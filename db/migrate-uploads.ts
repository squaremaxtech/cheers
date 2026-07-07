// One-off, idempotent migration to the split uploads/ layout:
//   uploads/users/<userId>/…  — worker profile media
//   uploads/receipts/…        — cash-collection proofs / dispute evidence
// Replaces the old layouts (uploads/<userId>/… and flat uploads/<name>),
// which the app no longer reads.
//
// Two independent halves, both safe to re-run:
//   1. DB: rewrite worker_media.url and payments.cash_proof_url to the new
//      URL shapes (a shared database only needs this once).
//   2. Disk: make sure every referenced file sits at the path its URL now
//      implies — files are found by their UUID basename anywhere under
//      uploads/ and moved into place. Run once per machine that has an
//      uploads/ directory (dev boxes AND the VPS).
// Run with: npm run db:migrate-uploads
import "dotenv/config";
import { existsSync, type Dirent } from "fs";
import { mkdir, readdir, rename } from "fs/promises";
import path from "path";
import {
  RECEIPTS_SUBDIR,
  SAFE_MEDIA_FOLDER,
  UPLOADS_DIR,
  USERS_SUBDIR,
} from "../lib/uploads";
import { pool } from "./index";

// URL prefixes: current and legacy.
const USERS_URL = `/api/media/${USERS_SUBDIR}/`;
const RECEIPTS_URL = `/api/media/${RECEIPTS_SUBDIR}/`;
const LEGACY_PER_USER = /^\/api\/media\/([a-f0-9-]{36})\/([^/]+)$/;
const LEGACY_FLAT = /^\/api\/media\/([^/]+\.[a-z0-9]+)$/;

// basename → absolute path for every file under uploads/. Basenames are
// server-generated UUIDs, so they are unique across the whole tree.
async function indexFiles(dir: string, out: Map<string, string>): Promise<void> {
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return; // no uploads dir on this machine
  }
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) await indexFiles(full, out);
    else out.set(e.name, full);
  }
}

// Move the file with this basename (wherever it currently is) to targetAbs.
async function ensureAt(
  files: Map<string, string>,
  basename: string,
  targetAbs: string
): Promise<"ok" | "missing"> {
  const current = files.get(basename);
  if (current === targetAbs || existsSync(targetAbs)) return "ok";
  if (!current) return "missing";
  await mkdir(path.dirname(targetAbs), { recursive: true });
  await rename(current, targetAbs);
  files.set(basename, targetAbs);
  return "ok";
}

async function main(): Promise<void> {
  const client = await pool.connect();
  try {
    // --- 1. Move whole legacy per-user dirs under users/ ------------------
    // (fs-only fast path; the per-row pass below catches anything left)
    let dirEntries: Dirent[];
    try {
      dirEntries = await readdir(UPLOADS_DIR, { withFileTypes: true });
    } catch {
      dirEntries = [];
    }
    await mkdir(path.join(UPLOADS_DIR, USERS_SUBDIR), { recursive: true });
    for (const e of dirEntries) {
      if (!e.isDirectory() || !SAFE_MEDIA_FOLDER.test(e.name)) continue;
      const from = path.join(UPLOADS_DIR, e.name);
      const to = path.join(UPLOADS_DIR, USERS_SUBDIR, e.name);
      if (existsSync(to)) {
        // target exists from an earlier partial run — merge file by file
        for (const f of await readdir(from)) {
          await rename(path.join(from, f), path.join(to, f));
        }
      } else {
        await rename(from, to);
      }
      console.log(`moved uploads/${e.name} -> uploads/${USERS_SUBDIR}/${e.name}`);
    }

    const files = new Map<string, string>();
    await indexFiles(UPLOADS_DIR, files);

    // --- 2. Worker media: URLs + file placement ---------------------------
    const { rows: media } = await client.query<{
      id: string;
      url: string;
      user_id: string;
    }>(
      `SELECT wm.id, wm.url, w.user_id
       FROM worker_media wm JOIN workers w ON w.id = wm.worker_id
       WHERE wm.url LIKE '/api/media/%'`
    );
    for (const m of media) {
      let owner: string;
      let name: string;
      if (m.url.startsWith(USERS_URL)) {
        const rest = m.url.slice(USERS_URL.length).split("/");
        if (rest.length !== 2) continue;
        [owner, name] = rest;
      } else {
        const perUser = LEGACY_PER_USER.exec(m.url);
        const flat = perUser ? null : LEGACY_FLAT.exec(m.url);
        if (perUser) {
          [, owner, name] = perUser;
        } else if (flat) {
          owner = m.user_id; // flat files belong to the media's worker
          name = flat[1];
        } else {
          continue;
        }
        const newUrl = `${USERS_URL}${owner}/${name}`;
        await client.query(`UPDATE worker_media SET url = $1 WHERE id = $2`, [
          newUrl,
          m.id,
        ]);
        console.log(`worker_media ${m.id}: ${m.url} -> ${newUrl}`);
      }
      const placed = await ensureAt(
        files,
        name,
        path.join(UPLOADS_DIR, USERS_SUBDIR, owner, name)
      );
      if (placed === "missing") {
        console.warn(`worker_media ${m.id}: file ${name} not found on this machine`);
      }
    }

    // --- 3. Cash proofs → receipts/ ----------------------------------------
    const { rows: proofs } = await client.query<{ id: string; url: string }>(
      `SELECT id, cash_proof_url AS url FROM payments
       WHERE cash_proof_url LIKE '/api/media/%'`
    );
    for (const p of proofs) {
      let name: string | null = null;
      if (p.url.startsWith(RECEIPTS_URL)) {
        name = p.url.slice(RECEIPTS_URL.length) || null;
      } else {
        const perUser = LEGACY_PER_USER.exec(p.url);
        const usersMatch = p.url.startsWith(USERS_URL)
          ? p.url.slice(USERS_URL.length).split("/")
          : null;
        const flat = LEGACY_FLAT.exec(p.url);
        if (perUser) name = perUser[2];
        else if (usersMatch && usersMatch.length === 2) name = usersMatch[1];
        else if (flat) name = flat[1];
        if (!name) continue;
        const newUrl = `${RECEIPTS_URL}${name}`;
        await client.query(
          `UPDATE payments SET cash_proof_url = $1 WHERE id = $2`,
          [newUrl, p.id]
        );
        console.log(`payment ${p.id}: ${p.url} -> ${newUrl}`);
      }
      if (!name) continue;
      const placed = await ensureAt(
        files,
        name,
        path.join(UPLOADS_DIR, RECEIPTS_SUBDIR, name)
      );
      if (placed === "missing") {
        console.warn(`payment ${p.id}: proof ${name} not found on this machine`);
      }
    }

    console.log("uploads migration complete");
  } finally {
    client.release();
  }
}

main()
  .catch((error) => {
    console.error(
      "uploads migration failed:",
      error instanceof Error ? error.message : error
    );
    process.exitCode = 1;
  })
  .finally(() => pool.end());
