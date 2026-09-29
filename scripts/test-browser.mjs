// Sign in as a test account in headless Chrome and look at a screen
// (test mode — see lib/test-mode.ts). Needs a dev server (`npm run test:dev`)
// and `npm run test:seed` done once.
//
// Usage: node scripts/test-browser.mjs <persona|public> [path] [--width=390] [--height=844] [--wait=3500] [--out=name] [--full] [--base=http://localhost:3011]
//   personas: customer, premium-customer, worker, premium-worker, driver,
//             admin, support, supervisor, monitor
//   e.g. node scripts/test-browser.mjs worker /worker/bookings
//        node scripts/test-browser.mjs admin /admin --width=1280 --height=900
// Prints any horizontal overflow and console errors, and saves a screenshot to
// .test-shots/
//
// It can also be imported to script a flow across several signed-in browsers:
//   import { openBrowser } from "./scripts/test-browser.mjs"
//   const pro = await openBrowser({ role: "worker" })
//   await pro.goto("/worker/bookings"); await pro.click("Accept"); await pro.shot("accepted")
import { spawn } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import path from "node:path";
import os from "node:os";

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// The same order Next.js resolves a variable in: the environment, then
// .env.local, then .env. The value is only ever placed in the sign-in URL.
function readEnv(key) {
  if (process.env[key] !== undefined) return process.env[key];
  for (const file of [".env.local", ".env"]) {
    if (!existsSync(file)) continue;
    const match = readFileSync(file, "utf8").match(new RegExp(`^${key}=(.*)$`, "m"));
    if (match !== null) return match[1].trim().replace(/^["']|["']$/g, "");
  }
  return undefined;
}

function findChrome() {
  const candidates = [
    process.env.CHROME_PATH,
    "C:/Program Files/Google/Chrome/Application/chrome.exe",
    "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/usr/bin/google-chrome",
    "/usr/bin/chromium-browser",
  ];
  const found = candidates.find((c) => c !== undefined && existsSync(c));
  if (found === undefined) throw new Error("Chrome not found — set CHROME_PATH");
  return found;
}

export const DEFAULT_BASE_URL =
  process.env.TEST_BASE_URL ?? "http://localhost:3011";

export async function openBrowser({
  role = "public",
  width = 390,
  height = 844,
  baseUrl = DEFAULT_BASE_URL,
} = {}) {
  const isMobile = width < 900;
  const port = 9400 + Math.floor(Math.random() * 500);
  const profile = path.join(os.tmpdir(), `cheers-test-profile-${port}`);
  const chrome = spawn(
    findChrome(),
    [
      `--remote-debugging-port=${port}`,
      `--user-data-dir=${profile}`,
      "--headless=new",
      "--disable-gpu",
      "--no-first-run",
      "--hide-scrollbars",
      "about:blank",
    ],
    { stdio: "ignore" }
  );

  let wsUrl;
  for (let attempt = 0; attempt < 60 && wsUrl === undefined; attempt++) {
    try {
      const targets = await (await fetch(`http://127.0.0.1:${port}/json`)).json();
      wsUrl = targets.find((t) => t.type === "page")?.webSocketDebuggerUrl;
    } catch {
      /* chrome is still starting */
    }
    if (wsUrl === undefined) await sleep(200);
  }
  if (wsUrl === undefined) throw new Error("Chrome did not start");

  const ws = new WebSocket(wsUrl);
  await new Promise((resolve) => ws.addEventListener("open", resolve));

  let nextId = 1;
  const pending = new Map();
  const problems = [];
  const dialogs = [];
  const send = (method, params = {}) =>
    new Promise((resolve) => {
      const id = nextId++;
      pending.set(id, resolve);
      ws.send(JSON.stringify({ id, method, params }));
    });
  ws.addEventListener("message", (event) => {
    const message = JSON.parse(event.data);
    if (message.id !== undefined && pending.has(message.id)) {
      pending.get(message.id)(message);
      pending.delete(message.id);
    }
    if (message.method === "Runtime.consoleAPICalled" && message.params.type === "error") {
      problems.push(
        message.params.args
          .map((arg) => arg.value ?? arg.description ?? "")
          .join(" ")
          .slice(0, 300)
      );
    }
    if (message.method === "Runtime.exceptionThrown") {
      const details = message.params.exceptionDetails;
      problems.push(
        `exception: ${details.exception?.description ?? details.text}`.slice(0, 300)
      );
    }
    // window.confirm guards several actions (cancel, accept a job, delete a
    // gig). A scripted run says yes, and keeps a note of what it agreed to.
    if (message.method === "Page.javascriptDialogOpening") {
      dialogs.push(message.params.message);
      void send("Page.handleJavaScriptDialog", { accept: true });
    }
  });

  await send("Page.enable");
  await send("Runtime.enable");
  await send("Emulation.setDeviceMetricsOverride", {
    width,
    height,
    deviceScaleFactor: isMobile ? 2 : 1,
    mobile: isMobile,
  });
  if (isMobile) {
    await send("Emulation.setTouchEmulationEnabled", { enabled: true });
    await send("Emulation.setUserAgentOverride", {
      userAgent:
        "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
    });
  }
  // The booking room shares position and the safety bar sends heartbeats —
  // give the test browser one in Kingston, and let it be moved.
  await send("Browser.grantPermissions", { permissions: ["geolocation"] });
  await send("Emulation.setGeolocationOverride", {
    latitude: 18.0105,
    longitude: -76.7936,
    accuracy: 10,
  });

  const evaluate = async (expression) =>
    (await send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true }))
      .result?.result?.value;

  // A control is looked up by CSS selector when the text looks like one
  // (#id, .class, [attr], tag[attr]), otherwise by its placeholder.
  const findField = (target) => `(() => {
    const target = ${JSON.stringify(target)}
    const visible = (e) => e.offsetParent !== null
    if (/^([#.\\[]|[a-z]+\\[)/.test(target)) return [...document.querySelectorAll(target)].find(visible)
    const wanted = target.toLowerCase()
    return [...document.querySelectorAll("input, textarea")].find(
      (e) => visible(e) && (e.placeholder ?? "").toLowerCase().includes(wanted)
    )
  })()`;

  const browser = {
    role,
    baseUrl,
    problems,
    dialogs,
    evaluate,
    setLocation: (latitude, longitude) =>
      send("Emulation.setGeolocationOverride", { latitude, longitude, accuracy: 10 }),

    // The first visit signs the persona in through /api/test-login and lands
    // on the path; later visits are plain navigations.
    async goto(pagePath = "/", wait = 3500) {
      let url = `${baseUrl}${pagePath}`;
      if (role !== "public" && browser.signedIn !== true) {
        const secret = readEnv("TEST_MODE_SECRET");
        if (secret === undefined || secret.length < 16) {
          throw new Error("TEST_MODE_SECRET is missing — see lib/test-mode.ts");
        }
        url = `${baseUrl}/api/test-login?as=${role}&secret=${encodeURIComponent(secret)}&to=${encodeURIComponent(pagePath)}`;
        browser.signedIn = true;
      }
      await send("Page.navigate", { url });
      await sleep(wait);
      return browser.path();
    },

    // Where the browser is now. The secret is taken out: when a sign-in is
    // refused the address is still the sign-in URL, and it must not end up in
    // a terminal or a log.
    path: async () =>
      ((await evaluate("location.pathname + location.search + location.hash")) ?? "").replace(
        /([?&]secret=)[^&#]*/,
        "$1***"
      ),

    // Click the first visible, enabled button / link / tab whose text or
    // aria-label contains the label. `exact` matches the whole text instead —
    // "7" on a calendar must not click "17".
    async click(label, { wait = 1500, exact = false, within = "body" } = {}) {
      const clicked = await evaluate(`(() => {
        const wanted = ${JSON.stringify(label)}.toLowerCase()
        const root = document.querySelector(${JSON.stringify(within)}) ?? document.body
        const el = [...root.querySelectorAll("button, a, [role=button], [role=option], label")].find((e) => {
          if (e.offsetParent === null || e.disabled) return false
          const text = (e.textContent ?? "").trim().toLowerCase()
          const aria = (e.getAttribute("aria-label") ?? "").toLowerCase()
          return ${exact} ? text === wanted || aria === wanted : text.includes(wanted) || aria.includes(wanted)
        })
        if (el === undefined) return false
        el.scrollIntoView({ block: "center" })
        el.click()
        return true
      })()`);
      await sleep(wait);
      return clicked;
    },

    // Type into an input found by placeholder or selector, the way React
    // expects (native setter + input event).
    async type(target, text, wait = 300) {
      const typed = await evaluate(`(() => {
        const el = ${findField(target)}
        if (el === undefined) return false
        el.scrollIntoView({ block: "center" })
        el.focus()
        const proto = el.tagName === "TEXTAREA" ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype
        Object.getOwnPropertyDescriptor(proto, "value").set.call(el, ${JSON.stringify(text)})
        el.dispatchEvent(new Event("input", { bubbles: true }))
        el.dispatchEvent(new Event("change", { bubbles: true }))
        return true
      })()`);
      await sleep(wait);
      return typed;
    },

    // Tick a checkbox or radio found by selector, or by the text of its label.
    async check(target, wait = 300) {
      const checked = await evaluate(`(() => {
        const target = ${JSON.stringify(target)}
        let el
        if (/^[#.\\[]/.test(target)) el = document.querySelector(target)
        else {
          const label = [...document.querySelectorAll("label")].find(
            (l) => l.offsetParent !== null && (l.textContent ?? "").toLowerCase().includes(target.toLowerCase())
          )
          el = label?.querySelector("input[type=checkbox], input[type=radio]")
        }
        if (el === undefined || el === null) return false
        el.scrollIntoView({ block: "center" })
        if (!el.checked) el.click()
        return el.checked
      })()`);
      await sleep(wait);
      return checked;
    },

    // Choose from the custom Select (components/ui/Select.tsx): after
    // hydration the id sits on a listbox button and the options are
    // [role=option] rows.
    async select(id, optionText, wait = 500) {
      const opened = await evaluate(`(() => {
        const button = document.querySelector(${JSON.stringify(`button#${id}`)})
        if (button === null) return false
        button.scrollIntoView({ block: "center" })
        button.click()
        return true
      })()`);
      if (!opened) return false;
      await sleep(300);
      const chosen = await evaluate(`(() => {
        const wanted = ${JSON.stringify(optionText)}.toLowerCase()
        const option = [...document.querySelectorAll("[role=option]")].find(
          (o) => (o.textContent ?? "").trim().toLowerCase().includes(wanted)
        )
        if (option === undefined) return false
        option.click()
        return true
      })()`);
      await sleep(wait);
      return chosen;
    },

    text: () => evaluate("document.body.innerText"),

    // Wait for whichever of several texts shows first and say which it was
    // (null on timeout). Toasts are gone in a few seconds, so an action with
    // two possible outcomes has to watch for both at once.
    async waitForAny(fragments, timeout = 10_000) {
      const deadline = Date.now() + timeout;
      while (Date.now() < deadline) {
        const body = ((await evaluate("document.body.innerText")) ?? "").toLowerCase();
        const found = fragments.find((f) => body.includes(f.toLowerCase()));
        if (found !== undefined) return found;
        await sleep(250);
      }
      return null;
    },

    // Wait until the address starts with a prefix, or matches a pattern (a
    // redirect after an action). Generous by default: on a dev server the
    // first visit to a route also compiles it.
    async waitForPath(wanted, timeout = 45_000) {
      const deadline = Date.now() + timeout;
      while (Date.now() < deadline) {
        const current = (await evaluate("location.pathname")) ?? "";
        if (wanted instanceof RegExp ? wanted.test(current) : current.startsWith(wanted)) {
          await sleep(1500);
          return true;
        }
        await sleep(400);
      }
      return false;
    },

    // Wait until the page shows some text (a toast, a status badge).
    async waitFor(fragment, timeout = 10_000) {
      const wanted = fragment.toLowerCase();
      const deadline = Date.now() + timeout;
      while (Date.now() < deadline) {
        const body = (await evaluate("document.body.innerText")) ?? "";
        if (body.toLowerCase().includes(wanted)) return true;
        await sleep(300);
      }
      return false;
    },

    // Elements that stick out past the screen edge (ignores intentional
    // horizontal scrollers and Google Maps internals).
    overflow: () =>
      evaluate(`(() => {
        const out = []
        for (const el of document.querySelectorAll("body *")) {
          const r = el.getBoundingClientRect()
          if (r.width === 0 || r.height === 0 || (r.right <= innerWidth + 1 && r.left >= -1)) continue
          if (el.closest(".gm-style, .pac-container") !== null) continue
          let p = el.parentElement, inScroller = false
          while (p !== null && p !== document.body) {
            const s = getComputedStyle(p)
            if (s.overflowX === "auto" || s.overflowX === "scroll" || s.overflowX === "hidden" || s.overflowX === "clip") { inScroller = true; break }
            p = p.parentElement
          }
          if (!inScroller) out.push(el.tagName.toLowerCase() + "." + String(el.className).slice(0, 60) + " [" + Math.round(r.left) + "-" + Math.round(r.right) + "]")
        }
        return out.slice(0, 10)
      })()`),

    async shot(name, { full = false } = {}) {
      mkdirSync(".test-shots", { recursive: true });
      const file = path.join(".test-shots", `${name}.png`);
      if (full) {
        const tall = await evaluate(
          "Math.min(Math.max(document.documentElement.scrollHeight, document.body.scrollHeight), 7000)"
        );
        await send("Emulation.setDeviceMetricsOverride", {
          width,
          height: Math.max(height, tall),
          deviceScaleFactor: 1,
          mobile: isMobile,
        });
        await sleep(600);
      }
      const capture = await send("Page.captureScreenshot", { format: "png" });
      writeFileSync(file, Buffer.from(capture.result.data, "base64"));
      if (full) {
        await send("Emulation.setDeviceMetricsOverride", {
          width,
          height,
          deviceScaleFactor: isMobile ? 2 : 1,
          mobile: isMobile,
        });
      }
      return file;
    },

    async close() {
      ws.close();
      chrome.kill();
      await sleep(400);
      try {
        rmSync(profile, { recursive: true, force: true });
      } catch {
        /* windows can hold the folder for a moment */
      }
    },
  };

  return browser;
}

// command line use
if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [role = "public", rawPath = "/", ...flags] = process.argv.slice(2);
  // Git Bash on Windows rewrites an argument like /worker into
  // C:/Program Files/Git/worker — undo that.
  const pagePath = rawPath.replace(/^[A-Za-z]:[\\/]Program Files[\\/]Git/i, "");
  const flag = (name, fallback) =>
    flags.find((f) => f.startsWith(`--${name}=`))?.split("=").slice(1).join("=") ?? fallback;

  const browser = await openBrowser({
    role,
    width: Number(flag("width", 390)),
    height: Number(flag("height", 844)),
    baseUrl: flag("base", DEFAULT_BASE_URL),
  });
  try {
    const landed = await browser.goto(pagePath, Number(flag("wait", 3500)));
    const name = flag(
      "out",
      `${role}${pagePath.replace(/[^a-z0-9]+/gi, "-")}`.replace(/-$/, "")
    );
    console.log(`landed on: ${landed}`);
    console.log(`overflow:  ${JSON.stringify(await browser.overflow())}`);
    console.log(`errors:    ${JSON.stringify(browser.problems)}`);
    console.log(`saved:     ${await browser.shot(name, { full: flags.includes("--full") })}`);
  } finally {
    await browser.close();
  }
}
