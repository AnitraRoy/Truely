
import { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  SignalHub,
  YAW_SIGNAL,
  PITCH_SIGNAL,
  MOTION_SIGNAL,
} from "@/lib/signals";
import type { AlignedFrame, VisionObservation } from "@/lib/signals";

let activeHub: SignalHub | null = null;

const VISUAL_SIGNALS = [YAW_SIGNAL, PITCH_SIGNAL, MOTION_SIGNAL] as const;

const SIGNAL_LABELS: Record<string, string> = {
  [YAW_SIGNAL]: "Head yaw (left/right)",
  [PITCH_SIGNAL]: "Head pitch (up/down)",
  [MOTION_SIGNAL]: "Head motion",
};

type BaselineStats = {
  mean: number;
  sd: number;
  sampleCount: number;
};

type VisualBaseline = Record<string, BaselineStats>;

function SignalTest() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const baselineBuf = useRef<Record<string, number[]> | null>(null);
  const baselineTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const recordingRef = useRef<VisionObservation[] | null>(null);

  const [useMic, setUseMic] = useState(false);
  const [started, setStarted] = useState<{
    camera: boolean;
    microphone: boolean;
  } | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [issue, setIssue] = useState<string | null>(null);
  const [frame, setFrame] = useState<AlignedFrame | null>(null);
  const [baseline, setBaseline] = useState<VisualBaseline | null>(null);
  const [calibrating, setCalibrating] = useState(false);
  const [recording, setRecording] = useState(false);

  useEffect(() => {
    return () => {
      if (baselineTimer.current) clearTimeout(baselineTimer.current);
      baselineBuf.current = null;
      activeHub?.dispose();
      activeHub = null;
    };
  }, []);

  const start = async () => {
    const video = videoRef.current;
    if (!video) return;

    setErrors([]);
    setIssue(null);
    setStarted(null);

    activeHub?.dispose();

    const hub = new SignalHub({
      enableAudio: useMic,
      onFrame: setFrame,
      onTrackingIssue: (trackingIssue) => setIssue(trackingIssue),
      onObservations: (observations) => {
        recordingRef.current?.push(...observations);

        const buffers = baselineBuf.current;
        if (!buffers) return;

        for (const observation of observations) {
          if (
            observation.valid &&
            Number.isFinite(observation.value) &&
            buffers[observation.signal]
          ) {
            buffers[observation.signal].push(observation.value);
          }
        }
      },
      onError: (source, code, message) =>
        setErrors((previous) => [
          ...previous,
          `${source}: ${code} (${message})`,
        ]),
    });

    activeHub = hub;

    try {
      const result = await hub.start(video);
      setStarted(result);

      if (!result.camera) {
        setErrors((previous) => [
          ...previous,
          "Camera failed to start. Check browser permissions and try again.",
        ]);
      }
    } catch (error) {
      setErrors((previous) => [
        ...previous,
        `Start failed: ${
          error instanceof Error ? error.message : String(error)
        }`,
      ]);
    }
  };

  const captureBaseline = () => {
    if (!started?.camera) {
      setErrors((previous) => [
        ...previous,
        "Start the camera before capturing a visual baseline.",
      ]);
      return;
    }

    if (calibrating) return;

    if (baselineTimer.current) clearTimeout(baselineTimer.current);

    setErrors([]);
    setBaseline(null);
    setCalibrating(true);

    baselineBuf.current = Object.fromEntries(
      VISUAL_SIGNALS.map((signal) => [signal, [] as number[]]),
    );

    baselineTimer.current = setTimeout(() => {
      const buffers = baselineBuf.current;
      baselineBuf.current = null;
      baselineTimer.current = null;
      setCalibrating(false);

      if (!buffers) return;

      const minimumSamples = 10;
      const nextBaseline: VisualBaseline = {};
      const problems: string[] = [];

      for (const signal of VISUAL_SIGNALS) {
        const values = buffers[signal];

        if (values.length < minimumSamples) {
          problems.push(
            `${SIGNAL_LABELS[signal]}: only ${values.length} valid samples; need at least ${minimumSamples}.`,
          );
          continue;
        }

        const mean =
          values.reduce((sum, value) => sum + value, 0) / values.length;

        const variance =
          values.reduce((sum, value) => sum + (value - mean) ** 2, 0) /
          values.length;

        nextBaseline[signal] = {
          mean,
          sd: Math.sqrt(variance),
          sampleCount: values.length,
        };
      }

      if (problems.length > 0) {
        setErrors([
          "Visual baseline was not saved. Keep your face visible, wait for tracking to stabilize, and retry.",
          ...problems,
        ]);
        return;
      }

      setBaseline(nextBaseline);
    }, 5000);
  };

  const stopAndDownload = () => {
    const observations = recordingRef.current ?? [];
    recordingRef.current = null;
    setRecording(false);

    const payload = {
      source: "recorded",
      observations,
    };

    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = `recorded-observations-${Date.now()}.json`;
    link.click();

    URL.revokeObjectURL(url);
  };

  const deviations = VISUAL_SIGNALS.map((signal) => {
    const current = frame?.signals[signal];
    const reference = baseline?.[signal];

    return {
      signal,
      current,
      reference,
      zScore:
        current?.valid && reference && reference.sd > 0
          ? (current.value - reference.mean) / reference.sd
          : null,
    };
  });

  return (
    <main
      style={{
        padding: 24,
        fontFamily: "sans-serif",
        maxWidth: 760,
        margin: "0 auto",
      }}
    >
      <h1>Visual signal test</h1>

      <p>
        {started
          ? `Camera: ${started.camera ? "on" : "FAILED"} · Microphone: ${
              useMic
                ? started.microphone
                  ? "on"
                  : "FAILED"
                : "off"
            }`
          : "Not started"}
      </p>

      <p>
        Tracking issue: <b>{issue ?? "none reported"}</b>
      </p>

      {errors.map((error, index) => (
        <p key={`${index}-${error}`} style={{ color: "crimson" }}>
          {error}
        </p>
      ))}

      <video
        ref={videoRef}
        autoPlay
        muted
        playsInline
        style={{
          width: "100%",
          maxWidth: 480,
          transform: "scaleX(-1)",
          background: "#000",
        }}
      />

      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 8,
          margin: "12px 0",
        }}
      >
        <label>
          <input
            type="checkbox"
            checked={useMic}
            disabled={started !== null}
            onChange={(event) => setUseMic(event.target.checked)}
          />{" "}
          Use mic (select before Start; use headphones)
        </label>

        <button onClick={start}>Start</button>
        <button onClick={() => activeHub?.pause()}>Pause</button>
        <button onClick={() => activeHub?.resume()}>Resume</button>
        <button
          onClick={() => {
            if (baselineTimer.current) {
              clearTimeout(baselineTimer.current);
              baselineTimer.current = null;
            }
            baselineBuf.current = null;
            setCalibrating(false);
            activeHub?.stop();
            setStarted(null);
          }}
        >
          Stop
        </button>

        <button onClick={captureBaseline} disabled={calibrating}>
          {calibrating
            ? "Capturing visual baseline..."
            : "Capture 5s visual baseline"}
        </button>

        {!recording ? (
          <button
            onClick={() => {
              recordingRef.current = [];
              setRecording(true);
            }}
          >
            Record (optional)
          </button>
        ) : (
          <button onClick={stopAndDownload}>Stop and download JSON</button>
        )}
      </div>

      <h2>Live signals</h2>
      <pre style={{ whiteSpace: "pre-wrap" }}>
        {frame
          ? Object.entries(frame.signals)
              .map(
                ([name, signal]) =>
                  `${name.padEnd(18)} value=${signal.value
                    .toFixed(3)
                    .padStart(8)}  valid=${signal.valid}  age=${signal.ageMs}ms`,
              )
              .join("\n") || "No signals yet"
          : "No frames yet"}
      </pre>

      <h2>Visual baselines</h2>
      {!baseline && !calibrating && (
        <p>
          Start the camera, look and behave naturally, then capture a baseline
          for all three visual signals.
        </p>
      )}

      {calibrating && (
        <p>
          Collecting samples for 5 seconds. Keep your face visible and behave
          naturally.
        </p>
      )}

      {baseline && (
        <div style={{ overflowX: "auto" }}>
          <table
            style={{
              width: "100%",
              borderCollapse: "collapse",
              textAlign: "left",
            }}
          >
            <thead>
              <tr>
                <th style={{ padding: 8 }}>Signal</th>
                <th style={{ padding: 8 }}>Mean</th>
                <th style={{ padding: 8 }}>SD</th>
                <th style={{ padding: 8 }}>Samples</th>
                <th style={{ padding: 8 }}>Current deviation</th>
              </tr>
            </thead>
            <tbody>
              {deviations.map(
                ({ signal, reference, current, zScore }) =>
                  reference && (
                    <tr key={signal}>
                      <td style={{ padding: 8 }}>
                        {SIGNAL_LABELS[signal]}
                      </td>
                      <td style={{ padding: 8 }}>
                        {reference.mean.toFixed(3)}
                      </td>
                      <td style={{ padding: 8 }}>
                        {reference.sd.toFixed(3)}
                      </td>
                      <td style={{ padding: 8 }}>
                        {reference.sampleCount}
                      </td>
                      <td style={{ padding: 8 }}>
                        {zScore !== null
                          ? `${zScore.toFixed(1)} SDs`
                          : current && !current.valid
                            ? "Invalid observation"
                            : "Unavailable"}
                      </td>
                    </tr>
                  ),
              )}
            </tbody>
          </table>
        </div>
      )}

      <p style={{ color: "#666", fontSize: 13 }}>
        Development diagnostic only: deviations are not judgments of
        engagement or automatic coaching triggers. The five-second baseline is
        for initial testing, not final production calibration.
      </p>
    </main>
  );
}

createRoot(document.getElementById("root")!).render(<SignalTest />);
