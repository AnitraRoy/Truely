import { NavLink } from "react-router-dom";
import { Masthead } from "./Masthead";

/**
 * Global header for Landing, Dashboard, Reports and Profile — the Masthead with
 * text links in the folio slot. Never rendered on /calibrate or /session
 * (CLAUDE.md §6). Owner: Design System team.
 *
 * The wordmark is the landing page ("/"), as in the app shell; "Home" is the
 * returning person's journal ("/home"). Names match the app toolbars.
 */
const LINKS = [
  { to: "/home", label: "Home" },
  { to: "/reports", label: "Review sessions" },
  { to: "/profile", label: "My profile" },
];

export function SiteNav() {
  return (
    <Masthead
      homeHref="/"
      folio={
        <nav aria-label="Primary" className="flex items-center gap-6">
          {LINKS.map(({ to, label }) => (
            <NavLink
              key={to}
              to={to}
              end
              className={({ isActive }) =>
                `inline-flex min-h-6 items-center border-b pb-0.5 font-serif text-[16px] italic text-text-primary transition-colors duration-cue ease-cue hover:text-accent ${
                  isActive ? "border-text-primary" : "border-transparent"
                }`
              }
            >
              {label}
            </NavLink>
          ))}
        </nav>
      }
    />
  );
}
