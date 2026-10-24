/**
 * reports module (PRD §6 Screen D, §9)
 * Owner: Data team.
 *
 * Responsibilities:
 *  - Build timeline data from recorded events.
 *  - Produce session summaries.
 *  - Compare compatible sessions.
 *  - Derive supported insights — NEVER fabricate (PRD §6, §12).
 */

import type { CoachingEvent, Session, SessionSummary } from "@/types";

export interface TimelineEntry {
  timestamp: number;
  kind: "deviation" | "cue" | "tracking_gap";
  event?: CoachingEvent;
}

export interface ReportBuilder {
  summarize(session: Session): SessionSummary;
  buildTimeline(session: Session): TimelineEntry[];
  /** Up to three insights, each backed by actual session data (PRD §6). */
  deriveInsights(session: Session): string[];
}

// TODO(data-team): implement timeline + summary derivation.
export function createReportBuilder(): ReportBuilder {
  throw new Error("reports.createReportBuilder not implemented");
}
