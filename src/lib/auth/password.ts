import "server-only";
import { hash, verify } from "@node-rs/argon2";

// OWASP-recommended Argon2id parameters (19 MiB, 2 iterations).
const OPTIONS = { memoryCost: 19456, timeCost: 2, parallelism: 1 } as const;

export function hashPassword(password: string) {
  return hash(password, OPTIONS);
}

export async function verifyPassword(passwordHash: string, password: string) {
  try {
    return await verify(passwordHash, password);
  } catch {
    return false;
  }
}

/** Password policy for admin accounts. */
export function passwordProblems(password: string): string | null {
  if (password.length < 12) return "Password must be at least 12 characters";
  if (password.length > 200) return "Password is too long";
  if (!/[a-zA-Z]/.test(password) || !/\d|[^a-zA-Z]/.test(password)) {
    return "Use a mix of letters and numbers or symbols";
  }
  return null;
}

// Used to keep login timing similar whether or not the account exists.
let dummyHash: Promise<string> | null = null;
export function getDummyHash() {
  dummyHash ??= hashPassword("timing-equaliser-not-a-real-password");
  return dummyHash;
}
