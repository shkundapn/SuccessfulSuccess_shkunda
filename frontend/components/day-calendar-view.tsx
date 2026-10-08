"use client"

import * as React from "react"
import {
  Clock,
  Eye,
  MapPin,
  Pencil,
  Plus,
  Trash2,
  Users,
  Video,
} from "lucide-react"

import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  extractCallUrl,
  formatHourLabel,
  formatTimeRange,
  getMeetingStatus,
  initials,
  isCallUrl,
  timeToMinutes,
} from "@/lib/datetime"
import type { Meeting } from "@/lib/types"
import { cn } from "@/lib/utils"

const HOUR_HEIGHT = 72 // pixels per 1 hour slot
const DEFAULT_START_HOUR = 7 // 07:00
const DEFAULT_END_HOUR = 21 // 21:00 (ruler reaches 22:00)

const TINTS = [
  { border: "border-l-purple-500", bg: "bg-purple-500/10 dark:bg-purple-500/20", text: "text-purple-700 dark:text-purple-300" },
  { border: "border-l-teal-500", bg: "bg-teal-500/10 dark:bg-teal-500/20", text: "text-teal-700 dark:text-teal-300" },
  { border: "border-l-pink-500", bg: "bg-pink-500/10 dark:bg-pink-500/20", text: "text-pink-700 dark:text-pink-300" },
  { border: "border-l-amber-500", bg: "bg-amber-500/10 dark:bg-amber-500/20", text: "text-amber-700 dark:text-amber-300" },
  { border: "border-l-blue-500", bg: "bg-blue-500/10 dark:bg-blue-500/20", text: "text-blue-700 dark:text-blue-300" },
]

interface PositionedMeeting {
  meeting: Meeting
  index: number
  startMin: number
  endMin: number
  colIndex: number
  totalCols: number
}

/**
 * Computes side-by-side columns for overlapping meetings similar to Google Calendar.
 */
function layoutMeetings(meetings: Meeting[]): PositionedMeeting[] {
  if (meetings.length === 0) return []

  // 1. Sort meetings by start time ascending, then by duration descending
  const sorted = meetings
    .map((m, index) => {
      const startMin = timeToMinutes(m.starts_at)
      const rawEnd = timeToMinutes(m.ends_at)
      const endMin = rawEnd <= startMin ? startMin + 30 : rawEnd
      return { meeting: m, index, startMin, endMin }
    })
    .sort((a, b) => a.startMin - b.startMin || (b.endMin - b.startMin) - (a.endMin - a.startMin))

  // 2. Group into overlapping clusters
  const clusters: typeof sorted[] = []
  let currentCluster: typeof sorted = []
  let clusterEnd = -1

  for (const item of sorted) {
    if (currentCluster.length === 0) {
      currentCluster.push(item)
      clusterEnd = item.endMin
    } else if (item.startMin < clusterEnd) {
      currentCluster.push(item)
      clusterEnd = Math.max(clusterEnd, item.endMin)
    } else {
      clusters.push(currentCluster)
      currentCluster = [item]
      clusterEnd = item.endMin
    }
  }
  if (currentCluster.length > 0) {
    clusters.push(currentCluster)
  }

  // 3. For each cluster, assign columns (greedy layout)
  const result: PositionedMeeting[] = []

  for (const cluster of clusters) {
    const columns: typeof cluster[] = []

    for (const item of cluster) {
      let placed = false
      for (let c = 0; c < columns.length; c++) {
        const lastInCol = columns[c]![columns[c]!.length - 1]!
        if (item.startMin >= lastInCol.endMin) {
          columns[c]!.push(item)
          result.push({
            meeting: item.meeting,
            index: item.index,
            startMin: item.startMin,
            endMin: item.endMin,
            colIndex: c,
            totalCols: 1, // updated below
          })
          placed = true
          break
        }
      }

      if (!placed) {
        columns.push([item])
        result.push({
          meeting: item.meeting,
          index: item.index,
          startMin: item.startMin,
          endMin: item.endMin,
          colIndex: columns.length - 1,
          totalCols: 1, // updated below
        })
      }
    }

    const totalCols = columns.length
    // Update totalCols for all items in this cluster
    const clusterIds = new Set(cluster.map((c) => c.meeting.id))
    for (const r of result) {
      if (clusterIds.has(r.meeting.id)) {
        r.totalCols = totalCols
      }
    }
  }

  return result
}

export function DayCalendarView({
  meetings,
  isTodayDate = true,
  onCreate,
  onView,
  onEdit,
  onDelete,
}: {
  meetings: Meeting[]
  isTodayDate?: boolean
  onCreate: () => void
  onView: (meeting: Meeting) => void
  onEdit: (meeting: Meeting) => void
  onDelete: (meeting: Meeting) => void
}) {
  // Current time in minutes for the moving red line
  const [currentMinutes, setCurrentMinutes] = React.useState<number>(() => {
    const now = new Date()
    return now.getHours() * 60 + now.getMinutes()
  })

  // Update current time every minute
  React.useEffect(() => {
    const timer = setInterval(() => {
      const now = new Date()
      setCurrentMinutes(now.getHours() * 60 + now.getMinutes())
    }, 60_000)
    return () => clearInterval(timer)
  }, [])

  // Calculate dynamic start/end hours to ensure no meeting is clipped
  const { startHour, endHour } = React.useMemo(() => {
    let minH = DEFAULT_START_HOUR
    let maxH = DEFAULT_END_HOUR

    for (const m of meetings) {
      const s = timeToMinutes(m.starts_at)
      const e = timeToMinutes(m.ends_at)
      const sh = Math.floor(s / 60)
      const eh = Math.ceil(e / 60)
      if (sh < minH) minH = Math.max(0, sh)
      if (eh > maxH) maxH = Math.min(23, eh)
    }

    return { startHour: minH, endHour: maxH }
  }, [meetings])

  const hours = React.useMemo(() => {
    const list: number[] = []
    for (let h = startHour; h <= endHour; h++) {
      list.push(h)
    }
    return list
  }, [startHour, endHour])

  const positioned = React.useMemo(() => layoutMeetings(meetings), [meetings])

  // Total height of the timeline grid
  const totalGridHeight = hours.length * HOUR_HEIGHT

  // Position of the current time line
  const nowTop = ((currentMinutes - startHour * 60) / 60) * HOUR_HEIGHT
  const isNowVisible =
    isTodayDate && currentMinutes >= startHour * 60 && currentMinutes <= (endHour + 1) * 60

  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
      {/* Calendar Header Bar */}
      <div className="flex flex-wrap items-center justify-between border-b border-border/70 bg-muted/40 px-4 py-3 sm:px-6">
        <div className="flex items-center gap-2">
          <div className="size-2 rounded-full bg-primary animate-pulse" />
          <h2 className="text-base font-semibold tracking-tight">Timeline Schedule</h2>
          <Badge variant="outline" className="ml-2 font-mono text-xs tabular-nums">
            {meetings.length} {meetings.length === 1 ? "meeting" : "meetings"}
          </Badge>
        </div>
        <p className="text-xs text-muted-foreground">
          Click an empty slot to schedule • Drag or click meeting to open
        </p>
      </div>

      {/* Main Timeline Scroll Canvas */}
      <div className="relative max-h-[700px] overflow-y-auto">
        <div className="relative flex select-none" style={{ height: `${totalGridHeight}px` }}>
          {/* Time Ruler (Left column) */}
          <div className="sticky left-0 z-10 w-16 sm:w-20 shrink-0 border-r border-border/60 bg-card/95 backdrop-blur-xs">
            {hours.map((hour) => (
              <div
                key={hour}
                className="relative border-b border-border/20 text-right pr-3 pt-1 text-xs font-mono font-medium text-muted-foreground/80 tabular-nums"
                style={{ height: `${HOUR_HEIGHT}px` }}
              >
                {formatHourLabel(hour)}
              </div>
            ))}
          </div>

          {/* Schedule Grid & Meeting Blocks Area */}
          <div className="relative flex-1">
            {/* Horizontal Grid Lines & Empty Slot Click targets */}
            {hours.map((hour) => (
              <div
                key={hour}
                onClick={onCreate}
                className="group relative border-b border-border/30 hover:bg-primary/5 transition-colors cursor-pointer"
                style={{ height: `${HOUR_HEIGHT}px` }}
                title={`Click to schedule a meeting at ${formatHourLabel(hour)}`}
              >
                {/* 30-minute faint divider line */}
                <div
                  className="absolute left-0 right-0 border-b border-dashed border-border/20 pointer-events-none"
                  style={{ top: `${HOUR_HEIGHT / 2}px` }}
                />
                <span className="absolute right-3 top-2 hidden text-[11px] font-medium text-primary/70 group-hover:inline-flex items-center gap-1">
                  <Plus className="size-3" /> Schedule at {formatHourLabel(hour)}
                </span>
              </div>
            ))}

            {/* Current Time Indicator Red Line */}
            {isNowVisible ? (
              <div
                className="pointer-events-none absolute left-0 right-0 z-20 flex items-center"
                style={{ top: `${nowTop}px` }}
              >
                <div className="relative -ml-2 flex items-center">
                  <span className="size-3.5 rounded-full bg-red-500 shadow-sm ring-2 ring-white dark:ring-zinc-900" />
                  <span className="ml-1 rounded-sm bg-red-500 px-1.5 py-0.5 text-[10px] font-bold text-white shadow-xs">
                    {Math.floor(currentMinutes / 60)
                      .toString()
                      .padStart(2, "0")}
                    :
                    {(currentMinutes % 60).toString().padStart(2, "0")}
                  </span>
                </div>
                <div className="h-0.5 flex-1 bg-red-500 shadow-xs" />
              </div>
            ) : null}

            {/* Positioned Meeting Blocks */}
            {positioned.map((item) => {
              const { meeting, index, startMin, endMin, colIndex, totalCols } = item
              const top = ((startMin - startHour * 60) / 60) * HOUR_HEIGHT
              const durationMin = Math.max(20, endMin - startMin)
              const height = Math.max(40, (durationMin / 60) * HOUR_HEIGHT - 4)

              // Side-by-side column percentage
              const colWidthPercent = 100 / totalCols
              const leftPercent = colIndex * colWidthPercent

              const tint = TINTS[index % TINTS.length]!
              const status = getMeetingStatus(meeting.starts_at, meeting.ends_at)
              const hasCall = isCallUrl(meeting.location)
              const callUrl = extractCallUrl(meeting.location)

              return (
                <div
                  key={meeting.id}
                  onClick={(e) => {
                    e.stopPropagation()
                    onView(meeting)
                  }}
                  className={cn(
                    "absolute z-10 cursor-pointer overflow-hidden rounded-xl border-l-4 border transition-all duration-150 p-2 sm:p-2.5",
                    "hover:z-30 hover:shadow-lg hover:-translate-y-0.5",
                    tint.border,
                    tint.bg,
                    status === "live"
                      ? "ring-2 ring-emerald-500/50 shadow-md border-emerald-500"
                      : "border-border/70 shadow-xs",
                  )}
                  style={{
                    top: `${top}px`,
                    height: `${height}px`,
                    left: `calc(${leftPercent}% + 2px)`,
                    width: `calc(${colWidthPercent}% - 6px)`,
                  }}
                >
                  <div className="flex h-full flex-col justify-between">
                    <div>
                      {/* Top row: Status/Time and Options Menu */}
                      <div className="flex items-center justify-between gap-1">
                        <div className="flex items-center gap-1.5 font-mono text-[11px] font-bold tabular-nums">
                          {status === "live" ? (
                            <span className="relative flex size-2">
                              <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                              <span className="relative inline-flex size-2 rounded-full bg-emerald-500" />
                            </span>
                          ) : (
                            <Clock className="size-3 opacity-70" />
                          )}
                          <span className={tint.text}>
                            {formatTimeRange(meeting.starts_at, meeting.ends_at)}
                          </span>
                        </div>

                        {/* Meeting Quick Dropdown */}
                        <div onClick={(e) => e.stopPropagation()}>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <button
                                type="button"
                                className="rounded-md p-0.5 hover:bg-black/10 dark:hover:bg-white/10 text-muted-foreground opacity-60 hover:opacity-100 transition-opacity"
                                aria-label="Meeting actions"
                              >
                                <span className="sr-only">Menu</span>
                                <span className="text-xs">⋮</span>
                              </button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onSelect={() => onView(meeting)}>
                                <Eye className="size-3.5 mr-2" /> View details
                              </DropdownMenuItem>
                              <DropdownMenuItem onSelect={() => onEdit(meeting)}>
                                <Pencil className="size-3.5 mr-2" /> Edit
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                variant="destructive"
                                onSelect={() => onDelete(meeting)}
                              >
                                <Trash2 className="size-3.5 mr-2" /> Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </div>

                      {/* Title */}
                      <h3 className="mt-0.5 truncate text-xs sm:text-sm font-bold tracking-tight text-foreground">
                        {meeting.name}
                      </h3>

                      {/* Location / Call link */}
                      {meeting.location ? (
                        <div className="mt-0.5 flex items-center gap-1 text-[11px] text-muted-foreground truncate">
                          {hasCall ? (
                            <Video className="size-3 text-primary shrink-0" />
                          ) : (
                            <MapPin className="size-3 shrink-0" />
                          )}
                          <span className="truncate">{meeting.location}</span>
                        </div>
                      ) : null}
                    </div>

                    {/* Bottom row: Participants and Quick Join */}
                    <div className="flex items-center justify-between gap-1 pt-1 mt-auto">
                      {meeting.participants.length > 0 ? (
                        <div className="flex items-center gap-1">
                          <div className="flex -space-x-1.5">
                            {meeting.participants.slice(0, 3).map((p) => (
                              <Avatar
                                key={p.id}
                                className="size-5 ring-1 ring-background"
                                title={p.name}
                              >
                                <AvatarFallback className="text-[9px]">
                                  {initials(p.name)}
                                </AvatarFallback>
                              </Avatar>
                            ))}
                          </div>
                          {meeting.participants.length > 3 ? (
                            <span className="text-[10px] text-muted-foreground font-semibold">
                              +{meeting.participants.length - 3}
                            </span>
                          ) : null}
                        </div>
                      ) : (
                        <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                          <Users className="size-2.5" /> 0
                        </span>
                      )}

                      {/* Quick Join Call Button inside block if height allows */}
                      {hasCall && callUrl && height >= 54 ? (
                        <Button
                          size="xs"
                          className="h-5 px-1.5 text-[10px] gap-1 font-semibold"
                          onClick={(e) => {
                            e.stopPropagation()
                            window.open(callUrl, "_blank", "noopener,noreferrer")
                          }}
                        >
                          <Video className="size-2.5" />
                          <span>Join</span>
                        </Button>
                      ) : null}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
