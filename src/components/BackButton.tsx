import { useLocation, useNavigate } from "react-router-dom";
import { Button } from "./Button";

/**
 * "Back" on every page, so nobody is stranded after moving forward.
 *
 * By default it returns to the page the person came from (browser history).
 * If there is none (they opened this page directly, or refreshed it), it goes
 * to `fallback` instead, so the control never does nothing. Pass `onBack` to
 * step back within a page (a calibration phase, say) rather than leave it.
 * Owner: Design System team.
 */
export function BackButton({
  fallback,
  onBack,
  label = "Back",
  className = "",
}: {
  /** Where to go when there is no earlier page in this visit. */
  fallback: string;
  /** Step back within the current page instead of navigating. */
  onBack?: () => void;
  label?: string;
  className?: string;
}) {
  const navigate = useNavigate();
  const { key } = useLocation();
  // React Router gives the first entry of a visit the key "default".
  const hasHistory = key !== "default";

  return (
    <Button
      variant="ghost"
      size="sm"
      className={className}
      onClick={() => {
        if (onBack) onBack();
        else if (hasHistory) navigate(-1);
        else navigate(fallback);
      }}
    >
      <span aria-hidden>←</span> {label}
    </Button>
  );
}

/** Where each page's Back goes when there is no history to return to. */
export function backFallback(pathname: string): string {
  if (pathname === "/home") return "/";
  if (pathname === "/profile/style") return "/profile";
  if (pathname.startsWith("/report/")) return "/reports";
  return "/home";
}
