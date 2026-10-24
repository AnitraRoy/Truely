import { useRef, type KeyboardEvent, type ReactNode } from "react";

/**
 * Accessible tabs (ARIA APG "tabs, automatic activation"): roving tabindex,
 * Left/Right/Home/End move and select. Controlled — the screen owns `value`.
 * Owner: Design System team. Used by the Profile screen.
 */
export interface TabItem<K extends string> {
  key: K;
  label: string;
  panel: ReactNode;
}

export function Tabs<K extends string>({
  label,
  items,
  value,
  onChange,
  idBase = "tabs",
}: {
  label: string;
  items: TabItem<K>[];
  value: K;
  onChange: (key: K) => void;
  idBase?: string;
}) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const index = Math.max(
    0,
    items.findIndex((t) => t.key === value),
  );

  const select = (i: number) => {
    const next = (i + items.length) % items.length;
    onChange(items[next].key);
    refs.current[next]?.focus();
  };

  const onKeyDown = (e: KeyboardEvent) => {
    const moves: Record<string, number> = {
      ArrowRight: index + 1,
      ArrowLeft: index - 1,
      Home: 0,
      End: items.length - 1,
    };
    if (e.key in moves) {
      e.preventDefault();
      select(moves[e.key]);
    }
  };

  return (
    <div>
      <div role="tablist" aria-label={label} onKeyDown={onKeyDown} className="flex gap-7 border-b border-border">
        {items.map((t, i) => {
          const selected = i === index;
          return (
            <button
              key={t.key}
              ref={(el) => (refs.current[i] = el)}
              type="button"
              role="tab"
              id={`${idBase}-tab-${t.key}`}
              aria-selected={selected}
              aria-controls={`${idBase}-panel-${t.key}`}
              tabIndex={selected ? 0 : -1}
              onClick={() => onChange(t.key)}
              className={`-mb-px min-h-6 border-b-2 pb-2 font-display text-[18px] transition-colors duration-cue ease-cue ${
                selected ? "border-text-primary text-text-primary" : "border-transparent text-text-muted hover:text-text-primary"
              }`}
            >
              {t.label}
            </button>
          );
        })}
      </div>
      {items.map((t, i) => (
        <div
          key={t.key}
          role="tabpanel"
          id={`${idBase}-panel-${t.key}`}
          aria-labelledby={`${idBase}-tab-${t.key}`}
          hidden={i !== index}
          tabIndex={0}
          className="pt-6"
        >
          {i === index && t.panel}
        </div>
      ))}
    </div>
  );
}
