/**
 * UI-facing access to saved session data and the data-deletion actions
 * (PRD §12: delete history, reset baseline). Owner: App-shell / State team.
 *
 * Thin wrapper over lib/storage (IndexedDB in the browser, memory elsewhere).
 * One shared CueStorage instance for the app — pass `getStorage()` to
 * `createSessionController` when Live Coaching is wired so both read the same
 * data. If storage can't be opened, screens show an honest "unavailable" state
 * rather than crashing. No fabricated counts (CLAUDE.md §5).
 */

import { useEffect, useState } from "react";
import { createDefaultStorage, type CueStorage } from "@/lib/storage";
import { toSessionSummary } from "@/lib/reports";
import type { SessionSummary } from "@/types";
import { useProfileStore } from "./profileStore";
import { useSessionStore } from "./sessionStore";

let shared: CueStorage | null = null;

/** The app's single storage instance (lazy; IndexedDB is only touched on first use). */
export function getStorage(): CueStorage {
  return (shared ??= createDefaultStorage());
}

/** Test hook: swap in e.g. `createMemoryStorage()`. */
export function setStorageForTests(storage: CueStorage | null): void {
  shared = storage;
}

export type SavedSessions =
  | { status: "loading" }
  | { status: "unavailable" }
  | { status: "ready"; sessions: SessionSummary[] };

/** Sessions saved on this device, newest first, or "unavailable" if storage can't be read. */
export function useSavedSessions(refreshKey = 0): SavedSessions {
  const [state, setState] = useState<SavedSessions>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;
    getStorage()
      .listSessions()
      .then((list) => !cancelled && setState({ status: "ready", sessions: list.map(toSessionSummary) }))
      .catch(() => !cancelled && setState({ status: "unavailable" }));
    return () => {
      cancelled = true;
    };
  }, [refreshKey]);

  return state;
}

/**
 * Mirror the profile's saving consent into storage, where the session
 * controller reads it (`controller.init()` → `storage.getConsent()`).
 */
export async function syncSaveConsent(allowed: boolean): Promise<void> {
  await getStorage().setConsent(allowed);
}

/** Remove every saved session; baselines, feedback history and preferences stay. */
export async function deleteSessionHistory(): Promise<void> {
  const storage = getStorage();
  const sessions = await storage.listSessions();
  await Promise.all(sessions.map((s) => storage.deleteSession(s.id)));
}

/** Forget the learned baseline (saved and in-app) so the next session recalibrates. */
export async function resetBaseline(): Promise<void> {
  await getStorage().clearBaselines();
  useSessionStore.getState().setCalibrated(false);
}

/** Delete everything saved (sessions, baselines, feedback history, consent) and return to first-run. */
export async function resetEverything(): Promise<void> {
  await getStorage().deleteAllData();
  useSessionStore.getState().reset();
  useProfileStore.getState().resetProfile();
}
