import { useId, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from "react";

/**
 * Labelled form controls: a visible label, optional help, and an error that is
 * linked with aria-describedby and stated in words (never colour alone).
 * Owner: Design System team. Native elements only.
 */
const CONTROL =
  "w-full rounded border border-border-strong bg-surface px-3 py-2.5 text-[15.5px] text-text-primary " +
  "placeholder:text-text-muted transition-colors duration-cue-fast ease-cue hover:border-text-primary " +
  "aria-[invalid=true]:border-warning disabled:opacity-50";

function Frame({
  id,
  label,
  help,
  error,
  children,
}: {
  id: string;
  label: ReactNode;
  help?: ReactNode;
  error?: string | null;
  children: ReactNode;
}) {
  return (
    <div>
      <label htmlFor={id} className="block text-[14px] font-medium">
        {label}
      </label>
      {help && (
        <p id={`${id}-help`} className="mt-0.5 text-[13.5px] text-text-muted">
          {help}
        </p>
      )}
      <div className="mt-2">{children}</div>
      {error && (
        <p id={`${id}-error`} className="mt-1.5 text-[13.5px] text-warning">
          <span aria-hidden>! </span>
          {error}
        </p>
      )}
    </div>
  );
}

const describedBy = (id: string, help?: ReactNode, error?: string | null) =>
  [help ? `${id}-help` : "", error ? `${id}-error` : ""].filter(Boolean).join(" ") || undefined;

type Common = { label: ReactNode; help?: ReactNode; error?: string | null };

export function TextField({ label, help, error, id, className = "", ...rest }: Common & InputHTMLAttributes<HTMLInputElement>) {
  const auto = useId();
  const fid = id ?? auto;
  return (
    <Frame id={fid} label={label} help={help} error={error}>
      <input id={fid} aria-invalid={error ? true : undefined} aria-describedby={describedBy(fid, help, error)} className={`${CONTROL} ${className}`} {...rest} />
    </Frame>
  );
}

export function TextArea({ label, help, error, id, className = "", ...rest }: Common & TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const auto = useId();
  const fid = id ?? auto;
  return (
    <Frame id={fid} label={label} help={help} error={error}>
      <textarea
        id={fid}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(fid, help, error)}
        className={`${CONTROL} min-h-[88px] resize-y leading-relaxed ${className}`}
        {...rest}
      />
    </Frame>
  );
}

export function SelectField({
  label,
  help,
  error,
  id,
  options,
  className = "",
  ...rest
}: Common & SelectHTMLAttributes<HTMLSelectElement> & { options: readonly string[] }) {
  const auto = useId();
  const fid = id ?? auto;
  return (
    <Frame id={fid} label={label} help={help} error={error}>
      <select id={fid} aria-describedby={describedBy(fid, help, error)} className={`${CONTROL} ${className}`} {...rest}>
        {options.map((o) => (
          <option key={o}>{o}</option>
        ))}
      </select>
    </Frame>
  );
}

/**
 * Several independent choices as pill checkboxes (the multi-select sibling of
 * ChoiceGroup). Checked items carry a ✓ in text. Native checkboxes in a fieldset.
 */
export function CheckChips({
  legend,
  options,
  value,
  onChange,
  help,
}: {
  legend: ReactNode;
  options: readonly string[];
  value: string[];
  onChange: (next: string[]) => void;
  help?: ReactNode;
}) {
  const toggle = (o: string) => onChange(value.includes(o) ? value.filter((v) => v !== o) : [...value, o]);
  return (
    <fieldset>
      <legend className="text-[14px] font-medium">{legend}</legend>
      {help && <p className="mt-0.5 text-[13.5px] text-text-muted">{help}</p>}
      <div className="mt-2.5 flex flex-wrap gap-2">
        {options.map((o) => {
          const checked = value.includes(o);
          return (
            <label
              key={o}
              className={`inline-flex min-h-9 cursor-pointer items-center gap-2 rounded-pill border px-3.5 text-[14px] transition-colors duration-cue-fast ease-cue has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-accent ${
                checked ? "border-accent bg-accent/10 text-text-primary" : "border-border-strong text-text-muted hover:text-text-primary"
              }`}
            >
              <input type="checkbox" className="sr-only" checked={checked} onChange={() => toggle(o)} />
              {checked && <span aria-hidden>✓</span>}
              {o}
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
