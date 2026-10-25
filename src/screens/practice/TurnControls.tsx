import { useState } from "react";
import { Button } from "@/components/Button";
import { MicProblem } from "@/components/PermissionList";
import type { MicState } from "@/components/useMicrophone";
import { TURN_STATUS_LABEL, type TurnStatus } from "./useTurnTaking";

/**
 * Status + answer controls for spoken practice. The state is always spelled
 * out ("Listening", "Your turn"), with a still dot beside it — no pulsing or
 * waveform theatre (CLAUDE.md §4). One primary action at a time.
 */
export function TurnStatusLine({ status }: { status: TurnStatus }) {
  const active = status === "listening";
  return (
    <p className="flex items-center gap-2 text-[14px]" aria-live="polite">
      <span aria-hidden className={`h-2 w-2 rounded-pill ${active ? "bg-accent" : status === "your-turn" ? "border-2 border-accent" : "bg-text-muted"}`} />
      <span className="font-medium">{TURN_STATUS_LABEL[status]}</span>
      {status === "thinking" && <span className="text-text-muted">: writing a reply</span>}
    </p>
  );
}

export function TurnControls({
  status,
  voice,
  mic,
  error,
  onBegin,
  onFinish,
  onTyped,
}: {
  status: TurnStatus;
  /** Speech in and out is available for this session. */
  voice: boolean;
  mic: MicState;
  error: string | null;
  onBegin: () => void;
  onFinish: () => void;
  onTyped: (text: string) => void;
}) {
  const [text, setText] = useState("");
  const [typing, setTyping] = useState(!voice);
  const yourTurn = status === "your-turn";
  const listening = status === "listening";

  return (
    <div>
      {voice && !typing && (
        <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
          {listening ? (
            <Button onClick={onFinish}>Done answering</Button>
          ) : (
            <Button onClick={onBegin} disabled={!yourTurn || mic !== "live"}>
              Start answering
            </Button>
          )}
          <button type="button" onClick={() => setTyping(true)} className="min-h-6 text-[14px] underline underline-offset-4 hover:text-accent" disabled={listening}>
            Type instead
          </button>
        </div>
      )}

      {typing && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!yourTurn || !text.trim()) return;
            onTyped(text);
            setText("");
          }}
        >
          <label htmlFor="typed-answer" className="block text-[14px] font-medium">
            Your answer
          </label>
          <textarea
            id="typed-answer"
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={3}
            className="mt-2 w-full resize-y rounded border border-border-strong bg-surface px-3 py-2.5 font-serif text-[16px] leading-relaxed"
          />
          <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-3">
            <Button type="submit" disabled={!yourTurn || !text.trim()}>
              Send answer
            </Button>
            {voice && (
              <button type="button" onClick={() => setTyping(false)} className="min-h-6 text-[14px] underline underline-offset-4 hover:text-accent">
                Speak instead
              </button>
            )}
          </div>
        </form>
      )}

      {error && (
        <p role="alert" className="mt-3 text-[14.5px] text-warning">
          {error}
        </p>
      )}
      {(mic === "denied" || mic === "unavailable") && (
        <div className="mt-3">
          <MicProblem state={mic} />
        </div>
      )}
    </div>
  );
}
