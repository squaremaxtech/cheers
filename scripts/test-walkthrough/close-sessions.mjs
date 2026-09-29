// Tidies up after a run: opens each booking room as the professional and
// confirms "I got home safely", so no safety session is left running.
//
// Usage: node scripts/test-walkthrough/close-sessions.mjs <persona> <bookingPath> [bookingPath ...]
import { openBrowser } from "../test-browser.mjs";

const [role = "worker", ...rawPaths] = process.argv.slice(2);
// Git Bash on Windows rewrites /bookings/x into C:/Program Files/Git/bookings/x.
const paths = rawPaths.map((p) => p.replace(/^[A-Za-z]:[\\/]Program Files[\\/]Git/i, ""));

const browser = await openBrowser({ role });
try {
  for (const bookingPath of paths) {
    await browser.goto(bookingPath, 3000);
    await browser.waitFor("viewing as", 40_000);
    await new Promise((r) => setTimeout(r, 2500));
    if (await browser.click("I've left the visit", { wait: 3000 })) {
      console.log(`${bookingPath}: left the visit`);
    }
    const home = await browser.click("I got home safely", { wait: 1000 });
    const ended = home && (await browser.waitFor("Monitoring ended", 15_000));
    console.log(`${bookingPath}: ${ended ? "home safe — monitoring ended" : home ? "clicked, no confirmation seen" : "nothing to close"}`);
    await browser.shot(`close-${bookingPath.split("/").pop().slice(0, 8)}`, { full: true });
  }
} finally {
  await browser.close();
}
