import type { Book } from "../types";
import { JOB_LABEL } from "../hooks/useRunJob";

/** One line that shows whether an AI job is running, failed or just finished. */
export default function JobStatus({ book, only }: { book: Book; only?: string[] }) {
  const base = book.jobAction.split(":")[0];
  if (only && !only.includes(base)) return null;
  if (book.jobStatus === "running") {
    const prog = book.jobAction.includes(":") ? `, ${book.jobAction.split(":")[1]}` : "";
    return <p className="rounded-lg bg-sun/30 px-3 py-2 text-sm font-semibold text-forest">{JOB_LABEL[base] ?? "Working"}{prog}… checking every 3 seconds. You can leave this page open.</p>;
  }
  if (book.jobStatus === "error") return <p className="rounded-lg bg-accent/10 px-3 py-2 text-sm text-accent">Job failed: {book.jobError}</p>;
  if (book.jobStatus === "done") return <p className="text-xs text-green">Last job finished: {(JOB_LABEL[base] ?? base).split(" (")[0]}.</p>;
  return null;
}
