import { useEffect, useState } from "react";
import { getSettings, putSettings, type Reserved, type ReservedItem, type StudioSettings as S } from "../api";
import { TooltipButton } from "./TooltipButton";

/** Studio-wide settings: reserved names and animals, the daily picture limit, and recent AI usage. */
export default function StudioSettings() {
  const [open, setOpen] = useState(false);
  const [s, setS] = useState<S | null>(null);
  const [msg, setMsg] = useState("");
  const [newName, setNewName] = useState("");
  const [newAnimal, setNewAnimal] = useState("");
  const [newOwner, setNewOwner] = useState("");
  const [cap, setCap] = useState("40");

  useEffect(() => {
    if (!open || s) return;
    getSettings().then((r) => { setS(r); setCap(String(r.limits.imagesPerDay)); }).catch((e) => setMsg(e instanceof Error ? e.message : String(e)));
  }, [open, s]);

  const saveReserved = async (reserved: Reserved) => {
    try { const r = await putSettings({ reserved }); setS(r); setMsg("Saved."); } catch (e) { setMsg(e instanceof Error ? e.message : String(e)); }
  };
  const addItem = (kind: "names" | "animals", name: string) => {
    if (!s || !name.trim()) return;
    const item: ReservedItem = { name: name.trim(), owner: newOwner.trim().toLowerCase() };
    void saveReserved({ ...s.reserved, [kind]: [...s.reserved[kind], item] });
    if (kind === "names") setNewName(""); else setNewAnimal("");
  };
  const removeItem = (kind: "names" | "animals", name: string) => {
    if (!s) return;
    void saveReserved({ ...s.reserved, [kind]: s.reserved[kind].filter((i) => i.name !== name) });
  };
  const saveCap = async () => {
    try { const r = await putSettings({ limits: { imagesPerDay: Number(cap) } }); setS(r); setMsg("Limit saved."); } catch (e) { setMsg(e instanceof Error ? e.message : String(e)); }
  };

  const list = (kind: "names" | "animals") => (
    <ul className="flex flex-wrap gap-1">
      {s?.reserved[kind].map((i) => (
        <li key={i.name} className="rounded-full bg-forest/10 px-2 py-0.5 text-xs" title={i.note || (i.owner ? `Owned by "${i.owner}" books` : "Reserved for every book")}>
          {i.name}{i.owner ? <span className="opacity-60"> · {i.owner}</span> : null}
          <button className="ml-1 opacity-60 hover:opacity-100" aria-label={`Remove ${i.name}`} onClick={() => removeItem(kind, i.name)}>×</button>
        </li>
      ))}
    </ul>
  );

  return (
    <div className="space-y-2">
      <TooltipButton className="text-xs text-muted underline" onClick={() => setOpen(!open)}>{open ? "Hide" : "Studio settings"}</TooltipButton>
      {open && (
        <div className="space-y-3 rounded-lg border border-forest/20 p-2 text-xs">
          {!s ? <p>Loading…</p> : (
            <>
              <section className="space-y-1">
                <b>Reserved names</b>
                <p className="hint">No other book may use these. The “owner” word is part of the title or series of the book that does use it.</p>
                {list("names")}
                <div className="flex gap-1">
                  <input className="field" placeholder="New name" value={newName} onChange={(e) => setNewName(e.target.value)} />
                  <input className="field" placeholder="Owner word" value={newOwner} onChange={(e) => setNewOwner(e.target.value)} />
                  <TooltipButton className="btn-alt" onClick={() => addItem("names", newName)}>Add</TooltipButton>
                </div>
              </section>
              <section className="space-y-1">
                <b>Reserved lead animals</b>
                {list("animals")}
                <div className="flex gap-1">
                  <input className="field" placeholder="New animal" value={newAnimal} onChange={(e) => setNewAnimal(e.target.value)} />
                  <TooltipButton className="btn-alt" onClick={() => addItem("animals", newAnimal)}>Add</TooltipButton>
                </div>
                <p className="hint">Open for supporting roles: {s.reserved.allowed.join(", ") || "none"}.</p>
              </section>
              <section className="space-y-1">
                <b>Pictures per day (in Studio)</b>
                <div className="flex items-center gap-1">
                  <input className="field !w-20" type="number" min={0} value={cap} onChange={(e) => setCap(e.target.value)} />
                  <TooltipButton className="btn-alt" onClick={saveCap}>Save</TooltipButton>
                </div>
                <p className="hint">Today: {s.usage[0]?.images ?? 0} made. Pictures are most of the AI credit spend.</p>
              </section>
              <section className="space-y-1">
                <b>Last 7 days</b>
                <table className="w-full"><tbody>
                  {s.usage.map((d) => (
                    <tr key={d.day} title={Object.entries(d.byKey).map(([k, n]) => `${k}: ${n}`).join("\n")}>
                      <td>{d.day.slice(5)}</td><td>{d.images} pictures</td><td>{Object.values(d.byKey).reduce((a, b) => a + b, 0) - d.images} AI calls</td>
                    </tr>
                  ))}
                </tbody></table>
                <p className="hint">Hover a row for the full breakdown.</p>
              </section>
            </>
          )}
          {msg && <p className="text-accent">{msg}</p>}
        </div>
      )}
    </div>
  );
}
