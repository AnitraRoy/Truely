import { useSearchParams } from "react-router-dom";
import { AppShell, PageHeader } from "@/components/AppShell";
import { Tabs } from "@/components/Tabs";
import { Overview } from "./Overview";
import { Settings } from "./Settings";
import { DataPrivacy } from "./DataPrivacy";

/**
 * My profile (10 · Profile review, plus Settings and Data & privacy).
 * A local device profile — there is no account (PRD §5). The active tab lives
 * in ?tab= so other screens can link straight to Data & privacy.
 * Focal point: the two columns of the review — desired style and natural
 * baseline, side by side and never merged.
 */
type TabKey = "overview" | "settings" | "data";
const KEYS: TabKey[] = ["overview", "settings", "data"];

export function Profile() {
  const [params, setParams] = useSearchParams();
  const raw = params.get("tab");
  const tab: TabKey = KEYS.includes(raw as TabKey) ? (raw as TabKey) : "overview";
  const setTab = (key: TabKey) => setParams(key === "overview" ? {} : { tab: key }, { replace: true });

  return (
    <AppShell>
      <PageHeader
        step="Your communication profile"
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
            { key: "overview", label: "Review", panel: <Overview onOpenTab={setTab} /> },
            { key: "settings", label: "Settings", panel: <Settings /> },
            { key: "data", label: "Data & privacy", panel: <DataPrivacy /> },
          ]}
        />
      </div>
    </AppShell>
  );
}
