import { useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { Button } from "@/components/Button";
import { ChoiceGroup } from "@/components/ChoiceGroup";
import { CheckChips, SelectField, TextArea, TextField } from "@/components/Field";
import { SectionTitle, Sheet } from "@/components/Sheet";
import { ServiceNotice } from "@/components/ServiceNotice";
import { Toggle } from "@/components/Toggle";
import { hasDesktopBridge, useServiceStatus } from "@/components/useServiceStatus";
import { FEEDBACK_CATEGORIES, FEEDBACK_CATEGORY_LABELS, STYLE_CONTEXTS } from "@/config/conversation";
import { extractStyle, fetchReference, isArticleUrl, isYouTubeUrl, planReferenceSearch, searchReferences, type ReferenceCandidate } from "@/lib/conversation";
import type { ServiceName } from "@/lib/services";
import { newId } from "@/state/conversations";
import { useProfileStore } from "@/state/profileStore";
import { useSessionStore } from "@/state/sessionStore";
import type { FeedbackCategory, SpeechMetrics, StyleReference, StyleTrait } from "@/types";
import { ReferenceSearch } from "./ReferenceSearch";

/**
 * 02 · Communication profile (Stage 1: Learn) — the "Communication profile"
 * tab of My profile (/profile?tab=style). Private Field Journal.
 * The person says who or what they want to sound like; Moss turns that into a
 * search, Apify finds talks and interviews (or reads a link they give), the
 * person picks one, Apify reads its captions or page, and Moss restates their
 * intent and drafts observable patterns for them to keep. They can also paste
 * text. Without the providers, they write patterns themselves — the profile
 * still works.
 *
 * Focal point: the draft patterns once they exist (the decision), the
 * reference form before that. This is the DESIRED style only; the natural
 * baseline comes from webcam calibration and is kept separate (§ note below).
 */
type Mode = "search" | "link" | "paste";
type Phase = { kind: "idle" } | { kind: "searching" } | { kind: "reading" } | { kind: "analyzing" } | { kind: "error"; message: string };

const LABEL_FOR = Object.fromEntries(FEEDBACK_CATEGORIES.map((c) => [FEEDBACK_CATEGORY_LABELS[c], c])) as Record<string, FeedbackCategory>;

function TraitRow({ trait, onChange, onRemove }: { trait: StyleTrait; onChange: (t: StyleTrait) => void; onRemove: () => void }) {
  const [editing, setEditing] = useState(false);
  return (
    <li className={`border-b border-border py-4 ${trait.keep ? "" : "opacity-70"}`}>
      <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-5">
        <div>
          <p className="text-[12.5px] text-text-muted">{FEEDBACK_CATEGORY_LABELS[trait.category]}</p>
          <h3 className="font-display text-[19px] font-semibold leading-snug">{trait.name}</h3>
        </div>
        <Toggle checked={trait.keep} onChange={(keep) => onChange({ ...trait, keep })} label={`Keep ${trait.name}`} />
      </div>
      {editing ? (
        <div className="mt-2">
          <TextArea
            label="Description"
            value={trait.description}
            onChange={(e) => onChange({ ...trait, description: e.target.value })}
            rows={2}
          />
        </div>
      ) : (
        <p className="mt-1 max-w-[60ch] text-[15px]">{trait.description}</p>
      )}
      {trait.evidence && !editing && (
        <p className="mt-1.5 font-serif text-[15px] italic text-text-muted">&ldquo;{trait.evidence}&rdquo;</p>
      )}
      <div className="mt-2 flex gap-5 text-[13.5px]">
        <button type="button" className="min-h-6 underline underline-offset-4 hover:text-accent" onClick={() => setEditing((v) => !v)} aria-expanded={editing}>
          {editing ? "Done editing" : "Edit"}
        </button>
        <button type="button" className="min-h-6 text-text-muted underline underline-offset-4 hover:text-text-primary" onClick={onRemove}>
          Remove
        </button>
      </div>
    </li>
  );
}

/** Old links to /profile/style land on the tab inside My profile. */
export function StyleProfile() {
  return <Navigate to="/profile?tab=style" replace />;
}

export function StyleProfilePanel({ onReview }: { onReview: () => void }) {
  const saved = useProfileStore((s) => s.communicationProfile);
  const setProfile = useProfileStore((s) => s.setCommunicationProfile);
  const calibrated = useSessionStore((s) => s.isCalibrated);
  const services = useServiceStatus();
  const desktop = hasDesktopBridge();

  const [mode, setMode] = useState<Mode>(saved?.reference?.source === "pasted" ? "paste" : saved?.reference?.url ? "link" : "search");
  const [url, setUrl] = useState(saved?.reference?.url ?? "");
  const [pasted, setPasted] = useState("");
  // "Find one": the request, what truely. searched for, the results, and the one the person picked.
  const [request, setRequest] = useState(saved?.reference?.query ?? "");
  const [searchedQuery, setSearchedQuery] = useState("");
  const [candidates, setCandidates] = useState<ReferenceCandidate[]>([]);
  const [picked, setPicked] = useState("");
  const [admire, setAdmire] = useState(saved?.admire ?? "");
  const [contexts, setContexts] = useState<string[]>(saved?.contexts ?? []);
  const [intent, setIntent] = useState(saved?.intent ?? "");
  const [reference, setReference] = useState<StyleReference | undefined>(saved?.reference);
  const [traits, setTraits] = useState<StyleTrait[]>(saved?.traits ?? []);
  const [phase, setPhase] = useState<Phase>({ kind: "idle" });
  const [savedNote, setSavedNote] = useState("");
  const [draftName, setDraftName] = useState("");
  const [draftDesc, setDraftDesc] = useState("");
  const [draftCat, setDraftCat] = useState(FEEDBACK_CATEGORY_LABELS.clarity);

  const busy = phase.kind === "searching" || phase.kind === "reading" || phase.kind === "analyzing";
  // The link to read: the video picked from search results, or the one typed in.
  const refUrl = mode === "search" ? picked : mode === "link" ? url.trim() : "";
  const urlError = mode === "link" && refUrl && !isYouTubeUrl(refUrl) && !isArticleUrl(refUrl) ? "That doesn't look like a web link. Paste the full address, starting with https://." : null;
  const needed: ServiceName[] = mode === "paste" ? ["moss"] : ["moss", "apify"];
  const missing = services ? needed.filter((s) => !services[s]) : [];
  const canSearch = !busy && Boolean(services?.apify) && request.trim().length > 0;
  const canAnalyze = !busy && services?.moss && (admire.trim().length > 0 || refUrl || (mode === "paste" && pasted.trim())) && !urlError && (!refUrl || services.apify);

  async function find() {
    setSavedNote("");
    setCandidates([]);
    setPicked("");
    setPhase({ kind: "searching" });
    const plan = await planReferenceSearch(request);
    const res = await searchReferences(plan.query);
    if (!res.ok) {
      setPhase({
        kind: "error",
        message:
          res.reason === "no_results"
            ? "No talks with captions turned up for that. Try a name plus \"talk\" or \"interview\", or paste a link."
            : res.reason === "empty_query"
              ? "Say who or what you want to sound like first."
              : "truely. couldn't reach Apify just now. Try again, or paste a link or text instead.",
      });
      return;
    }
    setSearchedQuery(plan.query);
    setCandidates(res.candidates);
    // The request doubles as the first draft of "what do you admire".
    if (!admire.trim()) setAdmire(request.trim());
    setPhase({ kind: "idle" });
  }

  async function analyze() {
    setSavedNote("");
    let referenceText: string | undefined;
    let ref: StyleReference | undefined;
    let speech: SpeechMetrics | undefined;
    if (mode === "paste" && pasted.trim()) {
      referenceText = pasted.trim();
      ref = { source: "pasted", analysedChars: referenceText.length };
    } else if (refUrl) {
      setPhase({ kind: "reading" });
      const res = await fetchReference(refUrl);
      if (!res.ok) {
        setPhase({
          kind: "error",
          message:
            res.reason === "no_transcript"
              ? "That video has no captions truely. can read. Try another video, or paste a transcript instead."
              : res.reason === "no_text"
                ? "That page has too little readable text, or it blocks automated reading. Try another link, or paste the text instead."
                : res.reason === "unsupported_url"
                  ? "truely. can read YouTube links and public web pages. Paste the text for anything else."
                  : "truely. couldn't reach Apify just now. Try again, or paste the text instead.",
        });
        return;
      }
      referenceText = res.text;
      speech = res.speech;
      ref = {
        source: res.kind,
        url: refUrl,
        title: res.title,
        analysedChars: res.text.length,
        ...(mode === "search" && searchedQuery ? { query: searchedQuery } : {}),
        ...(res.speech ? { speech: res.speech } : {}),
      };
    }
    setPhase({ kind: "analyzing" });
    const style = await extractStyle({ admire, contexts, referenceText, speech });
    if (!style) {
      setPhase({ kind: "error", message: "truely. couldn't draft patterns this time. Try again, or write your own below." });
      return;
    }
    setReference(ref);
    setIntent(style.intent);
    // Fresh drafts replace earlier drafts, but patterns the person wrote themselves stay.
    setTraits((prev) => [...prev.filter((t) => t.id.startsWith("own-")), ...style.traits.map((t) => ({ ...t, id: newId("trait"), keep: true }))]);
    setPhase({ kind: "idle" });
  }

  function addOwn() {
    if (!draftName.trim() || !draftDesc.trim()) return;
    setTraits((t) => [...t, { id: newId("own"), category: LABEL_FOR[draftCat] ?? "clarity", name: draftName.trim(), description: draftDesc.trim(), keep: true }]);
    setDraftName("");
    setDraftDesc("");
  }

  function save() {
    setProfile({ reference, admire: admire.trim(), contexts, intent: intent || undefined, traits, updatedAt: Date.now() });
    setSavedNote("Saved. Your practice sessions now use the patterns you kept.");
  }

  const kept = traits.filter((t) => t.keep).length;

  return (
    <div>
      <h2 className="text-balance font-display text-[clamp(24px,2.6vw,30px)] font-semibold leading-tight">
        What does good communication look like to you?
      </h2>
      <p className="mt-2 max-w-[66ch] text-text-muted">
        Start with someone whose style you admire. The patterns you keep become your voice baseline: what every practice and
        live session coaches toward. They&apos;re goals, not a script to imitate.
      </p>

      <div className="mt-9 grid items-start gap-x-10 gap-y-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.25fr)]">
        {/* The reference form */}
        <section aria-labelledby="ref-title">
          <SectionTitle id="ref-title">A reference to learn from</SectionTitle>
          <p className="mt-1 text-[14.5px] text-text-muted">A public talk, interview or article, and what you like about it.</p>
          {services && (
            <ServiceNotice className="mt-5" missing={missing} desktop={desktop}>
              You can still write your own patterns in the panel beside this.
            </ServiceNotice>
          )}

          <form
            className="mt-6 space-y-6"
            onSubmit={(e) => {
              e.preventDefault();
              if (canAnalyze) void analyze();
            }}
          >
            <div>
              <p id="ref-mode-label" className="text-[14px] font-medium">
                How do you want to give truely. a reference?
              </p>
              <div className="mt-2">
                <ChoiceGroup<Mode>
                  name="reference-mode"
                  labelledBy="ref-mode-label"
                  value={mode}
                  onChange={setMode}
                  options={[
                    { value: "search", label: "Find one" },
                    { value: "link", label: "I have a link" },
                    { value: "paste", label: "Paste text" },
                  ]}
                />
              </div>
            </div>

            {mode === "search" && (
              <ReferenceSearch
                request={request}
                onRequest={setRequest}
                onSearch={() => void find()}
                searching={phase.kind === "searching"}
                canSearch={canSearch}
                searchedQuery={searchedQuery}
                candidates={candidates}
                picked={picked}
                onPick={setPicked}
              />
            )}
            {mode === "link" && (
              <TextField
                label="Link to a talk, interview or article"
                help="A public YouTube video with captions, or a public web page."
                type="url"
                inputMode="url"
                placeholder="https://…"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                error={urlError}
              />
            )}
            {mode === "paste" && (
              <TextArea
                label="Reference text"
                help="Paste a transcript or article you have the right to use. Only the first few pages are analyzed."
                value={pasted}
                onChange={(e) => setPasted(e.target.value)}
                rows={6}
              />
            )}

            <TextArea
              label="What do you admire?"
              help="In your own words. truely. uses this to understand what you want to improve."
              placeholder="For example: they explain complex ideas simply, and pause before the important part."
              value={admire}
              onChange={(e) => setAdmire(e.target.value)}
              rows={3}
            />

            <CheckChips legend="Where you'll use it" options={STYLE_CONTEXTS} value={contexts} onChange={setContexts} />

            <div className="flex flex-wrap items-center gap-x-5 gap-y-3 border-t border-border pt-5">
              <Button type="submit" disabled={!canAnalyze}>
                {phase.kind === "reading" ? "Reading the reference…" : phase.kind === "analyzing" ? "Finding patterns…" : "Analyze reference"}
              </Button>
              <p className="text-[13.5px] text-text-muted" aria-live="polite">
                {busy ? "This can take up to a minute." : ""}
              </p>
            </div>
            <p className="text-[13.5px] text-text-muted">
              Public material only. When you search, your words go to Moss to make a YouTube search, and Apify runs it. The link you
              pick goes to Apify to read its captions or page, and the text plus your note go to Moss to draft patterns. Nothing is
              published, and only the patterns you keep are saved, on this device.
            </p>
            {phase.kind === "error" && (
              <p role="alert" className="text-[14.5px] text-warning">
                {phase.message}
              </p>
            )}
          </form>
        </section>

        {/* Focal once it exists: the draft */}
        <Sheet aria-labelledby="draft-title" className="px-6 py-7 md:px-8">
          <div className="flex flex-wrap items-baseline justify-between gap-3">
            <SectionTitle id="draft-title">Patterns worth keeping</SectionTitle>
            {traits.length > 0 && (
              <p className="text-[13.5px] text-text-muted">
                {kept} of {traits.length} kept
              </p>
            )}
          </div>
          {intent && (
            <p className="mt-3 border-l-2 border-ochre-mark pl-3.5 font-serif text-[16.5px] italic">
              {intent}
              {reference?.title && <span className="mt-1 block font-sans text-[13px] not-italic text-text-muted">From: {reference.title}</span>}
            </p>
          )}

          {traits.length > 0 ? (
            <ul className="mt-4 border-t border-border">
              {traits.map((t) => (
                <TraitRow
                  key={t.id}
                  trait={t}
                  onChange={(next) => setTraits((all) => all.map((x) => (x.id === t.id ? next : x)))}
                  onRemove={() => setTraits((all) => all.filter((x) => x.id !== t.id))}
                />
              ))}
            </ul>
          ) : (
            <p className="mt-4 font-serif italic text-text-muted">
              Drafted patterns appear here after the analysis. Review each one before you keep it.
            </p>
          )}

          <details className="mt-6 border-t border-border pt-4">
            <summary className="min-h-6 cursor-pointer text-[14.5px] font-medium">Write your own pattern</summary>
            <div className="mt-4 space-y-4">
              <SelectField label="Aspect" options={FEEDBACK_CATEGORIES.map((c) => FEEDBACK_CATEGORY_LABELS[c])} value={draftCat} onChange={(e) => setDraftCat(e.target.value)} />
              <TextField label="Name" placeholder="For example: Lead with the point" value={draftName} onChange={(e) => setDraftName(e.target.value)} />
              <TextArea label="What it looks like" placeholder="For example: Say the decision first, then the reason." value={draftDesc} onChange={(e) => setDraftDesc(e.target.value)} rows={2} />
              <Button variant="secondary" size="sm" onClick={addOwn} disabled={!draftName.trim() || !draftDesc.trim()}>
                Add pattern
              </Button>
            </div>
          </details>

          <div className="mt-7 flex flex-wrap items-center gap-x-6 gap-y-3 border-t border-border pt-6">
            <Button onClick={save} disabled={kept === 0}>
              Save profile
            </Button>
            {saved && (
              <Button variant="ghost" onClick={onReview}>
                Review your profile
              </Button>
            )}
          </div>
          <p role="status" className="mt-3 min-h-[1.5em] text-[14px] text-accent">
            {savedNote}
          </p>
        </Sheet>
      </div>

      {/* The distinction, stated once */}
      <aside aria-labelledby="distinction-title" className="mt-14 grid gap-x-10 gap-y-3 border-t-2 border-text-primary pt-6 md:grid-cols-[minmax(0,1fr)_minmax(0,1.25fr)]">
        <h2 id="distinction-title" className="font-display text-[22px] font-semibold leading-snug">
          For your voice, you set the baseline.
        </h2>
        <div>
          <p className="max-w-[62ch] text-text-muted">
            truely. doesn&apos;t record a sample of you talking to compare against. The style you choose here is the baseline for how
            you sound. Separately, a short camera calibration measures your natural head and gaze patterns, only if you turn it
            on. truely. never infers one from the other.
          </p>
          <Link to="/calibrate" className="mt-3 inline-block underline underline-offset-4 hover:text-accent">
            {calibrated ? "Recalibrate your camera baseline" : "Set up camera calibration"}
          </Link>
        </div>
      </aside>
    </div>
  );
}
