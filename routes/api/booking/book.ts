import type { Context } from "hono";
import { createSign } from "crypto";
import { config, getBookingCalendar } from "../../../config";

const SCOPES = ["https://www.googleapis.com/auth/calendar.events"];

let tokenCache: { token: string; exp: number } | null = null;

function base64url(data: string): string {
  return Buffer.from(data).toString("base64url");
}

async function getAccessToken(key: any): Promise<string> {
  if (tokenCache && Date.now() < tokenCache.exp) return tokenCache.token;

  const now = Math.floor(Date.now() / 1000);
  const header = base64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const payload = base64url(
    JSON.stringify({
      iss: key.client_email,
      scope: SCOPES.join(" "),
      aud: "https://oauth2.googleapis.com/token",
      iat: now,
      exp: now + 3600,
    })
  );

  const sign = createSign("RSA-SHA256");
  sign.update(`${header}.${payload}`);
  const signature = sign.sign(key.private_key, "base64url");

  const resp = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=${header}.${payload}.${signature}`,
  });

  if (!resp.ok) throw new Error(`Token exchange failed: ${resp.status}`);
  const data = (await resp.json()) as any;
  tokenCache = {
    token: data.access_token,
    exp: Date.now() + (data.expires_in - 60) * 1000,
  };
  return data.access_token;
}

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default async (c: Context) => {
  if (c.req.method === "OPTIONS") return c.text("", 204);

  let body: any;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Invalid JSON" }, 400);
  }

  const { start, end, name, email, company, topic, additionalAttendees, notes } =
    body;
  if (!start || !end || !name || !email) {
    return c.json({ error: "Required: start, end, name, email" }, 400);
  }
  if (!emailRegex.test(email)) {
    return c.json({ error: "Invalid email" }, 400);
  }

  const extras: string[] = [];
  if (Array.isArray(additionalAttendees)) {
    for (const e of additionalAttendees) {
      const trimmed = String(e).trim();
      if (trimmed && emailRegex.test(trimmed)) extras.push(trimmed);
    }
  }

  const keyJson = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
  if (!keyJson) return c.json({ error: "Server config error" }, 500);

  try {
    const key = JSON.parse(keyJson);
    const token = await getAccessToken(key);

    const safeName = String(name).slice(0, 100);
    const safeCompany = company ? String(company).slice(0, 100) : "";
    const safeTopic = topic ? String(topic).slice(0, 200) : "";
    const safeNotes = notes ? String(notes).slice(0, 500) : "";

    const title = `Meeting with ${safeName}${safeCompany ? ` (${safeCompany})` : ""}`;

    const descParts: string[] = [];
    descParts.push(
      `Booked by: ${safeName}${safeCompany ? ` / ${safeCompany}` : ""}`
    );
    descParts.push(`Email: ${email}`);
    if (safeTopic) descParts.push(`Topic: ${safeTopic}`);
    if (safeNotes) descParts.push(`Notes: ${safeNotes}`);
    if (extras.length)
      descParts.push(`Additional attendees: ${extras.join(", ")}`);
    descParts.push("", "Booked via Zo Booking Page");

    const allAttendees = [{ email }, ...extras.map((e) => ({ email: e }))];

    const calendarId = getBookingCalendar();
    const conferenceParam = config.createMeetLink
      ? "&conferenceDataVersion=1"
      : "";

    const eventBody: any = {
      summary: title,
      description: descParts.join("\n"),
      start: { dateTime: start, timeZone: config.timezone },
      end: { dateTime: end, timeZone: config.timezone },
      attendees: allAttendees,
    };

    if (config.createMeetLink) {
      eventBody.conferenceData = {
        createRequest: {
          requestId: `book-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          conferenceSolutionKey: { type: "hangoutsMeet" },
        },
      };
    }

    const eventResp = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events?sendUpdates=all${conferenceParam}`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(eventBody),
      }
    );

    if (!eventResp.ok) {
      const err = await eventResp.text();
      console.error("Calendar insert error:", err);
      return c.json({ error: "Booking failed" }, 502);
    }

    const event = (await eventResp.json()) as any;
    const meetLink = event.conferenceData?.entryPoints?.find(
      (ep: any) => ep.entryPointType === "video"
    )?.uri;

    return c.json({
      success: true,
      message: "Meeting booked successfully",
      eventId: event.id,
      meetLink: meetLink || null,
    });
  } catch (e) {
    console.error("Booking error:", e);
    return c.json({ error: "Booking failed" }, 502);
  }
};
