import { useEffect, useRef, type ReactNode } from "react";
import { Button } from "./Button";

/**
 * Modal confirmation on the native <dialog> (focus trap + Esc for free).
 * For destructive data actions: the body names exactly what is removed. Calm,
 * never red (CLAUDE.md §4) — the warning token marks the heading rule only.
 * Focus lands on Cancel, the safe choice. Owner: Design System team.
 */
export function ConfirmDialog({
  open,
  title,
  children,
  confirmLabel,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  children: ReactNode;
  confirmLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    if (!open && el.open) el.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-labelledby="confirm-dialog-title"
      onCancel={(e) => {
        e.preventDefault();
        onCancel();
      }}
      className="w-[min(92vw,440px)] rounded border border-text-primary bg-bg p-0 text-text-primary backdrop:bg-scrim/50"
    >
      <div className="p-6">
        <h2 id="confirm-dialog-title" className="border-l-2 border-warning pl-3 font-display text-[22px] leading-tight">
          {title}
        </h2>
        <div className="mt-3 text-[15.5px] text-text-muted">{children}</div>
        <div className="mt-6 flex flex-wrap items-center justify-end gap-6">
          <Button variant="ghost" onClick={onCancel} autoFocus>
            Cancel
          </Button>
          <Button onClick={onConfirm}>{confirmLabel}</Button>
        </div>
      </div>
    </dialog>
  );
}
