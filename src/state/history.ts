/**
 * One session history across every surface: voice coaching, mock interviews,
 * and live coaching (conversation transcripts plus the behavioral webcam
 * sessions from lib/storage). Owner: App-shell / State team.
 *
 * Each entry knows which report board opens it, so history rows, the Overview
 * and Profile Review all link to the same place. Counts only, no scores.
 */
import { useMemo } from "react";
import { GOAL_LABELS } from "@/config/coaching";
import type { ConversationKind, ConversationSession, FeedbackCategory } from "@/types";
import { useConversations } from "./conversations";
import { useSavedSessions } from "./savedData";

export interface HistoryEntry {
  id: string;
  kind: ConversationKind;
  title: string;
  /** The goal or focus, in words. */
  focus: string;
  startedAt: number;
  durationMs: number;
  href: string;
  /** Feedback categories noted in this session (conversation sessions only). */
  categories: FeedbackCategory[];
  hasRecording: boolean;
  hasTranscript: boolean;
  sample?: boolean;
}

export const KIND_LABELS: Record<ConversationKind, string> = {
  voice: "Voice coaching",
  interview: "Mock interview",
  live: "Live coaching",
};

export function reportHref(kind: ConversationKind, id: string): string {
  return `/report/${kind}/${encodeURIComponent(id)}`;
}

export function fromConversation(s: ConversationSession): HistoryEntry {
  return {
    id: s.id,
    kind: s.kind,
    title: s.title,
    focus: s.goals[0] ?? "",
    startedAt: s.startedAt,
    durationMs: Math.max(0, (s.endedAt ?? s.startedAt) - s.startedAt),
    href: reportHref(s.kind, s.id),
    categories: [...new Set(s.feedback.map((f) => f.category))],
    hasRecording: Boolean(s.recording),
    hasTranscript: s.transcript.length > 0,
    sample: s.sample,
  };
}

export type History = { status: "loading" } | { status: "ready"; entries: HistoryEntry[]; savingUnavailable: boolean };

export function useHistory(): History {
  const conversations = useConversations();
  const behavioral = useSavedSessions();

  return useMemo<History>(() => {
    if (conversations.status === "loading" || behavioral.status === "loading") return { status: "loading" };
    const linked = new Set(conversations.sessions.map((s) => s.behavioralSessionId).filter(Boolean));
    const fromBehavioral: HistoryEntry[] =
      behavioral.status === "ready"
        ? behavioral.sessions
            .filter((s) => !linked.has(s.id))
            .map((s) => ({
              id: s.id,
              kind: "live" as const,
              title: "Live coaching",
              focus: GOAL_LABELS[s.goal],
              startedAt: s.startedAt,
              durationMs: s.durationMs,
              href: `/report/${encodeURIComponent(s.id)}`,
              categories: [],
              hasRecording: false,
              hasTranscript: false,
            }))
        : [];
    const entries = [...conversations.sessions.map(fromConversation), ...fromBehavioral].sort((a, b) => b.startedAt - a.startedAt);
    return { status: "ready", entries, savingUnavailable: behavioral.status === "unavailable" };
  }, [conversations, behavioral]);
}
