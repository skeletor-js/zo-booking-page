// ============================================================
// Zo Booking Page — Configuration
// ============================================================
// Customize everything here. All three routes (page, availability
// API, booking API) read from this single config file.
// ============================================================

export const config = {
  // --- Identity ---
  name: "Your Name",
  email: "you@example.com",
  tagline: "Pick a date, choose your duration, and find a time that works.",

  // --- Scheduling ---
  timezone: "America/New_York",
  // UTC offset string matching your timezone (used for date math).
  // Examples: "-05:00" (EST), "-08:00" (PST), "+00:00" (UTC), "+01:00" (CET)
  utcOffset: "-05:00",
  businessHoursStart: 9, // 24h format
  businessHoursEnd: 17,
  // Minimum notice in milliseconds before a slot is bookable.
  // Default: 1 hour. Set to 0 to allow immediate bookings.
  minNoticeMs: 60 * 60 * 1000,
  // Durations offered to visitors (minutes). Supported: 15, 30, 60.
  durations: [15, 30, 60] as const,
  defaultDuration: 30 as 15 | 30 | 60,
  // How many weekdays to show in the date picker.
  weekdaysToShow: 10,

  // --- Google Calendar ---
  // Calendar IDs to check for conflicts (FreeBusy).
  // The first calendar is also where new events are created.
  calendars: ["you@example.com"],
  // The calendar ID where booked events are inserted.
  // Defaults to the first entry in `calendars` above.
  bookingCalendar: "",

  // --- Availability cache ---
  // How long (ms) to cache FreeBusy results. 0 = no cache.
  cacheTtlMs: 3 * 60 * 1000,

  // --- Google Meet ---
  // Automatically create a Google Meet link for each booking.
  createMeetLink: true,

  // --- Theme ---
  // Colors use a simple token system. Override any value.
  theme: {
    // Page background
    pageBg: "#f8f9fa",
    // Primary text
    text: "#1a1a1a",
    // Secondary / muted text
    textMuted: "#6b7280",
    // Accent color (buttons, selection, active states)
    accent: "#2563eb",
    // Accent hover
    accentHover: "#1d4ed8",
    // Accent foreground (text on accent bg)
    accentFg: "#ffffff",
    // Card / panel background
    cardBg: "rgba(243, 244, 246, 0.6)",
    // Card border
    cardBorder: "rgba(0, 0, 0, 0.08)",
    // Input background
    inputBg: "#ffffff",
    // Input border
    inputBorder: "rgba(0, 0, 0, 0.12)",
    // Selection highlight
    selectionBg: "#2563eb",
    selectionFg: "#ffffff",
    // Border radius for cards (px)
    cardRadius: 16,
    // Border radius for buttons/inputs (px)
    controlRadius: 10,
    // Font stack
    fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
  },

  // --- "Already have a meeting?" section ---
  // Set to null to hide this section entirely.
  existingMeetingEmail: "you@example.com" as string | null,

  // --- Footer ---
  footerText: "built with zo",
  footerHandle: "", // e.g. your zo handle or brand name
};

// Resolved booking calendar (falls back to first calendar).
export function getBookingCalendar(): string {
  return config.bookingCalendar || config.calendars[0] || "";
}
