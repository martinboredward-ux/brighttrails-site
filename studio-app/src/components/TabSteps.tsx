export interface StepItem { label: string; target: string; done?: boolean; hint?: string }

const go = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });

/** A short numbered "do these in this order" list for a tab. A tick means the step looks done; steps with no tick are things to do by hand. */
export default function TabSteps({ title, steps, last }: { title: string; steps: StepItem[]; last?: string }) {
  const next = steps.find((s) => s.done === false);
  return (
    <section className="card space-y-2">
      <h2 className="text-base font-bold text-forest">{title}</h2>
      <ol className="grid gap-1 sm:grid-cols-2">
        {steps.map((s, i) => (
          <li key={s.label}>
            <button type="button" onClick={() => go(s.target)} className={`flex w-full items-start gap-2 rounded px-2 py-1 text-left text-sm hover:bg-forest/10 ${next === s ? "bg-sun/30 font-semibold" : ""}`}>
              <span className={`mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ${s.done ? "bg-forest text-white" : "border border-forest text-forest"}`}>{s.done ? "✓" : i + 1}</span>
              <span>{s.label}{s.hint && <span className="block text-xs font-normal text-muted">{s.hint}</span>}</span>
            </button>
          </li>
        ))}
      </ol>
      <p className="hint">{next ? `Next: step ${steps.indexOf(next) + 1}, ${next.label.toLowerCase()}.` : "Every step that can be checked looks done."} Ticks are a guide only; skip what you do not need.{last ? ` ${last}` : ""}</p>
    </section>
  );
}
