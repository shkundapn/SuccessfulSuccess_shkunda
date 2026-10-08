"use client"

import { useState } from "react"
import { CalendarDays, History, Layers, RefreshCw, Sparkles } from "lucide-react"

import { AppHeader } from "@/components/app-header"
import { DeleteMeetingDialog } from "@/components/delete-meeting-dialog"
import { MeetingDetailsDialog } from "@/components/meeting-details-dialog"
import { MeetingFormDialog } from "@/components/meeting-form-dialog"
import { MeetingList } from "@/components/meeting-list"
import { Button } from "@/components/ui/button"
import { useMeetings } from "@/hooks/use-meetings"
import { formatLongDate, getMeetingStatus } from "@/lib/datetime"
import type { Meeting } from "@/lib/types"

/** Which dialog is open. The form doubles as "create" (no meeting) and "edit". */
type DialogState =
  | { kind: "none" }
  | { kind: "form"; meeting?: Meeting }
  | { kind: "details"; meeting: Meeting }
  | { kind: "delete"; meeting: Meeting }

export function TodayPage({ initialDialogOpen = false }: { initialDialogOpen?: boolean }) {
  const [dialog, setDialog] = useState<DialogState>(
    initialDialogOpen ? { kind: "form" } : { kind: "none" },
  )
  const [windowTab, setWindowTab] = useState<"all" | "upcoming" | "past">("all")
  // Kept after closing so dialogs keep their content during the close animation.
  const [selected, setSelected] = useState<Meeting>()
  const [editing, setEditing] = useState<Meeting>()
  const { data, refetch, isFetching, dataUpdatedAt } = useMeetings()

  const count = data?.items.length ?? 0
  const upcomingCount =
    data?.items.filter((item) => getMeetingStatus(item.starts_at, item.ends_at) !== "past").length ?? 0
  const pastCount =
    data?.items.filter((item) => getMeetingStatus(item.starts_at, item.ends_at) === "past").length ?? 0

  // Details show the freshest copy from the list, e.g. right after an edit.
  const current = data?.items.find((item) => item.id === selected?.id) ?? selected

  const open = (next: DialogState) => {
    if (next.kind !== "none") setSelected(next.meeting)
    if (next.kind === "form") setEditing(next.meeting)
    setDialog(next)
  }
  const close = () => setDialog({ kind: "none" })

  const onCreate = () => open({ kind: "form" })
  const onView = (meeting: Meeting) => open({ kind: "details", meeting })
  const onEdit = (meeting: Meeting) => open({ kind: "form", meeting })
  const onDelete = (meeting: Meeting) => open({ kind: "delete", meeting })

  const syncTimestamp = dataUpdatedAt
    ? new Date(dataUpdatedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })
    : null

  return (
    <>
      <AppHeader onCreate={onCreate} />

      <main className="mx-auto w-full max-w-6xl px-4 pt-10 pb-16 sm:px-6 lg:px-8">
        {/* Header section with Date and Quick Refresh */}
        <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-gradient-canva text-4xl font-bold tracking-tight sm:text-5xl">
              Today
            </h1>
            {data ? (
              <p className="text-muted-foreground mt-2 text-base">{formatLongDate(data.date)}</p>
            ) : null}
          </div>

          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            {syncTimestamp ? (
              <div className="flex items-center gap-1.5 rounded-full border border-border/80 bg-background/80 px-3 py-1.5 text-xs text-muted-foreground shadow-xs">
                <span className="size-2 rounded-full bg-emerald-500 animate-pulse" />
                <span>Last synced: <span className="font-mono font-medium text-foreground">{syncTimestamp}</span></span>
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

        {/* Window Switcher Tabs (Separates Past meetings vs Active/Upcoming) */}
        <div className="mb-8 flex flex-wrap items-center justify-between gap-3 border-b border-border/60 pb-3">
          <div className="inline-flex rounded-xl bg-muted/60 p-1 text-xs sm:text-sm font-medium">
            <button
              type="button"
              onClick={() => setWindowTab("all")}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 transition-all ${
                windowTab === "all"
                  ? "bg-background text-foreground shadow-xs font-semibold"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Layers className="size-3.5 sm:size-4" />
              <span>All Windows</span>
              <span className="ml-1 rounded-full bg-muted px-2 py-0.2 text-xs font-semibold text-foreground tabular-nums">
                {count}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setWindowTab("upcoming")}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 transition-all ${
                windowTab === "upcoming"
                  ? "bg-background text-foreground shadow-xs font-semibold"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Sparkles className="size-3.5 sm:size-4 text-primary" />
              <span>Upcoming & Live</span>
              <span className="ml-1 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 px-2 py-0.2 text-xs font-semibold tabular-nums">
                {upcomingCount}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setWindowTab("past")}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 transition-all ${
                windowTab === "past"
                  ? "bg-background text-foreground shadow-xs font-semibold"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <History className="size-3.5 sm:size-4 text-zinc-500" />
              <span>Past Meetings</span>
              <span className="ml-1 rounded-full bg-zinc-200 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 px-2 py-0.2 text-xs font-semibold tabular-nums">
                {pastCount}
              </span>
            </button>
          </div>

          <div className="hidden sm:flex items-center gap-2 text-xs text-muted-foreground">
            <CalendarDays className="size-3.5" />
            <span>Timezone: {Intl.DateTimeFormat().resolvedOptions().timeZone}</span>
          </div>
        </div>

        <MeetingList
          windowTab={windowTab}
          onCreate={onCreate}
          onView={onView}
          onEdit={onEdit}
          onDelete={onDelete}
        />
      </main>

      <MeetingFormDialog
        open={dialog.kind === "form"}
        onOpenChange={(isOpen) => !isOpen && close()}
        meeting={editing}
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
