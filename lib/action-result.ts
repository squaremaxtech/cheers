// Uniform return type for all server actions.
export type ActionResult<T = undefined> =
  | { ok: true; data: T }
  | { ok: false; error: string };

export function ok<T>(data: T): ActionResult<T> {
  return { ok: true, data };
}

export function err<T = undefined>(error: string): ActionResult<T> {
  return { ok: false, error };
}

// Standard error messages, kept user-safe (no internals leaked).
export const ERR = {
  unauthorized: "You must be signed in to do that.",
  forbidden: "You do not have permission to do that.",
  badRequest: "Invalid input. Please check the form and try again.",
  notFound: "Not found.",
  server: "Something went wrong. Please try again.",
} as const;
