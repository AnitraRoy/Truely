import { useEffect, useState } from "react";
import { getServiceStatus, serviceBridge, type ServiceStatus } from "@/lib/services";

/**
 * Which providers are configured, for showing honest "needs X" states.
 * `null` while checking. All false without a bridge. Owner: Design System.
 */
export function useServiceStatus(): ServiceStatus | null {
  const [status, setStatus] = useState<ServiceStatus | null>(null);
  useEffect(() => {
    let cancelled = false;
    getServiceStatus().then((s) => !cancelled && setStatus(s));
    return () => {
      cancelled = true;
    };
  }, []);
  return status;
}

/** True when a service bridge exists: the Cue desktop shell, or the Vite dev server in development. */
export function hasDesktopBridge(): boolean {
  return serviceBridge() !== null;
}

/** Playback lives in lib/services/playback; re-exported for existing screen imports. */
export { playAudio, primeAudio } from "@/lib/services/playback";
