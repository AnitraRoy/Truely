import { Button } from "@/components/Button";
import { TextArea } from "@/components/Field";
import type { ReferenceCandidate } from "@/lib/conversation";

/**
 * Stage 1, "find one": describe who or what you want to sound like, truely. turns
 * that into a YouTube search through Apify, and the person picks the result to
 * learn from. Choosing is deliberate: truely. never picks a reference for them.
 * Owner: Integration + UI.
 */
function clock(sec?: number): string {
  if (sec === undefined) return "";
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = String(Math.floor(sec % 60)).padStart(2, "0");
  return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${s}` : `${m}:${s}`;
}

export function ReferenceSearch({
  request,
  onRequest,
  onSearch,
  searching,
  canSearch,
  searchedQuery,
  candidates,
  picked,
  onPick,
}: {
  request: string;
  onRequest: (v: string) => void;
  onSearch: () => void;
  searching: boolean;
  canSearch: boolean;
  /** The query truely. actually searched for, shown so the person can see what ran. */
  searchedQuery: string;
  candidates: ReferenceCandidate[];
  picked: string;
  onPick: (url: string) => void;
}) {
  return (
    <div className="space-y-5">
      <TextArea
        label="Who or what do you want to sound like?"
        help="A person, a talk, or a quality, in your own words."
        placeholder="For example: explain technical ideas as clearly as Richard Feynman does."
        value={request}
        onChange={(e) => onRequest(e.target.value)}
        rows={3}
      />
      <Button type="button" variant="secondary" onClick={onSearch} disabled={!canSearch}>
        {searching ? "Searching…" : "Find talks and interviews"}
      </Button>

      <div aria-live="polite">
        {searchedQuery && candidates.length > 0 && (
          <p className="text-[13.5px] text-text-muted">
            Searched YouTube for &ldquo;{searchedQuery}&rdquo;. Only videos with captions are shown.
          </p>
        )}
      </div>

      {candidates.length > 0 && (
        <fieldset>
          <legend className="text-[14px] font-medium">Pick one to learn from</legend>
          <ul className="mt-2 border-t border-border">
            {candidates.map((c) => {
              const checked = picked === c.url;
              const meta = [c.channel, clock(c.durationSec), c.views !== undefined ? `${c.views.toLocaleString()} views` : ""].filter(Boolean).join(", ");
              return (
                <li key={c.id} className="border-b border-border">
                  <label
                    className={`flex min-h-11 cursor-pointer items-start gap-3 py-3 has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-accent ${
                      checked ? "text-text-primary" : "text-text-muted hover:text-text-primary"
                    }`}
                  >
                    <input type="radio" name="reference-candidate" value={c.url} checked={checked} onChange={() => onPick(c.url)} className="mt-1.5 accent-accent" />
                    <span className="min-w-0">
                      <span className={`block text-[15px] leading-snug ${checked ? "font-medium" : ""}`}>{c.title}</span>
                      {meta && <span className="block text-[13px] text-text-muted">{meta}</span>}
                    </span>
                  </label>
                  <a href={c.url} target="_blank" rel="noreferrer" className="mb-3 ml-7 inline-block min-h-6 text-[13px] underline underline-offset-4 hover:text-accent">
                    Open on YouTube to check it
                  </a>
                </li>
              );
            })}
          </ul>
        </fieldset>
      )}
    </div>
  );
}
