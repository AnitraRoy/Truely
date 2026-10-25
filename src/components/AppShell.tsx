import { useEffect, useState, type ReactNode } from "react";
import { Link, NavLink, useLocation } from "react-router-dom";
import { useProfileStore } from "@/state/profileStore";
import { useSessionStore } from "@/state/sessionStore";

/**
 * The journal's application shell: one numbered sidebar for the practice
 * journey (Overview → profile → voice → interview → live → history), the
 * person's profile beneath it, and an honest status block. Owner: Design
 * System team.
 *
 * One navigation, not two: the concept's duplicate top bar is dropped. Below
 * `md` the sidebar becomes a top bar with an APG disclosure menu. Never used
 * while a live session is running (CLAUDE.md §6); the live screen renders its
 * own quiet header.
 */
const JOURNEY = [
  { to: "/home", label: "Overview" },
  { to: "/profile/style", label: "Communication profile" },
  { to: "/practice/voice", label: "Voice coaching" },
  { to: "/practice/interview", label: "Mock interviews" },
  { to: "/session", label: "Live coaching" },
  { to: "/reports", label: "Session history" },
];

const linkCls = (active: boolean) =>
  `group grid min-h-10 grid-cols-[28px_1fr] items-center rounded border-l-2 px-3 py-2 text-[14.5px] transition-colors duration-cue-fast ease-cue ${
    active ? "border-ochre-mark bg-accent/10 font-medium text-text-primary" : "border-transparent text-text-muted hover:bg-sunken/60 hover:text-text-primary"
  }`;

function Nav({ onNavigate }: { onNavigate?: () => void }) {
  const { pathname } = useLocation();
  // /report/* belongs to Session history; /profile/style is its own entry.
  const isActive = (to: string) =>
    to === "/reports" ? pathname.startsWith("/reports") || pathname.startsWith("/report/") : pathname === to;

  return (
    <nav aria-label="Primary">
      <p id="nav-practice" className="px-3 text-[12.5px] text-text-muted">
        Your practice
      </p>
      <ul aria-labelledby="nav-practice" className="mt-2 space-y-0.5">
        {JOURNEY.map((item, i) => (
          <li key={item.to}>
            <Link to={item.to} onClick={onNavigate} aria-current={isActive(item.to) ? "page" : undefined} className={linkCls(isActive(item.to))}>
              <span aria-hidden className="font-mono text-[11.5px] tabular-nums text-text-muted">
                {String(i + 1).padStart(2, "0")}
              </span>
              {item.label}
            </Link>
          </li>
        ))}
      </ul>
      <ul className="mt-5 space-y-0.5 border-t border-border pt-5">
        <li>
          <NavLink to="/profile" end onClick={onNavigate} className={({ isActive: a }) => linkCls(a)}>
            <span aria-hidden />
            My profile
          </NavLink>
        </li>
      </ul>
    </nav>
  );
}

/** What the coach knows so far, in words. Never a score or progress bar. */
function ProfileStatus() {
  const profile = useProfileStore((s) => s.communicationProfile);
  const calibrated = useSessionStore((s) => s.isCalibrated);
  const kept = profile?.traits.filter((t) => t.keep).length ?? 0;
  const rows = [
    { label: "Desired style", value: kept > 0 ? `${kept} pattern${kept === 1 ? "" : "s"} chosen` : "Not set yet", done: kept > 0, to: "/profile/style" },
    { label: "Natural baseline", value: calibrated ? "Calibrated" : "Not calibrated", done: calibrated, to: "/calibrate" },
  ];
  return (
    <dl className="space-y-3 px-3">
      {rows.map((r) => (
        <div key={r.label}>
          <dt className="text-[12.5px] text-text-muted">{r.label}</dt>
          <dd className="mt-0.5 flex items-center gap-2 text-[14px]">
            <span aria-hidden className={`h-[7px] w-[7px] rounded-pill ${r.done ? "bg-positive" : "border border-text-muted"}`} />
            {r.done ? (
              r.value
            ) : (
              <Link to={r.to} className="underline decoration-border-strong underline-offset-4 hover:text-accent hover:decoration-accent">
                {r.value}
              </Link>
            )}
          </dd>
        </div>
      ))}
    </dl>
  );
}

const Wordmark = () => (
  <Link to="/home" className="font-display text-[24px] font-semibold leading-none tracking-[-0.01em] transition-colors duration-cue ease-cue hover:text-accent" aria-label="Cue overview">
    Cue<span className="text-ochre-mark">.</span>
  </Link>
);

export function AppShell({ children }: { children: ReactNode }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const { pathname } = useLocation();
  useEffect(() => setMenuOpen(false), [pathname]);

  return (
    <div className="min-h-screen md:grid md:grid-cols-[236px_minmax(0,1fr)]">
      <a href="#main" className="sr-only z-50 rounded bg-surface px-3 py-2 focus:not-sr-only focus:fixed focus:left-3 focus:top-3">
        Skip to content
      </a>

      {/* Desktop sidebar */}
      <aside className="hidden border-r border-border bg-surface md:block">
        <div className="sticky top-0 flex h-screen flex-col overflow-y-auto px-3 pb-7 pt-7">
          <div className="px-3">
            <Wordmark />
            <p className="mt-1.5 font-serif text-[14px] italic text-text-muted">Your communication journal</p>
          </div>
          <div className="mt-9">
            <Nav />
          </div>
          <div className="mt-8 border-t border-border pt-6">
            <ProfileStatus />
          </div>
          <p className="mt-auto px-3 pt-10 font-display text-[19px] leading-tight">
            A little better,
            <span className="block font-sans text-[13.5px] text-text-muted">one conversation at a time.</span>
          </p>
        </div>
      </aside>

      {/* Narrow screens: top bar + disclosure menu */}
      <header className="border-b border-border bg-surface px-4 py-3 md:hidden">
        <div className="flex items-center justify-between">
          <Wordmark />
          <button
            type="button"
            aria-expanded={menuOpen}
            aria-controls="mobile-nav"
            onClick={() => setMenuOpen((v) => !v)}
            className="min-h-10 rounded border border-border-strong px-3 text-[14px]"
          >
            {menuOpen ? "Close menu" : "Menu"}
          </button>
        </div>
        <div id="mobile-nav" hidden={!menuOpen} className="pb-2 pt-5">
          <Nav onNavigate={() => setMenuOpen(false)} />
          <div className="mt-5 border-t border-border pt-5">
            <ProfileStatus />
          </div>
        </div>
      </header>

      <main id="main" tabIndex={-1} className="min-w-0 px-4 py-8 focus:outline-none sm:px-8 md:px-10 md:py-11 lg:px-14">
        <div className="mx-auto max-w-[1120px]">{children}</div>
      </main>
    </div>
  );
}

/**
 * Page title block. `step` names the journey stage in plain words (it encodes
 * real order), and is the only small label above a heading.
 */
export function PageHeader({ title, lede, step, actions }: { title: ReactNode; lede?: ReactNode; step?: string; actions?: ReactNode }) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-x-8 gap-y-4">
      <div className="max-w-[760px]">
        {step && <p className="mb-2 text-[13.5px] text-text-muted">{step}</p>}
        <h1 className="text-balance font-display text-[clamp(32px,4.2vw,48px)] font-semibold leading-[1.04] tracking-[-0.018em]">{title}</h1>
        {lede && <p className="mt-3 max-w-[64ch] text-[16.5px] leading-relaxed text-text-muted">{lede}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-4">{actions}</div>}
    </header>
  );
}
