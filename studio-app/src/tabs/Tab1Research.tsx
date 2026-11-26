import type { Dispatch, SetStateAction } from "react";
import type { Book } from "../types";
import { useRunJob } from "../hooks/useRunJob";
import ResearchPanel from "../components/ResearchPanel";
import PreReviewPanel from "../components/PreReviewPanel";
import Tab1Details from "./Tab1Details";

interface Props {
  book: Book; books: Book[];
  update: (p: Partial<Book>) => void;
  commit: (p: Partial<Book>) => Promise<void>;
  save: () => Promise<Book | null>;
  setBook: Dispatch<SetStateAction<Book | null>>;
  fail: (e: unknown) => void;
  locked: boolean;
}

/** Tab 1: research, core inputs (including the Character & Badge Library), then the pre-outline review. */
export default function Tab1Research({ book, books, update, commit, save, setBook, fail, locked }: Props) {
  const run = useRunJob({ book, save, setBook, fail });
  return (
    <div className="space-y-4">
      <ResearchPanel book={book} update={update} commit={commit} run={(a) => run(a)} />
      <Tab1Details book={book} books={books} update={update} commit={commit} fail={fail} locked={locked} />
      <PreReviewPanel book={book} update={update} commit={commit} run={(a) => run(a)} />
    </div>
  );
}
