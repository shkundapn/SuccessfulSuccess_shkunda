"use client"

import { useState, useRef, useTransition } from "react"
import {
  Sparkles,
  Loader2,
  XCircle,
  Plus,
  Trash2,
  Clock,
  CheckCircle2,
  Calendar,
  User,
  AlertCircle,
  FileText,
} from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { parseAgenda, saveMeetingAgenda } from "@/lib/api"
import type { Meeting, ParsedAgenda, AgendaItem, ActionItem } from "@/lib/types"

const MAX_PASTE_CHARS = 10000

export function AgendaSection({
  meeting,
  onSaved,
}: {
  meeting: Meeting
  onSaved?: (updated: Meeting) => void
}) {
  const hasExistingAgenda = Boolean(meeting.agenda && (meeting.agenda.items?.length || meeting.agenda.title))
  const [isEditing, setIsEditing] = useState(!hasExistingAgenda)
  const [pastedText, setPastedText] = useState("")
  const [isParsing, setIsParsing] = useState(false)
  const [parseError, setParseError] = useState<string | null>(null)
  const [isSaving, startSaving] = useTransition()

  // AbortController for canceling ongoing AI requests
  const abortControllerRef = useRef<AbortController | null>(null)

  // Current agenda form state
  const [title, setTitle] = useState(meeting.agenda?.title ?? "")
  const [durationMinutes, setDurationMinutes] = useState<number | string>(
    meeting.agenda?.duration_minutes ?? ""
  )
  const [items, setItems] = useState<AgendaItem[]>(meeting.agenda?.items ?? [])
  const [actionItems, setActionItems] = useState<ActionItem[]>(meeting.agenda?.action_items ?? [])

  // Stored original AI suggestion and metadata for feedback loop
  const [aiSuggestion, setAiSuggestion] = useState<ParsedAgenda | null>(
    meeting.ai_suggestion?.suggestion ?? null
  )
  const [modelUsed, setModelUsed] = useState<string | null>(
    meeting.ai_suggestion?.model ?? null
  )
  const [promptVersion, setPromptVersion] = useState<string | null>(
    meeting.ai_suggestion?.prompt_version ?? null
  )

  // Set of field identifiers that are currently marked as "suggested"
  const [suggestedFields, setSuggestedFields] = useState<Set<string>>(new Set())

  // Mark field as touched (removes suggestion badge)
  const touchField = (key: string) => {
    if (suggestedFields.has(key)) {
      setSuggestedFields((prev) => {
        const next = new Set(prev)
        next.delete(key)
        return next
      })
    }
  }

  // Handle Parse button click
  const handleParse = async () => {
    if (!pastedText.trim()) {
      setParseError("Please paste some text first.")
      return
    }
    if (pastedText.length > MAX_PASTE_CHARS) {
      setParseError(
        `Text is too long (${pastedText.length} characters). The limit is ${MAX_PASTE_CHARS}.`
      )
      return
    }

    setParseError(null)
    setIsParsing(true)

    const controller = new AbortController()
    abortControllerRef.current = controller

    try {
      const todayStr = new Date().toISOString().split("T")[0]
      const tzStr = Intl.DateTimeFormat().resolvedOptions().timeZone || "Europe/Kyiv"

      const result = await parseAgenda(pastedText, todayStr, tzStr, controller.signal)
      const parsed = result.agenda

      // Update form state with parsed values
      setTitle(parsed.title ?? "")
      setDurationMinutes(parsed.duration_minutes ?? "")
      setItems(parsed.items ?? [])
      setActionItems(parsed.action_items ?? [])

      // Save suggestion for feedback auditing
      setAiSuggestion(parsed)
      setModelUsed(result.model)
      setPromptVersion(result.prompt_version)

      // Mark all populated fields as "suggested"
      const suggested = new Set<string>()
      if (parsed.title) suggested.add("title")
      if (parsed.duration_minutes != null) suggested.add("duration_minutes")
      parsed.items?.forEach((item, index) => {
        if (item.topic) suggested.add(`item_${index}_topic`)
        if (item.owner) suggested.add(`item_${index}_owner`)
        if (item.minutes != null) suggested.add(`item_${index}_minutes`)
      })
      parsed.action_items?.forEach((action, index) => {
        if (action.task) suggested.add(`action_${index}_task`)
        if (action.owner) suggested.add(`action_${index}_owner`)
        if (action.due) suggested.add(`action_${index}_due`)
      })
      setSuggestedFields(suggested)

      toast.success("Agenda parsed! Review the suggested fields and click Save.")
    } catch (err: unknown) {
      if (err instanceof Error && err.name === "AbortError") {
        toast.info("Agenda parsing canceled.")
        setParseError("Parsing was canceled by user.")
      } else {
        const message = err instanceof Error ? err.message : "Failed to parse agenda."
        setParseError(message)
        toast.error(message)
      }
    } finally {
      setIsParsing(false)
      abortControllerRef.current = null
    }
  }

  // Handle Cancel parsing button
  const handleCancelParse = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
      abortControllerRef.current = null
    }
  }

  // Handle Save Agenda
  const handleSave = () => {
    const agendaPayload: ParsedAgenda = {
      title: title.trim() || null,
      starts_at: null,
      duration_minutes: durationMinutes !== "" ? Number(durationMinutes) : null,
      items: items.map((i) => ({
        topic: i.topic.trim(),
        owner: i.owner ? i.owner.trim() : null,
        minutes: i.minutes != null ? Number(i.minutes) : null,
      })),
      action_items: actionItems.map((a) => ({
        task: a.task.trim(),
        owner: a.owner ? a.owner.trim() : null,
        due: a.due ? a.due.trim() : null,
      })),
      language: null,
    }

    startSaving(async () => {
      try {
        const updated = await saveMeetingAgenda(meeting.id, {
          agenda: agendaPayload,
          ai_suggestion: aiSuggestion,
          model: modelUsed,
          prompt_version: promptVersion,
        })
        toast.success("Agenda saved successfully!")
        setSuggestedFields(new Set())
        setIsEditing(false)
        if (onSaved) onSaved(updated)
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Failed to save agenda."
        toast.error(message)
      }
    })
  }

  // Add empty agenda item
  const handleAddItem = () => {
    setItems((prev) => [...prev, { topic: "", owner: null, minutes: null }])
  }

  // Remove agenda item
  const handleRemoveItem = (index: number) => {
    setItems((prev) => prev.filter((_, i) => i !== index))
  }

  // Add empty action item
  const handleAddActionItem = () => {
    setActionItems((prev) => [...prev, { task: "", owner: null, due: null }])
  }

  // Remove action item
  const handleRemoveActionItem = (index: number) => {
    setActionItems((prev) => prev.filter((_, i) => i !== index))
  }

  return (
    <div id="agenda-section" className="space-y-4 pt-2">
      <div className="flex items-center justify-between">
        <h3 className="flex items-center gap-2 text-sm font-semibold">
          <FileText className="size-4 text-primary" aria-hidden />
          Meeting Agenda
          {meeting.agenda?.title ? (
            <span className="text-muted-foreground text-xs font-normal">
              • {meeting.agenda.items?.length ?? 0} items
            </span>
          ) : null}
        </h3>
        {!isEditing && hasExistingAgenda ? (
          <Button
            variant="outline"
            size="xs"
            onClick={() => setIsEditing(true)}
            className="h-7 text-xs"
          >
            Edit Agenda
          </Button>
        ) : null}
      </div>

      {/* VIEW MODE: Displays formatted saved agenda */}
      {!isEditing && hasExistingAgenda ? (
        <div className="rounded-lg border bg-zinc-50/50 dark:bg-zinc-900/40 p-4 space-y-3 text-sm">
          <div className="flex items-start justify-between gap-2">
            <div>
              <h4 className="font-semibold text-base">{meeting.agenda?.title || "Agenda"}</h4>
              {meeting.agenda?.duration_minutes ? (
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-0.5">
                  <Clock className="size-3.5" />
                  <span>{meeting.agenda.duration_minutes} minutes allocated</span>
                </div>
              ) : null}
            </div>
            {meeting.ai_suggestion ? (
              <Badge variant="outline" className="text-[11px] gap-1 font-mono">
                <Sparkles className="size-3 text-amber-500" />
                AI Parsed
              </Badge>
            ) : null}
          </div>

          {/* Agenda Items list */}
          {meeting.agenda?.items && meeting.agenda.items.length > 0 ? (
            <div className="space-y-2 pt-1">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Topics
              </p>
              <ul className="space-y-2">
                {meeting.agenda.items.map((item, idx) => (
                  <li
                    key={idx}
                    className="flex items-center justify-between gap-2 rounded-md bg-white dark:bg-zinc-800/80 px-3 py-2 border text-xs"
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground font-mono font-medium">{idx + 1}.</span>
                      <span className="font-medium text-foreground">{item.topic}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {item.owner ? (
                        <span className="inline-flex items-center gap-1 text-muted-foreground bg-zinc-100 dark:bg-zinc-700/60 px-2 py-0.5 rounded-full">
                          <User className="size-3" />
                          {item.owner}
                        </span>
                      ) : null}
                      {item.minutes ? (
                        <span className="inline-flex items-center gap-1 text-muted-foreground font-mono">
                          <Clock className="size-3" />
                          {item.minutes}m
                        </span>
                      ) : null}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {/* Action Items list */}
          {meeting.agenda?.action_items && meeting.agenda.action_items.length > 0 ? (
            <div className="space-y-2 pt-2">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Action Items
              </p>
              <ul className="space-y-1.5">
                {meeting.agenda.action_items.map((action, idx) => (
                  <li
                    key={idx}
                    className="flex items-center justify-between gap-2 rounded-md bg-white dark:bg-zinc-800/80 px-3 py-2 border text-xs"
                  >
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="size-3.5 text-emerald-500 shrink-0" />
                      <span>{action.task}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {action.owner ? (
                        <span className="text-muted-foreground">{action.owner}</span>
                      ) : null}
                      {action.due ? (
                        <Badge variant="secondary" className="text-[10px] gap-1">
                          <Calendar className="size-2.5" />
                          {action.due}
                        </Badge>
                      ) : null}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      ) : (
        /* EDIT / PASTE MODE */
        <div className="space-y-4">
          {/* Card: Paste an agenda */}
          <div className="rounded-lg border bg-card p-4 space-y-3 shadow-xs">
            <div className="flex items-center justify-between">
              <label htmlFor="agenda-paste-box" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <Sparkles className="size-3.5 text-primary" />
                Paste an agenda (notes, email, chat)
              </label>
              <span
                className={`font-mono text-xs ${
                  pastedText.length > MAX_PASTE_CHARS
                    ? "text-destructive font-semibold"
                    : "text-muted-foreground"
                }`}
              >
                {pastedText.length.toLocaleString()} / {MAX_PASTE_CHARS.toLocaleString()}
              </span>
            </div>

            <Textarea
              id="agenda-paste-box"
              placeholder="e.g.: Пн 10:00, синк по прайсингу, 45 хв. 1) нові тарифи Pro — Олена, 15 хв 2) фідбек від клієнтів — Taras 3) що робимо з річною знижкою. Taras до п'ятниці збирає порівняння з конкурентами."
              value={pastedText}
              onChange={(e) => {
                setPastedText(e.target.value)
                if (parseError) setParseError(null)
              }}
              rows={3}
              className="resize-y text-xs font-sans"
              disabled={isParsing}
            />

            {parseError ? (
              <div className="flex items-center gap-2 text-destructive text-xs p-2 rounded-md bg-destructive/10">
                <AlertCircle className="size-4 shrink-0" />
                <span>{parseError}</span>
              </div>
            ) : null}

            <div className="flex items-center justify-between">
              <div className="text-[11px] text-muted-foreground">
                Parsed by Amazon Bedrock LLM outside VPC ($0 idle cost)
              </div>

              <div className="flex items-center gap-2">
                {isParsing ? (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleCancelParse}
                    className="gap-1.5 text-destructive hover:text-destructive h-8 text-xs"
                  >
                    <XCircle className="size-3.5" />
                    Cancel
                  </Button>
                ) : null}

                <Button
                  size="sm"
                  onClick={handleParse}
                  disabled={isParsing || !pastedText.trim() || pastedText.length > MAX_PASTE_CHARS}
                  className="gap-1.5 h-8 text-xs"
                >
                  {isParsing ? (
                    <>
                      <Loader2 className="size-3.5 animate-spin" />
                      Parsing...
                    </>
                  ) : (
                    <>
                      <Sparkles className="size-3.5" />
                      Parse with AI
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>

          {/* Form: Pre-filled / Structured Agenda */}
          <div className="rounded-lg border bg-card p-4 space-y-4">
            <div className="flex items-center justify-between border-b pb-2">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Structured Agenda Form
              </h4>
              {suggestedFields.size > 0 ? (
                <span className="text-[11px] text-amber-600 dark:text-amber-400 font-medium">
                  {suggestedFields.size} fields suggested by AI (edit to verify)
                </span>
              ) : null}
            </div>

            {/* Title & Duration */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="sm:col-span-2 space-y-1">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-medium">Agenda Title</label>
                  {suggestedFields.has("title") ? (
                    <Badge variant="secondary" className="h-4 px-1 text-[10px] bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30 gap-0.5">
                      <Sparkles className="size-2" /> suggested
                    </Badge>
                  ) : null}
                </div>
                <Input
                  placeholder="e.g. Pricing Sync"
                  value={title}
                  onChange={(e) => {
                    touchField("title")
                    setTitle(e.target.value)
                  }}
                  className="h-8 text-xs"
                />
              </div>

              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-medium">Duration (min)</label>
                  {suggestedFields.has("duration_minutes") ? (
                    <Badge variant="secondary" className="h-4 px-1 text-[10px] bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30 gap-0.5">
                      <Sparkles className="size-2" /> suggested
                    </Badge>
                  ) : null}
                </div>
                <Input
                  type="number"
                  placeholder="45"
                  value={durationMinutes}
                  onChange={(e) => {
                    touchField("duration_minutes")
                    setDurationMinutes(e.target.value)
                  }}
                  className="h-8 text-xs font-mono"
                />
              </div>
            </div>

            <Separator />

            {/* Agenda Topics */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-xs font-medium flex items-center gap-1.5">
                  <Clock className="size-3.5 text-muted-foreground" />
                  Agenda Topics ({items.length})
                </label>
                <Button
                  type="button"
                  variant="outline"
                  size="xs"
                  onClick={handleAddItem}
                  className="h-7 text-xs gap-1"
                >
                  <Plus className="size-3" /> Add Topic
                </Button>
              </div>

              {items.length === 0 ? (
                <p className="text-xs text-muted-foreground italic py-1">
                  No topics added yet. Click &quot;Parse with AI&quot; above or Add Topic manually.
                </p>
              ) : (
                <div className="space-y-2">
                  {items.map((item, idx) => (
                    <div
                      key={idx}
                      className="flex flex-col sm:flex-row items-start sm:items-center gap-2 p-2 rounded-md border bg-zinc-50/50 dark:bg-zinc-900/30 text-xs"
                    >
                      <span className="font-mono text-muted-foreground w-4 shrink-0">{idx + 1}.</span>

                      {/* Topic Input */}
                      <div className="flex-1 w-full space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] text-muted-foreground">Topic</span>
                          {suggestedFields.has(`item_${idx}_topic`) ? (
                            <Badge variant="secondary" className="h-3.5 px-1 text-[9px] bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30 gap-0.5">
                              <Sparkles className="size-2" /> suggested
                            </Badge>
                          ) : null}
                        </div>
                        <Input
                          placeholder="e.g. Pro Plan Pricing"
                          value={item.topic}
                          onChange={(e) => {
                            touchField(`item_${idx}_topic`)
                            const val = e.target.value
                            setItems((prev) =>
                              prev.map((it, i) => (i === idx ? { ...it, topic: val } : it))
                            )
                          }}
                          className="h-7 text-xs"
                        />
                      </div>

                      {/* Owner Input */}
                      <div className="w-full sm:w-28 space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] text-muted-foreground">Owner</span>
                          {suggestedFields.has(`item_${idx}_owner`) ? (
                            <Badge variant="secondary" className="h-3.5 px-1 text-[9px] bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30 gap-0.5">
                              <Sparkles className="size-2" /> suggested
                            </Badge>
                          ) : null}
                        </div>
                        <Input
                          placeholder="e.g. Olena"
                          value={item.owner ?? ""}
                          onChange={(e) => {
                            touchField(`item_${idx}_owner`)
                            const val = e.target.value
                            setItems((prev) =>
                              prev.map((it, i) => (i === idx ? { ...it, owner: val || null } : it))
                            )
                          }}
                          className="h-7 text-xs"
                        />
                      </div>

                      {/* Minutes Input */}
                      <div className="w-full sm:w-20 space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] text-muted-foreground">Min</span>
                          {suggestedFields.has(`item_${idx}_minutes`) ? (
                            <Badge variant="secondary" className="h-3.5 px-1 text-[9px] bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30 gap-0.5">
                              <Sparkles className="size-2" /> suggested
                            </Badge>
                          ) : null}
                        </div>
                        <Input
                          type="number"
                          placeholder="15"
                          value={item.minutes ?? ""}
                          onChange={(e) => {
                            touchField(`item_${idx}_minutes`)
                            const val = e.target.value
                            setItems((prev) =>
                              prev.map((it, i) =>
                                i === idx ? { ...it, minutes: val !== "" ? Number(val) : null } : it
                              )
                            )
                          }}
                          className="h-7 text-xs font-mono"
                        />
                      </div>

                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => handleRemoveItem(idx)}
                        className="h-7 w-7 text-muted-foreground hover:text-destructive shrink-0 mt-4 sm:mt-0"
                      >
                        <Trash2 className="size-3" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <Separator />

            {/* Action Items */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-xs font-medium flex items-center gap-1.5">
                  <CheckCircle2 className="size-3.5 text-muted-foreground" />
                  Action Items ({actionItems.length})
                </label>
                <Button
                  type="button"
                  variant="outline"
                  size="xs"
                  onClick={handleAddActionItem}
                  className="h-7 text-xs gap-1"
                >
                  <Plus className="size-3" /> Add Action
                </Button>
              </div>

              {actionItems.length === 0 ? (
                <p className="text-xs text-muted-foreground italic py-1">
                  No action items extracted.
                </p>
              ) : (
                <div className="space-y-2">
                  {actionItems.map((action, idx) => (
                    <div
                      key={idx}
                      className="flex flex-col sm:flex-row items-start sm:items-center gap-2 p-2 rounded-md border bg-zinc-50/50 dark:bg-zinc-900/30 text-xs"
                    >
                      {/* Task Input */}
                      <div className="flex-1 w-full space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] text-muted-foreground">Task</span>
                          {suggestedFields.has(`action_${idx}_task`) ? (
                            <Badge variant="secondary" className="h-3.5 px-1 text-[9px] bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30 gap-0.5">
                              <Sparkles className="size-2" /> suggested
                            </Badge>
                          ) : null}
                        </div>
                        <Input
                          placeholder="e.g. Gather competitor comparison"
                          value={action.task}
                          onChange={(e) => {
                            touchField(`action_${idx}_task`)
                            const val = e.target.value
                            setActionItems((prev) =>
                              prev.map((it, i) => (i === idx ? { ...it, task: val } : it))
                            )
                          }}
                          className="h-7 text-xs"
                        />
                      </div>

                      {/* Owner Input */}
                      <div className="w-full sm:w-28 space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] text-muted-foreground">Owner</span>
                          {suggestedFields.has(`action_${idx}_owner`) ? (
                            <Badge variant="secondary" className="h-3.5 px-1 text-[9px] bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30 gap-0.5">
                              <Sparkles className="size-2" /> suggested
                            </Badge>
                          ) : null}
                        </div>
                        <Input
                          placeholder="e.g. Taras"
                          value={action.owner ?? ""}
                          onChange={(e) => {
                            touchField(`action_${idx}_owner`)
                            const val = e.target.value
                            setActionItems((prev) =>
                              prev.map((it, i) => (i === idx ? { ...it, owner: val || null } : it))
                            )
                          }}
                          className="h-7 text-xs"
                        />
                      </div>

                      {/* Due Date Input */}
                      <div className="w-full sm:w-28 space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] text-muted-foreground">Due Date</span>
                          {suggestedFields.has(`action_${idx}_due`) ? (
                            <Badge variant="secondary" className="h-3.5 px-1 text-[9px] bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30 gap-0.5">
                              <Sparkles className="size-2" /> suggested
                            </Badge>
                          ) : null}
                        </div>
                        <Input
                          placeholder="YYYY-MM-DD"
                          value={action.due ?? ""}
                          onChange={(e) => {
                            touchField(`action_${idx}_due`)
                            const val = e.target.value
                            setActionItems((prev) =>
                              prev.map((it, i) => (i === idx ? { ...it, due: val || null } : it))
                            )
                          }}
                          className="h-7 text-xs font-mono"
                        />
                      </div>

                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => handleRemoveActionItem(idx)}
                        className="h-7 w-7 text-muted-foreground hover:text-destructive shrink-0 mt-4 sm:mt-0"
                      >
                        <Trash2 className="size-3" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Bottom Actions: Save & Cancel */}
            <div className="flex items-center justify-between pt-3 border-t">
              {hasExistingAgenda ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsEditing(false)}
                  disabled={isSaving}
                  className="h-8 text-xs"
                >
                  Cancel
                </Button>
              ) : (
                <div />
              )}

              <Button
                type="button"
                size="sm"
                onClick={handleSave}
                disabled={isSaving || isParsing || (!title.trim() && items.length === 0)}
                className="gap-1.5 h-8 text-xs font-semibold ml-auto"
              >
                {isSaving ? (
                  <>
                    <Loader2 className="size-3.5 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="size-3.5" />
                    Save Agenda
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
