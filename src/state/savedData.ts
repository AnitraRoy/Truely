/**
 * UI-facing access to saved session data and the data-deletion actions
 * (PRD §12: delete history, reset baseline). Owner: App-shell / State team.
 *
 * Thin wrapper over lib/storage. The adapter is still a stub that throws, so
 * every call here degrades to an honest "nothing saved yet" instead of
 * crashing the screen. No fabricated counts (CLAUDE.md §5).
 */

import { useEffect, useState } from "react";
import { createStorageAdapter, type StorageAdapter } from "@/lib/storage";
import type { SessionSummary } from "@/types";
import { useProfileStore } from "./profileStore";
import { useSessionStore } from "./sessionStore";

function tryAdapter(): StorageAdapter | null {
  try {
    return createStorageAdapter();
  } catch {
    return null;
  }
}

export type SavedSessions =
  | { status: "loading" }
  | { status: "unavailable" }
  | { status: "ready"; sessions: SessionSummary[] };

/**
 * Sessions saved on this device, newest first, or "unavailable" while storage
 * isn't implemented (or can't be opened).
 */
export function useSavedSessions(refreshKey = 0): SavedSessions {
  const [state, setState] = useState<SavedSessions>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;
    const adapter = tryAdapter();
    if (!adapter) {
      setState({ status: "unavailable" });
      return;
    }
    adapter
      .listSessions()
      .then(
        (list) =>
          !cancelled &&
          setState({ status: "ready", sessions: [...list].sort((a, b) => b.startedAt - a.startedAt) }),
      )
      .catch(() => !cancelled && setState({ status: "unavailable" }));
    return () => {
      cancelled = true;
    };
  }, [refreshKey]);

  return state;
}

/** Remove every saved session; baselines and preferences stay. */
export async function deleteSessionHistory(): Promise<void> {
  const adapter = tryAdapter();
  if (!adapter) return;
  const sessions = await adapter.listSessions().catch(() => []);
  await Promise.all(sessions.map((s) => adapter.deleteSession(s.id)));
}

/**
 * Forget the learned baseline so the next session recalibrates.
 * TODO(data-team): StorageAdapter has no baseline-only delete; add an optional
 * `resetBaselines()` so saved baselines are removed too. Until then this
 * clears the in-app calibration state only.
 */
export async function resetBaseline(): Promise<void> {
  useSessionStore.getState().setCalibrated(false);
}

/** Delete saved sessions and baselines, and return the profile to first-run. */
export async function resetEverything(): Promise<void> {
  const adapter = tryAdapter();
  if (adapter) await adapter.resetAll().catch(() => undefined);
  useSessionStore.getState().reset();
  useProfileStore.getState().resetProfile();
}
