// A. A ride, end to end: rider posts a route and a price → driver counters →
//    rider accepts → driver travels, picks up, completes → rider rates.
// B. The premium rail: who can and cannot see a premium service, and an admin
//    granting and revoking access.
// C. Role boundaries: where each role is, and is not, allowed to go.
//
// Usage: node scripts/test-walkthrough/05-rides-and-access.mjs [--only=ride|premium|roles] [--premium-gig=<gig id>]
import { openBrowser } from "../test-browser.mjs";

const args = process.argv.slice(2);
const flag = (name) => args.find((a) => a.startsWith(`--${name}=`))?.split("=").slice(1).join("=");
const only = flag("only");
const premiumGigId = flag("premium-gig");
const PREMIUM_GIG = "Villa celebration";
const PREMIUM_PRO = "blue-mahoe-events";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const steps = [];
function step(name, ok, detail = "") {
  steps.push({ name, ok });
  console.log(`${ok ? "ok  " : "FAIL"} ${name}${detail ? ` — ${detail}` : ""}`);
  return ok;
}
const has = async (browser, fragment) =>
  ((await browser.text()) ?? "").toLowerCase().includes(fragment.toLowerCase());

async function withBrowser(options, run) {
  const browser = await openBrowser(options);
  try {
    return await run(browser);
  } finally {
    await browser.close();
  }
}

// ============================================================================
// A. Ride
// ============================================================================
if (!only || only === "ride") {
  console.log("\n— ride —");
  const rider = await openBrowser({ role: "customer" });
  const driver = await openBrowser({ role: "driver" });
  try {
    await rider.goto("/rides/new", 3000);
    await rider.waitFor("Request ride", 40_000);
    await sleep(1500);
    await rider.type("Where should the driver meet you", "Half-Way Tree Transport Centre, Kingston (TEST)");
    await rider.type("Where are you going", "Emancipation Park, New Kingston (TEST)");
    await rider.type("#ride-offer", "12.00");
    await rider.shot("05-a1-ride-form", { full: true });
    await rider.click("Request ride", { exact: true, wait: 300 });
    const posted = await rider.waitForPath(/^\/rides\/[0-9a-f-]{36}/);
    const ridePath = await rider.path();
    if (step("rider posts a ride request", posted, ridePath)) {
      await driver.goto("/driver/requests", 3000);
      await driver.waitFor("Counter-offer", 40_000);
      step("driver sees the request on the board", await has(driver, "Emancipation Park"));
      await driver.shot("05-a2-driver-board", { full: true });
      await driver.click("Counter-offer", { wait: 1000 });
      await driver.type("input[id^=counter-]", "15");
      await driver.click("Send offer", { exact: true, wait: 300 });
      step("driver sends a counter-offer", (await driver.waitForAny(["Offer sent"], 20_000)) !== null, "$15.00");

      const arrived = await rider.waitFor("15.00", 20_000);
      step("the offer reaches the rider live", arrived);
      if (!arrived) {
        await rider.goto(ridePath, 3000);
        await rider.waitFor("15.00", 40_000);
      }
      await rider.click("Accept", { exact: true, wait: 300 });
      step("rider accepts the driver", (await rider.waitForAny(["Driver confirmed"], 20_000)) !== null);
      await sleep(2000);
      step("rider is shown the plate to check", await has(rider, "TEST 001"));
      await rider.shot("05-a3-rider-matched", { full: true });

      await driver.goto(ridePath, 3000);
      await driver.waitFor("I'm on my way", 40_000);
      await driver.click("I'm on my way", { wait: 300 });
      step("driver sets off", (await driver.waitForAny(["you're on the way"], 20_000)) !== null);
      await sleep(2000);
      await driver.click("Rider on board", { wait: 300 });
      step("driver picks the rider up", (await driver.waitForAny(["Trip started"], 20_000)) !== null);
      await sleep(2000);
      await driver.click("Complete ride", { wait: 300 });
      step("driver completes the ride", (await driver.waitForAny(["Ride completed"], 20_000)) !== null);
      await driver.shot("05-a4-driver-completed", { full: true });

      await rider.goto(ridePath, 3000);
      await rider.waitFor("Submit rating", 40_000);
      await rider.click("5 stars", { exact: true, wait: 500 });
      await rider.type("#ride-review-body", "On time and easy to find. Plate matched.");
      await rider.click("Submit rating", { wait: 300 });
      step("rider rates the driver", (await rider.waitForAny(["your rating helps"], 20_000)) !== null);
    }
    console.log(`dialogs accepted: ${JSON.stringify([...rider.dialogs, ...driver.dialogs])}`);
  } catch (error) {
    console.log(`stopped: ${error.message}`);
    await rider.shot("05-stopped-rider", { full: true });
    await driver.shot("05-stopped-driver", { full: true });
  } finally {
    await rider.close();
    await driver.close();
  }
}

// ============================================================================
// B. The premium rail
// ============================================================================
if (!only || only === "premium") {
  console.log("\n— premium rail —");
  await withBrowser({ role: "public", width: 1280, height: 900 }, async (visitor) => {
    await visitor.goto(`/workers/${PREMIUM_PRO}`, 3000);
    await visitor.waitFor("Day-of event coordination", 40_000);
    const html = (await visitor.evaluate("document.documentElement.outerHTML")) ?? "";
    step(
      "a visitor sees the professional, but no trace of the premium service",
      !html.includes(PREMIUM_GIG) && !html.includes("blue-mahoe-premium") && !html.includes("2,500"),
      "no title, no photo, no price in the page source"
    );
    await visitor.goto("/browse?premium=1", 3000);
    await visitor.waitFor("Browse", 40_000);
    await sleep(2000);
    step("a hand-typed ?premium=1 does nothing for a visitor", !(await has(visitor, PREMIUM_GIG)) && !(await has(visitor, "invitation-only")));
  });

  await withBrowser({ role: "customer", width: 1280, height: 900 }, async (standard) => {
    await standard.goto("/browse?premium=1", 3000);
    await standard.waitFor("Browse", 40_000);
    await sleep(2000);
    step("a standard customer sees no premium chip and no premium service", !(await has(standard, "Premium only")) && !(await has(standard, PREMIUM_GIG)));
    if (premiumGigId) {
      await standard.goto(`/book/${PREMIUM_PRO}?gig=${premiumGigId}`, 3000);
      await standard.waitFor("Book", 40_000);
      await sleep(2000);
      step("a standard customer cannot reach a premium service by its link", !(await has(standard, PREMIUM_GIG)));
      await standard.shot("05-b1-standard-book-premium-link", { full: true });
    }
  });

  await withBrowser({ role: "premium-customer", width: 1280, height: 900 }, async (premium) => {
    await premium.goto(`/workers/${PREMIUM_PRO}`, 3000);
    await premium.waitFor("Day-of event coordination", 40_000);
    step("a premium customer sees the premium service", await has(premium, PREMIUM_GIG));
  });

  // An admin grants the standard customer access, the customer sees the
  // tier, the admin takes it away again — left exactly as it was found.
  const admin = await openBrowser({ role: "admin", width: 1280, height: 900 });
  const standard = await openBrowser({ role: "customer", width: 1280, height: 900 });
  try {
    await admin.goto("/admin/promote?q=test.customer", 3000);
    await admin.waitFor("Grant premium access", 40_000);
    await admin.shot("05-b2-admin-promote", { full: true });
    await admin.click("Grant premium access", { wait: 300 });
    step("admin grants premium access", (await admin.waitForAny(["Premium granted"], 20_000)) !== null);

    await standard.goto(`/workers/${PREMIUM_PRO}`, 3000);
    await standard.waitFor("Day-of event coordination", 40_000);
    step("the customer now sees the premium service", await has(standard, PREMIUM_GIG));

    await admin.goto("/admin/promote?q=test.customer", 3000);
    await admin.waitFor("Revoke", 40_000);
    await sleep(1000);
    // The search result row, not the "who holds what" list further down.
    await admin.click("Revoke", { exact: true, wait: 300 });
    step("admin revokes it", (await admin.waitForAny(["Premium removed"], 20_000)) !== null, `dialogs: ${JSON.stringify(admin.dialogs)}`);

    await standard.goto(`/workers/${PREMIUM_PRO}`, 3000);
    await standard.waitFor("Day-of event coordination", 40_000);
    step("the premium service disappears again", !(await has(standard, PREMIUM_GIG)));
  } catch (error) {
    console.log(`stopped: ${error.message}`);
    await admin.shot("05-stopped-admin", { full: true });
  } finally {
    await admin.close();
    await standard.close();
  }
}

// ============================================================================
// C. Role boundaries
// ============================================================================
if (!only || only === "roles") {
  console.log("\n— role boundaries —");
  const visits = [
    // [persona, path it asks for, where it must end up, what that proves]
    ["customer", "/admin", "/dashboard", "a customer is turned away from admin"],
    ["customer", "/safety", "/dashboard", "a customer is turned away from the safety desk"],
    ["worker", "/admin", "/worker", "a professional is turned away from admin"],
    ["driver", "/admin", "/driver", "a driver is turned away from admin"],
    ["monitor", "/admin", "/safety", "a safety monitor gets the safety desk and nothing else"],
    ["support", "/admin/promote", "/admin", "desk support cannot reach Promote"],
    ["support", "/safety", "/safety", "desk support can work the safety desk"],
    ["supervisor", "/admin/verifications", "/admin/verifications", "a supervisor can reach ID verifications"],
    ["admin", "/admin/promote", "/admin/promote", "an admin can reach Promote"],
    ["admin", "/admin/payments", "/admin/payments", "an admin can reach payments"],
  ];
  const browsers = new Map();
  try {
    for (const [role, asked, expected, proves] of visits) {
      if (!browsers.has(role)) browsers.set(role, await openBrowser({ role, width: 1280, height: 900 }));
      const browser = browsers.get(role);
      await browser.goto(asked, 3000);
      // Let any redirect (and a first compile) settle.
      let landed = await browser.path();
      for (let i = 0; i < 40; i++) {
        await sleep(500);
        const next = await browser.path();
        const body = (await browser.text()) ?? "";
        if (next === landed && body.trim().length > 60) break;
        landed = next;
      }
      landed = (await browser.path()).split("?")[0];
      const ok = expected === "/admin" ? landed === "/admin" : landed.startsWith(expected);
      step(proves, ok, `${role}: ${asked} → ${landed}`);
    }
  } finally {
    for (const browser of browsers.values()) await browser.close();
  }
}

const failed = steps.filter((s) => !s.ok);
console.log(
  failed.length === 0
    ? `\nAll ${steps.length} steps passed.`
    : `\n${failed.length} of ${steps.length} steps failed: ${failed.map((s) => s.name).join("; ")}`
);
process.exitCode = failed.length === 0 ? 0 : 1;
