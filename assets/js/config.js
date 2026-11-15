/*
 * SITE CONFIGURATION — the one file to edit for links, prices and numbers.
 * Nothing here needs a build: save, commit, and Netlify redeploys.
 *
 * Rules:
 *  - Leave a URL as null until you have the exact page. Buttons stay hidden
 *    while the URL is null (books then show "Tell me when it's out").
 *  - cover: path to a cover image under assets/img/covers/, e.g.
 *    "assets/img/covers/mavericks-big-snore.jpg". While null, the colored
 *    placeholder cover shows.
 *  - price: text exactly as it should appear, e.g. "$10.99". null hides it.
 *  - kindle / paperback: true once that format is actually live on Amazon.
 *  - paperbackDate: "YYYY-MM-DD" to show "Paperback — <date>" while paperback
 *    is still false. Once paperback goes live, set paperback: true and this
 *    stops being used (leave it or remove it, doesn't matter).
 */
window.SITE_CONFIG = {
  siteUrl: "https://brighttrailspublishing.com",
  contactEmail: null, // e.g. "hello@brighttrailspublishing.com"

  books: {
    "mavericks-big-snore":        { amazon: "https://www.amazon.com/dp/B0HR4T99KR", cover: "assets/img/covers/mavericks-big-snore.jpg", price: null, kindle: true, paperback: false, paperbackDate: "2026-11-22" },
    "mavericks-first-sleepover":  { amazon: "https://www.amazon.com/dp/B0HR57LKQG", cover: "assets/img/covers/mavericks-first-sleepover.jpg", price: null, kindle: true, paperback: false, paperbackDate: "2026-11-29" },
    "mavericks-little-rumble":    { amazon: "https://www.amazon.com/dp/B0HRQXDMMQ", cover: "assets/img/covers/mavericks-little-rumble.jpg", price: null, kindle: true, paperback: false, paperbackDate: "2026-12-06" },
    "mavericks-grumpy-day":       { amazon: "https://www.amazon.com/dp/B0HC1NH3ND", cover: "assets/img/covers/mavericks-grumpy-day.jpg", price: null, kindle: true, paperback: false, paperbackDate: "2026-12-13" },
    "thick-to-thin-coloring":     { amazon: null, cover: null, price: null },
    "mindanao-tricycles":         { amazon: "https://www.amazon.com/dp/B0HQZC4JP9", cover: "assets/img/covers/mindanao-tricycles.jpg", price: null, kindle: false, paperback: true },
    "luzon-visayas-tricycles":    { amazon: null, cover: null, price: null },
    "thanksgiving-coloring":      { amazon: "https://www.amazon.com/dp/B0HR5YTNNV", cover: "assets/img/covers/thanksgiving-coloring.jpg", price: null, kindle: false, paperback: true },
    "animal-science-wild-animals":{ amazon: null, cover: null, price: "$10.99" },
    "hearth-and-holly":           { amazon: null, cover: "assets/img/covers/hearth-and-holly.jpg", price: null },
    "line-tracing-anxiety-relief":{ amazon: null, cover: null, price: null },
    "line-tracing-young-adults":  { amazon: null, cover: null, price: null }
  },

  gives: {
    kitsGiven: null,        // a number, e.g. 120. null shows "first delivery coming soon"
    kitsPerClassroom: null, // e.g. 40
    classroomPrice: null,   // e.g. "$120"
    checkoutUrl: null       // Stripe Payment Link or PayPal link for the classroom set
  }
};
