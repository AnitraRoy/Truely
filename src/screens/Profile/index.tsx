import { useSearchParams } from "react-router-dom";
import { AppShell, PageHeader } from "@/components/AppShell";
import { Tabs } from "@/components/Tabs";
import { Overview } from "./Overview";
import { Settings } from "./Settings";
import { DataPrivacy } from "./DataPrivacy";
import { StyleProfilePanel } from "../StyleProfile";

/**
 * My profile: 10 · Profile review, 02 · Communication profile (desired style),
 * Settings, and Data & privacy, as tabs of one screen.
 * A local device profile — there is no account (PRD §5). The active tab lives
 * in ?tab= so other screens can link straight to Data & privacy.
 * Focal point: the two columns of the review — desired style and natural
 * baseline, side by side and never merged.
 */
export type ProfileTab = "overview" | "style" | "settings" | "data";
const KEYS: ProfileTab[] = ["overview", "style", "settings", "data"];

export function Profile() {
  const [params, setParams] = useSearchParams();
  const raw = params.get("tab");
  const tab: ProfileTab = KEYS.includes(raw as ProfileTab) ? (raw as ProfileTab) : "overview";
  const setTab = (key: ProfileTab) => setParams(key === "overview" ? {} : { tab: key }, { replace: true });
  // From a button inside a panel: switch, then put focus on the new tab so it isn't lost with the old panel.
  const openTab = (key: ProfileTab) => {
    setTab(key);
    requestAnimationFrame(() => document.getElementById(`profile-tab-${key}`)?.focus());
  };

  return (
    <AppShell art={{ plate: "yellowhammer" }}>
      <PageHeader
        step="My profile"
        title="A style that still sounds like you."
        lede="Use this profile as a compass, not a script. Your goals can change as you practise and review real conversations."
      />
      <div className="mt-9">
        <Tabs
          label="Profile sections"
          idBase="profile"
          value={tab}
          onChange={setTab}
          items={[
            { key: "overview", label: "Review", panel: <Overview onOpenTab={openTab} /> },
            { key: "style", label: "Communication profile", panel: <StyleProfilePanel onReview={() => openTab("overview")} /> },
            { key: "settings", label: "Settings", panel: <Settings /> },
            { key: "data", label: "Data & privacy", panel: <DataPrivacy /> },
          ]}
        />
      </div>
    </AppShell>
  );
}
