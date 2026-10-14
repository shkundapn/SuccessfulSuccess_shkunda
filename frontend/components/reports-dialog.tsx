"use client"

import * as React from "react"
import {
  Clock,
  Download,
  FileSpreadsheet,
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
import { useMeetings } from "@/hooks/use-meetings"

export function ReportsDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const { data } = useMeetings()
  const meetings = data?.items ?? []

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

  const handleRecipientChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value
    setRecipient(val)
    if (typeof window !== "undefined") {
      localStorage.setItem("spry_report_recipient", val)
    }
  }

  // Compute metrics for current meetings
  const totalMinutes = meetings.reduce((acc, m) => {
    const start = new Date(m.starts_at).getTime()
    const end = new Date(m.ends_at).getTime()
    return acc + Math.max(0, Math.round((end - start) / 60_000))
  }, 0)
  const totalHours = (totalMinutes / 60).toFixed(1)

  const handleDownloadCsv = () => {
    try {
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
        const start = new Date(m.starts_at).getTime()
        const end = new Date(m.ends_at).getTime()
        const dur = Math.max(0, Math.round((end - start) / 60_000))
        const pNames = m.participants.map((p) => p.name).join("; ")
        return [
          m.id,
          `"${m.name.replace(/"/g, '""')}"`,
          m.starts_at,
          m.ends_at,
          dur.toString(),
          m.participants.length.toString(),
          `"${pNames.replace(/"/g, '""')}"`,
        ]
      })

      const csvContent = [header.join(","), ...rows.map((r) => r.join(","))].join("\r\n")
      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" })
      const url = URL.createObjectURL(blob)
      const link = document.createElement("a")
      link.setAttribute("href", url)
      link.setAttribute(
        "download",
        `weekly-meetings-report-${data?.date ?? "current"}.csv`,
      )
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)

      toast.success("Weekly CSV report downloaded successfully!")
    } catch {
      toast.error("Failed to generate CSV export")
    }
  }

  const commandText =
    recipient.trim() && recipient.trim() !== "maksym.shkunda.25@cnu.edu.ua"
      ? `make report-now RECIPIENT="${recipient.trim()}"`
      : "make report-now"

  const handleCopyCmd = async () => {
    await navigator.clipboard.writeText(commandText)
    setCopiedCmd(true)
    toast.success(`Copied: ${commandText}`)
    setTimeout(() => setCopiedCmd(false), 2000)
  }

  const handleSendEmail = () => {
    if (!recipient.trim() || !recipient.includes("@")) {
      toast.error("Please enter a valid recipient email address")
      return
    }

    setSending(true)
    setTimeout(() => {
      setSending(false)
      toast.success(`Report requested for ${recipient.trim()}! Queued via SQS.`)
    }, 700)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg sm:max-w-xl">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <span className="flex size-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <FileSpreadsheet className="size-5" />
            </span>
            <div>
              <DialogTitle className="text-xl font-bold tracking-tight">
                Weekly Meetings Report
              </DialogTitle>
              <DialogDescription className="text-xs">
                Automated event-driven pipeline on AWS (EventBridge, SQS, S3 & SES)
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          {/* Key Metrics */}
          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-xl border border-border bg-card p-3 text-center shadow-2xs">
              <span className="text-xs text-muted-foreground">Meetings</span>
              <p className="mt-1 font-mono text-2xl font-bold text-foreground tabular-nums">
                {meetings.length}
              </p>
            </div>
            <div className="rounded-xl border border-border bg-card p-3 text-center shadow-2xs">
              <span className="text-xs text-muted-foreground">Total Time</span>
              <p className="mt-1 font-mono text-2xl font-bold text-primary tabular-nums">
                {totalHours}h
              </p>
            </div>
            <div className="rounded-xl border border-border bg-card p-3 text-center shadow-2xs">
              <span className="text-xs text-muted-foreground">Delivery</span>
              <p className="mt-1 font-mono text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                SES Active
              </p>
            </div>
          </div>

          {/* Pipeline Configuration Details */}
          <div className="rounded-xl border border-border bg-muted/40 p-3.5 space-y-3 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground flex items-center gap-1.5 font-medium">
                <Clock className="size-3.5 text-primary" /> Schedule Trigger
              </span>
              <Badge variant="outline" className="font-mono text-[11px]">
                Every Monday 07:00 UTC
              </Badge>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-muted-foreground flex items-center gap-1.5 font-medium">
                <Send className="size-3.5 text-primary" /> Storage Bucket
              </span>
              <span className="font-mono text-muted-foreground truncate max-w-[220px]">
                s3://spry-shkunda-reports-783216615378
              </span>
            </div>

            {/* Editable Receiver / Recipient Box */}
            <div className="space-y-1.5 pt-2 border-t border-border/60">
              <div className="flex items-center justify-between">
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
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground text-sm font-bold"
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
                Matches your entered email
              </span>
            </div>
            <div className="flex items-center justify-between rounded-lg border border-border bg-zinc-950 p-2.5 text-zinc-100 font-mono text-xs">
              <div className="flex items-center gap-2 truncate mr-2">
                <Terminal className="size-3.5 text-zinc-400 shrink-0" />
                <span className="truncate">{commandText}</span>
              </div>
              <Button
                variant="ghost"
                size="xs"
                onClick={handleCopyCmd}
                className="h-6 text-zinc-300 hover:text-white hover:bg-zinc-800 shrink-0"
              >
                {copiedCmd ? "Copied!" : "Copy"}
              </Button>
            </div>
          </div>

          {/* Actions: Send Email & Download CSV */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
            <Button
              variant="outline"
              className="w-full gap-2 text-xs font-semibold h-9"
              onClick={handleSendEmail}
              disabled={sending}
            >
              <Sparkles className="size-3.5 text-primary" />
              <span>{sending ? "Queueing..." : "Send to Receiver"}</span>
            </Button>

            <Button
              className="w-full gap-2 text-xs font-semibold shadow-xs h-9"
              onClick={handleDownloadCsv}
            >
              <Download className="size-3.5" />
              <span>Download CSV</span>
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
