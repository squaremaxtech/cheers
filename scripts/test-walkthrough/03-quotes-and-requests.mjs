// The two other ways work gets booked, plus both ways it gets cancelled:
//   A. quote     customer asks for a price on a quote-mode gig → professional
//                sends an offer → customer accepts and books → customer cancels
//   B. request   customer posts a job with a budget → professional counters →
//                customer books the offer → professional cancels
//
// Usage: node scripts/test-walkthrough/03-quotes-and-requests.mjs [customer] [worker] [worker-slug] [--gig="Quote gig title"] [--category="Photo & Video"] [--premium]
import { openBrowser } from "../test-browser.mjs";

const args = process.argv.slice(2);
const positional = args.filter((a) => !a.startsWith("--"));
const flag = (name) => args.find((a) => a.startsWith(`--${name}=`))?.split("=").slice(1).join("=");
const [customerRole = "customer", workerRole = "worker", slug = "island-lens-studio"] = positional;
const quoteGig = flag("gig") ?? "Event aftermovie";
const category = flag("category") ?? "Photo & Video";
const premiumRequest = args.includes("--premium");
const only = flag("only"); // "quote" | "request"
const tag = `03-${customerRole}`;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const steps = [];
function step(name, ok, detail = "") {
  steps.push({ name, ok });
  console.log(`${ok ? "ok  " : "FAIL"} ${name}${detail ? ` — ${detail}` : ""}`);
  return ok;
}
function note(text) {
  console.log(`note ${text}`);
}
const has = async (browser, fragment) =>
  ((await browser.text()) ?? "").toLowerCase().includes(fragment.toLowerCase());

// A date on Jamaica's calendar (UTC-5, no DST).
const jamaicaISO = (offsetDays) =>
  new Date(Date.now() - 5 * 3_600_000 + offsetDays * 86_400_000).toISOString().slice(0, 10);

const customer = await openBrowser({ role: customerRole });
const worker = await openBrowser({ role: workerRole });

try {
  // ==========================================================================
  // A. Quote
  // ==========================================================================
  if (only !== "request") {
    console.log("\n— quote —");
    await customer.goto(`/workers/${slug}`, 3000);
    await customer.waitFor("Message ", 40_000);
    await customer.click(quoteGig, { wait: 1500 });
    step("customer opens a quote-mode gig", await customer.click("Request a quote", { wait: 1500 }), quoteGig);
    await customer.type("#q-description", "Aftermovie for a rooftop launch: about 150 guests, two DJs and a live sax set. We need a 90-second cut for Instagram by Monday.");
    await customer.type("#q-date", jamaicaISO(3));
    await customer.type("#q-time", "19:00");
    await customer.type("#q-location", "New Kingston, Kingston");
    await customer.shot(`${tag}-a1-quote-form`, { full: true });
    await customer.click("Send quote request", { wait: 300 });
    // One open request per gig per customer: a second run is told so, and
    // carries on with the request that is already there.
    const asked = await customer.waitForAny(["Quote request sent", "Request sent", "already"], 20_000);
    step("customer sends the quote request", asked !== null, asked === "already" ? "one was already open" : "");

    await worker.goto("/worker/quotes", 3000);
    await worker.waitFor("Send offer", 40_000);
    step("professional sees the request in the quote inbox", await has(worker, "rooftop launch"));
    await worker.type("[name=price]", "520");
    await worker.type("[name=duration]", "240");
    await worker.type("[name=note]", "Includes two cameras and the 90-second cut by Monday noon.");
    await worker.shot(`${tag}-a2-worker-offer`, { full: true });
    await worker.click("Send offer", { exact: true, wait: 300 });
    step("professional sends a priced offer", (await worker.waitForAny(["Offer sent"], 20_000)) !== null, "$520.00 · 240 min");

    await customer.goto("/quotes", 3000);
    await customer.waitFor("Accept & book", 40_000);
    step("customer sees the offer", await has(customer, "520"));
    await customer.click("Accept & book", { wait: 1500 });
    await customer.type("input[type=date]", jamaicaISO(3));
    await customer.type("input[type=time]", "19:00");
    await customer.type("Street address, area, parish", "8 Test Rooftop, Knutsford Blvd, New Kingston (TEST)");
    await customer.shot(`${tag}-a3-accept-form`, { full: true });
    await customer.click("Confirm booking", { exact: true, wait: 300 });
    const booked = await customer.waitForPath("/bookings/");
    const quoteBooking = await customer.path();
    if (step("customer accepts the offer and books", booked, quoteBooking)) {
      await customer.waitFor("viewing as", 40_000);
      step("the booking arrives already accepted, at the offered price", (await has(customer, "accepted")) && (await has(customer, "520")));
      await customer.click("No tip", { exact: true, wait: 500 });
      await customer.click("Confirm booking", { wait: 300 });
      step("customer confirms", (await customer.waitForAny(["Booking confirmed"], 20_000)) !== null);
      await sleep(2500);

      // Three days out: well inside the free-cancellation window.
      await customer.click("Cancel booking", { wait: 300 });
      const cancelled = await customer.waitFor("cancelled", 20_000);
      step("customer cancels (more than 5 hours ahead)", cancelled, `confirm dialog: ${JSON.stringify(customer.dialogs.slice(-1))}`);
      await customer.shot(`${tag}-a4-cancelled`, { full: true });
    }
  }

  // ==========================================================================
  // B. Job request
  // ==========================================================================
  if (only !== "quote") {
    console.log(`\n— job request${premiumRequest ? " (premium)" : ""} —`);
    const title = premiumRequest ? "Producer for a private anniversary dinner (TEST)" : "Photographer for a birthday takeover (TEST)";
    const REQUEST_ROOM = /^\/requests\/[0-9a-f-]{36}/;

    // A request left open by an earlier run is picked up rather than doubled.
    await customer.goto("/requests", 3000);
    await customer.waitFor("request", 40_000);
    await sleep(1500);
    let requestPath = null;
    if ((await has(customer, title)) && (await customer.click(title, { wait: 300 }))) {
      if (await customer.waitForPath(REQUEST_ROOM, 45_000)) {
        requestPath = await customer.path();
        if (await has(customer, "Open for offers")) note(`resuming the open request at ${requestPath}`);
        else requestPath = null;
      }
    }

    if (requestPath === null) {
    await customer.goto("/requests/new", 3000);
    await customer.waitFor("Post request", 40_000);
    await sleep(1500);
    await customer.type("#job-title", title);
    step("customer picks a category", await customer.select("job-category", category), category);
    if (premiumRequest) {
      step("premium customer is offered the premium switch", await customer.check("Premium request"));
    } else {
      step("standard customer is NOT offered the premium switch", !(await has(customer, "Premium request")));
    }
    await customer.type("#job-description", "A 30th birthday takeover at a lounge: around 60 guests, doors at 9. We need someone for three hours who knows how to work in low light.");
    await customer.type("#job-tags", "birthday, party");
    step("customer picks a parish", await customer.select("job-parish", "St. James"), "St. James");
    await customer.type("#job-area", "Hip Strip");
    await customer.type("Street address", "21 Test Avenue, Montego Bay, St. James (TEST)");
    await customer.type("#job-date", jamaicaISO(4));
    await customer.type("#job-time", "20:00");
    await customer.select("job-duration", "3 h");
    await customer.type("#job-budget", "150");
    await customer.check("[name=matchMode][value=manual]");
    await customer.shot(`${tag}-b1-request-form`, { full: true });
    await customer.click("Post request", { exact: true, wait: 300 });
    const posted = await customer.waitForPath(REQUEST_ROOM, 45_000);
    requestPath = await customer.path();
    if (!step("customer posts the request", posted, requestPath)) {
      console.log(((await customer.text()) ?? "").slice(0, 500));
      throw new Error("request was not posted");
    }
    }

    await worker.goto("/worker/jobs", 3000);
    await worker.waitFor("Job board", 40_000);
    await sleep(2000);
    const onBoard = await has(worker, title);
    step("professional sees the request on the job board", onBoard);
    if (onBoard) {
      step("the board shows the area, never the street address", !(await has(worker, "21 Test Avenue")));
      await worker.shot(`${tag}-b2-job-board`, { full: true });
      await worker.click("Counter-offer", { wait: 1500 });
      await worker.type("input[id^=price-]", "170");
      await worker.type("input[id^=note-]", "Three hours, 100+ edited images in five days.");
      await worker.click("Send offer", { exact: true, wait: 300 });
      const sent = await worker.waitForAny(["Offer sent", "offer sent", "Add a live gig", "no longer open", "not available"], 20_000);
      step("professional sends a counter-offer", sent !== null && /offer sent/i.test(sent), sent ?? "no response");
      if (sent !== null && !/offer sent/i.test(sent)) {
        note(`the professional was told: "${((await worker.text()) ?? "").split("\n").find((l) => l.toLowerCase().includes(sent.toLowerCase())) ?? sent}"`);
      }

      if (sent !== null && /offer sent/i.test(sent)) {
        // The request room is live: the offer should arrive without a refresh.
        const arrived = await customer.waitFor("170", 15_000);
        step("the offer reaches the customer live", arrived);
        if (!arrived) {
          await customer.goto(requestPath, 3000);
          await customer.waitFor("170", 40_000);
        }
        await customer.shot(`${tag}-b3-offers`, { full: true });
        await customer.click("Book", { exact: true, wait: 300 });
        const matched = await customer.waitForPath("/bookings/");
        const jobBooking = await customer.path();
        if (step("customer books the offer", matched, jobBooking)) {
          await customer.waitFor("viewing as", 40_000);
          await customer.click("No tip", { exact: true, wait: 500 });
          await customer.click("Confirm booking", { wait: 300 });
          step("customer confirms", (await customer.waitForAny(["Booking confirmed"], 20_000)) !== null);

          await worker.goto("/worker/bookings", 3000);
          await worker.waitFor("Upcoming", 40_000);
          await sleep(1500);
          await worker.click("Cancel", { exact: true, wait: 300 });
          step("professional cancels", (await worker.waitForAny(["cancelled", "Cancelled"], 20_000)) !== null, `confirm dialog: ${JSON.stringify(worker.dialogs.slice(-1))}`);
          await worker.shot(`${tag}-b4-worker-cancelled`, { full: true });
        }
      }
    }

    // Whatever happened above, do not leave an open request on the board.
    await customer.goto(requestPath, 3000);
    await customer.waitFor("Request", 40_000);
    await sleep(1500);
    if (await customer.click("Withdraw request", { wait: 300 })) {
      step("customer withdraws the open request", (await customer.waitForAny(["cancelled", "Cancelled", "withdrawn"], 20_000)) !== null);
    }
  }

  console.log(`\nconsole errors — customer: ${JSON.stringify(customer.problems.filter((p) => !p.includes("Google Maps")))}`);
  console.log(`console errors — professional: ${JSON.stringify(worker.problems.filter((p) => !p.includes("Google Maps")))}`);
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
