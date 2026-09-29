// Cancels bookings from either side and checks the result.
//
// Usage: node scripts/test-walkthrough/04-cancel.mjs <persona> <bookingPath> [<persona> <bookingPath> ...]
//   a customer cancels from the booking room; a professional from /worker/bookings
import { openBrowser } from "../test-browser.mjs";

const raw = process.argv.slice(2);
// Git Bash on Windows rewrites /bookings/x into C:/Program Files/Git/bookings/x.
const clean = (p) => p.replace(/^[A-Za-z]:[\\/]Program Files[\\/]Git/i, "");
let failures = 0;

for (let i = 0; i + 1 < raw.length; i += 2) {
  const role = raw[i];
  const bookingPath = clean(raw[i + 1]);
  const isWorker = role.includes("worker");
  const browser = await openBrowser({ role });
  try {
    await browser.goto(bookingPath, 3000);
    await browser.waitFor("viewing as", 40_000);
    await new Promise((r) => setTimeout(r, 2000));
    const clicked = await browser.click(isWorker ? "Cancel" : "Cancel booking", { exact: true, wait: 300 });
    const outcome = await browser.waitForAny(["Booking cancelled", "Something went wrong", "can no longer", "at least 5 hours"], 20_000);
    await new Promise((r) => setTimeout(r, 2500));
    const text = ((await browser.text()) ?? "").toLowerCase();
    const cancelled = text.includes("cancelled");
    if (!cancelled) failures += 1;
    console.log(
      `${cancelled ? "ok  " : "FAIL"} ${role} cancels ${bookingPath} — clicked: ${clicked}, dialog: ${JSON.stringify(browser.dialogs)}, app said: ${JSON.stringify(outcome)}`
    );
    await browser.shot(`04-${role}-cancel`, { full: true });
  } finally {
    await browser.close();
  }
}
process.exitCode = failures === 0 ? 0 : 1;
