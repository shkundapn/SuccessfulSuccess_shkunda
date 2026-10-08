"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import { createMeeting, deleteMeeting, listMeetings, updateMeeting } from "@/lib/api"
import type { MeetingCreateInput } from "@/lib/types"

export type MeetingQueryParams = { date?: string; q?: string }

function parseParams(param?: MeetingQueryParams | string): MeetingQueryParams {
  if (typeof param === "string") return { date: param }
  return param ?? {}
}

/** Shared cache key: the list and the header menu read the same entry. */
export const meetingsKey = (param?: MeetingQueryParams | string) => {
  const p = parseParams(param)
  return ["meetings", { date: p.date ?? "today", q: p.q ?? "" }] as const
}

export function useMeetings(param?: MeetingQueryParams | string) {
  const p = parseParams(param)
  return useQuery({
    queryKey: meetingsKey(param),
    queryFn: () => listMeetings(p),
  })
}

export function useCreateMeeting() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (payload: MeetingCreateInput) => createMeeting(payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["meetings"] }),
  })
}

export function useUpdateMeeting() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: MeetingCreateInput }) =>
      updateMeeting(id, payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["meetings"] }),
  })
}

export function useDeleteMeeting() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => deleteMeeting(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["meetings"] }),
  })
}
