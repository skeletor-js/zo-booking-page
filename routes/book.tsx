import { useState, useEffect, useCallback, useMemo } from "react";
import {
  Clock,
  Calendar,
  User,
  Mail,
  MessageSquare,
  Check,
  Globe,
} from "lucide-react";
import { config } from "../config";

const t = config.theme;

function getWeekdays(count: number) {
  const days: {
    date: string;
    dayName: string;
    dayNum: number;
    month: string;
  }[] = [];
  const now = new Date();
  const tzStr = now.toLocaleDateString("en-US", {
    timeZone: config.timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const [m, d, y] = tzStr.split("/").map(Number);
  const cursor = new Date(y, m - 1, d);
  while (days.length < count) {
    const dow = cursor.getDay();
    if (dow !== 0 && dow !== 6) {
      days.push({
        date: `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, "0")}-${String(cursor.getDate()).padStart(2, "0")}`,
        dayName: cursor.toLocaleDateString("en-US", { weekday: "short" }),
        dayNum: cursor.getDate(),
        month: cursor.toLocaleDateString("en-US", { month: "short" }),
      });
    }
    cursor.setDate(cursor.getDate() + 1);
  }
  return days;
}

function formatTime(iso: string, tz: string) {
  return new Date(iso).toLocaleTimeString("en-US", {
    timeZone: tz,
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

function getTimezoneLabel(tz: string) {
  try {
    const now = new Date();
    const short =
      now
        .toLocaleTimeString("en-US", { timeZone: tz, timeZoneName: "short" })
        .split(" ")
        .pop() || "";
    const offset =
      now
        .toLocaleTimeString("en-US", {
          timeZone: tz,
          timeZoneName: "longOffset",
        })
        .split("GMT")
        .pop() || "";
    const city = tz.split("/").pop()?.replace(/_/g, " ") || tz;
    return `${city} (${short}${offset ? ", GMT" + offset : ""})`;
  } catch {
    return tz;
  }
}

const COMMON_TIMEZONES = [
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Phoenix",
  "America/Los_Angeles",
  "America/Anchorage",
  "Pacific/Honolulu",
  "America/Toronto",
  "America/Vancouver",
  "America/Mexico_City",
  "America/Sao_Paulo",
  "America/Argentina/Buenos_Aires",
  "Europe/London",
  "Europe/Paris",
  "Europe/Berlin",
  "Europe/Amsterdam",
  "Europe/Madrid",
  "Europe/Rome",
  "Europe/Stockholm",
  "Europe/Moscow",
  "Africa/Cairo",
  "Africa/Johannesburg",
  "Africa/Lagos",
  "Asia/Dubai",
  "Asia/Kolkata",
  "Asia/Bangkok",
  "Asia/Singapore",
  "Asia/Shanghai",
  "Asia/Tokyo",
  "Asia/Seoul",
  "Australia/Sydney",
  "Australia/Melbourne",
  "Pacific/Auckland",
];

function getAllTimezones() {
  try {
    return Intl.supportedValuesOf("timeZone");
  } catch {
    return COMMON_TIMEZONES;
  }
}

export default function BookPage() {
  const weekdays = getWeekdays(config.weekdaysToShow);
  const [selectedDate, setSelectedDate] = useState(weekdays[0]?.date || "");
  const [duration, setDuration] = useState<15 | 30 | 60>(
    config.defaultDuration
  );
  const [allSlots, setAllSlots] = useState<{
    slots15: any[];
    slots30: any[];
    slots60: any[];
  } | null>(null);
  const [loading, setLoading] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<{
    start: string;
    end: string;
  } | null>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [company, setCompany] = useState("");
  const [topic, setTopic] = useState("");
  const [additionalAttendees, setAdditionalAttendees] = useState("");
  const [notes, setNotes] = useState("");
  const [bookingState, setBookingState] = useState<
    "idle" | "booking" | "success" | "error"
  >("idle");
  const [meetLink, setMeetLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [userTimezone, setUserTimezone] = useState(() => {
    try {
      return Intl.DateTimeFormat().resolvedOptions().timeZone;
    } catch {
      return config.timezone;
    }
  });
  const [showAllTimezones, setShowAllTimezones] = useState(false);

  const allTimezones = useMemo(() => getAllTimezones(), []);

  const timezoneOptions = useMemo(() => {
    const list = showAllTimezones ? allTimezones : COMMON_TIMEZONES;
    const detected = userTimezone;
    const filtered = list.filter((tz) => tz !== detected);
    return [detected, ...filtered];
  }, [showAllTimezones, allTimezones, userTimezone]);

  const displayedSlots = allSlots
    ? duration === 15
      ? allSlots.slots15
      : duration === 30
        ? allSlots.slots30
        : allSlots.slots60
    : [];

  const fetchSlots = useCallback(async (date: string) => {
    setLoading(true);
    setSelectedSlot(null);
    setAllSlots(null);
    setBookingState("idle");
    try {
      const resp = await fetch(`/api/booking/availability?date=${date}`, {
        headers: { Accept: "application/json" },
      });
      if (!resp.ok) throw new Error("fail");
      const data = await resp.json();
      setAllSlots({
        slots15: data.slots15 || [],
        slots30: data.slots30 || [],
        slots60: data.slots60 || [],
      });
    } catch {
      setAllSlots({ slots15: [], slots30: [], slots60: [] });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (selectedDate) fetchSlots(selectedDate);
  }, [selectedDate, fetchSlots]);

  useEffect(() => {
    setSelectedSlot(null);
  }, [duration]);

  const handleBook = async () => {
    if (!selectedSlot || !name.trim() || !email.trim()) return;
    setBookingState("booking");
    try {
      const extraEmails = additionalAttendees
        .split(/[,;\s]+/)
        .map((e) => e.trim())
        .filter((e) => e && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e));

      const resp = await fetch("/api/booking/book", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          start: selectedSlot.start,
          end: selectedSlot.end,
          name: name.trim(),
          email: email.trim(),
          company: company.trim() || undefined,
          topic: topic.trim() || undefined,
          additionalAttendees: extraEmails.length ? extraEmails : undefined,
          notes: notes.trim() || undefined,
        }),
      });
      if (!resp.ok) throw new Error("fail");
      const data = await resp.json();
      setMeetLink(data.meetLink || null);
      setBookingState("success");
    } catch {
      setBookingState("error");
    }
  };

  const handleCopyEmail = () => {
    if (!config.existingMeetingEmail) return;
    navigator.clipboard.writeText(config.existingMeetingEmail);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const selectedDateObj = weekdays.find((d) => d.date === selectedDate);

  const tzShortName = useMemo(() => {
    try {
      return (
        new Date()
          .toLocaleTimeString("en-US", {
            timeZone: userTimezone,
            timeZoneName: "short",
          })
          .split(" ")
          .pop() || userTimezone
      );
    } catch {
      return userTimezone;
    }
  }, [userTimezone]);

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap');
        * { box-sizing: border-box; }
        ::selection { background: ${t.selectionBg}; color: ${t.selectionFg}; }
        body {
          font-family: ${t.fontFamily};
          margin: 0;
          background: ${t.pageBg};
          color: ${t.text};
          -webkit-font-smoothing: antialiased;
        }
        select:focus { border-color: ${t.accent} !important; outline: none; }

        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(16px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .fade-up {
          animation: fadeUp 0.6s cubic-bezier(0.22, 1, 0.36, 1) forwards;
          opacity: 0;
        }

        @keyframes shimmer {
          0% { background-position: -200% 0; }
          100% { background-position: 200% 0; }
        }
        .skeleton-slot {
          height: 44px;
          border-radius: ${t.controlRadius}px;
          background: linear-gradient(90deg, ${t.cardBg} 25%, ${t.cardBorder} 50%, ${t.cardBg} 75%);
          background-size: 200% 100%;
          animation: shimmer 1.5s ease-in-out infinite;
        }

        .date-btn { transition: all 0.2s ease; }
        .date-btn:hover { border-color: ${t.accent}66 !important; }
        .slot-btn { transition: all 0.2s ease; }
        .slot-btn:hover { border-color: ${t.accent}66 !important; background: ${t.accent}14 !important; }
        .slot-btn.active:hover { background: ${t.accent} !important; }
        input:focus, textarea:focus { border-color: ${t.accent} !important; outline: none; }
        .cta-btn:hover:not(:disabled) { background: ${t.accentHover} !important; border-color: ${t.accentHover} !important; }

        .date-strip { display: flex; gap: 8px; overflow-x: auto; padding-bottom: 4px; -webkit-overflow-scrolling: touch; }
        .date-strip::-webkit-scrollbar { height: 0; }
        .slots-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; }
        .form-name-row { display: flex; gap: 14px; }

        @media (max-width: 480px) {
          .page-heading { font-size: 30px !important; }
          .page-container { padding: 32px 16px !important; }
          .inner-container { max-width: 100% !important; }
          .slots-grid { grid-template-columns: repeat(2, 1fr) !important; }
          .form-name-row { flex-direction: column !important; }
          .form-card { padding: 20px !important; }
          .success-card { padding: 28px !important; }
          .duration-toggle { flex-wrap: wrap; justify-content: center; }
          .duration-toggle button { padding: 8px 16px !important; font-size: 13px !important; }
          .date-btn { width: 64px !important; }
        }
      `}</style>

      <div
        className="page-container"
        style={{ minHeight: "100vh", padding: "48px 20px" }}
      >
        <div
          className="inner-container"
          style={{ maxWidth: 560, margin: "0 auto" }}
        >
          <div
            className="fade-up"
            style={{ textAlign: "center", marginBottom: 48 }}
          >
            <h1
              className="page-heading"
              style={{
                fontSize: 40,
                fontWeight: 700,
                color: t.text,
                marginBottom: 8,
                lineHeight: 1.1,
              }}
            >
              Book Time with {config.name}
            </h1>
            <p
              style={{
                color: t.textMuted,
                fontSize: 16,
                lineHeight: 1.5,
                margin: 0,
              }}
            >
              {config.tagline}
            </p>
          </div>

          {bookingState === "success" ? (
            <div
              className="fade-up success-card"
              style={{
                background: t.cardBg,
                border: `1px solid ${t.accent}26`,
                borderRadius: t.cardRadius,
                padding: 40,
                textAlign: "center",
              }}
            >
              <div
                style={{
                  width: 56,
                  height: 56,
                  borderRadius: "50%",
                  background: t.accent,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  margin: "0 auto 20px",
                }}
              >
                <Check size={28} color={t.accentFg} strokeWidth={2.5} />
              </div>
              <h2 style={{ fontSize: 28, fontWeight: 700, marginBottom: 8 }}>
                You're booked
              </h2>
              <p
                style={{ color: t.textMuted, fontSize: 15, marginBottom: 4 }}
              >
                {duration} minutes with {config.name} on{" "}
                {selectedDateObj
                  ? `${selectedDateObj.dayName}, ${selectedDateObj.month} ${selectedDateObj.dayNum}`
                  : selectedDate}
              </p>
              {selectedSlot && (
                <p
                  style={{
                    color: t.textMuted,
                    fontSize: 15,
                    marginBottom: 20,
                  }}
                >
                  {formatTime(selectedSlot.start, userTimezone)} {"\u2013"}{" "}
                  {formatTime(selectedSlot.end, userTimezone)} ({tzShortName})
                </p>
              )}
              {meetLink && (
                <a
                  href={meetLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    display: "inline-block",
                    padding: "10px 24px",
                    borderRadius: 999,
                    background: t.text,
                    color: t.pageBg,
                    fontSize: 14,
                    fontWeight: 500,
                    textDecoration: "none",
                    marginBottom: 16,
                    transition: "opacity 0.2s",
                  }}
                  onMouseOver={(e) =>
                    (e.currentTarget.style.opacity = "0.85")
                  }
                  onMouseOut={(e) => (e.currentTarget.style.opacity = "1")}
                >
                  Join Google Meet
                </a>
              )}
              <p style={{ color: t.textMuted, fontSize: 14 }}>
                A calendar invite has been sent to {email}.
              </p>
            </div>
          ) : (
            <>
              {/* Timezone selector */}
              <div
                className="fade-up"
                style={{ marginBottom: 24, animationDelay: "0.05s" }}
              >
                <div
                  style={{ display: "flex", alignItems: "center", gap: 10 }}
                >
                  <Globe size={15} color={t.textMuted} />
                  <select
                    value={userTimezone}
                    onChange={(e) => setUserTimezone(e.target.value)}
                    style={{
                      flex: 1,
                      padding: "8px 12px",
                      borderRadius: t.controlRadius,
                      border: `1px solid ${t.inputBorder}`,
                      background: t.inputBg,
                      color: t.text,
                      fontSize: 14,
                      fontFamily: t.fontFamily,
                      cursor: "pointer",
                      appearance: "none" as const,
                      WebkitAppearance: "none" as const,
                      backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%236b7280' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E")`,
                      backgroundRepeat: "no-repeat",
                      backgroundPosition: "right 12px center",
                      paddingRight: 32,
                    }}
                  >
                    {timezoneOptions.map((tz) => (
                      <option key={tz} value={tz}>
                        {getTimezoneLabel(tz)}
                      </option>
                    ))}
                  </select>
                  {!showAllTimezones && (
                    <button
                      onClick={() => setShowAllTimezones(true)}
                      style={{
                        background: "none",
                        border: "none",
                        color: t.accent,
                        fontSize: 12,
                        cursor: "pointer",
                        whiteSpace: "nowrap",
                        fontFamily: t.fontFamily,
                        padding: "4px 0",
                      }}
                    >
                      More
                    </button>
                  )}
                </div>
              </div>

              {/* Date picker */}
              <div
                className="fade-up"
                style={{ marginBottom: 32, animationDelay: "0.1s" }}
              >
                <label
                  style={{
                    fontSize: 12,
                    textTransform: "uppercase" as const,
                    letterSpacing: "0.1em",
                    color: t.textMuted,
                    display: "block",
                    marginBottom: 12,
                    fontWeight: 600,
                  }}
                >
                  Select a date
                </label>
                <div className="date-strip">
                  {weekdays.map((day) => {
                    const isSelected = day.date === selectedDate;
                    return (
                      <button
                        key={day.date}
                        className="date-btn"
                        onClick={() => setSelectedDate(day.date)}
                        style={{
                          flexShrink: 0,
                          width: 72,
                          padding: "12px 8px",
                          borderRadius: 12,
                          border: isSelected
                            ? `2px solid ${t.accent}`
                            : `1px solid ${t.cardBorder}`,
                          background: isSelected ? t.accent : t.cardBg,
                          color: isSelected ? t.accentFg : t.text,
                          cursor: "pointer",
                          textAlign: "center" as const,
                          fontFamily: t.fontFamily,
                        }}
                      >
                        <div style={{ fontSize: 11, opacity: 0.7, marginBottom: 2 }}>
                          {day.dayName}
                        </div>
                        <div
                          style={{
                            fontSize: 22,
                            fontWeight: 600,
                            lineHeight: 1.2,
                          }}
                        >
                          {day.dayNum}
                        </div>
                        <div style={{ fontSize: 11, opacity: 0.7, marginTop: 2 }}>
                          {day.month}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Duration toggle */}
              <div
                className="fade-up"
                style={{ marginBottom: 32, animationDelay: "0.2s" }}
              >
                <label
                  style={{
                    fontSize: 12,
                    textTransform: "uppercase" as const,
                    letterSpacing: "0.1em",
                    color: t.textMuted,
                    display: "block",
                    marginBottom: 12,
                    fontWeight: 600,
                  }}
                >
                  Duration
                </label>
                <div
                  className="duration-toggle"
                  style={{
                    display: "inline-flex",
                    background: t.cardBg,
                    borderRadius: 999,
                    padding: 3,
                    border: `1px solid ${t.cardBorder}`,
                  }}
                >
                  {config.durations.map((d) => (
                    <button
                      key={d}
                      onClick={() => setDuration(d)}
                      style={{
                        padding: "8px 20px",
                        borderRadius: 999,
                        border: "none",
                        background: duration === d ? t.accent : "transparent",
                        color: duration === d ? t.accentFg : t.textMuted,
                        fontSize: 14,
                        fontWeight: 500,
                        cursor: "pointer",
                        transition: "all 0.2s ease",
                        display: "flex",
                        alignItems: "center",
                        gap: 6,
                        fontFamily: t.fontFamily,
                      }}
                    >
                      <Clock size={14} />
                      {d} min
                    </button>
                  ))}
                </div>
              </div>

              {/* Time slots */}
              <div
                className="fade-up"
                style={{ marginBottom: 32, animationDelay: "0.3s" }}
              >
                <label
                  style={{
                    fontSize: 12,
                    textTransform: "uppercase" as const,
                    letterSpacing: "0.1em",
                    color: t.textMuted,
                    display: "block",
                    marginBottom: 12,
                    fontWeight: 600,
                  }}
                >
                  Available times ({tzShortName})
                </label>

                {loading ? (
                  <div className="slots-grid">
                    {Array.from({ length: 9 }).map((_, i) => (
                      <div
                        key={i}
                        className="skeleton-slot"
                        style={{ animationDelay: `${i * 0.08}s` }}
                      />
                    ))}
                  </div>
                ) : displayedSlots.length === 0 ? (
                  <div
                    style={{
                      padding: 48,
                      textAlign: "center" as const,
                      background: t.cardBg,
                      borderRadius: t.cardRadius,
                      border: `1px solid ${t.cardBorder}`,
                    }}
                  >
                    <Calendar
                      size={24}
                      color={t.textMuted}
                      style={{
                        margin: "0 auto 12px",
                        display: "block",
                      }}
                    />
                    <p
                      style={{ color: t.textMuted, fontSize: 14, margin: 0 }}
                    >
                      No {duration}-minute slots available on this day.
                    </p>
                  </div>
                ) : (
                  <div className="slots-grid">
                    {displayedSlots.map((slot: any) => {
                      const isSelected = selectedSlot?.start === slot.start;
                      return (
                        <button
                          key={slot.start}
                          className={`slot-btn ${isSelected ? "active" : ""}`}
                          onClick={() =>
                            setSelectedSlot(isSelected ? null : slot)
                          }
                          style={{
                            padding: "12px 8px",
                            borderRadius: t.controlRadius,
                            border: isSelected
                              ? `2px solid ${t.accent}`
                              : `1px solid ${t.cardBorder}`,
                            background: isSelected ? t.accent : t.cardBg,
                            color: isSelected ? t.accentFg : t.text,
                            fontSize: 14,
                            fontWeight: 500,
                            cursor: "pointer",
                            fontFamily: t.fontFamily,
                          }}
                        >
                          {formatTime(slot.start, userTimezone)}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Booking form */}
              {selectedSlot && (
                <div
                  className="fade-up form-card"
                  style={{
                    background: t.cardBg,
                    border: `1px solid ${t.accent}26`,
                    borderRadius: t.cardRadius,
                    padding: 28,
                    marginBottom: 32,
                  }}
                >
                  <label
                    style={{
                      fontSize: 12,
                      textTransform: "uppercase" as const,
                      letterSpacing: "0.1em",
                      color: t.textMuted,
                      display: "block",
                      marginBottom: 20,
                      fontWeight: 600,
                    }}
                  >
                    Your details
                  </label>

                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column" as const,
                      gap: 14,
                    }}
                  >
                    <div className="form-name-row">
                      <div style={{ position: "relative" as const, flex: 1 }}>
                        <User
                          size={16}
                          color={t.textMuted}
                          style={{
                            position: "absolute" as const,
                            left: 14,
                            top: 14,
                          }}
                        />
                        <input
                          type="text"
                          placeholder="Your name *"
                          value={name}
                          onChange={(e) => setName(e.target.value)}
                          style={{
                            width: "100%",
                            padding: "12px 12px 12px 40px",
                            borderRadius: t.controlRadius,
                            border: `1px solid ${t.inputBorder}`,
                            background: t.inputBg,
                            color: t.text,
                            fontSize: 15,
                            fontFamily: t.fontFamily,
                          }}
                        />
                      </div>
                      <div style={{ position: "relative" as const, flex: 1 }}>
                        <input
                          type="text"
                          placeholder="Company (optional)"
                          value={company}
                          onChange={(e) => setCompany(e.target.value)}
                          style={{
                            width: "100%",
                            padding: "12px 14px",
                            borderRadius: t.controlRadius,
                            border: `1px solid ${t.inputBorder}`,
                            background: t.inputBg,
                            color: t.text,
                            fontSize: 15,
                            fontFamily: t.fontFamily,
                          }}
                        />
                      </div>
                    </div>
                    <div style={{ position: "relative" as const }}>
                      <Mail
                        size={16}
                        color={t.textMuted}
                        style={{
                          position: "absolute" as const,
                          left: 14,
                          top: 14,
                        }}
                      />
                      <input
                        type="email"
                        placeholder="Your email *"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        style={{
                          width: "100%",
                          padding: "12px 12px 12px 40px",
                          borderRadius: t.controlRadius,
                          border: `1px solid ${t.inputBorder}`,
                          background: t.inputBg,
                          color: t.text,
                          fontSize: 15,
                          fontFamily: t.fontFamily,
                        }}
                      />
                    </div>
                    <div style={{ position: "relative" as const }}>
                      <input
                        type="text"
                        placeholder="Additional attendee emails, comma separated (optional)"
                        value={additionalAttendees}
                        onChange={(e) =>
                          setAdditionalAttendees(e.target.value)
                        }
                        style={{
                          width: "100%",
                          padding: "12px 14px",
                          borderRadius: t.controlRadius,
                          border: `1px solid ${t.inputBorder}`,
                          background: t.inputBg,
                          color: t.text,
                          fontSize: 15,
                          fontFamily: t.fontFamily,
                        }}
                      />
                    </div>
                    <div style={{ position: "relative" as const }}>
                      <input
                        type="text"
                        placeholder="What's this about? (optional)"
                        value={topic}
                        onChange={(e) => setTopic(e.target.value)}
                        style={{
                          width: "100%",
                          padding: "12px 14px",
                          borderRadius: t.controlRadius,
                          border: `1px solid ${t.inputBorder}`,
                          background: t.inputBg,
                          color: t.text,
                          fontSize: 15,
                          fontFamily: t.fontFamily,
                        }}
                      />
                    </div>
                    <div style={{ position: "relative" as const }}>
                      <MessageSquare
                        size={16}
                        color={t.textMuted}
                        style={{
                          position: "absolute" as const,
                          left: 14,
                          top: 14,
                        }}
                      />
                      <textarea
                        placeholder="Notes (optional)"
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        rows={3}
                        style={{
                          width: "100%",
                          padding: "12px 12px 12px 40px",
                          borderRadius: t.controlRadius,
                          border: `1px solid ${t.inputBorder}`,
                          background: t.inputBg,
                          color: t.text,
                          fontSize: 15,
                          resize: "vertical" as const,
                          fontFamily: t.fontFamily,
                        }}
                      />
                    </div>
                  </div>

                  <div
                    style={{
                      marginTop: 20,
                      display: "flex",
                      alignItems: "center",
                      gap: 16,
                      flexWrap: "wrap" as const,
                    }}
                  >
                    <button
                      className="cta-btn"
                      onClick={handleBook}
                      disabled={
                        !name.trim() ||
                        !email.trim() ||
                        bookingState === "booking"
                      }
                      style={{
                        padding: "12px 32px",
                        borderRadius: 999,
                        border: `2px solid ${t.accent}`,
                        background: t.accent,
                        color: t.accentFg,
                        fontSize: 15,
                        fontWeight: 600,
                        cursor:
                          !name.trim() ||
                          !email.trim() ||
                          bookingState === "booking"
                            ? "not-allowed"
                            : "pointer",
                        opacity: !name.trim() || !email.trim() ? 0.5 : 1,
                        transition: "all 0.2s ease",
                        fontFamily: t.fontFamily,
                      }}
                    >
                      {bookingState === "booking"
                        ? "Booking..."
                        : "Confirm Booking"}
                    </button>
                    <span style={{ color: t.textMuted, fontSize: 13 }}>
                      {formatTime(selectedSlot.start, userTimezone)}{" "}
                      {"\u2013"}{" "}
                      {formatTime(selectedSlot.end, userTimezone)},{" "}
                      {selectedDateObj
                        ? `${selectedDateObj.dayName} ${selectedDateObj.month} ${selectedDateObj.dayNum}`
                        : selectedDate}{" "}
                      ({tzShortName})
                    </span>
                  </div>

                  {bookingState === "error" && (
                    <p
                      style={{
                        color: "#dc2626",
                        fontSize: 14,
                        marginTop: 12,
                        marginBottom: 0,
                      }}
                    >
                      Something went wrong. Please try again.
                    </p>
                  )}
                </div>
              )}

              {/* Existing meeting section */}
              {config.existingMeetingEmail && (
                <div
                  style={{
                    background: t.cardBg,
                    border: `1px solid ${t.cardBorder}`,
                    borderRadius: t.cardRadius,
                    padding: 24,
                    marginBottom: 32,
                    textAlign: "center" as const,
                  }}
                >
                  <label
                    style={{
                      fontSize: 12,
                      textTransform: "uppercase" as const,
                      letterSpacing: "0.1em",
                      color: t.textMuted,
                      display: "block",
                      marginBottom: 10,
                      fontWeight: 600,
                    }}
                  >
                    Already have a meeting?
                  </label>
                  <p
                    style={{
                      color: t.textMuted,
                      fontSize: 14,
                      margin: "0 0 14px",
                      lineHeight: 1.5,
                    }}
                  >
                    Add {config.name} to your existing calendar event:
                  </p>
                  <button
                    onClick={handleCopyEmail}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 8,
                      padding: "10px 20px",
                      borderRadius: t.controlRadius,
                      border: `1px solid ${t.inputBorder}`,
                      background: t.inputBg,
                      color: t.text,
                      fontSize: 15,
                      fontWeight: 500,
                      cursor: "pointer",
                      fontFamily: t.fontFamily,
                      transition: "all 0.2s ease",
                    }}
                  >
                    <Mail size={15} color={t.accent} />
                    {config.existingMeetingEmail}
                    <span
                      style={{
                        fontSize: 12,
                        color: t.textMuted,
                        marginLeft: 4,
                      }}
                    >
                      {copied ? "Copied!" : "Click to copy"}
                    </span>
                  </button>
                </div>
              )}

              {/* Footer */}
              <div
                style={{
                  textAlign: "center" as const,
                  paddingTop: 32,
                  borderTop: `1px solid ${t.cardBorder}`,
                }}
              >
                {config.footerHandle && (
                  <span
                    style={{
                      fontSize: 12,
                      color: t.textMuted,
                      opacity: 0.5,
                      display: "block",
                    }}
                  >
                    {config.footerHandle}
                  </span>
                )}
                {config.footerText && (
                  <span
                    style={{
                      fontSize: 10,
                      color: t.textMuted,
                      opacity: 0.4,
                      display: "block",
                      marginTop: 4,
                    }}
                  >
                    {config.footerText}
                  </span>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}
