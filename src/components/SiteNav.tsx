import { NavLink } from "react-router-dom";
import { Masthead } from "./Masthead";

/**
 * Global header for Landing, Dashboard, Reports and Profile — the Masthead with
 * text links in the folio slot. Never rendered on /calibrate or /session
 * (CLAUDE.md §6). Owner: Design System team.
 */
const LINKS = [
  { to: "/reports", label: "Reports" },
  { to: "/profile", label: "Profile" },
];

export function SiteNav() {
  return (
    <Masthead
      homeHref="/home"
      folio={
        <nav aria-label="Primary" className="flex items-center gap-6">
          {LINKS.map(({ to, label }) => (
            <NavLink
              key={to}
              to={to}
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
