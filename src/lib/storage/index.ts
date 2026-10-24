/**
 * storage module (PRD §9, §12 privacy)
 * Owner: Data team.
 *
 * Responsibilities:
 *  - Persist consented session metadata + derived metrics (IndexedDB).
 *  - Manage session history.
 *  - Handle deletion and reset.
 *
 * Must NOT persist raw video by default (PRD §4.4, §12, §13).
 */

import type { BehavioralBaseline, Session, SessionSummary } from "@/types";

export interface StorageAdapter {
  saveBaseline(baseline: BehavioralBaseline): Promise<void>;
  loadBaselines(): Promise<BehavioralBaseline[]>;
  saveSession(session: Session): Promise<void>;
  listSessions(): Promise<SessionSummary[]>;
  getSession(id: string): Promise<Session | null>;
  deleteSession(id: string): Promise<void>;
  /** Clear all saved sessions + baselines (PRD §12). */
  resetAll(): Promise<void>;
}

// TODO(data-team): implement with IndexedDB (no raw video — PRD §12).
export function createStorageAdapter(): StorageAdapter {
  throw new Error("storage.createStorageAdapter not implemented");
}
