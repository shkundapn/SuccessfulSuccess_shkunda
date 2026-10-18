import { signOut } from "aws-amplify/auth"

import { getAccessToken } from "@/lib/auth"
import type {
  AgendaSaveInput,
  ApiErrorBody,
  ApiErrorDetail,
  Meeting,
  MeetingCreateInput,
  MeetingList,
  ParsedAgenda,
  UserProfile,
} from "@/lib/types"

export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ||
  "https://omp54u5dee63qjrnyqz74wo42y0brxmp.lambda-url.us-east-1.on.aws"

export class ApiError extends Error {
  readonly code: string
  readonly details: ApiErrorDetail[]
  readonly status: number

  constructor(status: number, code: string, message: string, details: ApiErrorDetail[]) {
    super(message)
    this.name = "ApiError"
    this.status = status
    this.code = code
    this.details = details
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const token = await getAccessToken()
  let response: Response
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...init?.headers,
      },
      cache: "no-store",
    })
  } catch {
    throw new ApiError(0, "network_error", "Could not reach the meetings API.", [])
  }

  // The session is gone or was revoked: sign out, and the auth guard sends the
  // user back to the login page.
  if (response.status === 401) {
    void signOut()
  }

  if (response.status === 204) {
    return undefined as T
  }

  const text = await response.text()
  const payload = text ? JSON.parse(text) : null

  if (!response.ok) {
    const body = payload as ApiErrorBody | null
    throw new ApiError(
      response.status,
      body?.error?.code ?? "internal_error",
      body?.error?.message ?? `Request failed with status ${response.status}.`,
      body?.error?.details ?? [],
    )
  }

  return payload as T
}

export function listMeetings(params: { date?: string; q?: string } = {}) {
  const search = new URLSearchParams()
  if (params.date) search.set("date", params.date)
  if (params.q) search.set("q", params.q)
  const query = search.toString()
  return request<MeetingList>(`/api/v1/meetings${query ? `?${query}` : ""}`)
}

export function getMeeting(id: string) {
  return request<Meeting>(`/api/v1/meetings/${id}`)
}

export function createMeeting(payload: MeetingCreateInput) {
  return request<Meeting>("/api/v1/meetings", {
    method: "POST",
    body: JSON.stringify(payload),
  })
}

export function updateMeeting(id: string, payload: MeetingCreateInput) {
  return request<Meeting>(`/api/v1/meetings/${id}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  })
}

export function deleteMeeting(id: string) {
  return request<void>(`/api/v1/meetings/${id}`, { method: "DELETE" })
}

export function getMe() {
  return request<UserProfile>("/api/v1/me")
}

/** Stores the profile from the ID token in the users table; call after signing in. */
export function syncMe(idToken: string) {
  return request<UserProfile>("/api/v1/me/sync", {
    method: "POST",
    body: JSON.stringify({ id_token: idToken }),
  })
}

export type ReportWeekOption = {
  week: string
  label: string
  start_date: string
  end_date: string
  is_current: boolean
  is_last: boolean
}

export type ReportPreview = {
  week: string
  period: string
  start_date: string
  end_date: string
  meetings_count: number
  duration_hours: number
  prev_week: string
  prev_meetings_count: number
  prev_duration_hours: number
  delta_count: number
  delta_hours: number
  unique_participants_count: number
  meetings: Array<{
    id: string
    name: string
    starts_at: string
    ends_at: string
    duration_min: number
    participants_count: number
    participants: string[]
  }>
}

export function getReportWeeks() {
  return request<ReportWeekOption[]>("/api/v1/reports/weeks")
}

export function getReportPreview(week?: string) {
  const query = week ? `?week=${encodeURIComponent(week)}` : ""
  return request<ReportPreview>(`/api/v1/reports/preview${query}`)
}

export function requestWeeklyReport(payload?: { week?: string; recipient?: string }) {
  return request<{ status: string; message_id?: string; week?: string; recipient?: string }>(
    "/api/v1/reports/request",
    {
      method: "POST",
      body: JSON.stringify(payload ?? {}),
    },
  )
}

export const AGENDA_PARSER_URL =
  process.env.NEXT_PUBLIC_AGENDA_PARSER_URL || ""

export async function parseAgenda(
  text: string,
  today: string,
  tz: string,
  signal?: AbortSignal,
): Promise<{
  agenda: ParsedAgenda
  model: string
  prompt_version: string
  cost_usd?: number
  latency_ms?: number
}> {
  const token = await getAccessToken()
  const url = AGENDA_PARSER_URL || `${API_BASE_URL}/api/v1/ai/parse-agenda`
  let response: Response
  try {
    response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ text, today, tz }),
      signal,
    })
  } catch (err: unknown) {
    if (err instanceof Error && err.name === "AbortError") {
      throw err
    }
    throw new ApiError(0, "network_error", "Could not reach the agenda parser service.", [])
  }

  if (response.status === 401) {
    void signOut()
  }

  const textResp = await response.text()
  const payload = textResp ? JSON.parse(textResp) : null

  if (!response.ok) {
    const errorMsg = payload?.error ?? `Parsing failed with status ${response.status}.`
    throw new ApiError(response.status, "parser_error", errorMsg, [])
  }

  return payload
}

export function saveMeetingAgenda(
  meetingId: string,
  payload: AgendaSaveInput,
): Promise<Meeting> {
  return request<Meeting>(`/api/v1/meetings/${meetingId}/agenda`, {
    method: "POST",
    body: JSON.stringify(payload),
  })
}

