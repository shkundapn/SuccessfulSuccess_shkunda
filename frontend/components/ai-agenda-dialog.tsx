"use client"

import { useState } from "react"
import { Sparkles, Calendar, Layers } from "lucide-react"

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { AgendaSection } from "@/components/agenda-section"
import { useMeetings } from "@/hooks/use-meetings"
import type { Meeting } from "@/lib/types"

export function AiAgendaDialog({
  open,
  onOpenChange,
  targetMeeting,
  onMeetingUpdated,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  targetMeeting?: Meeting
  onMeetingUpdated?: (updated: Meeting) => void
}) {
  const { data } = useMeetings()
  const meetings = data?.items ?? []

  const [selectedId, setSelectedId] = useState<string>("")

  // Determine which meeting is active: explicitly selected, or targetMeeting, or first meeting
  const activeMeeting =
    meetings.find((m) => m.id === selectedId) ||
    targetMeeting ||
    meetings[0]

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[88vh] overflow-y-auto w-full sm:max-w-2xl p-5 sm:p-6">
        <DialogHeader className="pr-6">
          <div className="flex items-center gap-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Sparkles className="size-5" />
            </span>
            <div className="min-w-0">
              <DialogTitle className="text-xl font-bold tracking-tight flex items-center gap-2">
                <span>AI Agenda Parser</span>
                <span className="text-[10px] uppercase font-mono font-bold tracking-wider px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
                  Amazon Bedrock
                </span>
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                Paste raw notes, chat messages, or an email — AI suggests, you decide & save
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* Meeting selector if there are multiple meetings */}
        {meetings.length > 1 ? (
          <div className="rounded-xl border border-border bg-card p-3 space-y-1.5 shadow-xs">
            <div className="flex items-center justify-between">
              <label
                htmlFor="meeting-picker-select"
                className="text-xs font-semibold text-foreground flex items-center gap-1.5"
              >
                <Layers className="size-3.5 text-primary" />
                <span>Target Meeting</span>
              </label>
              <span className="text-[11px] text-muted-foreground">
                Agenda will attach to this meeting
              </span>
            </div>
            <select
              id="meeting-picker-select"
              value={activeMeeting?.id || ""}
              onChange={(e) => setSelectedId(e.target.value)}
              className="w-full text-xs rounded-lg border border-border bg-background px-3 py-2 font-medium focus:outline-none focus:ring-2 focus:ring-primary/20 cursor-pointer"
            >
              {meetings.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name} — {new Date(m.starts_at).toLocaleDateString([], { month: "short", day: "numeric" })} at {new Date(m.starts_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </option>
              ))}
            </select>
          </div>
        ) : null}

        {activeMeeting ? (
          <div className="pt-1">
            <AgendaSection
              key={activeMeeting.id}
              meeting={activeMeeting}
              onSaved={(updated) => {
                if (onMeetingUpdated) onMeetingUpdated(updated)
              }}
            />
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-border p-8 text-center space-y-2">
            <Calendar className="size-8 mx-auto text-muted-foreground/50" />
            <h4 className="text-sm font-semibold text-foreground">No meetings found</h4>
            <p className="text-xs text-muted-foreground max-w-sm mx-auto">
              Agendas in SuccessfulSuccess attach to a meeting. Create a meeting first, then paste your agenda notes to parse them into structured topics and action items.
            </p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
