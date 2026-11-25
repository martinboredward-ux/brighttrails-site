# brighttrailspublishing.com

Static site for Bright Trails Publishing. The public site is plain HTML, CSS and JavaScript. The one addition is the private KDP Book Studio at `/studio` (see the last section), which has its own build.

## Structure

| Route | File |
| --- | --- |
| `/` | `index.html`: hero, books by age, Maveric Fox Series, Bright Trails Gives, free printables signup, about |
| `/thanks/` | `thanks/index.html`: shown after someone signs up for printables |
| `/privacy/` | `privacy/index.html`: privacy policy with a privacy request form |
| `/privacy/received/` | shown after someone sends a privacy request |
| `404.html` | not-found page |

Shared files: `assets/css/site.css`, `assets/js/site.js`, logo and favicon in `assets/img/`, book covers go in `assets/img/covers/`.

## The one file you edit: `assets/js/config.js`

- **Amazon links**: paste the product URL into `amazon` for each book. The "Buy on Amazon" button and "Available now" tag appear automatically. While the value is `null`, the book shows "Coming soon".
- **Covers**: put the image in `assets/img/covers/` and set `cover`, e.g. `"assets/img/covers/mavericks-big-snore.jpg"`. While `null`, the colored placeholder cover shows.
- **Prices**: set `price` as the text to show, e.g. `"$10.99"`. `null` hides it.
- **Bright Trails Gives**: set `kitsGiven` (a number) once the first delivery happens, plus `kitsPerClassroom`, `classroomPrice` and `checkoutUrl` (a Stripe Payment Link or PayPal link). The "Sponsor a classroom" button stays hidden until `checkoutUrl` is set.
- **Contact email**: set `contactEmail` to show it in the footer and privacy page.

## Printables signup

The form uses Netlify Forms. After the first deploy, open the site in Netlify, go to **Forms**, and turn on form detection. Submissions appear under **Forms › printables**, where you can add email notifications. Netlify doesn't send the printables automatically. Email them yourself, or connect a mailing service later.

## Deploy

1. In Netlify, choose **Add new site › Import an existing project › GitHub** and pick this repository.
2. Leave the build command empty. Publish directory is `.` (already set in `netlify.toml`).
3. Under **Domain management**, add `brighttrailspublishing.com` and point the DNS at Netlify. You can keep DNS at GoDaddy, as with edwardmartimbor.com.

## Privacy

- Fonts are self-hosted in `assets/fonts/` (SIL Open Font License). Don't add Google Fonts, analytics or embeds without updating the privacy policy first.
- Netlify Forms collects two forms: **printables** (with an optional `news` consent box) and **privacy-request**. In Netlify, add an email notification for **privacy-request** so you see requests quickly, and answer within 30 days.
- Only send book news to people whose submission has `news: yes`.
- If you add an email service (e.g. MailerLite), name it in the privacy policy's "Who else handles your information" section.

## KDP Book Studio (`/studio`, private)

An admin tool for planning books, building activity-page PDFs, writing KDP listings and making A+ images. It is isolated from the public pages.

| Part | Where |
| --- | --- |
| App (Vite + React + TypeScript + Tailwind, `base: /studio/`) | `studio-app/`, builds into `./studio/` (not committed) |
| API | `netlify/functions/studio-books.ts` (`/api/studio/books`), `studio-kdp-package.ts` (`/api/studio/generate-kdp-package`), `book-studio-background.ts` (`/.netlify/functions/book-studio-background`) |
| Shared code | `netlify/lib/` (password check, Netlify Blobs store `kdp-book-studio`, banned-word list) |

- Set `APP_PASSWORD` in Netlify environment variables. Every Studio function checks it (`x-studio-password` header) and `/studio` shows a login screen.
- AI calls go through Netlify AI Gateway with no API keys: Gemini Flash (tries `GEMINI_MODEL` first, then `gemini-3.8-flash`, `gemini-3.7-flash`, `gemini-4-hydrogen`, `gemini-3-flash-preview`; set `GEMINI_MODEL` in Netlify to change it without a deploy) and Claude (`claude-haiku-5-5`, switchable to `claude-sonnet-5-5`). They use Netlify credits. Every AI button has a free copy-prompt twin for your web chat.
- Activity PDFs and A+ banners are built in the browser and cost nothing.
- `/studio` is `noindex`, disallowed in `robots.txt`, and sent with `X-Robots-Tag`.
- Restore point: git tag `pre-studio-backup` is the site exactly as it was before the Studio.
- Local run: `npm install && npm run build && npx netlify dev` (open `/` and `/studio/`).
