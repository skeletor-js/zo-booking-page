# Zo Booking Page

A self-hosted booking page for [Zo Computer](https://zocomputer.com). Visitors pick a date, duration, and time slot, then book directly onto your Google Calendar with an auto-generated Google Meet link.

No database. No third-party scheduling service. Just three zo.space routes and a Google Cloud service account.

## Features

- Real-time availability from one or more Google Calendars (FreeBusy API)
- 15, 30, and 60 minute durations (configurable)
- Automatic Google Meet link generation
- Visitor timezone detection with full IANA timezone selector
- Calendar invites sent to all attendees
- Additional attendee support
- Availability caching (configurable TTL)
- Fully responsive (mobile + desktop)
- Single config file for all customization (name, colors, hours, calendars, etc.)

## Project Structure

```
zo-booking-page/
  config.ts                          # All configuration lives here
  routes/
    book.tsx                         # Page route — the booking UI
    api/booking/
      availability.ts               # API route — queries Google Calendar FreeBusy
      book.ts                        # API route — creates calendar events
```

## Setup

### 1. Google Cloud Console Setup

You need a Google Cloud service account with Calendar API access. This lets the booking page read your availability and create events without requiring visitors to authenticate.

#### Create a project and enable the Calendar API

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Click the project dropdown at the top and select **New Project**
3. Name it something like `zo-booking` and click **Create**
4. Once the project is created, make sure it is selected in the project dropdown
5. Go to **APIs & Services > Library** (or search "Calendar API" in the top search bar)
6. Find **Google Calendar API** and click **Enable**

#### Create a service account

1. Go to **APIs & Services > Credentials**
2. Click **+ Create Credentials > Service account**
3. Give it a name like `zo-booking` and click **Create and Continue**
4. Skip the optional roles and permissions steps — click **Done**
5. You will see the new service account in the credentials list. Click on it.
6. Go to the **Keys** tab
7. Click **Add Key > Create new key**
8. Choose **JSON** and click **Create**
9. A JSON file will download. This is your service account key. Keep it safe.

#### Share your calendar(s) with the service account

The service account needs read access to check availability, and write access to create events.

1. Open the downloaded JSON key file and find the `client_email` field (it looks like `zo-booking@your-project.iam.gserviceaccount.com`)
2. Go to [Google Calendar](https://calendar.google.com)
3. For each calendar you want to check availability against:
   - Click the three dots next to the calendar name > **Settings and sharing**
   - Scroll to **Share with specific people or groups**
   - Click **+ Add people and groups**
   - Paste the service account `client_email`
   - Set permission to **See all event details** (for availability checking)
4. For the calendar where events should be created (usually your primary calendar):
   - Set permission to **Make changes to events** instead

> **Important:** The calendar ID for your primary Google Calendar is usually your email address (e.g., `you@gmail.com`). For other calendars, find the Calendar ID in Calendar Settings > Integrate calendar.

### 2. Configure the booking page

Open `config.ts` and update the values:

```typescript
export const config = {
  name: "Your Name",
  email: "you@example.com",
  timezone: "America/New_York",
  utcOffset: "-05:00",
  businessHoursStart: 9,
  businessHoursEnd: 17,
  calendars: ["you@gmail.com"],        // Calendar IDs to check
  // ... theme colors, durations, etc.
};
```

Key fields to change:
- **`name`** — displayed in the heading and confirmation
- **`email`** / **`existingMeetingEmail`** — your contact email
- **`timezone`** / **`utcOffset`** — your business timezone
- **`calendars`** — array of Google Calendar IDs to check for conflicts
- **`bookingCalendar`** — which calendar to create events on (defaults to first in `calendars`)
- **`theme`** — colors, border radius, font stack

### 3. Deploy to zo.space

#### Add the service account key as a secret

1. In your Zo Computer, go to **Settings > Advanced**
2. In the **Secrets** area, add a new secret:
   - **Name:** `GOOGLE_SERVICE_ACCOUNT_KEY`
   - **Value:** Paste the entire contents of the JSON key file you downloaded

#### Create the routes

You can deploy by creating three zo.space routes. Use the Zo chat or API to create them:

**Page route** — path: `/book`, type: `page`
Copy the contents of `routes/book.tsx`

**Availability API** — path: `/api/booking/availability`, type: `api`
Copy the contents of `routes/api/booking/availability.ts`

**Booking API** — path: `/api/booking/book`, type: `api`
Copy the contents of `routes/api/booking/book.ts`

> **Tip:** You can also ask your Zo AI assistant to deploy these routes for you: "Deploy the booking page from the zo-booking-page repo."

### 4. Make it public

By default, new zo.space pages are private. To make the booking page accessible to visitors:

- Set the `/book` page route to **public**
- The API routes are always publicly accessible (they are API routes)

Your booking page will be live at `https://<your-handle>.zo.space/book`.

## Customization

### Theme

All visual styling is driven by `config.theme`. You can match your brand:

```typescript
theme: {
  pageBg: "#0f172a",          // dark background
  text: "#f8fafc",            // light text
  textMuted: "#94a3b8",
  accent: "#6366f1",          // indigo accent
  accentHover: "#4f46e5",
  accentFg: "#ffffff",
  cardBg: "rgba(30, 41, 59, 0.8)",
  cardBorder: "rgba(255, 255, 255, 0.08)",
  inputBg: "#1e293b",
  inputBorder: "rgba(255, 255, 255, 0.12)",
  selectionBg: "#6366f1",
  selectionFg: "#ffffff",
  cardRadius: 16,
  controlRadius: 10,
  fontFamily: "'Inter', system-ui, sans-serif",
}
```

### Durations

Change which durations are offered:

```typescript
durations: [30, 60] as const,    // only 30 and 60 minute meetings
defaultDuration: 30,
```

### Multiple calendars

Check availability across multiple calendars but book onto one:

```typescript
calendars: ["work@company.com", "personal@gmail.com"],
bookingCalendar: "work@company.com",
```

### Disable Google Meet

```typescript
createMeetLink: false,
```

### Hide "Already have a meeting?" section

```typescript
existingMeetingEmail: null,
```

## How It Works

1. **Visitor loads the page** — the frontend renders a date picker for the next N weekdays
2. **Visitor picks a date** — the page calls `/api/booking/availability?date=YYYY-MM-DD`
3. **Availability API** — authenticates with Google using the service account, calls the Calendar FreeBusy API across all configured calendars, computes available slots for each duration, and returns them
4. **Visitor picks a slot and fills in details** — name, email, optional company/topic/notes/extra attendees
5. **Visitor confirms** — the page POSTs to `/api/booking/book`
6. **Booking API** — creates a Google Calendar event with a Google Meet link, sends invites to all attendees, and returns the Meet link to the page
7. **Success screen** — shows confirmation with a "Join Google Meet" button

## Requirements

- A [Zo Computer](https://zocomputer.com) account
- A Google Cloud project with Calendar API enabled
- A Google Cloud service account with calendar access

## License

MIT
