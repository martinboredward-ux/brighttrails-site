# Local browser test for the Studio (no Netlify, no credits)

Runs the REAL Studio functions (studio-books.ts, studio-image.ts, studio-store.ts) against an in-memory stand-in for Netlify Blobs, serves the built app, and drives it in Chrome with Playwright.

1. `cd studio-app && npm run build`
2. `cd studio-app/e2e && node --import ./register.mjs --experimental-strip-types server.mjs &`  (port 8888, password "test")
3. `python3 test.py` then `python3 test2.py`

Paths in the scripts assume /tmp/e2e and /home/claude/brighttrails-site; copy this folder to /tmp/e2e first or edit them. Does not test AI generation (needs real API keys).
