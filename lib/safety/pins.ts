import { randomBytes, randomInt, scrypt as scryptCb, timingSafeEqual } from "crypto";
import { promisify } from "util";

const scrypt = promisify(scryptCb) as (
  password: string,
  salt: string,
  keylen: number
) => Promise<Buffer>;

// PIN handling, kept in one place so no caller can accidentally reintroduce a
// naive `===` comparison.

// Constant-time comparison of two short secrets. A plain `===` on a PIN leaks
// how many leading digits matched through timing; with only 10,000 possible
// values that is a meaningful head start. timingSafeEqual needs equal lengths,
// so mismatched lengths short-circuit to false BEFORE the compare (length is
// not secret — it is always 4).
export function pinsMatch(a: string | null, b: string | null): boolean {
  if (!a || !b) return false;
  const bufA = Buffer.from(a, "utf8");
  const bufB = Buffer.from(b, "utf8");
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

// 4-digit PIN from a CSPRNG (never Math.random — a predictable safety PIN is
// no safety PIN).
export function generatePin(): string {
  return String(randomInt(0, 10000)).padStart(4, "0");
}

// A second PIN for the same booking that is guaranteed to differ from the
// first — a duress PIN equal to the real one would be silently useless.
export function generateDistinctPin(other: string): string {
  let pin = generatePin();
  while (pin === other) pin = generatePin();
  return pin;
}

// The worker's SOS-cancel code is stored hashed: a plaintext code in the
// database would let anyone with read access silence a live alarm. Salted
// scrypt, because a bare hash of a 4-digit code is a 10,000-entry lookup.
export async function hashPin(pin: string): Promise<string> {
  const salt = randomBytes(16).toString("hex");
  const derived = await scrypt(pin, salt, 32);
  return `${salt}:${derived.toString("hex")}`;
}

export async function verifyPinHash(
  pin: string,
  stored: string | null
): Promise<boolean> {
  if (!stored) return false;
  const [salt, hex] = stored.split(":");
  if (!salt || !hex) return false;
  const derived = await scrypt(pin, salt, 32);
  const expected = Buffer.from(hex, "hex");
  if (expected.length !== derived.length) return false;
  return timingSafeEqual(derived, expected);
}
