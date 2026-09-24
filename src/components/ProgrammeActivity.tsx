import React, { useMemo } from 'react';
import { CheckSquare, ListOrdered, MessageSquareText, Rows3, SlidersHorizontal, Split, TextCursorInput } from 'lucide-react';

export type ProgrammeActivityKind =
  | 'reflection'
  | 'checklist'
  | 'scale'
  | 'script'
  | 'sorting'
  | 'if-then'
  | 'priority-list'
  | 'review-grid'
  | 'action-choice'
  | 'maintenance-plan';

export type ProgrammeActivityConfig = {
  kind: ProgrammeActivityKind;
  label: string;
  description?: string;
  prompt?: string;
  items?: string[];
  options?: string[];
  fields?: string[];
  columns?: string[];
};

type Answer = Record<string, unknown>;

type ProgrammeActivityProps = {
  activity?: ProgrammeActivityConfig;
  prompt: string;
  value: string;
  onChange: (value: string) => void;
};

const fieldClass = 'mt-2 block w-full rounded-xl border border-slate-300 bg-white p-3 text-sm font-normal text-slate-950 placeholder:text-slate-500 dark:border-slate-600 dark:bg-slate-950 dark:text-white dark:placeholder:text-slate-400';
const labelClass = 'block text-sm font-semibold text-slate-950 dark:text-slate-100';
const panelClass = 'rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-950';

function parseAnswer(value: string): Answer {
  if (!value) return {};
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : { reflection: value };
  } catch {
    return { reflection: value };
  }
}

function encodeAnswer(answer: Answer) {
  return JSON.stringify(answer);
}

function asString(value: unknown) {
  return typeof value === 'string' ? value : '';
}

function asStringArray(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
}

function ActivityIcon({ kind }: { kind: ProgrammeActivityKind }) {
  const icons = {
    reflection: TextCursorInput,
    checklist: CheckSquare,
    scale: SlidersHorizontal,
    script: MessageSquareText,
    sorting: Split,
    'if-then': Split,
    'priority-list': ListOrdered,
    'review-grid': Rows3,
    'action-choice': CheckSquare,
    'maintenance-plan': ListOrdered
  };
  const Icon = icons[kind];
  return <Icon className="h-4 w-4 text-violet-700 dark:text-violet-300" />;
}

export function ProgrammeActivity({ activity, prompt, value, onChange }: ProgrammeActivityProps) {
  const config = activity || { kind: 'reflection' as const, label: 'Reflection', prompt };
  const answer = useMemo(() => parseAnswer(value), [value]);
  const patch = (next: Answer) => onChange(encodeAnswer({ ...answer, ...next }));
  const items = config.items || [];
  const fields = config.fields || [];
  const options = config.options || [];
  const columns = config.columns || ['First', 'Second', 'Third'];

  return (
    <div className={panelClass}>
      <div className="mb-3 flex items-center gap-2 text-xs font-black uppercase tracking-wide text-violet-800 dark:text-violet-200">
        <ActivityIcon kind={config.kind} />
        {config.label}
      </div>
      {config.description ? <p className="mb-4 text-sm leading-6 text-slate-700 dark:text-slate-200">{config.description}</p> : null}

      {config.kind === 'reflection' ? (
        <label className={labelClass}>
          {config.prompt || prompt}
          <textarea
            maxLength={5000}
            value={asString(answer.reflection)}
            onChange={(event) => patch({ reflection: event.target.value })}
            className={`${fieldClass} min-h-36`}
            placeholder="Save a private reflection for this step"
          />
        </label>
      ) : null}

      {config.kind === 'checklist' ? (
        <fieldset className="space-y-3">
          <legend className={labelClass}>{config.prompt || prompt}</legend>
          {items.map((item) => {
            const selected = asStringArray(answer.checked).includes(item);
            return (
              <label key={item} className="flex items-start gap-3 rounded-xl border border-slate-200 bg-white p-3 text-sm text-slate-800 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100">
                <input
                  type="checkbox"
                  checked={selected}
                  onChange={(event) => {
                    const current = new Set(asStringArray(answer.checked));
                    if (event.target.checked) current.add(item);
                    else current.delete(item);
                    patch({ checked: [...current] });
                  }}
                  className="mt-1 h-4 w-4 accent-violet-700"
                />
                <span>{item}</span>
              </label>
            );
          })}
        </fieldset>
      ) : null}

      {config.kind === 'scale' ? (
        <div className="space-y-4">
          <label className={labelClass}>
            {config.prompt || prompt}
            <input
              type="range"
              min="1"
              max="5"
              value={asString(answer.rating) || '3'}
              onChange={(event) => patch({ rating: event.target.value })}
              className="mt-4 w-full accent-violet-700"
            />
          </label>
          <div className="flex justify-between text-xs font-bold text-slate-500 dark:text-slate-400">
            <span>Not ready</span>
            <span>Steady</span>
            <span>Ready</span>
          </div>
          <textarea
            maxLength={4000}
            value={asString(answer.note)}
            onChange={(event) => patch({ note: event.target.value })}
            className={`${fieldClass} min-h-24`}
            placeholder="What would move this one point safer or easier?"
          />
        </div>
      ) : null}

      {config.kind === 'script' || config.kind === 'review-grid' || config.kind === 'maintenance-plan' ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {fields.map((field) => (
            <label key={field} className={labelClass}>
              {field}
              <textarea
                maxLength={2000}
                value={asString(answer[field])}
                onChange={(event) => patch({ [field]: event.target.value })}
                className={`${fieldClass} min-h-24`}
                placeholder="Add your note"
              />
            </label>
          ))}
        </div>
      ) : null}

      {config.kind === 'sorting' ? (
        <div className="space-y-3">
          <p className={labelClass}>{config.prompt || prompt}</p>
          {items.map((item) => (
            <label key={item} className="grid gap-2 rounded-xl border border-slate-200 bg-white p-3 text-sm text-slate-800 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 sm:grid-cols-[minmax(0,1fr)_12rem] sm:items-center">
              <span>{item}</span>
              <select
                value={asString(answer[item])}
                onChange={(event) => patch({ [item]: event.target.value })}
                className="rounded-lg border border-slate-300 bg-white p-2 text-sm text-slate-950 dark:border-slate-600 dark:bg-slate-950 dark:text-white"
              >
                <option value="">Choose</option>
                {columns.map((column) => <option key={column} value={column}>{column}</option>)}
              </select>
            </label>
          ))}
        </div>
      ) : null}

      {config.kind === 'if-then' ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <label className={labelClass}>
            If this happens
            <textarea maxLength={2000} value={asString(answer.if)} onChange={(event) => patch({ if: event.target.value })} className={`${fieldClass} min-h-28`} placeholder="Name the likely obstacle" />
          </label>
          <label className={labelClass}>
            Then I will
            <textarea maxLength={2000} value={asString(answer.then)} onChange={(event) => patch({ then: event.target.value })} className={`${fieldClass} min-h-28`} placeholder="Choose a kind, practical response" />
          </label>
        </div>
      ) : null}

      {config.kind === 'priority-list' ? (
        <label className={labelClass}>
          {config.prompt || prompt}
          <textarea
            maxLength={5000}
            value={asString(answer.priorities)}
            onChange={(event) => patch({ priorities: event.target.value })}
            className={`${fieldClass} min-h-36`}
            placeholder={(items.length ? items : ['First priority', 'Second priority', 'Third priority']).join('\n')}
          />
        </label>
      ) : null}

      {config.kind === 'action-choice' ? (
        <fieldset>
          <legend className={labelClass}>{config.prompt || prompt}</legend>
          <div className="mt-3 flex flex-wrap gap-2">
            {options.map((option) => {
              const active = answer.choice === option;
              return (
                <button
                  key={option}
                  type="button"
                  onClick={() => patch({ choice: option })}
                  className={`rounded-xl border px-3 py-2 text-sm font-bold transition ${active ? 'border-violet-700 bg-violet-700 text-white dark:border-violet-300 dark:bg-violet-500' : 'border-slate-300 bg-white text-slate-800 hover:bg-violet-50 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800'}`}
                >
                  {option}
                </button>
              );
            })}
          </div>
          <textarea maxLength={3000} value={asString(answer.note)} onChange={(event) => patch({ note: event.target.value })} className={`${fieldClass} min-h-24`} placeholder="Add a reason or support note" />
        </fieldset>
      ) : null}
    </div>
  );
}
