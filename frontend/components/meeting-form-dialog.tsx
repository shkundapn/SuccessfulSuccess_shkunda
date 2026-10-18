import { zodResolver } from "@hookform/resolvers/zod"
import {
  CalendarIcon,
  CheckCircle2,
  Loader2,
  Mic,
  MicOff,
  Sparkles,
  XCircle,
} from "lucide-react"
import { useEffect, useRef, useState } from "react"
import { Controller, useForm } from "react-hook-form"
import { toast } from "sonner"
import { z } from "zod"

import { ParticipantsInput } from "@/components/participants-input"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Textarea } from "@/components/ui/textarea"
import { useCreateMeeting, useUpdateMeeting } from "@/hooks/use-meetings"
import { ApiError, parseAgenda, saveMeetingAgenda } from "@/lib/api"
import { formatTime, parseIsoDay, toIsoDate, toIsoWithOffset } from "@/lib/datetime"
import type { Meeting, ParsedAgenda } from "@/lib/types"

const timePattern = /^([01]\d|2[0-3]):([0-5]\d)$/

const participantSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(120, "Name is too long"),
  email: z
    .string()
    .trim()
    .max(255)
    .refine((value) => value === "" || z.email().safeParse(value).success, {
      message: "Enter a valid email address",
    })
    .optional(),
})

const formSchema = z
  .object({
    name: z.string().trim().min(1, "Name is required").max(200, "Name is too long"),
    description: z.string().trim().max(2000, "Description is too long").optional(),
    location: z.string().trim().max(200, "Location is too long").optional(),
    date: z.date(),
    startTime: z.string().regex(timePattern, "Use HH:mm"),
    endTime: z.string().regex(timePattern, "Use HH:mm"),
    participants: z.array(participantSchema).max(50, "At most 50 participants"),
  })
  .refine((data) => data.endTime > data.startTime, {
    message: "The meeting must end after it starts",
    path: ["endTime"],
  })
  .refine(
    (data) => {
      const keys = data.participants.map(
        (p) => `${p.name.trim().toLowerCase()}|${(p.email ?? "").trim().toLowerCase()}`,
      )
      return new Set(keys).size === keys.length
    },
    { message: "Participants must be unique", path: ["participants"] },
  )

type FormValues = z.infer<typeof formSchema>

type ParticipantErrors = { name?: { message?: string }; email?: { message?: string } }

/** Flattens react-hook-form's per-row participant errors into { rowIndex: message }. */
function participantErrors(
  rows: unknown,
): Record<number, string | undefined> {
  if (!Array.isArray(rows)) return {}
  return Object.fromEntries(
    rows.map((row: ParticipantErrors | undefined, index: number) => [
      index,
      row?.name?.message ?? row?.email?.message,
    ]),
  )
}

/** Blank form for a new meeting, or the meeting's current values when editing. */
function defaultValues(
  meeting?: Meeting,
  defaultDate?: Date,
  defaultStartTime?: string,
): FormValues {
  if (!meeting) {
    const start = defaultStartTime ?? "10:00"
    const [h, m] = start.split(":").map(Number)
    const endH = Math.min(23, (h ?? 10) + 1)
    const end = `${String(endH).padStart(2, "0")}:${String(m ?? 0).padStart(2, "0")}`

    return {
      name: "",
      description: "",
      location: "",
      date: defaultDate ?? new Date(),
      startTime: start,
      endTime: end,
      participants: [{ name: "", email: "" }],
    }
  }
  return {
    name: meeting.name,
    description: meeting.description ?? "",
    location: meeting.location ?? "",
    date: parseIsoDay(meeting.starts_at),
    startTime: formatTime(meeting.starts_at),
    endTime: formatTime(meeting.ends_at),
    participants:
      meeting.participants.length > 0
        ? meeting.participants.map((p) => ({ name: p.name, email: p.email ?? "" }))
        : [{ name: "", email: "" }],
  }
}

interface SpeechRecognitionResultLike {
  isFinal: boolean
  0: { transcript: string }
}

interface SpeechRecognitionEventLike {
  resultIndex: number
  results: {
    length: number
    [index: number]: SpeechRecognitionResultLike
  }
}

interface SpeechRecognitionErrorEventLike {
  error: string
  message?: string
}

interface SpeechRecognitionLike {
  continuous: boolean
  interimResults: boolean
  lang: string
  start: () => void
  stop: () => void
  abort: () => void
  onstart: (() => void) | null
  onresult: ((event: SpeechRecognitionEventLike) => void) | null
  onerror: ((event: SpeechRecognitionErrorEventLike) => void) | null
  onend: (() => void) | null
}

/** Creates a meeting, or edits `meeting` when one is passed. */
export function MeetingFormDialog({
  open,
  onOpenChange,
  meeting,
  defaultDate,
  defaultStartTime,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  meeting?: Meeting
  defaultDate?: Date
  defaultStartTime?: string
}) {
  const createMeeting = useCreateMeeting()
  const updateMeeting = useUpdateMeeting()
  const [datePickerOpen, setDatePickerOpen] = useState(false)
  const isEdit = !!meeting

  // AI Prompt & Voice Pre-fill State
  const [promptText, setPromptText] = useState("")
  const [isAiParsing, setIsAiParsing] = useState(false)
  const [isListening, setIsListening] = useState(false)
  const [voiceLang, setVoiceLang] = useState<"uk-UA" | "en-US">("uk-UA")
  const [aiSuccessMsg, setAiSuccessMsg] = useState<string | null>(null)
  const [aiSuggestedFields, setAiSuggestedFields] = useState<Set<string>>(new Set())
  const [parsedAgendaForMeeting, setParsedAgendaForMeeting] = useState<{
    agenda: ParsedAgenda
    model: string
    prompt_version: string
  } | null>(null)

  const abortControllerRef = useRef<AbortController | null>(null)
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null)
  const basePromptTextRef = useRef<string>("")

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: defaultValues(meeting, defaultDate, defaultStartTime),
  })

  const {
    register,
    handleSubmit,
    control,
    reset,
    setError,
    formState: { errors, isSubmitting },
  } = form

  // Refill the form each time it opens
  useEffect(() => {
    if (open) {
      reset(defaultValues(meeting, defaultDate, defaultStartTime))
    }
  }, [open, meeting, defaultDate, defaultStartTime, reset])

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) {
      setPromptText("")
      setIsAiParsing(false)
      setIsListening(false)
      setAiSuccessMsg(null)
      setAiSuggestedFields(new Set())
      setParsedAgendaForMeeting(null)
      try {
        recognitionRef.current?.stop()
      } catch {
        // ignore
      }
    }
    onOpenChange(nextOpen)
  }

  // Voice speech-to-text handler
  const handleToggleVoice = async () => {
    if (typeof window === "undefined") return

    const win = window as unknown as {
      SpeechRecognition?: new () => SpeechRecognitionLike
      webkitSpeechRecognition?: new () => SpeechRecognitionLike
    }

    const SpeechRecognitionClass = win.SpeechRecognition || win.webkitSpeechRecognition

    if (!SpeechRecognitionClass) {
      toast.error(
        "Voice speech recognition is not supported in this browser (e.g. Firefox). Please use Google Chrome, Microsoft Edge, or Apple Safari, or type your prompt.",
        { duration: 6000 }
      )
      return
    }

    if (isListening) {
      try {
        recognitionRef.current?.stop()
      } catch {
        // ignore
      }
      setIsListening(false)
      return
    }

    // Step 1: Explicitly request microphone stream to ensure browser & system permission
    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
        stream.getTracks().forEach((track) => track.stop())
      } catch (err: unknown) {
        const e = err as { name?: string; message?: string }
        if (e.name === "NotAllowedError" || e.name === "PermissionDeniedError") {
          toast.error(
            "Microphone permission was denied. Please allow microphone access in your browser settings (click lock icon in address bar) and try again.",
            { duration: 7000 }
          )
          return
        } else if (e.name === "NotFoundError" || e.name === "DevicesNotFoundError") {
          toast.error("No microphone device was detected. Please connect a microphone.", { duration: 6000 })
          return
        }
      }
    }

    try {
      basePromptTextRef.current = promptText.trim()
      const recognition = new SpeechRecognitionClass()
      recognition.continuous = true
      recognition.interimResults = true
      recognition.lang = voiceLang

      recognition.onstart = () => {
        setIsListening(true)
        toast.info(
          `Microphone listening (${voiceLang === "uk-UA" ? "Ukrainian" : "English"}). Speak now...`
        )
      }

      recognition.onresult = (event: SpeechRecognitionEventLike) => {
        let finalStr = ""
        let interimStr = ""
        for (let i = 0; i < event.results.length; i++) {
          const res = event.results[i]
          if (res?.isFinal) {
            finalStr += (res[0]?.transcript ?? "") + " "
          } else {
            interimStr += res?.[0]?.transcript ?? ""
          }
        }
        const spoken = (finalStr + interimStr).trim()
        const base = basePromptTextRef.current
        setPromptText(base ? `${base} ${spoken}` : spoken)
      }

      recognition.onerror = (event: SpeechRecognitionErrorEventLike) => {
        setIsListening(false)
        const code = event?.error
        if (code === "not-allowed" || code === "service-not-allowed") {
          toast.error(
            "Microphone access blocked. Please allow microphone access in browser settings (lock icon in address bar).",
            { duration: 7000 }
          )
        } else if (code === "network") {
          toast.error(
            "Speech recognition network error. (Note: if using Brave browser, disable Brave Shields for speech services, or use Chrome/Edge).",
            { duration: 7000 }
          )
        } else if (code === "no-speech") {
          toast.warning("No speech detected. Please speak closer to your microphone or try again.")
        } else if (code === "audio-capture") {
          toast.error("No microphone detected. Please check your audio hardware.")
        } else if (code !== "aborted") {
          toast.error(`Voice error: ${code || "unknown"}`)
        }
      }

      recognition.onend = () => {
        setIsListening(false)
      }

      recognitionRef.current = recognition
      recognition.start()
    } catch (e: unknown) {
      setIsListening(false)
      const err = e as { message?: string }
      toast.error(`Could not start voice recognition: ${err.message || "unknown error"}`)
    }
  }

  const handleCancelAi = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
      abortControllerRef.current = null
    }
    setIsAiParsing(false)
  }

  // Parse prompt text with Amazon Bedrock LLM and pre-fill form
  const handleParsePrompt = async () => {
    if (!promptText.trim()) {
      toast.error("Please enter or say meeting details first.")
      return
    }

    setIsAiParsing(true)
    setAiSuccessMsg(null)

    const controller = new AbortController()
    abortControllerRef.current = controller

    try {
      const todayStr = new Date().toISOString().split("T")[0]
      const tzStr = Intl.DateTimeFormat().resolvedOptions().timeZone || "Europe/Kyiv"

      const result = await parseAgenda(promptText, todayStr, tzStr, controller.signal)
      const agenda = result.agenda

      // 1. Title / Name
      const meetingName =
        agenda.title?.trim() ||
        agenda.items?.[0]?.topic?.trim() ||
        "Team Sync"
      form.setValue("name", meetingName, { shouldValidate: true })

      // 2. Date and Times
      if (agenda.starts_at) {
        try {
          const startDateObj = new Date(agenda.starts_at)
          if (!isNaN(startDateObj.getTime())) {
            form.setValue("date", startDateObj, { shouldValidate: true })
            const hh = String(startDateObj.getHours()).padStart(2, "0")
            const mm = String(startDateObj.getMinutes()).padStart(2, "0")
            const startHhMm = `${hh}:${mm}`
            form.setValue("startTime", startHhMm, { shouldValidate: true })

            const duration = agenda.duration_minutes || 60
            const endDateObj = new Date(startDateObj.getTime() + duration * 60 * 1000)
            const endHh = String(endDateObj.getHours()).padStart(2, "0")
            const endMm = String(endDateObj.getMinutes()).padStart(2, "0")
            form.setValue("endTime", `${endHh}:${endMm}`, { shouldValidate: true })
          }
        } catch {
          // fallback
        }
      } else if (agenda.duration_minutes) {
        const currentStart = form.getValues("startTime") || "10:00"
        const [h, m] = currentStart.split(":").map(Number)
        const totalMinutes = (h * 60 + m) + agenda.duration_minutes
        const endH = Math.min(23, Math.floor(totalMinutes / 60))
        const endM = totalMinutes % 60
        form.setValue("endTime", `${String(endH).padStart(2, "0")}:${String(endM).padStart(2, "0")}`, { shouldValidate: true })
      }

      // Track AI suggested fields to highlight in UI
      const suggested = new Set<string>()
      suggested.add("name")

      // 3. Location / Room / Call link
      if (agenda.location && agenda.location.trim()) {
        form.setValue("location", agenda.location.trim(), { shouldValidate: true })
        suggested.add("location")
      } else {
        const urlMatch = promptText.match(/(https?:\/\/[^\s]+)/)
        if (urlMatch) {
          form.setValue("location", urlMatch[1], { shouldValidate: true })
          suggested.add("location")
        }
      }

      // 4. Participants (from explicit LLM attendees list + item/action owners)
      const extractedParticipants: Array<{ name: string; email: string }> = []
      const seenNames = new Set<string>()

      const addParticipant = (name: string, email?: string | null) => {
        const trimmed = name.trim()
        if (!trimmed) return
        const key = trimmed.toLowerCase()
        if (!seenNames.has(key)) {
          seenNames.add(key)
          extractedParticipants.push({ name: trimmed, email: (email ?? "").trim() })
        }
      }

      // 4a. Explicit participants identified by LLM
      agenda.participants?.forEach((p) => {
        if (p?.name) addParticipant(p.name, p.email)
      })

      // 4b. Owners from agenda topics
      agenda.items?.forEach((item) => {
        if (item.owner) addParticipant(item.owner)
      })

      // 4c. Owners from action items
      agenda.action_items?.forEach((action) => {
        if (action.owner) addParticipant(action.owner)
      })

      if (extractedParticipants.length > 0) {
        form.setValue("participants", extractedParticipants, { shouldValidate: true })
        suggested.add("participants")
      }

      // 5. Description from topics & action items
      const descLines: string[] = []
      if (agenda.items && agenda.items.length > 0) {
        descLines.push("Agenda Topics:")
        agenda.items.forEach((item, idx) => {
          const ownerPart = item.owner ? ` (${item.owner}` : ""
          const minPart = item.minutes ? `${ownerPart ? ", " : " ("}${item.minutes}m` : ""
          const closePart = ownerPart || minPart ? ")" : ""
          descLines.push(`${idx + 1}. ${item.topic}${ownerPart}${minPart}${closePart}`)
        })
      }
      if (agenda.action_items && agenda.action_items.length > 0) {
        if (descLines.length > 0) descLines.push("")
        descLines.push("Action Items:")
        agenda.action_items.forEach((act) => {
          const ownerPart = act.owner ? `${act.owner}: ` : ""
          const duePart = act.due ? ` (Due: ${act.due})` : ""
          descLines.push(`- ${ownerPart}${act.task}${duePart}`)
        })
      }
      if (descLines.length > 0) {
        form.setValue("description", descLines.join("\n"), { shouldValidate: true })
        suggested.add("description")
      }

      if (agenda.starts_at) {
        suggested.add("date")
        suggested.add("startTime")
        suggested.add("endTime")
      }

      setAiSuggestedFields(suggested)

      setParsedAgendaForMeeting({
        agenda,
        model: result.model,
        prompt_version: result.prompt_version,
      })

      setAiSuccessMsg("Meeting fields pre-filled! Review below & click Create.")
      toast.success("AI pre-filled the meeting fields from your prompt!")
    } catch (err: unknown) {
      if (err instanceof Error && err.name === "AbortError") {
        toast.info("AI parsing canceled.")
      } else {
        const msg = err instanceof Error ? err.message : "Failed to parse prompt."
        toast.error(msg)
      }
    } finally {
      setIsAiParsing(false)
      abortControllerRef.current = null
    }
  }

  const onSubmit = handleSubmit(async (values) => {
    const participants = values.participants
      .filter((participant) => participant.name.trim() !== "")
      .map((participant) => ({
        name: participant.name.trim(),
        email: participant.email?.trim() ? participant.email.trim() : null,
      }))

    const payload = {
      name: values.name.trim(),
      description: values.description?.trim() || null,
      location: values.location?.trim() || null,
      starts_at: toIsoWithOffset(values.date, values.startTime),
      ends_at: toIsoWithOffset(values.date, values.endTime),
      participants,
    }

    try {
      if (meeting) {
        await updateMeeting.mutateAsync({ id: meeting.id, payload })
        toast.success("Meeting updated")
      } else {
        const created = await createMeeting.mutateAsync(payload)
        toast.success("Meeting created")

        // If agenda was parsed by AI, attach it to the newly created meeting
        if (parsedAgendaForMeeting && created?.id) {
          try {
            await saveMeetingAgenda(created.id, {
              agenda: parsedAgendaForMeeting.agenda,
              ai_suggestion: parsedAgendaForMeeting.agenda,
              model: parsedAgendaForMeeting.model,
              prompt_version: parsedAgendaForMeeting.prompt_version,
            })
            toast.success("AI agenda attached to your new meeting!")
          } catch (agendaErr) {
            console.warn("Could not save initial agenda:", agendaErr)
          }
        }
      }
      onOpenChange(false)
    } catch (error) {
      if (error instanceof ApiError) {
        // Map server-side field errors back onto the matching inputs.
        const fieldMap: Record<string, keyof FormValues> = {
          name: "name",
          description: "description",
          location: "location",
          starts_at: "startTime",
          ends_at: "endTime",
          participants: "participants",
        }
        for (const detail of error.details) {
          const target = fieldMap[detail.field.split(".")[0] ?? ""]
          if (target) setError(target, { message: detail.message })
        }
        toast.error(error.message)
      } else {
        toast.error(isEdit ? "Could not update the meeting." : "Could not create the meeting.")
      }
    }
  })

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit meeting" : "New meeting"}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? "Change the details, time slot or participants."
              : "Give it a name, a time slot and the people who should be there."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={onSubmit} className="space-y-4">
          {!isEdit ? (
            <div className="rounded-xl border border-primary/30 bg-primary/5 p-3.5 space-y-2.5 shadow-xs">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-xs font-bold text-primary">
                  <Sparkles className="size-4 text-primary" />
                  <span>Create from Prompt (AI Assistant)</span>
                </div>
                <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded-full bg-primary/10 text-primary font-bold">
                  Bedrock AI
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                Say or paste meeting notes in natural language — AI will extract title, date, time, duration & attendees:
              </p>
              <div className="relative">
                <Textarea
                  value={promptText}
                  onChange={(e) => {
                    setPromptText(e.target.value)
                    if (aiSuccessMsg) setAiSuccessMsg(null)
                  }}
                  placeholder="e.g.: Пн 10:00, синк по прайсингу в кабінеті 302, 45 хв. Учасники: Олена, Taras. 1) нові тарифи Pro — Олена, 15 хв"
                  className="text-xs bg-background resize-y min-h-[68px] pr-20"
                  disabled={isAiParsing}
                />
                <div className="absolute right-2 top-2 flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => {
                      const next = voiceLang === "uk-UA" ? "en-US" : "uk-UA"
                      setVoiceLang(next)
                      toast.info(`Voice recognition set to ${next === "uk-UA" ? "Ukrainian" : "English"}`)
                    }}
                    className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded border border-border bg-background/90 hover:bg-muted text-foreground transition-colors cursor-pointer shadow-2xs"
                    title="Switch voice recognition language (Ukrainian / English)"
                  >
                    {voiceLang === "uk-UA" ? "UA" : "EN"}
                  </button>
                  <button
                    type="button"
                    onClick={handleToggleVoice}
                    className={`p-1.5 rounded-full transition-all cursor-pointer ${
                      isListening
                        ? "bg-red-500 text-white animate-pulse ring-2 ring-red-400/50"
                        : "text-muted-foreground hover:text-primary hover:bg-muted"
                    }`}
                    title={
                      isListening
                        ? "Listening... click to stop"
                        : `Voice input (${voiceLang === "uk-UA" ? "Ukrainian" : "English"})`
                    }
                    aria-label="Voice input"
                  >
                    {isListening ? <MicOff className="size-3.5" /> : <Mic className="size-3.5" />}
                  </button>
                </div>
              </div>

              {isListening ? (
                <div className="flex items-center justify-between rounded-lg bg-red-500/10 border border-red-500/25 px-2.5 py-1.5 text-xs text-red-600 dark:text-red-400">
                  <div className="flex items-center gap-2">
                    <span className="size-2 rounded-full bg-red-500 animate-ping" />
                    <span className="font-medium text-[11px]">
                      Listening ({voiceLang === "uk-UA" ? "Ukrainian" : "English"})... speak now.
                    </span>
                  </div>
                  <Button
                    type="button"
                    size="xs"
                    variant="destructive"
                    className="h-5 text-[10px] px-2 py-0 cursor-pointer"
                    onClick={handleToggleVoice}
                  >
                    Done Speaking
                  </Button>
                </div>
              ) : null}

              <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                <div className="text-[11px] text-muted-foreground">
                  {aiSuccessMsg ? (
                    <span className="text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-1">
                      <CheckCircle2 className="size-3.5" />
                      {aiSuccessMsg}
                    </span>
                  ) : (
                    <span>The model suggests, you decide & confirm</span>
                  )}
                </div>
                <div className="flex items-center gap-2 ml-auto">
                  {isAiParsing ? (
                    <Button
                      type="button"
                      variant="outline"
                      size="xs"
                      onClick={handleCancelAi}
                      className="text-destructive hover:text-destructive h-7 text-xs cursor-pointer"
                    >
                      <XCircle className="size-3.5 mr-1" />
                      Cancel
                    </Button>
                  ) : null}
                  <Button
                    type="button"
                    size="xs"
                    className="gap-1.5 h-7 text-xs font-semibold cursor-pointer shadow-xs"
                    disabled={isAiParsing || !promptText.trim()}
                    onClick={handleParsePrompt}
                  >
                    {isAiParsing ? (
                      <>
                        <Loader2 className="size-3 animate-spin" />
                        <span>Parsing...</span>
                      </>
                    ) : (
                      <>
                        <Sparkles className="size-3" />
                        <span>Pre-fill Form</span>
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </div>
          ) : null}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="name">Name</Label>
              {aiSuggestedFields.has("name") ? (
                <span className="text-[10px] bg-primary/10 text-primary border border-primary/20 px-1.5 py-0.5 rounded-full font-medium flex items-center gap-1">
                  <Sparkles className="size-2.5" /> AI suggested
                </span>
              ) : null}
            </div>
            <Input
              id="name"
              placeholder="Sprint planning"
              aria-invalid={!!errors.name}
              aria-describedby={errors.name ? "name-error" : undefined}
              {...register("name")}
              onChange={(e) => {
                register("name").onChange(e)
                if (aiSuggestedFields.has("name")) {
                  setAiSuggestedFields((prev) => {
                    const next = new Set(prev)
                    next.delete("name")
                    return next
                  })
                }
              }}
            />
            {errors.name ? (
              <p id="name-error" className="text-destructive text-sm">
                {errors.name.message}
              </p>
            ) : null}
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="description">Description</Label>
              {aiSuggestedFields.has("description") ? (
                <span className="text-[10px] bg-primary/10 text-primary border border-primary/20 px-1.5 py-0.5 rounded-full font-medium flex items-center gap-1">
                  <Sparkles className="size-2.5" /> AI suggested
                </span>
              ) : null}
            </div>
            <Textarea
              id="description"
              rows={3}
              placeholder="What is this meeting about?"
              {...register("description")}
              onChange={(e) => {
                register("description").onChange(e)
                if (aiSuggestedFields.has("description")) {
                  setAiSuggestedFields((prev) => {
                    const next = new Set(prev)
                    next.delete("description")
                    return next
                  })
                }
              }}
            />
            {errors.description ? (
              <p className="text-destructive text-sm">{errors.description.message}</p>
            ) : null}
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="location">Location</Label>
              {aiSuggestedFields.has("location") ? (
                <span className="text-[10px] bg-primary/10 text-primary border border-primary/20 px-1.5 py-0.5 rounded-full font-medium flex items-center gap-1">
                  <Sparkles className="size-2.5" /> AI suggested
                </span>
              ) : null}
            </div>
            <Input
              id="location"
              placeholder="Room 3 or a meeting link"
              {...register("location")}
              onChange={(e) => {
                register("location").onChange(e)
                if (aiSuggestedFields.has("location")) {
                  setAiSuggestedFields((prev) => {
                    const next = new Set(prev)
                    next.delete("location")
                    return next
                  })
                }
              }}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-2 sm:col-span-1">
              <Label>Date</Label>
              <Controller
                control={control}
                name="date"
                render={({ field }) => (
                  <Popover open={datePickerOpen} onOpenChange={setDatePickerOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        type="button"
                        variant="outline"
                        className="w-full justify-start font-normal"
                      >
                        <CalendarIcon className="size-4" aria-hidden />
                        {toIsoDate(field.value)}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={field.value}
                        onSelect={(date) => {
                          if (date) field.onChange(date)
                          setDatePickerOpen(false)
                        }}
                        autoFocus
                      />
                    </PopoverContent>
                  </Popover>
                )}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="startTime">Start</Label>
              <Input id="startTime" type="time" step={900} {...register("startTime")} />
              {errors.startTime ? (
                <p className="text-destructive text-sm">{errors.startTime.message}</p>
              ) : null}
            </div>

            <div className="space-y-2">
              <Label htmlFor="endTime">End</Label>
              <Input id="endTime" type="time" step={900} {...register("endTime")} />
              {errors.endTime ? (
                <p className="text-destructive text-sm">{errors.endTime.message}</p>
              ) : null}
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Participants</Label>
              {aiSuggestedFields.has("participants") ? (
                <span className="text-[10px] bg-primary/10 text-primary border border-primary/20 px-1.5 py-0.5 rounded-full font-medium flex items-center gap-1">
                  <Sparkles className="size-2.5" /> AI suggested
                </span>
              ) : null}
            </div>
            <Controller
              control={control}
              name="participants"
              render={({ field }) => (
                <ParticipantsInput
                  value={field.value}
                  onChange={(val) => {
                    field.onChange(val)
                    if (aiSuggestedFields.has("participants")) {
                      setAiSuggestedFields((prev) => {
                        const next = new Set(prev)
                        next.delete("participants")
                        return next
                      })
                    }
                  }}
                  errors={participantErrors(errors.participants)}
                />
              )}
            />
          </div>
          {errors.participants?.message ? (
            <p className="text-destructive text-sm">{errors.participants.message}</p>
          ) : null}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isEdit
                ? isSubmitting
                  ? "Saving…"
                  : "Save changes"
                : isSubmitting
                  ? "Creating…"
                  : "Create meeting"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
