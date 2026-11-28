import type { Book } from "../types";
import { launchProgress, meta, nextAction, seasonPlan, bookType } from "../utils/studioMeta";
import { pagePicture } from "../utils/checks";

const STAGE: Record<string, string> = { idea: "Idea", writing: "Writing", art: "Art", interior: "Interior", cover: "Cover", proof: "Proof", published: "Published" };

function waiting(b: Book): string {
  const need = b.sections.filter((s) => s.kind !== "template" && b.mode !== "nonfiction" && !pagePicture(b, s)).length;
  const l = meta(b).launch ?? {};
  if (b.stage === "proof" || (l.proof && !l.proofok)) return l.proofin ? "Your approval of the proof" : "Proof copy (US friend)";
  if (l.mustUpload || (l.proofok && !l.published)) return "KDP review / publish";
  if (need && b.stage !== "idea") return `${need} picture${need === 1 ? "" : "s"}`;
  if (!b.sections.length) return "Outline";
  return "You";
}

/** All books at a glance: stage, next step, what each is waiting on, countdown to its target date. */
export default function Dashboard({ books, onOpen }: { books: Book[]; onOpen: (id: string) => void }) {
  const rows = books.map((b) => ({ b, p: launchProgress(b), plan: seasonPlan(meta(b).targetDate ?? "") })).sort((x, y) => (x.plan?.daysLeft ?? 9999) - (y.plan?.daysLeft ?? 9999));
  return (
    <section className="card space-y-2">
      <h2 className="text-base font-bold text-forest">Portfolio ({books.length} books)</h2>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead><tr className="border-b border-line text-xs text-muted"><th className="p-1">Book</th><th>Type</th><th>Stage</th><th>Launch</th><th>Next step</th><th>Waiting on</th><th>Live by</th></tr></thead>
          <tbody>
            {rows.map(({ b, p, plan }) => (
              <tr key={b.id} className="border-b border-line/50 align-top">
                <td className="p-1"><button type="button" className="font-semibold underline" onClick={() => onOpen(b.id)}>{b.title}</button>{b.approvedAt && <span className="ml-1 rounded bg-green px-1 text-[10px] font-bold text-white">APPROVED</span>}</td>
                <td>{bookType(meta(b).bookType)?.label.split(" (")[0] ?? b.mode}</td>
                <td>{STAGE[b.stage] ?? b.stage}</td>
                <td>{p.done}/{p.total}</td>
                <td className="max-w-56">{nextAction(b)}</td>
                <td>{waiting(b)}</td>
                <td className={plan?.late ? "font-bold text-accent" : ""}>{plan ? `${plan.live} (${plan.daysLeft} d${plan.late ? ", late" : ""})` : "-"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="hint">Set a book's target date and tick its launch steps in Tab 6 · Studio Tools.</p>
    </section>
  );
}
