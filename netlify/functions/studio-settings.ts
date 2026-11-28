import type { Config } from "@netlify/functions";
import { checkAuth, json } from "../lib/studio-auth.ts";
import { cleanReserved, getLimits, getReserved, recentUsage, setLimits, setReserved } from "../lib/studio-settings.ts";

export const config: Config = { path: "/api/studio/settings" };

/** Studio-wide settings: the reserved names/animals list, the daily picture limit and recent usage. */
export default async (req: Request): Promise<Response> => {
  const denied = checkAuth(req);
  if (denied) return denied;
  try {
    if (req.method === "PUT") {
      const b = (await req.json().catch(() => ({}))) as { reserved?: unknown; limits?: { imagesPerDay?: unknown } };
      if (b.reserved) await setReserved(cleanReserved(b.reserved));
      if (b.limits) {
        const n = Number(b.limits.imagesPerDay);
        if (!Number.isFinite(n) || n < 0) return json({ error: "The daily picture limit must be 0 or more." }, 400);
        await setLimits({ imagesPerDay: Math.min(Math.round(n), 1000) });
      }
    } else if (req.method !== "GET") return json({ error: "Method not allowed" }, 405);
    const [reserved, limits, usage] = await Promise.all([getReserved(), getLimits(), recentUsage(7)]);
    return json({ reserved, limits, usage });
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : String(err) }, 500);
  }
};
