import { buildConversationReport } from "@/lib/conversation";
import { newId, saveConversation } from "@/state/conversations";
import type { CommunicationProfile, ConversationKind, ConversationSession, FeedbackEvent, TranscriptSegment } from "@/types";

/**
 * End of a practice or live session: write the reflection from the
 * transcript (when there's anything to reflect on), then save the session
 * under the person's saving consent. The report may be absent — the report
 * board then shows the transcript and notes alone, never invented findings.
 */
export async function finishConversation(input: {
  kind: ConversationKind;
  title: string;
  goals: string[];
  context?: Record<string, string>;
  profile: CommunicationProfile | null;
  transcript: TranscriptSegment[];
  feedback: FeedbackEvent[];
  startedAt: number;
  endedAt: number;
  recording?: { blob: Blob; durationMs: number } | null;
  behavioralSessionId?: string;
}): Promise<string> {
  const report = await buildConversationReport({ kind: input.kind, profile: input.profile, goals: input.goals, transcript: input.transcript });
  const id = newId(input.kind);
  const rec = input.recording && input.recording.blob.size > 0 ? input.recording : null;
  const session: ConversationSession = {
    id,
    kind: input.kind,
    title: input.title,
    startedAt: input.startedAt,
    endedAt: input.endedAt,
    goals: input.goals,
    context: input.context,
    transcript: input.transcript,
    feedback: input.feedback,
    ...(report ? { report } : {}),
    ...(rec ? { recording: { blobKey: id, mimeType: rec.blob.type, hasVideo: false, durationMs: rec.durationMs } } : {}),
    ...(input.behavioralSessionId ? { behavioralSessionId: input.behavioralSessionId } : {}),
  };
  await saveConversation(session, rec?.blob);
  return id;
}

/** Practice goals: the patterns the person kept, or a sensible default set. */
export function goalsFrom(profile: CommunicationProfile | null, fallback: readonly string[]): string[] {
  const kept = profile?.traits.filter((t) => t.keep).map((t) => t.name) ?? [];
  return kept.length > 0 ? kept : [...fallback];
}
