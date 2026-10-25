import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { AppShell, PageHeader } from "@/components/AppShell";
import { ChoiceGroup } from "@/components/ChoiceGroup";
import { EmptyState } from "@/components/EmptyState";
import { Button } from "@/components/Button";
import { plural } from "@/components/format";
import { useProfileStore } from "@/state/profileStore";
import { KIND_LABELS, useHistory } from "@/state/history";
import { SAMPLE_REPORT_LINKS } from "@/screens/ConversationReport/samples";
import type { ConversationKind } from "@/types";
import { SessionList } from "./SessionList";

/**
 * 06 · Session history. Private Field Journal.
 * Every voice session, mock interview and live coaching session, newest first,
 * filterable by kind and searchable by title or focus. Each row opens its
 * matching report board. Empty stays honestly empty and says why (CLAUDE.md §5).
 * Focal point: the register.
 */
type Filter = "all" | ConversationKind;
const FILTERS: { value: Filter; label: string }[] = [
  { value: "all", label: "All sessions" },
  { value: "voice", label: KIND_LABELS.voice },
  { value: "interview", label: "Mock interviews" },
  { value: "live", label: KIND_LABELS.live },
];

export function Reports() {
  const navigate = useNavigate();
  const consent = useProfileStore((s) => s.consentSaveMetrics);
  const history = useHistory();
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");

  const all = history.status === "ready" ? history.entries : [];
  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return all.filter((e) => (filter === "all" || e.kind === filter) && (!q || `${e.title} ${e.focus}`.toLowerCase().includes(q)));
  }, [all, filter, query]);

  return (
    <AppShell art={{ plate: "yellowhammer", place: "foot" }}>
      <PageHeader
        step="Your session history"
        title="Small moments, worth revisiting."
        lede="Every session leaves something to come back to: a transcript, a moment that worked, one thing to try next time."
      />

      {history.status === "ready" && all.length > 0 && (
        <div className="mt-9 flex flex-wrap items-end justify-between gap-x-8 gap-y-4">
          <div>
            <p id="filter-label" className="sr-only">
              Show
            </p>
            <ChoiceGroup name="history-filter" options={FILTERS} value={filter} onChange={setFilter} labelledBy="filter-label" />
          </div>
          <div className="w-full sm:w-72">
            <label htmlFor="history-search" className="sr-only">
              Search sessions
            </label>
            <input
              id="history-search"
              type="search"
              placeholder="Search by title or focus"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="w-full rounded border border-border-strong bg-surface px-3 py-2 text-[15px] placeholder:text-text-muted"
            />
          </div>
        </div>
      )}

      <div className="mt-7">
        <p className="mb-4 text-[14px] text-text-muted" aria-live="polite">
          {history.status === "loading"
            ? "Opening your sessions…"
            : all.length > 0
              ? shown.length === all.length
                ? `${plural(all.length, "session")}, newest first.`
                : `${plural(shown.length, "session")} of ${all.length} shown.`
              : ""}
        </p>

        {history.status === "loading" ? null : shown.length > 0 ? (
          <SessionList entries={shown} />
        ) : all.length > 0 ? (
          <p className="font-serif italic text-text-muted">No sessions match. Try another filter or search.</p>
        ) : (
          <EmptyState
            title={consent ? "Nothing filed yet" : "No sessions kept"}
            action={
              <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
                <Button onClick={() => navigate("/practice/voice")}>Start voice practice</Button>
                {!consent && (
                  <Button variant="ghost" onClick={() => navigate("/profile?tab=data")}>
                    Turn on saving
                  </Button>
                )}
              </div>
            }
          >
            {consent
              ? "Finished sessions are listed here with their transcript and notes."
              : "Saving is off, so sessions are kept only until you close this tab. You still see each report when a session ends."}
          </EmptyState>
        )}

        {import.meta.env.DEV && (
          <p className="mt-8 text-[13.5px] text-text-muted">
            Development only: preview the report boards with clearly labelled sample data:{" "}
            {SAMPLE_REPORT_LINKS.map((l, i) => (
              <span key={l.href}>
                {i > 0 && ", "}
                <Link to={l.href} className="underline underline-offset-4 hover:text-accent">
                  {l.label}
                </Link>
              </span>
            ))}
            .
          </p>
        )}
      </div>
    </AppShell>
  );
}
