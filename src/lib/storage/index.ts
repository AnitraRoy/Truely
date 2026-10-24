/**
 * storage module (PRD §9, §12 persistence & privacy).
 * Owner: Integration (Person 4).
 *
 * What is stored (ONLY with the user's consent, and ONLY derived data):
 *   session:<id>     Session (events, segments, downsampled z-series) — never frames/video
 *   baseline:<sig>   BehavioralBaseline (mean/variance/…)
 *   adaptation       per-signal feedback counts
 *   consent          boolean
 *
 * `createIndexedDbStorage()` is lazy: safe to import during Next.js SSR; it only
 * touches IndexedDB on first call. `createMemoryStorage()` is for tests and for
 * the "don't save my data" path.
 */

import { clear, createStore, del, get, getMany, keys, set, type UseStore } from "idb-keyval";
import type { CueAdaptationState } from "@/lib/coaching";
import type { BehavioralBaseline, Session } from "@/types";

export interface CueStorage {
  getConsent(): Promise<boolean>;
  setConsent(allowed: boolean): Promise<void>;

  saveSession(session: Session): Promise<void>;
  getSession(id: string): Promise<Session | null>;
  /** Newest first. */
  listSessions(): Promise<Session[]>;
  deleteSession(id: string): Promise<void>;

  saveBaselines(baselines: BehavioralBaseline[]): Promise<void>;
  loadBaselines(): Promise<BehavioralBaseline[]>;
  clearBaselines(): Promise<void>;

  saveAdaptation(state: CueAdaptationState): Promise<void>;
  loadAdaptation(): Promise<CueAdaptationState>;

  /** "Delete my data": sessions, baselines, feedback history AND consent. */
  deleteAllData(): Promise<void>;
}

const SESSION = "session:";
const BASELINE = "baseline:";
const ADAPTATION = "adaptation";
const CONSENT = "consent";

const byNewest = (a: Session, b: Session) => b.startedAt - a.startedAt;

// ---- IndexedDB ---------------------------------------------------------------

export function createIndexedDbStorage(dbName = "cue", storeName = "kv"): CueStorage {
  let store: UseStore | null = null;
  const s = () => (store ??= createStore(dbName, storeName));
  const keysWithPrefix = async (prefix: string) =>
    (await keys(s())).filter((k): k is string => typeof k === "string" && k.startsWith(prefix));

  return {
    async getConsent() {
      return (await get<boolean>(CONSENT, s())) === true;
    },
    async setConsent(allowed) {
      await set(CONSENT, allowed, s());
    },

    async saveSession(session) {
      await set(SESSION + session.id, session, s());
    },
    async getSession(id) {
      return (await get<Session>(SESSION + id, s())) ?? null;
    },
    async listSessions() {
      const ks = await keysWithPrefix(SESSION);
      const all = await getMany<Session>(ks, s());
      return all.filter((x): x is Session => Boolean(x)).sort(byNewest);
    },
    async deleteSession(id) {
      await del(SESSION + id, s());
    },

    async saveBaselines(baselines) {
      await Promise.all(baselines.map((b) => set(BASELINE + b.signal, b, s())));
    },
    async loadBaselines() {
      const ks = await keysWithPrefix(BASELINE);
      return (await getMany<BehavioralBaseline>(ks, s())).filter((x): x is BehavioralBaseline => Boolean(x));
    },
    async clearBaselines() {
      await Promise.all((await keysWithPrefix(BASELINE)).map((k) => del(k, s())));
    },

    async saveAdaptation(state) {
      await set(ADAPTATION, state, s());
    },
    async loadAdaptation() {
      return (await get<CueAdaptationState>(ADAPTATION, s())) ?? {};
    },

    async deleteAllData() {
      await clear(s());
    },
  };
}

// ---- Memory ------------------------------------------------------------------

export function createMemoryStorage(): CueStorage {
  const m = new Map<string, unknown>();
  const clone = <T>(v: T): T => structuredClone(v);
  const withPrefix = (p: string) => [...m.keys()].filter((k) => k.startsWith(p));

  return {
    async getConsent() {
      return m.get(CONSENT) === true;
    },
    async setConsent(allowed) {
      m.set(CONSENT, allowed);
    },
    async saveSession(session) {
      m.set(SESSION + session.id, clone(session));
    },
    async getSession(id) {
      const v = m.get(SESSION + id) as Session | undefined;
      return v ? clone(v) : null;
    },
    async listSessions() {
      return withPrefix(SESSION).map((k) => clone(m.get(k) as Session)).sort(byNewest);
    },
    async deleteSession(id) {
      m.delete(SESSION + id);
    },
    async saveBaselines(baselines) {
      for (const b of baselines) m.set(BASELINE + b.signal, clone(b));
    },
    async loadBaselines() {
      return withPrefix(BASELINE).map((k) => clone(m.get(k) as BehavioralBaseline));
    },
    async clearBaselines() {
      for (const k of withPrefix(BASELINE)) m.delete(k);
    },
    async saveAdaptation(state) {
      m.set(ADAPTATION, clone(state));
    },
    async loadAdaptation() {
      return clone((m.get(ADAPTATION) as CueAdaptationState | undefined) ?? {});
    },
    async deleteAllData() {
      m.clear();
    },
  };
}

/** IndexedDB in the browser; memory elsewhere (SSR, tests, locked-down browsers). */
export function createDefaultStorage(): CueStorage {
  return typeof indexedDB !== "undefined" ? createIndexedDbStorage() : createMemoryStorage();
}
