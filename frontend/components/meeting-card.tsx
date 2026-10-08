"use client"

import {
  Bell,
  Calendar,
  Clock,
  Copy,
  Eye,
  History,
  MapPin,
  MoreHorizontal,
  Pencil,
  Trash2,
  Users,
  Video,
} from "lucide-react"
import { toast } from "sonner"

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
  extractCallUrl,
  formatDateTimeStamp,
  formatRelativeMeetingTime,
  formatTimeRange,
  getMeetingProgress,
  getMeetingStatus,
  initials,
  isCallUrl,
  isStartingSoon,
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
  const hasCall = isCallUrl(meeting.location)
  const callUrl = extractCallUrl(meeting.location)
  const startingSoon = status === "upcoming" && isStartingSoon(meeting.starts_at)
  const progress = status === "live" ? getMeetingProgress(meeting.starts_at, meeting.ends_at) : null

  const handleCopyLink = async (e: React.MouseEvent) => {
    e.stopPropagation()
    if (!callUrl) return
    try {
      await navigator.clipboard.writeText(callUrl)
      toast.success("Meeting link copied to clipboard")
    } catch {
      toast.error("Could not copy link")
    }
  }

  const handleJoinCall = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (!callUrl) return
    window.open(callUrl, "_blank", "noopener,noreferrer")
  }

  return (
    <Card
      id={`meeting-${meeting.id}`}
      onClick={() => onView(meeting)}
      className={cn(
        "flex flex-col h-full cursor-pointer scroll-mt-28 transition-all duration-200 hover:-translate-y-0.5",
        status === "past"
          ? "border-border/60 bg-card/60 opacity-85 hover:opacity-100 hover:shadow-sm"
          : status === "live"
            ? "border-emerald-500/50 bg-card shadow-sm ring-2 ring-emerald-500/30 hover:shadow-md"
            : "hover:shadow-[0_2px_4px_rgba(15,16,21,0.04),0_20px_44px_-16px_rgba(139,61,255,0.28)]",
      )}
    >
      <CardHeader className="flex-1 pb-3">
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
            ) : startingSoon ? (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/40 bg-amber-500/15 px-2.5 py-0.5 text-xs font-semibold text-amber-700 dark:text-amber-400 animate-pulse">
                <Bell className="size-3" aria-hidden />
                Starting soon
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 rounded-full border border-primary/20 bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">
                <Clock className="size-3" aria-hidden />
                {relativeTime}
              </span>
            )}
          </div>
          {meeting.location ? (
            <span
              className={cn(
                "inline-flex items-center gap-1 text-xs truncate max-w-[180px]",
                hasCall ? "text-primary font-medium" : "text-muted-foreground",
              )}
              title={meeting.location}
            >
              {hasCall ? (
                <Video className="size-3.5 text-primary shrink-0" aria-hidden />
              ) : (
                <MapPin className="size-3.5 text-muted-foreground shrink-0" aria-hidden />
              )}
              <span className="truncate">{meeting.location}</span>
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
          <CardDescription className="line-clamp-2">{meeting.description}</CardDescription>
        ) : null}

        {/* Live progress indicator bar */}
        {progress ? (
          <div className="mt-2 space-y-1 rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-2 text-xs">
            <div className="flex items-center justify-between font-semibold text-emerald-700 dark:text-emerald-300">
              <span className="flex items-center gap-1.5">
                <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
                {progress.percent}% elapsed
              </span>
              <span>{progress.remainingMinutes}m remaining</span>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-emerald-500/20">
              <div
                className="h-full rounded-full bg-emerald-500 transition-all duration-300"
                style={{ width: `${progress.percent}%` }}
              />
            </div>
          </div>
        ) : null}
      </CardHeader>

      <CardContent className="pt-0">
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border/50 pt-3">
          {meeting.participants.length === 0 ? (
            <p className="text-muted-foreground inline-flex items-center gap-1.5 text-xs">
              <Users className="size-3.5" aria-hidden />
              No participants yet
            </p>
          ) : (
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="flex items-center gap-2">
                  <div className="flex -space-x-2">
                    {shown.map((participant) => (
                      <Avatar
                        key={participant.id}
                        className="ring-background size-7 ring-2"
                        title={participant.name}
                      >
                        <AvatarFallback className="text-[10px]">
                          {initials(participant.name)}
                        </AvatarFallback>
                      </Avatar>
                    ))}
                    {overflow > 0 ? (
                      <Avatar className="ring-background size-7 ring-2">
                        <AvatarFallback className="text-[10px]">+{overflow}</AvatarFallback>
                      </Avatar>
                    ) : null}
                  </div>
                  <span className="text-muted-foreground truncate text-xs max-w-[130px]">
                    {allNames}
                  </span>
                </div>
              </TooltipTrigger>
              <TooltipContent className="max-w-xs">
                <p>{allNames}</p>
              </TooltipContent>
            </Tooltip>
          )}

          {/* Quick Call Action Buttons */}
          {hasCall && callUrl ? (
            <div className="flex items-center gap-1.5 ml-auto">
              <Button
                variant="outline"
                size="xs"
                className="h-7 px-2 text-xs gap-1"
                onClick={handleCopyLink}
                title="Copy link"
              >
                <Copy className="size-3" />
                <span className="hidden sm:inline">Copy</span>
              </Button>
              <Button
                size="xs"
                className="h-7 px-2.5 text-xs gap-1 font-semibold shadow-xs"
                onClick={handleJoinCall}
              >
                <Video className="size-3" />
                <span>Join</span>
              </Button>
            </div>
          ) : null}
        </div>
      </CardContent>
    </Card>
  )
}
