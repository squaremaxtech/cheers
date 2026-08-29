import type { MetadataRoute } from "next";

// Installing CheersJA to the home screen is what turns a website into something
// that can actually protect someone:
//   - Web Push works on iOS ONLY for installed apps (16.4+). Without install,
//     an iPhone worker cannot be reached once their browser is closed — which
//     is precisely when a missed check-in matters.
//   - A standalone window keeps the session alive and puts the safety screen
//     one tap from the home screen instead of several from a browser.
// Worker onboarding therefore treats install as a step, not a suggestion.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "CheersJA — Book Your Event Crew in Jamaica",
    short_name: "CheersJA",
    description:
      "Book DJs, MCs, sound and lighting, performers, caterers, bartenders, décor, photographers and event security across Jamaica — browse, message, book and run the job, with safety check-ins for professionals on site.",
    start_url: "/dashboard",
    display: "standalone",
    orientation: "portrait",
    // Matches --color-base / --color-gold in app/globals.css.
    background_color: "#0c0a09",
    theme_color: "#0c0a09",
    categories: ["entertainment", "events", "business"],
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      {
        src: "/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
    // Deep-links straight to the live booking list — the screen a worker wants
    // when they open the app in a hurry.
    shortcuts: [
      {
        name: "My bookings",
        short_name: "Bookings",
        url: "/worker/bookings",
      },
      {
        name: "Safety settings",
        short_name: "Safety",
        url: "/worker/safety",
      },
    ],
  };
}
