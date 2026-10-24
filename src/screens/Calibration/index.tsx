/**
 * Screen B: Goal Selection + Calibration (PRD §6 Screen B). Owner: Screen B team.
 * Pick one goal → request webcam → 30–60s baseline calibration.
 */
export function Calibration() {
  return (
    <main className="mx-auto max-w-4xl px-6 py-16">
      <h1 className="text-2xl font-semibold">Set up your session</h1>
      {/* TODO(screen-b): goal picker, webcam permission + preview, calibration
          progress, completion state. Do not require perfect eye contact. */}
    </main>
  );
}
