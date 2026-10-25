import { useEffect, useState } from "react";
import { getServiceStatus, type ServiceStatus } from "@/lib/services";

/**
 * Which providers are configured, for showing honest "needs X" states.
 * `null` while checking. All false outside the desktop app. Owner: Design System.
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

/** True when running inside the Cue desktop shell (the service bridge exists). */
export function hasDesktopBridge(): boolean {
  return Boolean((globalThis as { cueDesktop?: { services?: unknown } }).cueDesktop?.services);
}

/** Play a short audio blob; resolves when it ends (or fails). */
export function playAudio(blob: Blob): Promise<void> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(blob);
    const audio = new Audio(url);
    const done = () => {
      URL.revokeObjectURL(url);
      resolve();
    };
    audio.onended = done;
    audio.onerror = done;
    audio.play().catch(done);
  });
}
