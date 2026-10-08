"use client"

import { Calendar, Clock, Eye, History, MapPin, MoreHorizontal, Pencil, Trash2, Users } from "lucide-react"

import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"
import {
  formatDateTimeStamp,
  formatRelativeMeetingTime,
  formatTimeRange,
  getMeetingStatus,
  initials,
} from "@/lib/datetime"
import type { Meeting } from "@/lib/types"

const MAX_AVATARS = 4

/** Canva colour-codes its cards; we rotate the same pastel tints by position. */
const TINTS = ["tint-violet", "tint-teal", "tint-pink", "tint-amber"] as const

export function MeetingCard({
  meeting,
  index = 0,
  onView,
  onEdit,
  onDelete,
}: {
  meeting: Meeting
  index?: number
  onView: (meeting: Meeting) => void
  onEdit: (meeting: Meeting) => void
  onDelete: (meeting: Meeting) => void
}) {
  const status = getMeetingStatus(meeting.starts_at, meeting.ends_at)
  const relativeTime = formatRelativeMeetingTime(meeting.starts_at, meeting.ends_at)
  const tint = TINTS[index % TINTS.length]
  const shown = meeting.participants.slice(0, MAX_AVATARS)
  const overflow = meeting.participants.length - shown.length
  const allNames = meeting.participants.map((p) => p.name).join(", ")

  return (
    <Card
      id={`meeting-${meeting.id}`}
      onClick={() => onView(meeting)}
      className={cn(
        "h-full cursor-pointer scroll-mt-28 transition-all duration-200 hover:-translate-y-0.5",
        status === "past"
          ? "border-border/60 bg-card/60 opacity-85 hover:opacity-100 hover:shadow-sm"
          : status === "live"
            ? "border-emerald-500/50 bg-card shadow-sm ring-2 ring-emerald-500/30 hover:shadow-md"
            : "hover:shadow-[0_2px_4px_rgba(15,16,21,0.04),0_20px_44px_-16px_rgba(139,61,255,0.28)]"
      )}
    >
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={cn(
                tint,
                "inline-flex items-center rounded-full px-3 py-1 font-mono text-xs font-semibold tabular-nums",
              )}
            >
              {formatTimeRange(meeting.starts_at, meeting.ends_at)}
            </span>
            {status === "past" ? (
              <span className="inline-flex items-center gap-1 rounded-full border border-zinc-300 dark:border-zinc-700 bg-zinc-100 dark:bg-zinc-800 px-2.5 py-0.5 text-xs font-medium text-zinc-600 dark:text-zinc-400">
                <History className="size-3" aria-hidden />
                Past • {relativeTime}
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
              <span className="inline-flex items-center gap-1 rounded-full border border-primary/20 bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">
                <Clock className="size-3" aria-hidden />
                {relativeTime}
              </span>
            )}
          </div>
          {meeting.location ? (
            <span className="text-muted-foreground inline-flex items-center gap-1 text-sm">
              <MapPin className="size-3.5" aria-hidden />
              {meeting.location}
            </span>
          ) : null}
        </div>
        <div className="text-muted-foreground/75 flex items-center gap-1.5 text-[11px] font-mono">
          <Calendar className="size-3" aria-hidden />
          <span>{formatDateTimeStamp(meeting.starts_at)}</span>
        </div>
        {/* Menu clicks bubble through the portal in React, so stop them reaching the card. */}
        <CardAction onClick={(event) => event.stopPropagation()}>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon-sm" aria-label={`Actions for ${meeting.name}`}>
                <MoreHorizontal aria-hidden />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={() => onView(meeting)}>
                <Eye aria-hidden />
                View details
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => onEdit(meeting)}>
                <Pencil aria-hidden />
                Edit
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem variant="destructive" onSelect={() => onDelete(meeting)}>
                <Trash2 aria-hidden />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </CardAction>
        <CardTitle className="text-xl font-bold tracking-tight">
          {/* A real button so the card opens from the keyboard; the click bubbles to the card. */}
          <button type="button" className="text-left outline-none focus-visible:underline">
            {meeting.name}
          </button>
        </CardTitle>
        {meeting.description ? (
          <CardDescription className="line-clamp-3">{meeting.description}</CardDescription>
        ) : null}
      </CardHeader>

      <CardContent>
        {meeting.participants.length === 0 ? (
          <p className="text-muted-foreground inline-flex items-center gap-1.5 text-sm">
            <Users className="size-4" aria-hidden />
            No participants yet
          </p>
        ) : (
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="flex items-center gap-3">
                <div className="flex -space-x-2">
                  {shown.map((participant) => (
                    <Avatar
                      key={participant.id}
                      className="ring-background size-8 ring-2"
                      title={participant.name}
                    >
                      <AvatarFallback className="text-xs">
                        {initials(participant.name)}
                      </AvatarFallback>
                    </Avatar>
                  ))}
                  {overflow > 0 ? (
                    <Avatar className="ring-background size-8 ring-2">
                      <AvatarFallback className="text-xs">+{overflow}</AvatarFallback>
                    </Avatar>
                  ) : null}
                </div>
                <span className="text-muted-foreground truncate text-sm">{allNames}</span>
              </div>
            </TooltipTrigger>
            <TooltipContent className="max-w-xs">
              <p>{allNames}</p>
            </TooltipContent>
          </Tooltip>
        )}
      </CardContent>
    </Card>
  )
}
