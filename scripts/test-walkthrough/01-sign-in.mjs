// Signs in as every persona and records where each one lands.
// Usage: node scripts/test-walkthrough/01-sign-in.mjs
import { openBrowser } from "../test-browser.mjs";

const PERSONAS = [
  ["customer", "/dashboard"],
  ["premium-customer", "/dashboard"],
  ["worker", "/worker"],
  ["premium-worker", "/worker"],
  ["driver", "/driver"],
  ["admin", "/admin"],
  ["support", "/admin"],
  ["supervisor", "/admin"],
  ["monitor", "/safety"],
];

let failures = 0;
for (const [role, expected] of PERSONAS) {
  const desktop = role === "admin" || role === "support" || role === "supervisor" || role === "monitor";
  const browser = await openBrowser({
    role,
    width: desktop ? 1280 : 390,
    height: desktop ? 900 : 844,
  });
  try {
    const landed = await browser.goto(expected, 4500);
    const text = (await browser.text()) ?? "";
    const ok = landed.startsWith(expected);
    if (!ok) failures += 1;
    const heading = text.split("\n").map((l) => l.trim()).filter(Boolean).slice(0, 40).join(" | ");
    console.log(`${ok ? "ok  " : "FAIL"} ${role.padEnd(17)} landed on ${landed}`);
    console.log(`     errors: ${JSON.stringify(browser.problems)}`);
    console.log(`     overflow: ${JSON.stringify(await browser.overflow())}`);
    console.log(`     page: ${heading.slice(0, 260)}`);
    await browser.shot(`01-${role}`);
  } finally {
    await browser.close();
  }
}
console.log(failures === 0 ? "\nEvery persona signed in." : `\n${failures} persona(s) failed.`);
process.exitCode = failures === 0 ? 0 : 1;
