/**
 * The app's single SessionController (PRD §9). Owner: Integration (Person 4).
 *
 * Created lazily on first use — never at import time — so loading the app can't open
 * the camera or the model. Wires, in one place:
 *   camera + MediaPipe  → lib/sessions/pipelineSource (Person 2's SignalPipeline)
 *   storage             → the same instance the UI uses (state/savedData)
 *   profile settings    → consent to save, mute cues, keep learning  (profileStore is the source of truth)
 *   goal                → sessionStore.goal
 *
 * Usage:
 *   main.tsx   <SessionProvider controller={getSessionController()}> … </SessionProvider>
 *   screens    const s = useSession(); const c = useSessionController();
 */
import {
  PIPELINE_CONFIG_OVERRIDES,
  createObservationExtractor,
  createPipelineVisionSource,
  createSessionController,
  type SessionController,
} from "@/lib/sessions";
import { useProfileStore } from "./profileStore";
import { getStorage } from "./savedData";
import { useSessionStore } from "./sessionStore";

let controller: SessionController | null = null;

export function getSessionController(): SessionController {
  if (controller) return controller;

  const c = createSessionController({
    vision: createPipelineVisionSource(),
    extractor: createObservationExtractor(),
    config: PIPELINE_CONFIG_OVERRIDES,
    storage: getStorage(),
  });
  controller = c;

  // The profile owns these preferences; keep the controller's copies in step (initial + every change).
  const applyProfile = () => {
    const p = useProfileStore.getState();
    void c.setSaveConsent(p.consentSaveMetrics);
    c.setCuesMuted(p.settings.muteCues);
    c.setLearning(p.settings.keepLearning);
  };
  const applyGoal = () => {
    const goal = useSessionStore.getState().goal;
    if (goal) c.setGoal(goal);
  };
  void c.init().then(() => {
    applyProfile();
    applyGoal();
  });
  useProfileStore.subscribe((s, prev) => {
    if (
      s.consentSaveMetrics !== prev.consentSaveMetrics ||
      s.settings.muteCues !== prev.settings.muteCues ||
      s.settings.keepLearning !== prev.settings.keepLearning
    )
      applyProfile();
  });
  useSessionStore.subscribe((s, prev) => {
    if (s.goal !== prev.goal) applyGoal();
  });
  return c;
}

/** Test hook. */
export function resetSessionControllerForTests(): void {
  controller = null;
}
