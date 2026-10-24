import { useSearchParams } from "react-router-dom";
import { SiteNav } from "@/components/SiteNav";
import { Tabs } from "@/components/Tabs";
import { PrivacyNote } from "@/components/PrivacyNote";
import { Overview } from "./Overview";
import { Settings } from "./Settings";
import { DataPrivacy } from "./DataPrivacy";

/**
 * Profile (docs/FRONTEND_GUIDE.md §3.3). Field Journal.
 * A local device profile — there is no account (PRD §5). The active tab lives
 * in ?tab= so other screens can link straight to Data & privacy.
 * Focal point: the page title and the active tab's panel.
 */
type TabKey = "overview" | "settings" | "data";
const KEYS: TabKey[] = ["overview", "settings", "data"];

export function Profile() {
  const [params, setParams] = useSearchParams();
  const raw = params.get("tab");
  const tab: TabKey = KEYS.includes(raw as TabKey) ? (raw as TabKey) : "overview";
  const setTab = (key: TabKey) => setParams(key === "overview" ? {} : { tab: key }, { replace: true });

  return (
    <main className="mx-auto max-w-5xl px-6 py-10 md:py-14">
      <SiteNav />

      <div className="mt-10 grid items-start gap-x-[clamp(24px,4vw,56px)] gap-y-8 md:grid-cols-[minmax(0,1fr)_220px]">
        <div>
          <h1 className="font-display text-[clamp(34px,5vw,52px)] font-semibold leading-[1.02] tracking-[-0.015em]">
            Your profile
          </h1>
          <div className="mt-8">
            <Tabs
              label="Profile sections"
              idBase="profile"
              value={tab}
              onChange={setTab}
              items={[
                { key: "overview", label: "Overview", panel: <Overview onOpenTab={setTab} /> },
                { key: "settings", label: "Settings", panel: <Settings /> },
                { key: "data", label: "Data & privacy", panel: <DataPrivacy /> },
              ]}
            />
          </div>
        </div>

        <aside className="md:pt-[88px]">
          <PrivacyNote>
            This profile lives in this browser on this device. There&apos;s no account, and nothing here is
            uploaded.
          </PrivacyNote>
        </aside>
      </div>
    </main>
  );
}
