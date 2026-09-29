// A whole booking, end to end, between two signed-in browsers:
//   customer messages the professional → books a fixed-price gig with an
//   add-on → professional accepts → customer confirms → professional travels,
//   starts the job with the customer's PIN, checks in, records the payment,
//   completes, leaves and gets home → customer reviews.
//
// Usage: node scripts/test-walkthrough/02-booking.mjs [customer] [worker] [worker-slug] [--gig="Gig title"] [--booking=/bookings/<id>] [--time="10:00 AM"]
//   e.g. node scripts/test-walkthrough/02-booking.mjs premium-customer premium-worker blue-mahoe-events --gig="Villa celebration"
//   --booking resumes an existing pending booking instead of making a new one.
import { openBrowser } from "../test-browser.mjs";

const args = process.argv.slice(2);
const positional = args.filter((a) => !a.startsWith("--"));
// Git Bash on Windows rewrites an argument like /bookings/x into
// C:/Program Files/Git/bookings/x — undo that.
const flag = (name) =>
  args
    .find((a) => a.startsWith(`--${name}=`))
    ?.split("=")
    .slice(1)
    .join("=")
    .replace(/^[A-Za-z]:[\/]Program Files[\/]Git/i, "");
const [customerRole = "customer", workerRole = "worker", slug = "island-lens-studio"] = positional;
const gigTitle = flag("gig") ?? "";
const resume = flag("booking");
const slot = flag("time") ?? "10:00 AM";
const tag = `02-${customerRole}`;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const steps = [];
function step(name, ok, detail = "") {
  steps.push({ name, ok });
  console.log(`${ok ? "ok  " : "FAIL"} ${name}${detail ? ` — ${detail}` : ""}`);
  return ok;
}

// A date on Jamaica's calendar (UTC-5, no DST).
function jamaicaDate(offsetDays) {
  const d = new Date(Date.now() - 5 * 3_600_000 + offsetDays * 86_400_000);
  return { iso: d.toISOString().slice(0, 10), day: d.getUTCDate(), month: d.getUTCMonth() };
}

const has = async (browser, fragment) =>
  ((await browser.text()) ?? "").toLowerCase().includes(fragment.toLowerCase());

const customer = await openBrowser({ role: customerRole });
const worker = await openBrowser({ role: workerRole });

try {
  let bookingPath = resume;

  if (!bookingPath) {
    // --- 1. the profile, and a message ------------------------------------
    await customer.goto(`/workers/${slug}`, 3000);
    step("customer opens the professional's profile", await customer.waitFor("Message ", 40_000), `/workers/${slug}`);
    await customer.shot(`${tag}-1-profile`, { full: true });

    await customer.click("Message ", { wait: 500 });
    if (step("customer opens a chat", await customer.waitForPath("/chats/"), await customer.path())) {
      const room = await customer.path();
      await customer.waitFor("Send", 20_000);
      await customer.type("Write a message", "Hi — are you free tomorrow morning? It's a product launch, about 80 guests.");
      await customer.click("Send", { exact: true, wait: 2500 });
      step("customer sends a message", await customer.waitFor("product launch", 8000));

      await worker.goto(room, 3000);
      step("professional sees the message", await worker.waitFor("product launch", 40_000));
      await worker.type("Write a message", "Morning works. Send the request through and I'll accept it right away.");
      await worker.click("Send", { exact: true, wait: 2500 });
      step("customer sees the reply live, without a refresh", await customer.waitFor("accept it right away", 15_000));
      await customer.shot(`${tag}-2-chat`);
    }

    // --- 2. book --------------------------------------------------------------
    await customer.goto(`/workers/${slug}${gigTitle ? "" : ""}`, 3000);
    await customer.waitFor("Book", 40_000);
    if (gigTitle) await customer.click(gigTitle, { wait: 1500 });
    await customer.click("Book this gig", { wait: 500 });
    step("customer opens the booking form", await customer.waitForPath("/book/"), await customer.path());
    await customer.waitFor("Send booking request", 40_000);

    // Wait for the calendar to finish asking the server which days are open.
    await sleep(1500);
    for (let i = 0; i < 40 && (await has(customer, "checking")); i++) await sleep(500);
    const today = jamaicaDate(0);
    const tomorrow = jamaicaDate(1);
    if (tomorrow.month !== today.month) {
      await customer.click("Next month", { wait: 2000 });
      for (let i = 0; i < 40 && (await has(customer, "checking")); i++) await sleep(500);
    }
    step("customer picks a date", await customer.click(String(tomorrow.day), { exact: true, wait: 1500 }), tomorrow.iso);
    await customer.waitFor(slot, 15_000);
    step("customer picks a time", await customer.click(slot, { exact: true, wait: 800 }), slot);

    const addon = await customer.evaluate(`(() => {
      const box = [...document.querySelectorAll("label input[type=checkbox]")].find((e) => e.offsetParent !== null)
      if (!box) return null
      box.scrollIntoView({ block: "center" }); box.click()
      return box.closest("label").textContent.trim().slice(0, 60)
    })()`);
    if (addon !== null) step("customer adds an add-on", true, addon);
    else console.log("note this gig has no add-ons");

    await customer.type("Street address", "12 Test Lane, Montego Bay, St. James (TEST)");
    await customer.type("#b-instructions", "Test booking — gate code 4471. Parking at the back.");
    await customer.shot(`${tag}-3-booking-form`, { full: true });
    await customer.click("Send booking request", { wait: 500 });
    const created = await customer.waitForPath("/bookings/");
    bookingPath = await customer.path();
    if (!step("customer sends the booking request", created, bookingPath)) {
      throw new Error("booking was not created");
    }
  } else {
    await customer.goto(bookingPath, 3000);
    await customer.waitFor("viewing as", 40_000);
    step("customer opens the existing booking", (await customer.path()).startsWith("/bookings/") && (await has(customer, "viewing as")), bookingPath);
  }
  await customer.shot(`${tag}-4-booking-pending`, { full: true });

  // --- 3. the professional decides ------------------------------------------
  await worker.goto("/worker/bookings", 3000);
  await worker.waitFor("New requests", 40_000);
  if (await has(worker, "About this customer")) {
    step(
      "professional sees the request with the customer card",
      true,
      (await has(worker, "12 Test Lane")) ? "address shown before accepting" : "address NOT shown"
    );
  } else {
    step("professional sees the request with the customer card", Boolean(resume), "nothing pending");
  }
  await worker.shot(`${tag}-5-worker-request`, { full: true });
  if (await worker.click("Accept", { exact: true, wait: 1000 })) {
    step("professional accepts", await worker.waitFor("Booking accepted", 15_000));
  } else {
    step("professional accepts", true, "already accepted");
  }

  // --- 4. the customer confirms -----------------------------------------------
  // The booking room is live: the acceptance should arrive without a refresh.
  const live = await customer.waitFor("Confirm booking", 15_000);
  if (live) {
    step("customer's booking room updates live", true);
    await customer.click("10%", { exact: true, wait: 600 });
    await customer.click("Confirm booking", { wait: 1000 });
    step("customer confirms the booking (10% tip)", await customer.waitFor("Booking confirmed", 15_000));
  } else {
    await customer.goto(bookingPath, 3000);
    await customer.waitFor("viewing as", 40_000);
    step("booking is confirmed", await has(customer, "confirmed"), "the professional recorded the payment first");
  }
  await sleep(2500);
  const pin = await customer.evaluate(`(() => {
    const el = [...document.querySelectorAll("p, span, div")].find((e) => /^\\d{4}$/.test((e.textContent ?? "").trim()) && e.children.length === 0)
    return el ? el.textContent.trim() : null
  })()`);
  step("customer sees the safety PIN", pin !== null);
  if (await has(customer, "Mark as paid")) {
    step("customer sees how to pay the professional", await has(customer, "Sample listing"), "payment details shown only once confirmed");
  }
  await customer.shot(`${tag}-6-customer-confirmed`, { full: true });

  // --- 5. the job -------------------------------------------------------------
  await worker.goto(bookingPath, 3000);
  await worker.waitFor("Verify PIN", 40_000);
  const monitored = await has(worker, "I'm on my way");
  if (monitored) {
    await worker.click("I'm on my way", { wait: 1000 });
    step("professional sets off (monitoring starts)", await worker.waitFor("Monitoring started", 15_000));
  } else {
    step("professional sets off", true, "unmonitored gig — no travel step");
  }

  // A wrong PIN first: it must be refused.
  const wrong = pin === "0000" ? "1111" : "0000";
  await worker.type("#s-pin", wrong);
  await worker.click("Verify PIN & start", { wait: 1000 });
  step("a wrong PIN is refused", await worker.waitFor("doesn't match", 15_000));
  await worker.type("#s-pin", pin ?? "");
  await worker.click("Verify PIN & start", { wait: 1000 });
  step("professional starts the job with the customer's PIN", await worker.waitFor("PIN verified", 15_000));
  await sleep(2500);
  await worker.shot(`${tag}-7-worker-in-progress`, { full: true });

  if (monitored) {
    const checked = (await worker.click("Check in now", { wait: 1000 })) || (await worker.click("I'm OK", { wait: 1000 }));
    step("professional checks in", checked && (await worker.waitFor("Check-in recorded", 15_000)));
  }

  // Completing before a payment is recorded must be refused.
  await worker.click("Mark completed", { wait: 300 });
  const outcome = await worker.waitForAny(["No payment is recorded", "Marked completed"], 15_000);
  const refused = outcome === "No payment is recorded";
  if (refused) step("completing without a recorded payment is refused", true);
  else step("professional completes the job", outcome === "Marked completed", outcome ? "payment was already recorded" : "no response to Mark completed");

  if (refused) {
  await worker.click("Confirm payment received", { wait: 1500 });
  await worker.select("pay-method", "Cash");
  await worker.type("#pay-note", "Cash on completion (test)");
  await worker.evaluate(`(() => {
    const buttons = [...document.querySelectorAll("button")].filter((b) => b.offsetParent !== null && b.textContent.trim() === "Confirm payment received")
    const submit = buttons.find((b) => b.type === "submit") ?? buttons[buttons.length - 1]
    if (submit) { submit.scrollIntoView({ block: "center" }); submit.click() }
  })()`);
  step("professional records the payment", await worker.waitFor("Payment recorded", 15_000));
  await sleep(2000);

  await worker.click("Mark completed", { wait: 1000 });
  step("professional completes the job", await worker.waitFor("Marked completed", 15_000));
  }
  await sleep(2000);

  if (monitored) {
    // Judged by what the safety bar offers next, not by a toast that is gone
    // in a few seconds. A run must never leave a session open, so this retries.
    if (await worker.click("I've left the visit", { wait: 300 })) {
      await worker.waitFor("I got home safely", 15_000);
    }
    let home = false;
    for (let attempt = 0; attempt < 3 && !home; attempt++) {
      await sleep(1500);
      await worker.click("I got home safely", { wait: 300 });
      home =
        (await worker.waitForAny(["Monitoring ended"], 8000)) !== null ||
        !(await has(worker, "I got home safely"));
    }
    step("professional leaves and gets home safely", home);
  }
  await sleep(1500);
  await worker.shot(`${tag}-8-worker-completed`, { full: true });

  // --- 6. the review ------------------------------------------------------------
  await customer.goto(bookingPath, 3000);
  await customer.waitFor("Submit review", 40_000);
  await customer.click("5 stars", { exact: true, wait: 500 });
  await customer.type("How was your experience", "On time, easy to work with, and the photos were with us in three days. Would book again.");
  await customer.click("Submit review", { wait: 1000 });
  step("customer leaves a review", await customer.waitFor("Review submitted", 15_000));
  await sleep(2000);
  await customer.shot(`${tag}-9-customer-reviewed`, { full: true });

  console.log(`\nbooking: ${bookingPath}`);
  console.log(`dialogs accepted: ${JSON.stringify([...customer.dialogs, ...worker.dialogs])}`);
  console.log(`console errors — customer: ${JSON.stringify(customer.problems)}`);
  console.log(`console errors — professional: ${JSON.stringify(worker.problems)}`);
} catch (error) {
  console.log(`stopped: ${error.message}`);
  await customer.shot(`${tag}-stopped-customer`, { full: true });
  await worker.shot(`${tag}-stopped-worker`, { full: true });
} finally {
  await customer.close();
  await worker.close();
}

const failed = steps.filter((s) => !s.ok);
console.log(
  failed.length === 0
    ? `\nAll ${steps.length} steps passed.`
    : `\n${failed.length} of ${steps.length} steps failed: ${failed.map((s) => s.name).join("; ")}`
);
process.exitCode = failed.length === 0 ? 0 : 1;
