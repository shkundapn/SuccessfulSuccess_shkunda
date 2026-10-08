"use client"

import { AlertCircle, CalendarDays, CalendarPlus, CheckCircle2, Clock, History, Sparkles } from "lucide-react"

import { MeetingCard } from "@/components/meeting-card"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { useMeetings } from "@/hooks/use-meetings"
import { getMeetingStatus } from "@/lib/datetime"
import type { Meeting } from "@/lib/types"

const GRID = "grid gap-4 sm:grid-cols-2 lg:grid-cols-3"

/** Shown while the first request for the day's meetings is in flight. */
function LoadingScreen() {
  return (
    <div role="status" aria-live="polite" className="space-y-8">
      <div className="flex flex-col items-center gap-4 py-6 text-center">
        <span className="relative flex size-16 items-center justify-center">
          <span
            className="absolute inset-0 animate-spin rounded-full [animation-duration:1.4s]"
            style={{
              background:
                "conic-gradient(from 0deg, var(--canva-teal), var(--canva-blue), var(--canva-violet), var(--canva-pink), transparent 85%)",
              mask: "radial-gradient(farthest-side, transparent calc(100% - 5px), #000 calc(100% - 4px))",
            }}
            aria-hidden
          />
          <span
            className="flex size-11 animate-pulse items-center justify-center rounded-full text-white"
            style={{
              backgroundImage:
                "linear-gradient(135deg, var(--canva-teal), var(--canva-blue) 45%, var(--canva-violet))",
            }}
            aria-hidden
          >
            <CalendarDays className="size-5" />
          </span>
        </span>
        <div>
          <p className="text-lg font-bold">Loading your meetings…</p>
          <p className="text-muted-foreground text-sm">Fetching today&apos;s schedule.</p>
        </div>
      </div>

      <div className={GRID} aria-hidden>
        {[0, 1, 2, 3, 4, 5].map((index) => (
          <Card key={index}>
            <CardContent className="space-y-3 py-6">
              <Skeleton className="h-6 w-28 rounded-full" />
              <Skeleton className="h-6 w-2/3" />
              <Skeleton className="h-4 w-full" />
              <div className="flex -space-x-2 pt-1">
                {[0, 1, 2].map((avatar) => (
                  <Skeleton key={avatar} className="ring-card size-8 rounded-full ring-2" />
                ))}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}

export function MeetingList({
  meetings: customMeetings,
  isPending: customPending,
  isError: customError,
  error: customErrObj,
  onRetry,
  windowTab = "all",
  onCreate,
  onView,
  onEdit,
  onDelete,
}: {
  meetings?: Meeting[]
  isPending?: boolean
  isError?: boolean
  error?: unknown
  onRetry?: () => void
  windowTab?: "all" | "upcoming" | "past"
  onCreate: () => void
  onView: (meeting: Meeting) => void
  onEdit: (meeting: Meeting) => void
  onDelete: (meeting: Meeting) => void
}) {
  const query = useMeetings()

  const isPending = customPending !== undefined ? customPending : query.isPending
  const isError = customError !== undefined ? customError : query.isError
  const error = customErrObj !== undefined ? customErrObj : query.error
  const refetch = onRetry ?? query.refetch
  const items = customMeetings !== undefined ? customMeetings : (query.data?.items ?? [])

  if (isPending) {
    return <LoadingScreen />
  }

  if (isError) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="size-4" aria-hidden />
        <AlertTitle>Could not load meetings</AlertTitle>
        <AlertDescription className="flex flex-col items-start gap-3">
          <span>{error instanceof Error ? error.message : "Unknown error."}</span>
          <Button size="sm" variant="outline" onClick={() => refetch()}>
            Retry
          </Button>
        </AlertDescription>
      </Alert>
    )
  }

  if (items.length === 0) {
    return (
      <Card className="border-2 border-dashed border-border bg-card/60 shadow-none">
        <CardContent className="flex flex-col items-center gap-4 py-16 text-center">
          <span
            className="flex size-14 items-center justify-center rounded-full text-white"
            style={{
              backgroundImage:
                "linear-gradient(135deg, var(--canva-teal), var(--canva-blue) 45%, var(--canva-violet))",
            }}
          >
            <CalendarPlus className="size-6" aria-hidden />
          </span>
          <div>
            <p className="text-lg font-bold">No meetings found</p>
            <p className="text-muted-foreground text-sm">
              Your day is clear or no meetings matched your filters. Schedule something when you are ready.
            </p>
          </div>
          <Button onClick={onCreate}>Schedule one</Button>
        </CardContent>
      </Card>
    )
  }

  const upcomingMeetings = items.filter(
    (m) => getMeetingStatus(m.starts_at, m.ends_at) !== "past"
  )
  const pastMeetings = items.filter(
    (m) => getMeetingStatus(m.starts_at, m.ends_at) === "past"
  )

  // Dedicated window for upcoming / active meetings only
  if (windowTab === "upcoming") {
    if (upcomingMeetings.length === 0) {
      return (
        <Card className="border-2 border-dashed border-border bg-card/60 shadow-none">
          <CardContent className="flex flex-col items-center gap-4 py-16 text-center">
            <span className="flex size-14 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="size-7" />
            </span>
            <div>
              <p className="text-lg font-bold">No upcoming meetings remaining today</p>
              <p className="text-muted-foreground text-sm max-w-md">
                All meetings scheduled for earlier today have concluded. You can check the Past Meetings window or schedule a new one.
              </p>
            </div>
            <Button onClick={onCreate}>Schedule a new meeting</Button>
          </CardContent>
        </Card>
      )
    }

    return (
      <div className={GRID}>
        {upcomingMeetings.map((meeting, index) => (
          <MeetingCard
            key={meeting.id}
            meeting={meeting}
            index={index}
            onView={onView}
            onEdit={onEdit}
            onDelete={onDelete}
          />
        ))}
      </div>
    )
  }

  // Dedicated window for past meetings only
  if (windowTab === "past") {
    if (pastMeetings.length === 0) {
      return (
        <Card className="border-2 border-dashed border-border bg-card/60 shadow-none">
          <CardContent className="flex flex-col items-center gap-4 py-16 text-center">
            <span className="flex size-14 items-center justify-center rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400">
              <History className="size-7" />
            </span>
            <div>
              <p className="text-lg font-bold">No past meetings yet today</p>
              <p className="text-muted-foreground text-sm max-w-md">
                As meetings conclude during the day, they will automatically appear in this past meetings archive window.
              </p>
            </div>
          </CardContent>
        </Card>
      )
    }

    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between border-b border-border/60 pb-3">
          <div className="flex items-center gap-2">
            <History className="size-4 text-muted-foreground" />
            <h2 className="text-lg font-bold tracking-tight">Past Meetings (Concluded Today)</h2>
            <span className="rounded-full border border-border bg-muted px-2.5 py-0.5 text-xs font-semibold tabular-nums text-muted-foreground">
              {pastMeetings.length}
            </span>
          </div>
          <span className="text-xs text-muted-foreground">All meetings are preserved with exact timestamps</span>
        </div>
        <div className={GRID}>
          {pastMeetings.map((meeting, index) => (
            <MeetingCard
              key={meeting.id}
              meeting={meeting}
              index={index}
              onView={onView}
              onEdit={onEdit}
              onDelete={onDelete}
            />
          ))}
        </div>
      </div>
    )
  }

  // "all" window tab: displays separate distinct windows for Upcoming and Past
  return (
    <div className="space-y-10">
      {/* Window 1: Upcoming & Live Meetings */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="size-4 text-primary" />
            <h2 className="text-xl font-bold tracking-tight">Active & Upcoming Today</h2>
            <span className="tint-violet rounded-full px-2.5 py-0.5 text-xs font-semibold tabular-nums">
              {upcomingMeetings.length}
            </span>
          </div>
          {upcomingMeetings.length > 0 ? (
            <Button size="sm" variant="outline" onClick={onCreate}>
              <Clock className="mr-1.5 size-3.5" />
              Add upcoming
            </Button>
          ) : null}
        </div>

        {upcomingMeetings.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border/80 bg-card/40 p-6 text-center">
            <p className="text-sm font-medium">All meetings for earlier today have concluded.</p>
            <p className="text-muted-foreground mt-1 text-xs">
              Check the separate Past Meetings window below or schedule a new meeting.
            </p>
          </div>
        ) : (
          <div className={GRID}>
            {upcomingMeetings.map((meeting, index) => (
              <MeetingCard
                key={meeting.id}
                meeting={meeting}
                index={index}
                onView={onView}
                onEdit={onEdit}
                onDelete={onDelete}
              />
            ))}
          </div>
        )}
      </section>

      {/* Window 2: Distinct Separate Window for Past Meetings */}
      {pastMeetings.length > 0 ? (
        <section className="rounded-2xl border border-border/80 bg-muted/20 p-5 sm:p-6 space-y-5 shadow-xs">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/60 pb-3">
            <div className="flex items-center gap-2.5">
              <div className="flex size-7 items-center justify-center rounded-lg bg-zinc-200 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300">
                <History className="size-4" />
              </div>
              <div>
                <h2 className="text-lg font-bold tracking-tight">Past Meetings Window (Earlier Today)</h2>
                <p className="text-xs text-muted-foreground">
                  Concluded meetings clearly marked as past with timestamps
                </p>
              </div>
              <span className="ml-2 rounded-full border border-border bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 text-xs font-semibold tabular-nums text-muted-foreground">
                {pastMeetings.length}
              </span>
            </div>
            <span className="text-xs text-muted-foreground font-mono">
              Archived records
            </span>
          </div>

          <div className={GRID}>
            {pastMeetings.map((meeting, index) => (
              <MeetingCard
                key={meeting.id}
                meeting={meeting}
                index={index}
                onView={onView}
                onEdit={onEdit}
                onDelete={onDelete}
              />
            ))}
          </div>
        </section>
      ) : null}
    </div>
  )
}

