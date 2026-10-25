import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it } from "vitest";
import { evidenceNotes } from "@/components/report/ReportParts";
import type { ConversationSession } from "@/types";
import { getConversation, resetConversationsForTests, saveConversation } from "../conversations";
import { useProfileStore } from "../profileStore";

const base = (id: string, extra: Partial<ConversationSession> = {}): ConversationSession => ({
  id,
  kind: "voice",
  title: "Voice practice",
  startedAt: 1_000,
  endedAt: 61_000,
  goals: [],
  transcript: [
    { id: "s1", startMs: 0, endMs: 4000, text: "Hello", role: "coach", speaker: "Coach" },
    { id: "s2", startMs: 5000, endMs: 12000, text: "Our launch moved.", role: "you", speaker: "You" },
  ],
  feedback: [],
  ...extra,
});

describe("recorded sessions", () => {
  beforeEach(() => {
    resetConversationsForTests();
    useProfileStore.setState({ consentSaveMetrics: false });
  });

  it("keeps a recorded session on disk even without the save-data consent", async () => {
    const recording = { blobKey: "rec-1", mimeType: "video/webm", hasVideo: true, durationMs: 60_000 };
    await saveConversation(base("rec-1", { recording }), new Blob(["x"], { type: "video/webm" }));
    resetConversationsForTests(); // drop the in-memory copy, as a reload would
    expect((await getConversation("rec-1"))?.recording?.hasVideo).toBe(true);
  });

  it("keeps an unrecorded session in memory only while consent is off", async () => {
    await saveConversation(base("plain-1"));
    resetConversationsForTests();
    expect(await getConversation("plain-1")).toBeNull();
  });
});

describe("evidence notes", () => {
  it("adds camera cues as notes tied to the line being spoken", () => {
    const notes = evidenceNotes(
      base("cam-1", { cameraObservations: [{ id: "e1", atMs: 7000, signal: "gaze_direction", text: "Your gaze has been away for a while." }] }),
    );
    expect(notes).toEqual([
      expect.objectContaining({ source: "camera", atMs: 7000, segmentId: "s2", label: "Camera: Gaze direction", note: "Your gaze has been away for a while." }),
    ]);
  });
});
