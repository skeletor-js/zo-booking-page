import type { Context } from "hono";
import { createSign } from "crypto";
import { config } from "../../../config";

const SCOPES = ["https://www.googleapis.com/auth/calendar.readonly"];

const cache = new Map<string, { data: any; ts: number }>();

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

type Block = { start: string; end: string };

function computeSlots(busy: Block[], date: string, duration: number): Block[] {
  const dayStart = new Date(
    `${date}T${String(config.businessHoursStart).padStart(2, "0")}:00:00${config.utcOffset}`
  );
  const dayEnd = new Date(
    `${date}T${String(config.businessHoursEnd).padStart(2, "0")}:00:00${config.utcOffset}`
  );
  const minNotice = Date.now() + config.minNoticeMs;

  const sorted = busy
    .map((b) => ({ start: new Date(b.start), end: new Date(b.end) }))
    .filter((b) => b.end > dayStart && b.start < dayEnd)
    .sort((a, b) => a.start.getTime() - b.start.getTime());

  const merged: { start: Date; end: Date }[] = [];
  for (const block of sorted) {
    const last = merged[merged.length - 1];
    if (last && block.start <= last.end) {
      last.end = new Date(Math.max(last.end.getTime(), block.end.getTime()));
    } else {
      merged.push({ start: new Date(block.start), end: new Date(block.end) });
    }
  }

  const slotMs = duration * 60 * 1000;
  const stepMs = (duration === 15 ? 15 : 30) * 60 * 1000;
  const slots: Block[] = [];
  let cursor = dayStart.getTime();

  for (const block of merged) {
    while (cursor + slotMs <= block.start.getTime()) {
      if (cursor > minNotice) {
        slots.push({
          start: new Date(cursor).toISOString(),
          end: new Date(cursor + slotMs).toISOString(),
        });
      }
      cursor += stepMs;
    }
    cursor = Math.max(cursor, block.end.getTime());
  }

  while (cursor + slotMs <= dayEnd.getTime()) {
    if (cursor > minNotice) {
      slots.push({
        start: new Date(cursor).toISOString(),
        end: new Date(cursor + slotMs).toISOString(),
      });
    }
    cursor += stepMs;
  }

  return slots;
}

export default async (c: Context) => {
  const date = c.req.query("date");
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return c.json({ error: "date parameter required (YYYY-MM-DD)" }, 400);
  }

  const d = new Date(`${date}T12:00:00${config.utcOffset}`);
  const dow = d.getDay();
  if (dow === 0 || dow === 6) {
    return c.json({ date, slots15: [], slots30: [], slots60: [] });
  }

  const cached = cache.get(date);
  if (config.cacheTtlMs > 0 && cached && Date.now() - cached.ts < config.cacheTtlMs) {
    return c.json(cached.data);
  }

  const keyJson = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
  if (!keyJson) return c.json({ error: "Server config error" }, 500);

  try {
    const key = JSON.parse(keyJson);
    const token = await getAccessToken(key);

    const timeMin = `${date}T${String(config.businessHoursStart).padStart(2, "0")}:00:00${config.utcOffset}`;
    const timeMax = `${date}T${String(config.businessHoursEnd).padStart(2, "0")}:00:00${config.utcOffset}`;

    const freeBusyResp = await fetch(
      "https://www.googleapis.com/calendar/v3/freeBusy",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          timeMin,
          timeMax,
          timeZone: config.timezone,
          items: config.calendars.map((id) => ({ id })),
        }),
      }
    );

    if (!freeBusyResp.ok) {
      const err = await freeBusyResp.text();
      console.error("FreeBusy API error:", err);
      return c.json({ error: "Calendar query failed" }, 502);
    }

    const fbData = (await freeBusyResp.json()) as any;
    const allBusy: Block[] = [];
    for (const calId of config.calendars) {
      const cal = fbData.calendars?.[calId];
      if (cal?.busy) {
        allBusy.push(...cal.busy);
      }
      if (cal?.errors) {
        console.error(`Calendar ${calId} errors:`, cal.errors);
      }
    }

    const data = {
      date,
      slots15: computeSlots(allBusy, date, 15),
      slots30: computeSlots(allBusy, date, 30),
      slots60: computeSlots(allBusy, date, 60),
    };

    if (config.cacheTtlMs > 0) {
      cache.set(date, { data, ts: Date.now() });
    }
    return c.json(data);
  } catch (e) {
    console.error("Availability error:", e);
    return c.json({ error: "Calendar query failed" }, 502);
  }
};
