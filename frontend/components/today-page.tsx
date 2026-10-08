"use client"

import { useMemo, useState } from "react"
import {
  Calendar as CalendarIcon,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  History,
  LayoutGrid,
  ListFilter,
  RefreshCw,
  Search,
  Sparkles,
  Video,
  X,
} from "lucide-react"

import { AppHeader } from "@/components/app-header"
import { DayCalendarView } from "@/components/day-calendar-view"
import { DeleteMeetingDialog } from "@/components/delete-meeting-dialog"
import { MeetingDetailsDialog } from "@/components/meeting-details-dialog"
import { MeetingFormDialog } from "@/components/meeting-form-dialog"
import { MeetingList } from "@/components/meeting-list"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Input } from "@/components/ui/input"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { useMeetings } from "@/hooks/use-meetings"
import {
  addDays,
  formatLongDate,
  getMeetingStatus,
  isCallUrl,
  isToday,
  parseIsoDay,
  subDays,
  toIsoDate,
} from "@/lib/datetime"
import type { Meeting } from "@/lib/types"

/** Which dialog is open. The form doubles as "create" (no meeting) and "edit". */
type DialogState =
  | { kind: "none" }
  | { kind: "form"; meeting?: Meeting; defaultStartTime?: string }
  | { kind: "details"; meeting: Meeting }
  | { kind: "delete"; meeting: Meeting }

type FilterChip = "all" | "live" | "upcoming" | "past" | "call"
type ViewMode = "timeline" | "grid"

export function TodayPage({ initialDialogOpen = false }: { initialDialogOpen?: boolean }) {
  const [selectedDate, setSelectedDate] = useState<string>(() => toIsoDate(new Date()))
  const [datePickerOpen, setDatePickerOpen] = useState(false)
  const [viewMode, setViewMode] = useState<ViewMode>("timeline")
  const [searchQuery, setSearchQuery] = useState("")
  const [filterChip, setFilterChip] = useState<FilterChip>("all")

  const [dialog, setDialog] = useState<DialogState>(
    initialDialogOpen ? { kind: "form" } : { kind: "none" },
  )
  const [selected, setSelected] = useState<Meeting>()
  const [editing, setEditing] = useState<Meeting>()
  const [startTimePrefill, setStartTimePrefill] = useState<string>()

  // Query backend for the selected date
  const { data, refetch, isFetching, isPending, isError, error, dataUpdatedAt } =
    useMeetings(selectedDate)

  const items = useMemo(() => data?.items ?? [], [data])
  const isCurrentToday = isToday(parseIsoDay(selectedDate))

  // Metrics for badges
  const liveCount = useMemo(
    () => items.filter((m) => getMeetingStatus(m.starts_at, m.ends_at) === "live").length,
    [items],
  )
  const upcomingCount = useMemo(
    () => items.filter((m) => getMeetingStatus(m.starts_at, m.ends_at) !== "past").length,
    [items],
  )
  const pastCount = useMemo(
    () => items.filter((m) => getMeetingStatus(m.starts_at, m.ends_at) === "past").length,
    [items],
  )
  const callCount = useMemo(
    () => items.filter((m) => isCallUrl(m.location)).length,
    [items],
  )

  // Filtered meetings based on search string and filter chip
  const filteredMeetings = useMemo(() => {
    return items.filter((m) => {
      // 1. Search Query Filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim()
        const nameMatch = m.name.toLowerCase().includes(q)
        const descMatch = (m.description ?? "").toLowerCase().includes(q)
        const locMatch = (m.location ?? "").toLowerCase().includes(q)
        const partMatch = m.participants.some((p) => p.name.toLowerCase().includes(q))
        if (!nameMatch && !descMatch && !locMatch && !partMatch) return false
      }

      // 2. Chip Filter
      if (filterChip === "live") {
        return getMeetingStatus(m.starts_at, m.ends_at) === "live"
      }
      if (filterChip === "upcoming") {
        return getMeetingStatus(m.starts_at, m.ends_at) !== "past"
      }
      if (filterChip === "past") {
        return getMeetingStatus(m.starts_at, m.ends_at) === "past"
      }
      if (filterChip === "call") {
        return isCallUrl(m.location)
      }

      return true
    })
  }, [items, searchQuery, filterChip])

  // Fresh selected meeting
  const current = items.find((item) => item.id === selected?.id) ?? selected

  const open = (next: DialogState) => {
    if (next.kind !== "none") setSelected(next.meeting)
    if (next.kind === "form") {
      setEditing(next.meeting)
      setStartTimePrefill(next.defaultStartTime)
    }
    setDialog(next)
  }
  const close = () => setDialog({ kind: "none" })

  const onCreate = (time?: string) => open({ kind: "form", defaultStartTime: time })
  const onView = (meeting: Meeting) => open({ kind: "details", meeting })
  const onEdit = (meeting: Meeting) => open({ kind: "form", meeting })
  const onDelete = (meeting: Meeting) => open({ kind: "delete", meeting })

  // Date Navigation handlers
  const handlePrevDay = () => {
    setSelectedDate((prev) => toIsoDate(subDays(parseIsoDay(prev), 1)))
  }
  const handleNextDay = () => {
    setSelectedDate((prev) => toIsoDate(addDays(parseIsoDay(prev), 1)))
  }
  const handleToday = () => {
    setSelectedDate(toIsoDate(new Date()))
  }

  const syncTimestamp = dataUpdatedAt
    ? new Date(dataUpdatedAt).toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      })
    : null

  return (
    <>
      <AppHeader onCreate={() => onCreate()} />

      <main className="mx-auto w-full max-w-6xl px-4 pt-8 pb-16 sm:px-6 lg:px-8">
        {/* Header section with Dynamic Title and Sync */}
        <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-gradient-canva text-4xl font-bold tracking-tight sm:text-5xl">
              {isCurrentToday ? "Today" : "Schedule"}
            </h1>
            <p className="text-muted-foreground mt-2 text-base">
              {formatLongDate(selectedDate)}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            {syncTimestamp ? (
              <div className="flex items-center gap-1.5 rounded-full border border-border/80 bg-background/80 px-3 py-1.5 text-xs text-muted-foreground shadow-2xs">
                <span className="size-2 rounded-full bg-emerald-500 animate-pulse" />
                <span>
                  Synced:{" "}
                  <span className="font-mono font-medium text-foreground">
                    {syncTimestamp}
                  </span>
                </span>
              </div>
            ) : null}

            <Button
              variant="outline"
              size="sm"
              onClick={() => refetch()}
              disabled={isFetching}
              className="gap-1.5 text-xs h-8"
              title="Refresh meeting data"
            >
              <RefreshCw className={`size-3.5 ${isFetching ? "animate-spin" : ""}`} />
              <span>{isFetching ? "Refreshing…" : "Sync"}</span>
            </Button>
          </div>
        </div>

        {/* Date Navigator Bar & View Switcher */}
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border/80 bg-card p-2 sm:p-2.5 shadow-2xs">
          {/* Left: Date Navigation */}
          <div className="flex items-center gap-1.5 sm:gap-2">
            <Button
              variant="ghost"
              size="icon-sm"
              className="size-8"
              onClick={handlePrevDay}
              aria-label="Previous day"
              title="Previous day"
            >
              <ChevronLeft className="size-4" />
            </Button>

            <Popover open={datePickerOpen} onOpenChange={setDatePickerOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-2 font-mono text-xs font-semibold h-8"
                >
                  <CalendarIcon className="size-3.5 text-primary" />
                  <span>{selectedDate}</span>
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={parseIsoDay(selectedDate)}
                  onSelect={(d) => {
                    if (d) {
                      setSelectedDate(toIsoDate(d))
                      setDatePickerOpen(false)
                    }
                  }}
                  autoFocus
                />
              </PopoverContent>
            </Popover>

            <Button
              variant="ghost"
              size="icon-sm"
              className="size-8"
              onClick={handleNextDay}
              aria-label="Next day"
              title="Next day"
            >
              <ChevronRight className="size-4" />
            </Button>

            <Button
              variant={isCurrentToday ? "secondary" : "default"}
              size="sm"
              className="h-8 text-xs font-medium"
              onClick={handleToday}
            >
              Today
            </Button>
          </div>

          {/* Right: View Mode Toggle (Google Calendar Timeline vs Grid Cards) */}
          <div className="flex items-center gap-1 rounded-xl bg-muted/60 p-1 text-xs font-medium">
            <button
              type="button"
              onClick={() => setViewMode("timeline")}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 transition-all ${
                viewMode === "timeline"
                  ? "bg-background text-foreground shadow-2xs font-semibold"
                  : "text-muted-foreground hover:text-foreground"
              }`}
              title="Google Calendar Schedule Timeline View"
            >
              <CalendarDays className="size-3.5 text-primary" />
              <span>Timeline View</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode("grid")}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 transition-all ${
                viewMode === "grid"
                  ? "bg-background text-foreground shadow-2xs font-semibold"
                  : "text-muted-foreground hover:text-foreground"
              }`}
              title="Grid Cards View"
            >
              <LayoutGrid className="size-3.5" />
              <span>Grid Cards</span>
            </button>
          </div>
        </div>

        {/* Search Input & Quick Filter Chips */}
        <div className="mb-6 space-y-3">
          <div className="flex flex-wrap items-center gap-3">
            {/* Search Input */}
            <div className="relative flex-1 min-w-[240px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
              <Input
                placeholder="Search meetings, description, participants or links…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 pr-9 h-9 text-xs sm:text-sm bg-card"
              />
              {searchQuery ? (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-0.5 rounded-md"
                  aria-label="Clear search"
                >
                  <X className="size-3.5" />
                </button>
              ) : null}
            </div>

            {/* Timezone Indicator */}
            <div className="hidden lg:flex items-center gap-1.5 text-xs text-muted-foreground">
              <CalendarDays className="size-3.5" />
              <span>{Intl.DateTimeFormat().resolvedOptions().timeZone}</span>
            </div>
          </div>

          {/* Quick Filter Chips */}
          <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
            <span className="text-xs text-muted-foreground mr-1 flex items-center gap-1">
              <ListFilter className="size-3" /> Filters:
            </span>

            {/* All */}
            <button
              type="button"
              onClick={() => setFilterChip("all")}
              className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs transition-all ${
                filterChip === "all"
                  ? "bg-primary text-primary-foreground font-semibold shadow-2xs"
                  : "bg-muted/70 text-muted-foreground hover:text-foreground hover:bg-muted"
              }`}
            >
              <span>All</span>
              <span className="font-mono tabular-nums text-[11px] opacity-80">
                {items.length}
              </span>
            </button>

            {/* Live Now (only shows if today or if there are live meetings) */}
            {liveCount > 0 ? (
              <button
                type="button"
                onClick={() => setFilterChip("live")}
                className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs transition-all ${
                  filterChip === "live"
                    ? "bg-emerald-600 text-white font-semibold shadow-2xs"
                    : "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-500/20"
                }`}
              >
                <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
                <span>Live Now</span>
                <span className="font-mono tabular-nums text-[11px] font-bold">
                  {liveCount}
                </span>
              </button>
            ) : null}

            {/* Upcoming */}
            <button
              type="button"
              onClick={() => setFilterChip("upcoming")}
              className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs transition-all ${
                filterChip === "upcoming"
                  ? "bg-primary text-primary-foreground font-semibold shadow-2xs"
                  : "bg-muted/70 text-muted-foreground hover:text-foreground hover:bg-muted"
              }`}
            >
              <Sparkles className="size-3" />
              <span>Upcoming</span>
              <span className="font-mono tabular-nums text-[11px] opacity-80">
                {upcomingCount}
              </span>
            </button>

            {/* Past */}
            <button
              type="button"
              onClick={() => setFilterChip("past")}
              className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs transition-all ${
                filterChip === "past"
                  ? "bg-zinc-700 dark:bg-zinc-300 text-white dark:text-zinc-900 font-semibold shadow-2xs"
                  : "bg-muted/70 text-muted-foreground hover:text-foreground hover:bg-muted"
              }`}
            >
              <History className="size-3" />
              <span>Past</span>
              <span className="font-mono tabular-nums text-[11px] opacity-80">
                {pastCount}
              </span>
            </button>

            {/* Has Call Link */}
            <button
              type="button"
              onClick={() => setFilterChip("call")}
              className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs transition-all ${
                filterChip === "call"
                  ? "bg-blue-600 text-white font-semibold shadow-2xs"
                  : "bg-muted/70 text-muted-foreground hover:text-foreground hover:bg-muted"
              }`}
            >
              <Video className="size-3" />
              <span>With Call Link</span>
              <span className="font-mono tabular-nums text-[11px] opacity-80">
                {callCount}
              </span>
            </button>

            {/* Active search tag */}
            {searchQuery ? (
              <Badge variant="outline" className="text-[11px] gap-1 ml-auto">
                Filtering by &quot;{searchQuery}&quot;
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="hover:text-destructive"
                >
                  <X className="size-3" />
                </button>
              </Badge>
            ) : null}
          </div>
        </div>

        {/* View Switcher Output */}
        {viewMode === "timeline" ? (
          <DayCalendarView
            meetings={filteredMeetings}
            isTodayDate={isCurrentToday}
            onCreate={() => onCreate()}
            onView={onView}
            onEdit={onEdit}
            onDelete={onDelete}
          />
        ) : (
          <MeetingList
            meetings={filteredMeetings}
            isPending={isPending}
            isError={isError}
            error={error}
            onRetry={() => refetch()}
            onCreate={() => onCreate()}
            onView={onView}
            onEdit={onEdit}
            onDelete={onDelete}
          />
        )}
      </main>

      <MeetingFormDialog
        open={dialog.kind === "form"}
        onOpenChange={(isOpen) => !isOpen && close()}
        meeting={editing}
        defaultDate={parseIsoDay(selectedDate)}
        defaultStartTime={startTimePrefill}
      />
      <MeetingDetailsDialog
        open={dialog.kind === "details"}
        onOpenChange={(isOpen) => !isOpen && close()}
        meeting={current}
        onEdit={onEdit}
        onDelete={onDelete}
      />
      <DeleteMeetingDialog
        open={dialog.kind === "delete"}
        onOpenChange={(isOpen) => !isOpen && close()}
        meeting={current}
      />
    </>
  )
}
