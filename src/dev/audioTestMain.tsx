import { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  AudioCalibrator,
  AudioSignalSource,
  VOICE_ACTIVE_SIGNAL,
  VOICE_LEVEL_SIGNAL,
} from "@/lib/audio";
import type { AudioCalibration } from "@/lib/audio";

// DEV ONLY. Real persistence belongs to the storage module (IndexedDB).
const STORE_KEY = "cue-dev-audio-profiles";
const QUIET_MS = 5000;
const SPEAK_MS = 20000; // 20 s for testing; the real flow should use 30-60 s

type ProfileId = "A" | "B";
type Profiles = Partial<Record<ProfileId, AudioCalibration>>;
type Phase = "idle" | "quiet" | "speak";

function loadProfiles(): Profiles {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    return raw ? (JSON.parse(raw) as Profiles) : {};
  } catch {
    return {};
  }
}

function saveProfiles(p: Profiles): void {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(p));
  } catch {
    // storage unavailable: ignore (dev page only)
  }
}

function AudioTest() {
  const sourceRef = useRef<AudioSignalSource | null>(null);
  const calibratorRef = useRef<AudioCalibrator | null>(null);
  const phaseRef = useRef<Phase>("idle");
  const timersRef = useRef<number[]>([]);
  const profilesRef = useRef<Profiles>(loadProfiles());

  const [profiles, setProfiles] = useState<Profiles>(profilesRef.current);
  const [selected, setSelected] = useState<ProfileId>("A");
  const [phase, setPhase] = useState<Phase>("idle");
  const [message, setMessage] = useState("");
  const [micOn, setMicOn] = useState(false);
  const [level, setLevel] = useState<number | null>(null);
  const [active, setActive] = useState<number | null>(null);
  const [errors, setErrors] = useState<string[]>([]);

  const clearTimers = () => {
    timersRef.current.forEach((t) => window.clearTimeout(t));
    timersRef.current = [];
  };

  const setPhaseBoth = (p: Phase) => {
    phaseRef.current = p;
    setPhase(p);
  };

  // Apply the selected profile's calibration to the running mic.
  useEffect(() => {
    sourceRef.current?.setCalibration(profiles[selected] ?? null);
  }, [selected, profiles]);

  useEffect(() => {
    return () => {
      clearTimers();
      sourceRef.current?.dispose(); // releases the mic
      sourceRef.current = null;
    };
  }, []);

  const startMic = async () => {
    setErrors([]);
    sourceRef.current?.dispose();
    const src = new AudioSignalSource({
      calibration: profilesRef.current[selected] ?? null,
      onObservations: (obs) => {
        const lvl = obs.find((o) => o.signal === VOICE_LEVEL_SIGNAL);
        const act = obs.find((o) => o.signal === VOICE_ACTIVE_SIGNAL);
        setLevel(lvl?.valid ? lvl.value : null);
        // Digital silence is invalid but still counts as "quiet" during the quiet phase.
        if (lvl) {
          const cal = calibratorRef.current;
          if (cal && phaseRef.current === "quiet") cal.addQuiet(lvl.value);
          if (cal && phaseRef.current === "speak" && lvl.valid) cal.addSpeech(lvl.value);
        }
        setActive(act?.valid ? act.value : null);
      },
      onError: (code, msg) => setErrors((e) => [...e, `${code}: ${msg}`]),
    });
    sourceRef.current = src;
    setMicOn(await src.start());
  };

  const stopMic = () => {
    clearTimers();
    calibratorRef.current = null;
    setPhaseBoth("idle");
    sourceRef.current?.stop();
    setMicOn(false);
    setLevel(null);
    setActive(null);
  };

  const calibrate = () => {
    if (!micOn) {
      setMessage("Start the mic first.");
      return;
    }
    const profileId = selected;
    const calibrator = new AudioCalibrator();
    calibratorRef.current = calibrator;
    setPhaseBoth("quiet");
    setMessage("Stay quiet for 5 seconds...");

    timersRef.current.push(
      window.setTimeout(() => {
        setPhaseBoth("speak");
        setMessage("Speak naturally for 20 seconds (pauses are fine)...");
      }, QUIET_MS)
    );
    timersRef.current.push(
      window.setTimeout(() => {
        setPhaseBoth("idle");
        calibratorRef.current = null;
        const result = calibrator.finish();
        if (result.ok) {
          const next: Profiles = { ...profilesRef.current };
          next[profileId] = result.calibration;
          profilesRef.current = next;
          saveProfiles(next);
          setProfiles(next);
          setMessage(`Profile ${profileId} calibrated.`);
        } else {
          setMessage(`Calibration failed: ${result.message}`);
        }
      }, QUIET_MS + SPEAK_MS)
    );
  };

  const clearProfiles = () => {
    profilesRef.current = {};
    saveProfiles({});
    setProfiles({});
    setMessage("Saved profiles cleared.");
  };

  const busy = phase !== "idle";
  const selectedCal = profiles[selected];

  return (
    <main style={{ padding: 24, fontFamily: "sans-serif", maxWidth: 680 }}>
      <h1>Audio calibration test</h1>
      <p>Use headphones. Mic only; nothing is recorded or sent anywhere.</p>
      {errors.map((e, i) => (
        <p key={i} style={{ color: "crimson", margin: 0 }}>
          {e}
        </p>
      ))}

      <div style={{ display: "flex", gap: 12, alignItems: "center", margin: "12px 0" }}>
        {(["A", "B"] as const).map((id) => (
          <label key={id}>
            <input
              type="radio"
              name="profile"
              checked={selected === id}
              disabled={busy}
              onChange={() => setSelected(id)}
            />{" "}
            Profile {id} {profiles[id] ? "(calibrated)" : "(empty)"}
          </label>
        ))}
      </div>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
        <button onClick={startMic} disabled={micOn}>Start mic</button>
        <button onClick={stopMic} disabled={!micOn}>Stop mic</button>
        <button onClick={calibrate} disabled={!micOn || busy}>Calibrate Profile {selected}</button>
        <button onClick={clearProfiles} disabled={busy}>Clear saved profiles</button>
      </div>

      <p><b>{phase === "idle" ? "" : `Phase: ${phase}. `}</b>{message}</p>

      <pre>
        {`level:         ${level === null ? "no signal" : level.toFixed(1) + " dBFS"}
voice_active:  ${active === null ? "n/a" : active} ${selectedCal ? "(using Profile " + selected + ")" : "(UNCALIBRATED fallback)"}`}
      </pre>

      <h3>Same live input, each saved profile's decision</h3>
      <table cellPadding={6}>
        <thead>
          <tr><th>Profile</th><th>Noise floor</th><th>Threshold</th><th>Speech mean ± SD</th><th>Speaking now?</th></tr>
        </thead>
        <tbody>
          {(["A", "B"] as const).map((id) => {
            const c = profiles[id];
            return (
              <tr key={id}>
                <td>{id}</td>
                {c ? (
                  <>
                    <td>{c.noiseFloorDb.toFixed(1)} dB</td>
                    <td>{c.speechThresholdDb.toFixed(1)} dB</td>
                    <td>{c.speechMeanDb.toFixed(1)} ± {c.speechSdDb.toFixed(1)}</td>
                    <td>{level === null ? "n/a" : level > c.speechThresholdDb ? "yes" : "no"}</td>
                  </>
                ) : (
                  <td colSpan={4}>not calibrated</td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </main>
  );
}

createRoot(document.getElementById("root")!).render(<AudioTest />);