import type { ReactNode } from "react";
import { SERVICE_UNAVAILABLE_COPY } from "@/config/conversation";
import type { ServiceName } from "@/lib/services";

/**
 * Honest "this needs a provider" state for integration-backed features.
 * Says what is missing and what still works. Calm, never an alarm.
 * Owner: Design System team.
 */
const NAMES: Record<ServiceName, string> = { moss: "Moss", cartesia: "Cartesia", apify: "Apify" };

export function ServiceNotice({
  missing,
  desktop,
  children,
  className = "",
}: {
  missing: ServiceName[];
  /** False outside the desktop app (no bridge at all). */
  desktop: boolean;
  children?: ReactNode;
  className?: string;
}) {
  if (missing.length === 0) return null;
  const names = missing.map((m) => NAMES[m]).join(" and ");
  return (
    <div role="note" className={`border-l-2 border-ochre-mark pl-3.5 ${className}`}>
      <p className="text-[14.5px]">
        <span className="font-medium">{names} {missing.length === 1 ? "isn't" : "aren't"} available here.</span>{" "}
        <span className="text-text-muted">{desktop ? SERVICE_UNAVAILABLE_COPY.not_configured : SERVICE_UNAVAILABLE_COPY.desktop_only}</span>
      </p>
      {children && <div className="mt-1.5 text-[14px] text-text-muted">{children}</div>}
    </div>
  );
}
