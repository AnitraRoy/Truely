import { COACHING_CONFIG } from "@/config/coaching";
import { SettingRow } from "@/components/SettingRow";
import { Toggle } from "@/components/Toggle";
import { ChoiceGroup } from "@/components/ChoiceGroup";
import { useProfileStore, type ProfileSettings } from "@/state/profileStore";
import { THEME_LABELS, type ThemePreference } from "@/styles/theme";

/**
 * Settings tab. Stores only the person's overrides; thresholds and timing stay
 * in src/config/coaching.ts (CLAUDE.md §8). Every control has a visible label
 * and help text.
 */
const CUE_SECONDS = Math.round(COACHING_CONFIG.cueVisibleMs / 1000);
const COOLDOWN_SECONDS = Math.round(COACHING_CONFIG.cueCooldownMs / 1000);

const FREQUENCY: { value: ProfileSettings["cueFrequency"]; label: string }[] = [
  { value: "standard", label: "Standard" },
  { value: "fewer", label: "Fewer" },
];

const THEMES = (Object.keys(THEME_LABELS) as ThemePreference[]).map((value) => ({ value, label: THEME_LABELS[value] }));

export function Settings() {
  const settings = useProfileStore((s) => s.settings);
  const update = useProfileStore((s) => s.updateSettings);

  return (
    <div>
      <h2 className="font-display text-[22px]">During a session</h2>
      <div className="mt-3 border-t border-border">
        <SettingRow
          label="Show coaching cues"
          helpId="set-cues-help"
          help={`Cues appear beside your preview for ${CUE_SECONDS} seconds, then fade. Turn off to keep observing without visual cues.`}
        >
          <Toggle
            checked={!settings.muteCues}
            onChange={(on) => update({ muteCues: !on })}
            label="Show coaching cues"
            describedBy="set-cues-help"
          />
        </SettingRow>

        <SettingRow
          label="Cue frequency"
          helpId="set-frequency-help"
          help={`Standard waits at least ${COOLDOWN_SECONDS} seconds between cues. Fewer waits longer.`}
        >
          <span id="set-frequency-label" className="sr-only">
            Cue frequency
          </span>
          <ChoiceGroup
            name="cue-frequency"
            options={FREQUENCY}
            value={settings.cueFrequency}
            onChange={(cueFrequency) => update({ cueFrequency })}
            labelledBy="set-frequency-label"
            describedBy="set-frequency-help"
          />
        </SettingRow>

        <SettingRow
          label="Keep learning from my sessions"
          helpId="set-learning-help"
          help="On: Cue keeps fine-tuning your usual head position and movement as you settle in, and spaces out cues you mark as distracting. Off: Cue keeps the baseline it first learned and leaves cue timing as it is. A first baseline is still learned once, since camera cues need it."
        >
          <Toggle
            checked={settings.keepLearning}
            onChange={(keepLearning) => update({ keepLearning })}
            label="Keep learning from my sessions"
            describedBy="set-learning-help"
          />
        </SettingRow>

        <SettingRow
          label="Signal sketch"
          helpId="set-viz-help"
          help="A small line beside the preview showing the measured signal. Off keeps the screen quieter."
        >
          <Toggle
            checked={settings.showSignalViz}
            onChange={(showSignalViz) => update({ showSignalViz })}
            label="Signal sketch"
            describedBy="set-viz-help"
          />
        </SettingRow>
      </div>

      <h2 className="mt-10 font-display text-[22px]">Appearance</h2>
      <div className="mt-3 border-t border-border">
        <SettingRow label="Theme" helpId="set-theme-help" help="The light journal is the default.">
          <span id="set-theme-label" className="sr-only">
            Theme
          </span>
          <ChoiceGroup
            name="theme"
            options={THEMES}
            value={settings.theme}
            onChange={(theme) => update({ theme })}
            labelledBy="set-theme-label"
            describedBy="set-theme-help"
          />
        </SettingRow>

        <SettingRow
          label="Reduce motion"
          helpId="set-motion-help"
          help="Cue already follows your device's reduced-motion setting. Turn this on to reduce motion here regardless."
        >
          <Toggle
            checked={settings.reducedMotion === "on"}
            onChange={(on) => update({ reducedMotion: on ? "on" : "system" })}
            label="Reduce motion"
            describedBy="set-motion-help"
          />
        </SettingRow>
      </div>
    </div>
  );
}
