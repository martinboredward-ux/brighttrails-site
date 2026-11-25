import { createHash, timingSafeEqual } from "node:crypto";

export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });
}

function digest(s: string): Buffer {
  return createHash("sha256").update(s).digest();
}

/** Returns an error Response when the request is not allowed, or null when it is. */
export function checkAuth(req: Request): Response | null {
  const expected = process.env.APP_PASSWORD;
  if (!expected) {
    return json({ error: "APP_PASSWORD is not set on the server. Add it in Netlify environment variables." }, 503);
  }
  const given = req.headers.get("x-studio-password") ?? "";
  if (!timingSafeEqual(digest(given), digest(expected))) {
    return json({ error: "Unauthorized" }, 401);
  }
  return null;
}
