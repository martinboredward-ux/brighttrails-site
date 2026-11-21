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
    "mavericks-little-rumble":    { amazon: "https://www.amazon.com/dp/B0HRQXDMMQ", cover: "assets/img/covers/mavericks-little-rumble.jpg", price: null },
    "mavericks-grumpy-day":       { amazon: "https://www.amazon.com/dp/B0HC1NH3ND", cover: "assets/img/covers/mavericks-grumpy-day.jpg", price: null },
    "mavericks-first-snow":       { amazon: null, cover: "assets/img/covers/mavericks-first-snow.jpg", price: null },
    "tiny-trails-winter-dot":     { amazon: null, cover: "assets/img/covers/tiny-trails-winter-dot.jpg", price: null },
    "tiny-trails-bold-and-cute":  { amazon: null, cover: "assets/img/covers/tiny-trails-bold-and-cute.jpg", price: null },
    "mindanao-tricycles":         { amazon: "https://www.amazon.com/dp/B0HQZC4JP9", cover: "assets/img/covers/mindanao-tricycles.jpg", price: null },
    "luzon-visayas-tricycles":    { amazon: null, cover: "assets/img/covers/luzon-visayas-tricycles.jpg", price: null },
    "thanksgiving-coloring":      { amazon: "https://www.amazon.com/dp/B0HR5YTNNV", cover: "assets/img/covers/thanksgiving-coloring.jpg", price: null },
    "animal-science-wild-animals":{ amazon: "https://www.amazon.com/dp/B0HRV9F3D8", cover: "assets/img/covers/animal-science-wild-animals.jpg", price: "$10.99" },
    "animal-science-book-2":      { amazon: null, cover: "assets/img/covers/animal-science-book-2.jpg", price: null },
    "barnaby-bumblebee-arctic":   { amazon: null, cover: "assets/img/covers/barnaby-bumblebee-arctic.jpg", price: null },
    "can-do-kid":                 { amazon: null, cover: "assets/img/covers/can-do-kid.jpg", price: null },
    "hearth-and-holly":           { amazon: "https://www.amazon.com/dp/B0HS3LMZ5J", cover: "assets/img/covers/hearth-and-holly.jpg", price: null },
    "line-tracing-anxiety-relief":{ amazon: null, cover: "assets/img/covers/line-tracing-anxiety-relief.jpg", price: null },
    "line-tracing-anxiety-teens": { amazon: null, cover: "assets/img/covers/line-tracing-anxiety-teens.jpg", price: null },
    "line-tracing-young-adults":  { amazon: null, cover: "assets/img/covers/line-tracing-young-adults.jpg", price: null }
  },

  gives: {
    kitsGiven: null,        // a number, e.g. 120. null shows "first delivery coming soon"
    kitsPerClassroom: null, // e.g. 40
    classroomPrice: null,   // e.g. "$120"
    checkoutUrl: null       // Stripe Payment Link or PayPal link for the classroom set
  }
};
