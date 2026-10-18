"use client"

import * as React from "react"
import { useQuery } from "@tanstack/react-query"
import {
  CalendarDays,
  Clock,
  Download,
  FileSpreadsheet,
  Loader2,
  Mail,
  Send,
  Sparkles,
  Terminal,
} from "lucide-react"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import {
  getReportPreview,
  getReportWeeks,
  requestWeeklyReport,
  type ReportWeekOption,
} from "@/lib/api"

const DEFAULT_WEEKS: ReportWeekOption[] = [
  {
    week: "2026-W41",
    label: "2026-W41 (Oct 05 – Oct 11) — Last Week",
    start_date: "2026-10-05",
    end_date: "2026-10-11",
    is_current: false,
    is_last: true,
  },
  {
    week: "2026-W42",
    label: "2026-W42 (Oct 12 – Oct 18) — Current Week",
    start_date: "2026-10-12",
    end_date: "2026-10-18",
    is_current: true,
    is_last: false,
  },
  {
    week: "2026-W40",
    label: "2026-W40 (Sep 28 – Oct 04)",
    start_date: "2026-09-28",
    end_date: "2026-10-04",
    is_current: false,
    is_last: false,
  },
  {
    week: "2026-W39",
    label: "2026-W39 (Sep 21 – Sep 27)",
    start_date: "2026-09-21",
    end_date: "2026-09-27",
    is_current: false,
    is_last: false,
  },
]

export function ReportsDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  // Designated ISO week (defaults to 2026-W41 where demo meetings reside)
  const [selectedWeek, setSelectedWeek] = React.useState<string>("2026-W41")

  // Editable recipient email, initialized from localStorage or default
  const [recipient, setRecipient] = React.useState<string>(() => {
    if (typeof window !== "undefined") {
      return (
        localStorage.getItem("spry_report_recipient") ||
        "maksym.shkunda.25@cnu.edu.ua"
      )
    }
    return "maksym.shkunda.25@cnu.edu.ua"
  })

  const [sending, setSending] = React.useState(false)
  const [copiedCmd, setCopiedCmd] = React.useState(false)

  // Fetch recent weeks from API with fallback
  const { data: serverWeeks } = useQuery({
    queryKey: ["report-weeks"],
    queryFn: getReportWeeks,
    enabled: open,
    staleTime: 60_000,
  })
  const availableWeeks = serverWeeks && serverWeeks.length > 0 ? serverWeeks : DEFAULT_WEEKS

  // Query structured preview metrics for the designated week
  const { data: preview, isLoading: isPreviewLoading } = useQuery({
    queryKey: ["report-preview", selectedWeek],
    queryFn: () => getReportPreview(selectedWeek),
    enabled: open && Boolean(selectedWeek),
    staleTime: 10_000,
  })

  const handleRecipientChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value
    setRecipient(val)
    if (typeof window !== "undefined") {
      localStorage.setItem("spry_report_recipient", val)
    }
  }

  const handleDownloadCsv = () => {
    try {
      const meetings = preview?.meetings ?? []
      const header = [
        "Meeting ID",
        "Name",
        "Starts At",
        "Ends At",
        "Duration Minutes",
        "Participants Count",
        "Participants",
      ]
      const rows = meetings.map((m) => {
        const pNames = m.participants.join("; ")
        return [
          m.id,
          `"${m.name.replace(/"/g, '""')}"`,
          m.starts_at,
          m.ends_at,
          m.duration_min.toString(),
          m.participants_count.toString(),
          `"${pNames.replace(/"/g, '""')}"`,
        ]
      })

      const csvContent = [header.join(","), ...rows.map((r) => r.join(","))].join("\r\n")
      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" })
      const url = URL.createObjectURL(blob)
      const link = document.createElement("a")
      link.setAttribute("href", url)
      link.setAttribute("download", `weekly-meetings-report-${selectedWeek}.csv`)
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)

      toast.success(`Weekly CSV report for ${selectedWeek} downloaded!`)
    } catch {
      toast.error("Failed to generate CSV export")
    }
  }

  const commandText = `make report-now WEEK="${selectedWeek}" RECIPIENT="${recipient.trim()}"`

  const handleCopyCmd = async () => {
    await navigator.clipboard.writeText(commandText)
    setCopiedCmd(true)
    toast.success(`Copied: ${commandText}`)
    setTimeout(() => setCopiedCmd(false), 2000)
  }

  const handleSendEmail = async () => {
    if (!recipient.trim() || !recipient.includes("@")) {
      toast.error("Please enter a valid recipient email address")
      return
    }

    setSending(true)
    try {
      await requestWeeklyReport({
        week: selectedWeek.trim(),
        recipient: recipient.trim(),
      })
      toast.success(
        `Report for ${selectedWeek.trim()} requested for ${recipient.trim()}! Pipeline triggered via SQS. Check your inbox shortly.`,
      )
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to trigger report")
    } finally {
      setSending(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[88vh] overflow-y-auto w-full sm:max-w-xl p-5 sm:p-6">
        <DialogHeader className="pr-6">
          <div className="flex items-center gap-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <FileSpreadsheet className="size-5" />
            </span>
            <div className="min-w-0">
              <DialogTitle className="text-xl font-bold tracking-tight">
                Weekly Meetings Report
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                Automated event-driven pipeline on AWS (EventBridge, SQS, S3 & SES)
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          {/* Week Designation Selection */}
          <div className="rounded-xl border border-border bg-card p-3.5 space-y-2.5 shadow-xs">
            <div className="flex flex-wrap items-center justify-between gap-1.5">
              <label
                htmlFor="designated-week-input"
                className="text-xs font-semibold text-foreground flex items-center gap-1.5"
              >
                <CalendarDays className="size-3.5 text-primary" />
                <span>Designated Report Week</span>
              </label>
              <span className="text-[11px] text-muted-foreground font-mono">
                {preview?.period ? `Period: ${preview.period}` : "Format: YYYY-Www"}
              </span>
            </div>

            {/* Quick Week Chips */}
            <div className="flex flex-wrap gap-1.5">
              {availableWeeks.map((w) => {
                const isSelected = selectedWeek.toUpperCase() === w.week.toUpperCase()
                return (
                  <button
                    key={w.week}
                    type="button"
                    onClick={() => setSelectedWeek(w.week)}
                    className={`text-[11px] px-2.5 py-1 rounded-lg border font-mono transition-all cursor-pointer ${
                      isSelected
                        ? "bg-primary text-primary-foreground border-primary font-bold shadow-xs"
                        : "bg-muted/50 hover:bg-muted text-muted-foreground hover:text-foreground border-border"
                    }`}
                  >
                    {w.week}
                    {w.is_current ? " (Curr)" : w.is_last ? " (Last)" : ""}
                  </button>
                )
              })}
            </div>

            {/* Custom Input */}
            <div className="flex items-center gap-2 pt-0.5">
              <span className="text-xs text-muted-foreground shrink-0">Custom Week:</span>
              <Input
                id="designated-week-input"
                type="text"
                value={selectedWeek}
                onChange={(e) => setSelectedWeek(e.target.value.toUpperCase())}
                placeholder="e.g. 2026-W41"
                className="h-8 text-xs font-mono bg-background"
              />
            </div>
          </div>

          {/* Key Metrics for Designated Week */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            <div className="rounded-xl border border-border bg-card p-3 text-center shadow-xs">
              <span className="text-xs text-muted-foreground font-medium">Meetings</span>
              <p className="mt-1 font-mono text-2xl font-bold text-foreground tabular-nums">
                {isPreviewLoading ? (
                  <Loader2 className="size-5 animate-spin mx-auto text-muted-foreground" />
                ) : (
                  preview?.meetings_count ?? 0
                )}
              </p>
              <span className="text-[10px] text-muted-foreground">
                {preview && preview.delta_count !== undefined
                  ? `${preview.delta_count >= 0 ? "+" : ""}${preview.delta_count} vs prev`
                  : "for this week"}
              </span>
            </div>

            <div className="rounded-xl border border-border bg-card p-3 text-center shadow-xs">
              <span className="text-xs text-muted-foreground font-medium">Total Time</span>
              <p className="mt-1 font-mono text-2xl font-bold text-primary tabular-nums">
                {isPreviewLoading ? (
                  <Loader2 className="size-5 animate-spin mx-auto text-primary" />
                ) : (
                  `${preview?.duration_hours ?? 0}h`
                )}
              </p>
              <span className="text-[10px] text-muted-foreground">
                {preview && preview.delta_hours !== undefined
                  ? `${preview.delta_hours >= 0 ? "+" : ""}${preview.delta_hours}h vs prev`
                  : "hours"}
              </span>
            </div>

            <div className="rounded-xl border border-border bg-card p-3 text-center shadow-xs">
              <span className="text-xs text-muted-foreground font-medium">Unique Attendees</span>
              <p className="mt-1 font-mono text-2xl font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">
                {isPreviewLoading ? (
                  <Loader2 className="size-5 animate-spin mx-auto text-emerald-600" />
                ) : (
                  preview?.unique_participants_count ?? 0
                )}
              </p>
              <span className="text-[10px] text-muted-foreground">participants</span>
            </div>
          </div>

          {/* Pipeline Configuration Details */}
          <div className="rounded-xl border border-border bg-muted/40 p-3.5 space-y-3 text-xs">
            <div className="flex flex-wrap items-center justify-between gap-1">
              <span className="text-muted-foreground flex items-center gap-1.5 font-medium">
                <Clock className="size-3.5 text-primary" /> Schedule Trigger
              </span>
              <Badge variant="outline" className="font-mono text-[11px]">
                Every Monday 07:00 UTC
              </Badge>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-1">
              <span className="text-muted-foreground flex items-center gap-1.5 font-medium">
                <Send className="size-3.5 text-primary" /> Storage Bucket
              </span>
              <span className="font-mono text-muted-foreground text-[11px] truncate max-w-[240px]">
                s3://spry-shkunda-reports-783216615378
              </span>
            </div>

            {/* Editable Receiver / Recipient Box */}
            <div className="space-y-1.5 pt-2 border-t border-border/60">
              <div className="flex flex-wrap items-center justify-between gap-1">
                <label
                  htmlFor="report-recipient-email"
                  className="font-medium text-foreground flex items-center gap-1.5"
                >
                  <Mail className="size-3.5 text-primary" />
                  <span>Receiver Email (Fillable)</span>
                </label>
                <span className="text-[11px] text-muted-foreground">
                  Delivered via Amazon SES
                </span>
              </div>
              <div className="relative">
                <Input
                  id="report-recipient-email"
                  type="email"
                  value={recipient}
                  onChange={handleRecipientChange}
                  placeholder="Enter recipient email address..."
                  className="h-8 pr-8 text-xs font-mono bg-card"
                />
                {recipient ? (
                  <button
                    type="button"
                    onClick={() => {
                      setRecipient("")
                      if (typeof window !== "undefined") {
                        localStorage.removeItem("spry_report_recipient")
                      }
                    }}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground text-sm font-bold cursor-pointer"
                    aria-label="Clear receiver email"
                  >
                    ×
                  </button>
                ) : null}
              </div>
            </div>
          </div>

          {/* Action: Trigger CLI or Download */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold">On-Demand SQS Command:</span>
              <span className="text-[11px] text-muted-foreground">
                Designated Week & Recipient
              </span>
            </div>
            <div className="flex items-center justify-between gap-2 rounded-lg border border-border bg-zinc-950 p-2.5 text-zinc-100 font-mono text-xs overflow-hidden">
              <div className="flex items-center gap-2 min-w-0 flex-1 overflow-hidden">
                <Terminal className="size-3.5 text-zinc-400 shrink-0" />
                <span className="truncate block font-mono text-[11px] text-zinc-200">{commandText}</span>
              </div>
              <Button
                variant="ghost"
                size="xs"
                onClick={handleCopyCmd}
                className="h-6 text-xs text-zinc-300 hover:text-white hover:bg-zinc-800 shrink-0 cursor-pointer"
              >
                {copiedCmd ? "Copied!" : "Copy"}
              </Button>
            </div>
          </div>

          {/* Actions: Send Email & Download CSV */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
            <Button
              variant="outline"
              className="w-full gap-2 text-xs font-semibold h-10 px-3 cursor-pointer"
              onClick={handleSendEmail}
              disabled={sending}
            >
              <Sparkles className="size-3.5 text-primary shrink-0" />
              <span className="truncate">{sending ? "Queueing..." : `Send ${selectedWeek} to Receiver`}</span>
            </Button>

            <Button
              className="w-full gap-2 text-xs font-semibold shadow-xs h-10 px-3 cursor-pointer"
              onClick={handleDownloadCsv}
            >
              <Download className="size-3.5 shrink-0" />
              <span className="truncate">Download {selectedWeek} CSV</span>
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
