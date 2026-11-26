import { useId, type ButtonHTMLAttributes, type ReactNode } from "react";
import { tipFor, type Tip } from "../tips";

function flat(n: ReactNode): string {
  if (n == null || typeof n === "boolean") return "";
  if (typeof n === "string" || typeof n === "number") return String(n);
  if (Array.isArray(n)) return n.map(flat).join("");
  if (typeof n === "object" && "props" in n) return flat((n as { props: { children?: ReactNode } }).props.children);
  return "";
}

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** What the button does. Defaults to the text matched in tips.ts. */
  tip?: string;
  /** Which engine runs, for example "Gemini Flash · Reads Notes + Style Bible". */
  engine?: string;
}

/** A button with a quick, crisp hover and keyboard-focus popover (not the slow browser title). */
export function TooltipButton({ tip, engine, children, className, ...rest }: Props) {
  const id = useId();
  const found: Tip | null = tip ? { what: tip, engine: engine ?? "" } : tipFor(flat(children));
  if (!found) return <button className={className} {...rest}>{children}</button>;
  return (
    <span className="tipwrap">
      <button className={className} aria-describedby={id} {...rest}>{children}</button>
      <span role="tooltip" id={id} className="tip">
        <span className="tip-what">{found.what}</span>
        {found.engine && <span className="tip-engine">{found.engine}</span>}
      </span>
    </span>
  );
}

/** Same popover around any element (file pickers, labels). */
export function Tip({ what, engine, children }: { what: string; engine?: string; children: ReactNode }) {
  const id = useId();
  return (
    <span className="tipwrap" aria-describedby={id}>
      {children}
      <span role="tooltip" id={id} className="tip">
        <span className="tip-what">{what}</span>
        {engine && <span className="tip-engine">{engine}</span>}
      </span>
    </span>
  );
}
