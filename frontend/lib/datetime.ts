import { format } from "date-fns"

/**
 * Reads HH:mm straight out of the ISO string instead of converting to the
 * browser's timezone. The API already renders timestamps in the application
 * timezone, so every client shows the same wall-clock time as the day window
 * the meeting was listed under.
 */
export function formatTime(iso: string): string {
  const match = /T(\d{2}):(\d{2})/.exec(iso)
  return match ? `${match[1]}:${match[2]}` : iso
}

export function formatTimeRange(startsAt: string, endsAt: string): string {
  return `${formatTime(startsAt)} – ${formatTime(endsAt)}`
}

export function formatLongDate(isoDate: string): string {
  return format(parseIsoDay(isoDate), "EEEE, d MMMM yyyy")
}

/** The calendar day of an API timestamp, read from the string like formatTime does. */
export function parseIsoDay(iso: string): Date {
  const [year, month, day] = iso.slice(0, 10).split("-").map(Number)
  return new Date(year, month - 1, day)
}

export function formatDuration(startsAt: string, endsAt: string): string {
  const minutes = Math.round((Date.parse(endsAt) - Date.parse(startsAt)) / 60_000)
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  if (hours === 0) return `${rest} min`
  return rest === 0 ? `${hours} h` : `${hours} h ${rest} min`
}

export function toIsoDate(date: Date): string {
  return format(date, "yyyy-MM-dd")
}

/**
 * Combines a calendar date and an HH:mm time into an ISO string carrying the
 * browser's UTC offset, which the API requires.
 */
export function toIsoWithOffset(date: Date, time: string): string {
  const [hours, minutes] = time.split(":").map(Number)
  const combined = new Date(date)
  combined.setHours(hours, minutes, 0, 0)
  return format(combined, "yyyy-MM-dd'T'HH:mm:ssXXX")
}

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]!.toUpperCase())
    .join("")
}

export type MeetingStatus = "past" | "live" | "upcoming"

/** Determine whether a meeting has already ended, is currently active, or is upcoming. */
export function getMeetingStatus(startsAt: string, endsAt: string): MeetingStatus {
  const now = Date.now()
  const start = new Date(startsAt).getTime()
  const end = new Date(endsAt).getTime()

  if (now > end) return "past"
  if (now >= start && now <= end) return "live"
  return "upcoming"
}

/** Human-readable relative description of when the meeting happened or will happen. */
export function formatRelativeMeetingTime(startsAt: string, endsAt: string): string {
  const now = Date.now()
  const start = new Date(startsAt).getTime()
  const end = new Date(endsAt).getTime()

  if (now > end) {
    const diffMin = Math.round((now - end) / 60_000)
    if (diffMin < 1) return "Just ended"
    if (diffMin < 60) return `Ended ${diffMin}m ago`
    const hours = Math.floor(diffMin / 60)
    if (hours < 24) return `Ended ${hours}h ago`
    const days = Math.floor(hours / 24)
    return `Ended ${days}d ago`
  }

  if (now >= start && now <= end) {
    const remainingMin = Math.max(1, Math.round((end - now) / 60_000))
    return `Ends in ${remainingMin}m`
  }

  const untilMin = Math.round((start - now) / 60_000)
  if (untilMin < 1) return "Starting now"
  if (untilMin < 60) return `Starts in ${untilMin}m`
  const hours = Math.floor(untilMin / 60)
  if (hours < 24) return `Starts in ${hours}h`
  const days = Math.floor(hours / 24)
  return `Starts in ${days}d`
}

/** Format full human readable date and time stamp, e.g. "8 Oct 2026, 10:00" */
export function formatDateTimeStamp(iso: string): string {
  try {
    const d = new Date(iso)
    if (Number.isNaN(d.getTime())) return iso
    return format(d, "d MMM yyyy, HH:mm")
  } catch {
    return iso
  }
}

/** Check if location string is or contains a virtual meeting link (Meet, Zoom, Teams, Webex, URL) */
export function isCallUrl(location: string | null | undefined): boolean {
  if (!location) return false
  const trimmed = location.trim()
  if (/^https?:\/\//i.test(trimmed)) return true
  return /(?:zoom\.us|meet\.google\.com|teams\.microsoft\.com|teams\.live\.com|webex\.com|whereby\.com)/i.test(
    trimmed,
  )
}

/** Extract full clickable URL from a location string */
export function extractCallUrl(location: string | null | undefined): string | null {
  if (!location) return null
  const trimmed = location.trim()
  const match = trimmed.match(/https?:\/\/[^\s]+/i)
  if (match) return match[0]
  if (
    /(?:zoom\.us|meet\.google\.com|teams\.microsoft\.com|teams\.live\.com|webex\.com|whereby\.com)/i.test(
      trimmed,
    )
  ) {
    return `https://${trimmed}`
  }
  return null
}

/** Compute elapsed progress percentage (0-100) and remaining minutes for a live meeting */
export function getMeetingProgress(
  startsAt: string,
  endsAt: string,
): { percent: number; remainingMinutes: number; elapsedMinutes: number } {
  const now = Date.now()
  const start = new Date(startsAt).getTime()
  const end = new Date(endsAt).getTime()
  const totalDuration = Math.max(1, end - start)
  const elapsed = Math.max(0, now - start)
  const percent = Math.min(100, Math.max(0, Math.round((elapsed / totalDuration) * 100)))
  const remainingMinutes = Math.max(0, Math.round((end - now) / 60_000))
  const elapsedMinutes = Math.round(elapsed / 60_000)
  return { percent, remainingMinutes, elapsedMinutes }
}

/** True if meeting starts within 15 minutes from now */
export function isStartingSoon(startsAt: string): boolean {
  const now = Date.now()
  const start = new Date(startsAt).getTime()
  const diffMin = (start - now) / 60_000
  return diffMin > 0 && diffMin <= 15
}

/**
 * Returns wall-clock minutes from midnight (0..1439) for this ISO timestamp.
 * Reads the time directly so it matches the displayed schedule.
 */
export function timeToMinutes(iso: string): number {
  const timeStr = formatTime(iso)
  const [h, m] = timeStr.split(":").map(Number)
  if (isNaN(h) || isNaN(m)) return 0
  return h * 60 + m
}

export function formatHourLabel(hour: number): string {
  return `${String(hour).padStart(2, "0")}:00`
}

export function addDays(date: Date, amount: number): Date {
  const result = new Date(date)
  result.setDate(result.getDate() + amount)
  return result
}

export function subDays(date: Date, amount: number): Date {
  return addDays(date, -amount)
}

export function isSameDay(d1: Date, d2: Date): boolean {
  return (
    d1.getFullYear() === d2.getFullYear() &&
    d1.getMonth() === d2.getMonth() &&
    d1.getDate() === d2.getDate()
  )
}

export function isToday(date: Date): boolean {
  return isSameDay(date, new Date())
}

