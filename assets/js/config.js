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
 */
window.SITE_CONFIG = {
  siteUrl: "https://brighttrailspublishing.com",
  contactEmail: null, // e.g. "hello@brighttrailspublishing.com"

  books: {
    "mavericks-big-snore":        { amazon: "https://www.amazon.com/dp/B0HR4T99KR", cover: "assets/img/covers/mavericks-big-snore.jpg", price: null },
    "mavericks-first-sleepover":  { amazon: "https://www.amazon.com/dp/B0HR57LKQG", cover: "assets/img/covers/mavericks-first-sleepover.jpg", price: null },
    "mavericks-little-rumble":    { amazon: null, cover: "assets/img/covers/mavericks-little-rumble.jpg", price: null },
    "thick-to-thin-coloring":     { amazon: null, cover: null, price: null },
    "mindanao-tricycles":         { amazon: "https://www.amazon.com/dp/B0HQZC4JP9", cover: "assets/img/covers/mindanao-tricycles.jpg", price: null },
    "luzon-visayas-tricycles":    { amazon: null, cover: null, price: null },
    "thanksgiving-coloring":      { amazon: null, cover: null, price: null },
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
