# brighttrailspublishing.com

Static site for Bright Trails Publishing. Plain HTML, CSS and JavaScript: no build step, no server, no dependencies. Same setup as edwardmartimbor-site.

## Structure

| Route | File |
| --- | --- |
| `/` | `index.html`: hero, books by age, Maveric Fox Series, Bright Trails Gives, free printables signup, about |
| `/thanks/` | `thanks/index.html`: shown after someone signs up for printables |
| `/privacy/` | `privacy/index.html`: privacy policy |
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
