"use client"

import { useRef } from "react"
import {
  CalendarDays,
  Clock,
  Copy,
  Mail,
  MapPin,
  Pencil,
  Trash2,
  Users,
  Video,
} from "lucide-react"
import { toast } from "sonner"

import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Separator } from "@/components/ui/separator"
import {
  extractCallUrl,
  formatDateTimeStamp,
  formatDuration,
  formatLongDate,
  formatRelativeMeetingTime,
  formatTimeRange,
  getMeetingStatus,
  initials,
  isCallUrl,
} from "@/lib/datetime"
import type { Meeting } from "@/lib/types"

export function MeetingDetailsDialog({
  meeting,
  open,
  onOpenChange,
  onEdit,
  onDelete,
}: {
  meeting?: Meeting
  open: boolean
  onOpenChange: (open: boolean) => void
  onEdit: (meeting: Meeting) => void
  onDelete: (meeting: Meeting) => void
}) {
  const editRef = useRef<HTMLButtonElement>(null)
  const status = meeting ? getMeetingStatus(meeting.starts_at, meeting.ends_at) : "upcoming"
  const relativeTime = meeting ? formatRelativeMeetingTime(meeting.starts_at, meeting.ends_at) : ""
  const hasCall = meeting ? isCallUrl(meeting.location) : false
  const callUrl = meeting ? extractCallUrl(meeting.location) : null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {meeting ? (
        <DialogContent
          className="max-h-[90svh] overflow-y-auto sm:max-w-lg"
          // Focus Edit rather than the first button, so Enter never starts a delete.
          onOpenAutoFocus={(event) => {
            event.preventDefault()
            editRef.current?.focus()
          }}
        >
          <DialogHeader>
            <div className="flex flex-wrap items-center gap-2 pb-1">
              {status === "past" ? (
                <span className="inline-flex items-center gap-1 rounded-full border border-zinc-300 dark:border-zinc-700 bg-zinc-100 dark:bg-zinc-800 px-2.5 py-0.5 text-xs font-semibold text-zinc-600 dark:text-zinc-400">
                  Past Meeting • {relativeTime}
                </span>
              ) : status === "live" ? (
                <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/40 bg-emerald-500/10 px-2.5 py-0.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                  <span className="relative flex size-2">
                    <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex size-2 rounded-full bg-emerald-500"></span>
                  </span>
                  Live Now
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 rounded-full border border-primary/20 bg-primary/10 px-2.5 py-0.5 text-xs font-semibold text-primary">
                  Upcoming • {relativeTime}
                </span>
              )}
            </div>
            <DialogTitle className="text-2xl font-bold tracking-tight">{meeting.name}</DialogTitle>
            <DialogDescription className="flex flex-wrap items-center gap-2 pt-1">
              <span className="tint-violet inline-flex items-center gap-1.5 rounded-full px-3 py-1 font-mono text-xs font-semibold tabular-nums">
                <Clock className="size-3.5" aria-hidden />
                {formatTimeRange(meeting.starts_at, meeting.ends_at)}
              </span>
              <span className="tint-teal inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold">
                {formatDuration(meeting.starts_at, meeting.ends_at)}
              </span>
              <span className="text-muted-foreground font-mono text-xs">
                {formatDateTimeStamp(meeting.starts_at)}
              </span>
            </DialogDescription>
          </DialogHeader>

          <dl className="grid gap-3 text-sm">
            <div className="flex items-center gap-2">
              <CalendarDays className="text-muted-foreground size-4" aria-hidden />
              <dt className="sr-only">Date</dt>
              <dd>{formatLongDate(meeting.starts_at)}</dd>
            </div>
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                {hasCall ? (
                  <Video className="text-primary size-4 shrink-0" aria-hidden />
                ) : (
                  <MapPin className="text-muted-foreground size-4 shrink-0" aria-hidden />
                )}
                <dt className="sr-only">Location</dt>
                <dd className={meeting.location ? undefined : "text-muted-foreground"}>
                  {hasCall && callUrl ? (
                    <a
                      href={callUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary font-medium hover:underline inline-flex items-center gap-1"
                    >
                      {meeting.location}
                    </a>
                  ) : (
                    meeting.location ?? "No location"
                  )}
                </dd>
              </div>

              {hasCall && callUrl ? (
                <Button
                  variant="outline"
                  size="xs"
                  className="h-7 text-xs gap-1"
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(callUrl)
                      toast.success("Meeting link copied to clipboard")
                    } catch {
                      toast.error("Could not copy link")
                    }
                  }}
                  title="Copy link"
                >
                  <Copy className="size-3" />
                  Copy
                </Button>
              ) : null}
            </div>
          </dl>

          {meeting.description ? (
            <p className="text-sm leading-relaxed whitespace-pre-wrap">{meeting.description}</p>
          ) : null}

          <Separator />

          <section className="space-y-3">
            <h3 className="flex items-center gap-2 text-sm font-semibold">
              <Users className="size-4" aria-hidden />
              Participants
              <span className="text-muted-foreground font-normal tabular-nums">
                {meeting.participants.length}
              </span>
            </h3>
            {meeting.participants.length === 0 ? (
              <p className="text-muted-foreground text-sm">No participants yet.</p>
            ) : (
              <ul className="space-y-2">
                {meeting.participants.map((participant) => (
                  <li key={participant.id} className="flex items-center gap-3">
                    <Avatar className="size-8">
                      <AvatarFallback className="text-xs">
                        {initials(participant.name)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{participant.name}</p>
                      {participant.email ? (
                        <a
                          href={`mailto:${participant.email}`}
                          className="text-muted-foreground hover:text-primary inline-flex items-center gap-1 truncate text-xs"
                        >
                          <Mail className="size-3" aria-hidden />
                          {participant.email}
                        </a>
                      ) : null}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <DialogFooter className="flex flex-wrap items-center justify-between gap-2 sm:justify-between">
            <Button variant="destructive" onClick={() => onDelete(meeting)}>
              <Trash2 aria-hidden />
              Delete
            </Button>
            <div className="flex items-center gap-2 ml-auto">
              {hasCall && callUrl ? (
                <Button
                  className="gap-1.5 font-semibold"
                  onClick={() => window.open(callUrl, "_blank", "noopener,noreferrer")}
                >
                  <Video className="size-4" />
                  Join Call
                </Button>
              ) : null}
              <Button ref={editRef} variant="outline" onClick={() => onEdit(meeting)}>
                <Pencil aria-hidden />
                Edit
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      ) : null}
    </Dialog>
  )
}
