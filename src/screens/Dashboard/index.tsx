import { Link, useNavigate } from "react-router-dom";
import { AppShell, PageHeader } from "@/components/AppShell";
import { Button } from "@/components/Button";
import { Sheet, SectionTitle } from "@/components/Sheet";
import { formatDuration } from "@/components/format";
import { useProfileStore } from "@/state/profileStore";
import { KIND_LABELS, useHistory, type HistoryEntry } from "@/state/history";
import type { ConversationKind } from "@/types";

/**
 * 01 · Overview — the returning person's home at /home. Private Field Journal.
 * Focal point: ONE suggested next step on the forest field (the screen's
 * expressive moment), chosen from where the person actually is in the
 * journey. Everything else recedes: honest counts, recent sessions, and the
 * patterns they chose. No scores, streaks or progress bars (CLAUDE.md §5).
 */
const RECENT = 4;
const DATE = new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" });
const TIME = new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" });

interface NextStep {
  lead: string;
  follow: string;
  body: string;
  action: string;
  to: string;
}

function nextStep(hasStyle: boolean, counts: Record<ConversationKind, number>): NextStep {
  if (!hasStyle)
    return {
      lead: "Know what you want to say.",
      follow: "Then practise saying it your way.",
      body: "Start with a speaker or a talk you admire. Cue picks out the patterns you can practise, and you choose which to keep.",
      action: "Build my profile",
      to: "/profile?tab=style",
    };
  if (counts.voice === 0)
    return {
      lead: "Try a five-minute voice session.",
      follow: "Think it through, out loud.",
      body: "Explain something you know well. The coach listens and suggests one or two small changes, tied to the patterns you chose.",
      action: "Start voice practice",
      to: "/practice/voice",
    };
  if (counts.interview === 0)
    return {
      lead: "Rehearse a conversation that matters.",
      follow: "A mock interview, with follow-ups.",
      body: "Pick a scenario and a difficulty. The interviewer speaks, you answer, and the transcript is there to review afterwards.",
      action: "Set up a mock interview",
      to: "/practice/interview",
    };
  return {
    lead: "Bring it into a real conversation.",
    follow: "Quiet help, only when it's useful.",
    body: "Live coaching listens alongside a real meeting or interview and offers a discreet suggestion now and then. You choose what it can access.",
    action: "Set up live coaching",
    to: "/session",
  };
}

function RecentRow({ e }: { e: HistoryEntry }) {
  return (
    <li className="grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-x-6 gap-y-0.5 border-b border-border py-3.5 sm:grid-cols-[120px_minmax(0,1fr)_minmax(0,1fr)_auto]">
      <span className="order-3 font-mono text-[12px] text-text-muted sm:order-none">
        {DATE.format(e.startedAt)}, {TIME.format(e.startedAt)}
      </span>
      <Link to={e.href} className="font-medium underline decoration-border-strong underline-offset-4 hover:text-accent hover:decoration-accent">
        {e.title}
      </Link>
      <span className="order-4 truncate text-text-muted sm:order-none">{e.focus}</span>
      <span className="text-right font-mono text-[12px] tabular-nums text-text-muted">{formatDuration(e.durationMs)}</span>
    </li>
  );
}

export function Dashboard() {
  const navigate = useNavigate();
  const profile = useProfileStore((s) => s.communicationProfile);
  const consent = useProfileStore((s) => s.consentSaveMetrics);
  const history = useHistory();
  const entries = history.status === "ready" ? history.entries.filter((e) => !e.sample) : [];
  const kept = profile?.traits.filter((t) => t.keep) ?? [];

  const counts: Record<ConversationKind, number> = { voice: 0, interview: 0, live: 0 };
  entries.forEach((e) => (counts[e.kind] += 1));
  const step = nextStep(kept.length > 0, counts);

  return (
    <AppShell art={{ plate: "bluejayVine" }}>
      <PageHeader
        title="Your next conversation, with more intention."
        lede="A private place to understand how you communicate, practise deliberately, and bring what works into real conversations."
      />

      <div className="mt-10 grid items-start gap-x-10 gap-y-10 lg:grid-cols-[minmax(0,1.65fr)_minmax(260px,1fr)]">
        {/* Focal: the one next step */}
        <Sheet tone="accent" aria-labelledby="next-title" className="px-7 py-8 md:px-10 md:py-11">
          <p className="text-[13.5px] opacity-85">Suggested next</p>
          <h2 id="next-title" className="mt-3 max-w-[18ch] text-balance font-display text-[clamp(30px,3.6vw,42px)] font-semibold leading-[1.05] tracking-[-0.015em]">
            {step.lead}
          </h2>
          <p className="mt-2 font-serif text-[clamp(19px,2vw,23px)] italic opacity-90">{step.follow}</p>
          <p className="mt-5 max-w-[52ch] text-[15.5px] leading-relaxed opacity-90">{step.body}</p>
          <div className="mt-8">
            <Button variant="inverse" onClick={() => navigate(step.to)}>
              {step.action}
            </Button>
          </div>
        </Sheet>

        {/* Secondary: counts, in words */}
        <section aria-labelledby="glance-title" className="lg:pt-2">
          <SectionTitle id="glance-title">At a glance</SectionTitle>
          <dl className="mt-3 border-t border-border">
            {(Object.keys(KIND_LABELS) as ConversationKind[]).map((k) => (
              <div key={k} className="flex items-baseline justify-between border-b border-border py-3">
                <dt className="text-text-muted">{KIND_LABELS[k]}</dt>
                <dd className={`font-display text-[20px] tabular-nums leading-none ${counts[k] === 0 ? "text-text-muted" : ""}`}>
                  {history.status === "loading" ? "…" : counts[k]}
                </dd>
              </div>
            ))}
          </dl>
          <p className="mt-3 text-[13.5px] text-text-muted">
            {consent ? "Sessions saved on this device." : "Saving is off, so only this visit's sessions are counted."}{" "}
            {!consent && (
              <Link to="/profile?tab=data" className="underline underline-offset-4 hover:text-accent">
                Change this
              </Link>
            )}
          </p>
        </section>

        {/* Tertiary row */}
        <section aria-labelledby="recent-title">
          <div className="flex items-baseline justify-between gap-4">
            <SectionTitle id="recent-title">Recent sessions</SectionTitle>
            {entries.length > 0 && (
              <Link to="/reports" className="text-[14px] underline underline-offset-4 hover:text-accent">
                All sessions
              </Link>
            )}
          </div>
          {entries.length > 0 ? (
            <ul className="mt-3 border-t border-border">
              {entries.slice(0, RECENT).map((e) => (
                <RecentRow key={`${e.kind}-${e.id}`} e={e} />
              ))}
            </ul>
          ) : (
            <p className="mt-3 border-t border-border pt-4 font-serif italic text-text-muted">
              {history.status === "loading" ? "Opening your journal…" : "Nothing here yet. Finished sessions are listed here, newest first."}
            </p>
          )}
        </section>

        <section aria-labelledby="toward-title">
          <SectionTitle id="toward-title">What you&apos;re working toward</SectionTitle>
          {kept.length > 0 ? (
            <ul className="mt-3 border-t border-border">
              {kept.map((t) => (
                <li key={t.id} className="border-b border-border py-3">
                  <p className="font-medium">{t.name}</p>
                  <p className="text-[14.5px] text-text-muted">{t.description}</p>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 border-t border-border pt-4 font-serif italic text-text-muted">
              Your chosen patterns appear here once you build your communication profile.
            </p>
          )}
          <Link to="/profile?tab=style" className="mt-3 inline-block text-[14px] underline underline-offset-4 hover:text-accent">
            {kept.length > 0 ? "Edit your communication profile" : "Build your communication profile"}
          </Link>
        </section>
      </div>
    </AppShell>
  );
}
