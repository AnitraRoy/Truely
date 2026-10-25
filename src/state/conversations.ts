/**
 * Conversation sessions (voice coaching, mock interviews, live transcripts)
 * and their optional recordings. Owner: App-shell / State team.
 *
 * Same consent rule as behavioral sessions (PRD §4.4): with saving on, sessions
 * go to IndexedDB on this device; with it off, they live in memory until the
 * tab closes, so the end-of-session report still works. Recordings are only
 * ever stored when the person turned recording on for that session, and they
 * never leave the device. Nothing here is uploaded.
 *
 * Kept apart from `lib/storage` (the behavioral engine's store) so that module's
 * contract is unchanged.
 */
import { useEffect, useState } from "react";
import { clear, createStore, del, get, keys, set, type UseStore } from "idb-keyval";
import type { ConversationSession } from "@/types";
import { useProfileStore } from "./profileStore";

const SESSION_PREFIX = "session:";
const BLOB_PREFIX = "recording:";

let idb: UseStore | null | undefined;
function store(): UseStore | null {
  if (idb !== undefined) return idb;
  try {
    idb = typeof indexedDB === "undefined" ? null : createStore("cue-conversations", "kv");
  } catch {
    idb = null;
  }
  return idb;
}

const memorySessions = new Map<string, ConversationSession>();
const memoryBlobs = new Map<string, Blob>();
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((l) => l());

const saving = () => useProfileStore.getState().consentSaveMetrics;

export function newId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

export async function saveConversation(session: ConversationSession, recording?: Blob): Promise<void> {
  memorySessions.set(session.id, session);
  if (recording && session.recording) memoryBlobs.set(session.recording.blobKey, recording);
  const s = store();
  if (saving() && s) {
    try {
      await set(SESSION_PREFIX + session.id, session, s);
      if (recording && session.recording) await set(BLOB_PREFIX + session.recording.blobKey, recording, s);
    } catch {
      /* stays in memory for this tab */
    }
  }
  notify();
}

export async function getConversation(id: string): Promise<ConversationSession | null> {
  const mem = memorySessions.get(id);
  if (mem) return mem;
  const s = store();
  if (!s) return null;
  try {
    return (await get<ConversationSession>(SESSION_PREFIX + id, s)) ?? null;
  } catch {
    return null;
  }
}

export async function getRecording(blobKey: string): Promise<Blob | null> {
  const mem = memoryBlobs.get(blobKey);
  if (mem) return mem;
  const s = store();
  if (!s) return null;
  try {
    return (await get<Blob>(BLOB_PREFIX + blobKey, s)) ?? null;
  } catch {
    return null;
  }
}

export async function listConversations(): Promise<ConversationSession[]> {
  const byId = new Map(memorySessions);
  const s = store();
  if (s) {
    try {
      const all = (await keys(s)).filter((k): k is string => typeof k === "string" && k.startsWith(SESSION_PREFIX));
      for (const k of all) {
        const v = await get<ConversationSession>(k, s);
        if (v) byId.set(v.id, v);
      }
    } catch {
      /* memory only */
    }
  }
  return [...byId.values()].sort((a, b) => b.startedAt - a.startedAt);
}

export async function deleteConversation(id: string): Promise<void> {
  const session = await getConversation(id);
  memorySessions.delete(id);
  const s = store();
  if (session?.recording) {
    memoryBlobs.delete(session.recording.blobKey);
    if (s) await del(BLOB_PREFIX + session.recording.blobKey, s).catch(() => undefined);
  }
  if (s) await del(SESSION_PREFIX + id, s).catch(() => undefined);
  notify();
}

/** Delete every conversation session and recording (Profile → Data & privacy). */
export async function deleteAllConversations(): Promise<void> {
  memorySessions.clear();
  memoryBlobs.clear();
  const s = store();
  if (s) await clear(s).catch(() => undefined);
  notify();
}

export type ConversationList = { status: "loading" } | { status: "ready"; sessions: ConversationSession[] };

/** Conversation sessions on this device (and this tab), newest first. Updates on save/delete. */
export function useConversations(): ConversationList {
  const [state, setState] = useState<ConversationList>({ status: "loading" });
  useEffect(() => {
    let cancelled = false;
    const load = () =>
      listConversations().then((sessions) => {
        if (!cancelled) setState({ status: "ready", sessions });
      });
    void load();
    listeners.add(load);
    return () => {
      cancelled = true;
      listeners.delete(load);
    };
  }, []);
  return state;
}

/** Test hook. */
export function resetConversationsForTests(): void {
  memorySessions.clear();
  memoryBlobs.clear();
  idb = undefined;
}
