"use client";
/**
 * React bindings for the session controller. Person 1 uses ONLY these in the UI.
 *
 *   // app/layout.tsx (client wrapper)
 *   <SessionProvider controller={controller}>{children}</SessionProvider>
 *
 *   // any screen
 *   const s = useSession();               // live snapshot, re-renders on change
 *   const c = useSessionController();     // call c.startSession(), c.pause(), …
 */

import { createContext, useContext, useSyncExternalStore, type ReactNode } from "react";
import type { SessionController, SessionSnapshot } from "./sessionController";

const Ctx = createContext<SessionController | null>(null);

export function SessionProvider({ controller, children }: { controller: SessionController; children: ReactNode }) {
  return <Ctx.Provider value={controller}>{children}</Ctx.Provider>;
}

export function useSessionController(): SessionController {
  const c = useContext(Ctx);
  if (!c) throw new Error("useSessionController must be used inside <SessionProvider>");
  return c;
}

export function useSession(): SessionSnapshot {
  const c = useSessionController();
  return useSyncExternalStore(c.subscribe, c.getSnapshot, c.getSnapshot);
}
