"use client";

import { useState } from "react";
import type { FieldSpec, FieldValue } from "./fields";

// The pieces that draw the questions of the forms (Hire me, post a job). They only know how to draw a FieldSpec.

export const inputClass =
  "w-full h-11 rounded-xl border border-[var(--ui-input)] bg-[var(--ui-surface)] px-3 text-sm outline-none focus:border-[#C86C29] focus:ring-2 focus:ring-[#C86C29]/20";
export const textareaClass =
  "w-full rounded-xl border border-[var(--ui-input)] bg-[var(--ui-surface)] p-3 text-sm outline-none focus:border-[#C86C29] focus:ring-2 focus:ring-[#C86C29]/20 resize-none";
export const smallButton =
  "rounded-lg border border-[var(--ui-input)] bg-[var(--ui-surface)] px-2.5 py-1 text-xs font-semibold hover:border-[#C86C29] transition disabled:opacity-40";

export function Label({ htmlFor, children, optional }: { htmlFor?: string; children: React.ReactNode; optional?: boolean }) {
  return (
    <label htmlFor={htmlFor} className="block mb-1.5 text-sm font-medium">
      {children} {optional && <span className="font-normal text-[var(--ui-muted)]">(optional)</span>}
    </label>
  );
}

export function Toggle({ id, checked, onChange, label, help }: { id: string; checked: boolean; onChange: (v: boolean) => void; label: string; help?: string }) {
  return (
    <label htmlFor={id} className="flex cursor-pointer items-start gap-3 rounded-xl border border-[var(--ui-border2)] bg-[var(--ui-surface)] p-3">
      <input id={id} type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="mt-0.5 h-4 w-4 accent-[#C86C29]" />
      <span>
        <span className="block text-sm font-medium">{label}</span>
        {help && <span className="block text-xs text-[var(--ui-muted)]">{help}</span>}
      </span>
    </label>
  );
}

/** Draws one question of the specialty, from its description in fields.ts. */
export function SpecField({ spec, value, onChange }: { spec: FieldSpec; value: FieldValue | undefined; onChange: (v: FieldValue) => void }) {
  const id = `f-${spec.key}`;
  const [chipInput, setChipInput] = useState("");
  const heading = (
    <Label htmlFor={id} optional={!spec.required && spec.type !== "toggle"}>
      {spec.label}
    </Label>
  );
  const help = spec.help ? <p className="mt-1 text-xs text-[var(--ui-muted)]">{spec.help}</p> : null;

  switch (spec.type) {
    case "select":
      return (
        <div>
          {heading}
          <select id={id} value={(value as string) ?? ""} onChange={(e) => onChange(e.target.value)} className={inputClass}>
            <option value="">Select...</option>
            {spec.options.map((o) => (
              <option key={o} value={o}>
                {o}
              </option>
            ))}
          </select>
          {help}
        </div>
      );

    case "multi": {
      const chosen = Array.isArray(value) ? value : [];
      return (
        <div>
          <p className="mb-1.5 text-sm font-medium">
            {spec.label} <span className="font-normal text-[var(--ui-muted)]">(choose any)</span>
          </p>
          <div className="flex flex-wrap gap-2">
            {spec.options.map((o) => {
              const on = chosen.includes(o);
              return (
                <button
                  key={o}
                  type="button"
                  aria-pressed={on}
                  onClick={() => onChange(on ? chosen.filter((x) => x !== o) : [...chosen, o])}
                  className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                    on ? "border-[#C86C29] bg-[#C86C29] text-white" : "border-[var(--ui-input)] bg-[var(--ui-surface)] hover:border-[#C86C29]"
                  }`}
                >
                  {o}
                </button>
              );
            })}
          </div>
          {help}
        </div>
      );
    }

    case "text":
      return (
        <div>
          {heading}
          <input id={id} value={(value as string) ?? ""} onChange={(e) => onChange(e.target.value)} maxLength={300} placeholder={spec.placeholder} className={inputClass} />
          {help}
        </div>
      );

    case "textarea":
      return (
        <div>
          {heading}
          <textarea id={id} value={(value as string) ?? ""} onChange={(e) => onChange(e.target.value)} maxLength={1500} rows={3} placeholder={spec.placeholder} className={textareaClass} />
          {help}
        </div>
      );

    case "number":
      return (
        <div>
          {heading}
          <div className="flex items-center gap-2">
            <input
              id={id}
              type="number"
              inputMode="numeric"
              min={spec.min}
              max={spec.max}
              value={(value as string) ?? ""}
              onChange={(e) => onChange(e.target.value)}
              placeholder={spec.placeholder}
              className={`${inputClass} max-w-[10rem]`}
            />
            {spec.unit && <span className="text-sm text-[var(--ui-muted)]">{spec.unit}</span>}
          </div>
          {help}
        </div>
      );

    case "date":
      return (
        <div>
          {heading}
          <input
            id={id}
            type="date"
            min={new Date().toISOString().slice(0, 10)}
            value={(value as string) ?? ""}
            onChange={(e) => onChange(e.target.value)}
            className={`${inputClass} max-w-[14rem]`}
          />
          {help}
        </div>
      );

    case "toggle":
      return <Toggle id={id} checked={value === true} onChange={onChange} label={spec.label} help={spec.help} />;

    case "chips": {
      const chips = Array.isArray(value) ? value : [];
      const max = spec.max ?? 10;
      const add = () => {
        const t = chipInput.trim().replace(/,+$/, "").trim();
        if (!t || t.length > 40 || chips.length >= max || chips.some((c) => c.toLowerCase() === t.toLowerCase())) return setChipInput("");
        onChange([...chips, t]);
        setChipInput("");
      };
      return (
        <div>
          {heading}
          {chips.length > 0 && (
            <div className="mb-2 flex flex-wrap gap-2">
              {chips.map((c) => (
                <span key={c} className="inline-flex items-center gap-1 rounded-full bg-[var(--ui-soft)] py-1 pl-3 pr-1.5 text-xs font-medium">
                  {c}
                  <button type="button" aria-label={`Remove ${c}`} onClick={() => onChange(chips.filter((x) => x !== c))} className="h-4 w-4 rounded-full leading-none text-[var(--ui-muted)] hover:bg-[var(--ui-border2)]">
                    ×
                  </button>
                </span>
              ))}
            </div>
          )}
          <input
            id={id}
            value={chipInput}
            onChange={(e) => setChipInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === ",") {
                e.preventDefault();
                add();
              }
            }}
            onBlur={add}
            disabled={chips.length >= max}
            maxLength={40}
            placeholder={chips.length >= max ? "Limit reached" : spec.placeholder}
            className={inputClass}
          />
          {help}
        </div>
      );
    }

    case "list": {
      const lines = Array.isArray(value) ? value : [];
      const max = spec.max ?? 10;
      return (
        <div>
          <p className="mb-1.5 text-sm font-medium">
            {spec.label} <span className="font-normal text-[var(--ui-muted)]">(optional)</span>
          </p>
          <div className="space-y-2">
            {lines.map((line, i) => (
              <div key={i} className="flex items-center gap-2">
                <input
                  value={line}
                  onChange={(e) => onChange(lines.map((x, idx) => (idx === i ? e.target.value : x)))}
                  maxLength={200}
                  aria-label={`${spec.label} ${i + 1}`}
                  placeholder={spec.placeholder}
                  className={inputClass}
                />
                <button type="button" aria-label="Remove" onClick={() => onChange(lines.filter((_, idx) => idx !== i))} className={`${smallButton} h-11 shrink-0`}>
                  ✕
                </button>
              </div>
            ))}
            <button type="button" onClick={() => onChange([...lines, ""])} disabled={lines.length >= max} className={`${smallButton} h-9`}>
              + Add
            </button>
          </div>
          {help}
        </div>
      );
    }
  }
}

