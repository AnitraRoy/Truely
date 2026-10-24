/**
 * What to do when another app (usually the meeting app) holds the camera.
 * Shown under the preview while it's "busy" (see useWebcamPreview, which keeps
 * retrying on its own). On Windows 11 the fix is the per-camera "Allow multiple
 * apps to use camera at the same time" switch, so we walk through it and offer
 * to open the Cameras page. Owner: Design System team.
 */
const CAMERA_SETTINGS_URI = "ms-settings:camera";

export function isWindows(): boolean {
  if (typeof navigator === "undefined") return false;
  const uaData = (navigator as Navigator & { userAgentData?: { platform?: string } }).userAgentData;
  return (uaData?.platform ?? navigator.userAgent).includes("Windows");
}

function OpenSettings() {
  const className =
    "font-serif text-[15px] italic text-text-primary border-b border-text-primary pb-0.5 " +
    "transition-colors duration-cue ease-cue hover:text-accent hover:border-accent";
  const desktop = window.cueDesktop;
  if (desktop) {
    return (
      <button type="button" onClick={() => void desktop.openCameraSettings()} className={className}>
        Open camera settings
      </button>
    );
  }
  return (
    <a href={CAMERA_SETTINGS_URI} className={className}>
      Open camera settings
    </a>
  );
}

export function CameraBusyHelp({ windows = isWindows() }: { windows?: boolean }) {
  return (
    <div className="space-y-3 text-[15px] leading-relaxed text-text-muted">
      <p className="m-0 text-text-primary">
        Another app is using your camera. Cue keeps trying and will pick it up as soon as it&apos;s free.
      </p>
      {windows ? (
        <>
          <p className="m-0">To use Cue and your meeting app at the same time, let Windows share the camera:</p>
          <ol className="m-0 list-decimal space-y-1 pl-5">
            <li>Open Settings, then Bluetooth &amp; devices, then Cameras.</li>
            <li>Choose your camera.</li>
            <li>Next to Advanced camera options, select Edit.</li>
            <li>
              Turn on <span className="text-text-primary">Allow multiple apps to use camera at the same time</span>, then
              select Apply.
            </li>
          </ol>
          <p className="m-0">
            If your meeting app already has the camera, turn its video off and on again. This switch is in recent
            Windows 11 updates; if you don&apos;t see it, turn off video in the other app instead.
          </p>
          <OpenSettings />
        </>
      ) : (
        <p className="m-0">Turn off video in the other app, or close it, and Cue will continue.</p>
      )}
    </div>
  );
}
