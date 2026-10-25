import { useEffect, useRef, useState, type ReactNode } from "react";
import { Link, useLocation } from "react-router-dom";
import { BackButton, backFallback } from "./BackButton";

/**
 * The journal's application shell: a top toolbar (wordmark, home icon, and the
 * main tools in one row) plus a side toolbar that lists the same tools in
 * journey order, each with a line saying what it's for. Owner: Design System.
 *
 * One list of tools (`TOOLS`) feeds both toolbars, so a destination always has
 * the same name. The "Cue." wordmark goes to the public landing page (`/`);
 * the home icon goes to Home (`/home`). Below `lg` the side toolbar is hidden
 * and the top toolbar's Menu disclosure shows the tools with their purpose
 * lines; the home icon stays. Never used while a live session is running
 * (CLAUDE.md §6); the live screen renders its own quiet header.
 */
type Match = (pathname: string, search: string) => boolean;
interface Tool {
  to: string;
  label: string;
  /** What the tool is for, in a few plain words (side toolbar and menu). */
  purpose: string;
  match: Match;
  /** Also listed in the top toolbar. */
  top?: boolean;
}

const isStyleTab = (search: string) => new URLSearchParams(search).get("tab") === "style";

/** The practice journey, in order. */
const TOOLS: Tool[] = [
  { to: "/home", label: "Home", purpose: "Your next step and recent sessions", match: (p) => p === "/home" },
  {
    to: "/profile?tab=style",
    label: "Find your style",
    purpose: "Pick a speaker you admire and the habits to practise",
    match: (p, q) => p === "/profile" && isStyleTab(q),
  },
  {
    to: "/practice/voice",
    label: "Practise out loud",
    purpose: "Talk it through with a coach who suggests small fixes",
    match: (p) => p === "/practice/voice",
    top: true,
  },
  {
    to: "/practice/interview",
    label: "Rehearse an interview",
    purpose: "A realistic mock interview with a live transcript",
    match: (p) => p === "/practice/interview",
    top: true,
  },
  {
    to: "/session",
    label: "Coach me live",
    purpose: "Discreet notes during a real meeting or interview",
    match: (p) => p === "/session",
    top: true,
  },
  {
    to: "/reports",
    label: "Review sessions",
    purpose: "Transcripts, key moments and what to try next",
    match: (p) => p.startsWith("/reports") || p.startsWith("/report/"),
    top: true,
  },
];

/** Set-up and account tools, below the journey. */
const SETUP: Tool[] = [
  {
    to: "/calibrate",
    label: "Calibrate camera",
    purpose: "Learn your natural head and gaze, in under a minute",
    match: (p) => p === "/calibrate",
  },
  {
    to: "/profile",
    label: "My profile",
    purpose: "Your style, camera baseline, settings and data",
    match: (p, q) => p === "/profile" && !isStyleTab(q),
  },
];

/** The top toolbar's "My profile" covers every profile tab, including Find your style. */
const TOP: Tool[] = [{ ...SETUP[1], match: (p) => p.startsWith("/profile") }, ...TOOLS.filter((t) => t.top)];

/** Functional icon (CLAUDE.md §4A.3 allows SVG for icons): an outline house. */
function HomeIcon() {
  return (
    <svg aria-hidden viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 10.5 12 4l8 6.5" />
      <path d="M6 9.5V20h12V9.5" />
      <path d="M10 20v-5.5h4V20" />
    </svg>
  );
}

function useActive() {
  const { pathname, search } = useLocation();
  return (t: Tool) => t.match(pathname, search);
}

const topCls = (active: boolean) =>
  `inline-flex min-h-10 items-center whitespace-nowrap rounded px-3 text-[14.5px] transition-colors duration-cue-fast ease-cue ${
    active ? "bg-accent/10 font-medium text-text-primary" : "text-text-muted hover:bg-sunken/70 hover:text-text-primary"
  }`;

function HomeLink() {
  const isActive = useActive();
  const active = isActive(TOOLS[0]);
  return (
    <Link to="/home" aria-label="Home" title="Home" aria-current={active ? "page" : undefined} className={`${topCls(active)} w-10 justify-center px-0`}>
      <HomeIcon />
    </Link>
  );
}

/** A tool with its purpose line: the side toolbar and the narrow-screen menu. */
function ToolLink({ tool, number, onNavigate }: { tool: Tool; number?: number; onNavigate?: () => void }) {
  const isActive = useActive();
  const active = isActive(tool);
  return (
    <Link
      to={tool.to}
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      className={`grid grid-cols-[26px_1fr] gap-x-1 rounded border-l-2 px-3 py-2.5 transition-colors duration-cue-fast ease-cue ${
        active ? "border-ochre-mark bg-accent/10" : "border-transparent hover:bg-sunken/60"
      }`}
    >
      <span aria-hidden className="pt-[3px] font-mono text-[11.5px] tabular-nums text-text-muted">
        {number != null ? String(number).padStart(2, "0") : ""}
      </span>
      <span>
        <span className={`block text-[14.5px] leading-snug text-text-primary ${active ? "font-medium" : ""}`}>{tool.label}</span>
        <span className="mt-0.5 block text-[12.5px] leading-snug text-text-muted">{tool.purpose}</span>
      </span>
    </Link>
  );
}

function ToolList({ onNavigate, idBase }: { onNavigate?: () => void; idBase: string }) {
  return (
    <>
      <p id={`${idBase}-journey`} className="px-3 text-[12.5px] text-text-muted">
        Your practice
      </p>
      <ul aria-labelledby={`${idBase}-journey`} className="mt-1.5 space-y-0.5">
        {TOOLS.map((t, i) => (
          <li key={t.to}>
            <ToolLink tool={t} number={i + 1} onNavigate={onNavigate} />
          </li>
        ))}
      </ul>
      <p id={`${idBase}-setup`} className="mt-5 border-t border-border px-3 pt-4 text-[12.5px] text-text-muted">
        Set-up
      </p>
      <ul aria-labelledby={`${idBase}-setup`} className="mt-1.5 space-y-0.5">
        {SETUP.map((t) => (
          <li key={t.to}>
            <ToolLink tool={t} onNavigate={onNavigate} />
          </li>
        ))}
      </ul>
    </>
  );
}

export function AppShell({
  children,
  back,
}: {
  children: ReactNode;
  /** Step back within the page (e.g. leave a running session for its setup form) instead of leaving the page. */
  back?: { onBack: () => void; label?: string };
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuButton = useRef<HTMLButtonElement>(null);
  const { pathname, search } = useLocation();
  const isActive = useActive();
  useEffect(() => setMenuOpen(false), [pathname, search]);

  return (
    <div className="min-h-screen">
      <a href="#main" className="sr-only z-50 rounded bg-surface px-3 py-2 focus:not-sr-only focus:fixed focus:left-3 focus:top-3">
        Skip to content
      </a>

      {/* Top toolbar */}
      <header className="sticky top-0 z-40 border-b border-border bg-surface">
        <div className="flex h-16 items-center gap-4 px-4 sm:px-8 lg:px-6">
          <span className="flex items-baseline gap-3 lg:w-[236px]">
            <Link
              to="/"
              aria-label="Cue landing page"
              title="Cue landing page"
              className="rounded font-display text-[24px] font-semibold leading-none tracking-[-0.01em] transition-colors duration-cue ease-cue hover:text-accent"
            >
              Cue<span className="text-ochre-mark">.</span>
            </Link>
            <span className="hidden font-serif text-[14px] italic text-text-muted 2xl:inline">Your communication journal</span>
          </span>

          <nav
            aria-label="Primary"
            className="relative ml-auto flex items-center gap-1"
            onKeyDown={(e) => {
              if (e.key === "Escape" && menuOpen) {
                setMenuOpen(false);
                menuButton.current?.focus();
              }
            }}
          >
            <HomeLink />
            <ul className="hidden items-center gap-1 lg:flex">
              {TOP.map((t) => {
                const active = isActive(t);
                return (
                  <li key={t.label}>
                    <Link to={t.to} aria-current={active ? "page" : undefined} className={topCls(active)}>
                      {t.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
            <button
              ref={menuButton}
              type="button"
              aria-expanded={menuOpen}
              aria-controls="mobile-nav"
              onClick={() => setMenuOpen((v) => !v)}
              className="ml-1 min-h-10 rounded border border-border-strong px-3 text-[14px] lg:hidden"
            >
              {menuOpen ? "Close menu" : "Menu"}
            </button>
            <div
              id="mobile-nav"
              hidden={!menuOpen}
              className="absolute right-0 top-full mt-3 max-h-[calc(100vh-5rem)] w-[min(320px,calc(100vw-2rem))] overflow-y-auto rounded-lg border border-border bg-surface p-2 pt-3 lg:hidden"
            >
              <ToolList idBase="menu" onNavigate={() => setMenuOpen(false)} />
            </div>
          </nav>
        </div>
      </header>

      <div className="lg:grid lg:grid-cols-[264px_minmax(0,1fr)]">
        {/* Side toolbar: the same tools in journey order, each with its purpose */}
        <aside className="hidden border-r border-border bg-surface lg:block">
          <nav aria-label="Tools" className="sticky top-16 h-[calc(100vh-4rem)] overflow-y-auto px-3 pb-8 pt-6">
            <ToolList idBase="side" />
          </nav>
        </aside>

        <main id="main" tabIndex={-1} className="min-w-0 px-4 py-9 focus:outline-none sm:px-8 md:py-12 lg:px-12">
          <div className="mx-auto max-w-[1120px]">
            <div className="mb-6">
              <BackButton fallback={backFallback(pathname)} onBack={back?.onBack} label={back?.label} />
            </div>
            {children}
          </div>
        </main>
      </div>
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
