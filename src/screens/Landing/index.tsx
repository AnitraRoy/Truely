import { useNavigate } from "react-router-dom";
import { Masthead } from "@/components/Masthead";
import { SiteNav } from "@/components/SiteNav";
import { Button } from "@/components/Button";
import { SpecimenPlate } from "@/components/SpecimenPlate";
import { PrivacyNote } from "@/components/PrivacyNote";
import { FieldArt } from "@/components/FieldArt";
import { useProfileStore } from "@/state/profileStore";
import bluejay from "@/assets/bluejay_final.jpg";

/**
 * Landing (docs/FRONTEND_GUIDE.md §3.1). Field Journal.
 * Says what Cue is, what it won't do, and gets the visitor to a first session.
 * Focal point: the hero headline against the blue jay plate — the screen's one
 * expressive moment. No stats, testimonials, or sample scores (CLAUDE.md §5).
 * Never requests the camera.
 */
const STEPS = [
  { title: "Learn how you want to sound", body: "Point Cue at a talk or interview you admire. It drafts patterns you can practise, and you keep the ones that fit." },
  { title: "Practise out loud", body: "A short voice session or a mock interview, with suggestions tied to what you actually said." },
  { title: "Get quiet help in the real thing", body: "During a meeting or interview, Cue offers a small note only when it's useful, then leaves you alone." },
  { title: "Review and carry it forward", body: "A transcript, the moments worth revisiting, and one thing to try next time. Never a score." },
];

const WONT = [
  "Judge your personality, honesty, or confidence",
  "Give you a score",
  "Expect you to stare into the camera",
  "Record or upload video",
];

const AUDIENCES = [
  ["Remote meetings", "updates, presentations, leading a discussion"],
  ["Interview practice", "rehearsing for the conversations that matter"],
  ["Teaching and class", "presenting work or running an online lesson"],
  ["Pitching and sales", "demos, founders, customer calls"],
  ["Creating", "streaming, tutorials, building an on-camera presence"],
];

export function Landing() {
  const navigate = useNavigate();
  const setupComplete = useProfileStore((s) => s.setupComplete);
  const start = () => navigate(setupComplete ? "/calibrate" : "/start");

  return (
    <div className="relative isolate overflow-x-clip">
      {/* The journal's last page: a woodcock printed faintly into the foot. */}
      <FieldArt plate="woodcock" fade="bottom-right" className="absolute bottom-0 right-0 -z-10 hidden w-[clamp(380px,46vw,700px)] md:block" />
      <main className="mx-auto max-w-5xl px-6 py-10 md:py-14">
        {setupComplete ? <SiteNav /> : <Masthead />}

        {/* Hero */}
        <section
          aria-labelledby="landing-title"
          className="mt-10 grid items-center gap-x-[clamp(28px,5vw,72px)] gap-y-12 md:mt-14 md:grid-cols-[minmax(0,1fr)_minmax(260px,380px)]"
        >
          <div>
            <h1
              id="landing-title"
              className="font-display text-[clamp(46px,8.4vw,96px)] font-semibold leading-[0.94] tracking-[-0.025em]"
            >
              Show up
              <br />
              as yourself.
              <span className="mt-4 block font-serif text-[clamp(24px,3.6vw,38px)] font-normal italic leading-tight tracking-normal text-text-muted">
                A little better every time.
              </span>
            </h1>
            <p className="mt-6 max-w-[44ch] text-[17.5px] leading-relaxed">
              Cue is a private coach for webcam conversations. It learns how you normally look and move on
              camera, then offers a small cue only when something you&apos;re working on drifts for a while.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-x-7 gap-y-4">
              <Button onClick={start}>Start a session</Button>
              {setupComplete ? (
                <Button variant="ghost" onClick={() => navigate("/home")}>
                  Open your journal
                </Button>
              ) : (
                <a
                  href="#how"
                  className="border-b border-text-primary pb-1 font-serif text-[16px] italic transition-colors duration-cue ease-cue hover:border-accent hover:text-accent"
                >
                  See how it works
                </a>
              )}
            </div>
          </div>

          <SpecimenPlate
            src={bluejay}
            alt="Hand-coloured engraving of blue jays on a branch with trumpet flowers, after J. J. Audubon"
            title="Plate CII — Corvus cristatus"
            note="hand-coloured"
          />
        </section>

        <PrivacyNote className="mt-14 max-w-[62ch]" />

        {/* How it works + what it won't do */}
        <div className="mt-20 grid items-start gap-x-[clamp(28px,5vw,72px)] gap-y-14 md:grid-cols-[minmax(0,1fr)_260px]">
          <section id="how" aria-labelledby="how-title" className="scroll-mt-8">
            <h2 id="how-title" className="font-display text-[clamp(28px,3.6vw,38px)] font-semibold leading-tight">
              How a session works
            </h2>
            <ol className="mt-6 border-t border-border">
              {STEPS.map((s, i) => (
                <li key={s.title} className="grid grid-cols-[44px_1fr] gap-x-4 border-b border-border py-5">
                  <span aria-hidden className="pt-1 font-mono text-[13px] text-text-muted">
                    {i + 1}
                  </span>
                  <div>
                    <h3 className="font-display text-[21px] leading-snug">{s.title}</h3>
                    <p className="mt-1 max-w-[58ch] text-text-muted">{s.body}</p>
                  </div>
                </li>
              ))}
            </ol>
          </section>

          <section aria-labelledby="wont-title" className="md:pt-[62px]">
            <h2 id="wont-title" className="font-display text-[22px] leading-snug">
              What Cue won&apos;t do
            </h2>
            <ul className="mt-4 space-y-3 border-l-2 border-ochre-mark pl-4">
              {WONT.map((w) => (
                <li key={w} className="font-serif italic leading-snug text-text-muted">
                  {w}
                </li>
              ))}
            </ul>
            <p className="mt-5 text-[15px] text-text-muted">
              It describes what it measured, like &ldquo;your gaze shifted away several times,&rdquo; and nothing
              about who you are.
            </p>
          </section>
        </div>

        {/* Who it's for — tertiary */}
        <section aria-labelledby="who-title" className="mt-20">
          <h2 id="who-title" className="font-display text-[22px] leading-snug">
            Who it&apos;s for
          </h2>
          <ul className="mt-4 grid gap-x-8 gap-y-3 sm:grid-cols-2 lg:grid-cols-3">
            {AUDIENCES.map(([name, detail]) => (
              <li key={name} className="text-[15px]">
                <span className="font-display text-[17px]">{name}</span>
                <span className="text-text-muted">: {detail}</span>
              </li>
            ))}
          </ul>
        </section>

        {/* Closing */}
        <section className="mt-20 flex flex-wrap items-end justify-between gap-6 border-t-2 border-text-primary pt-8">
          <p className="max-w-[30ch] font-display text-[clamp(24px,3vw,32px)] leading-tight">
            Setup takes about two minutes. No account needed.
          </p>
          <Button onClick={start}>Start a session</Button>
        </section>
      </main>
    </div>
  );
}
