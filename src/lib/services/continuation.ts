import "server-only";
import { db, type Tx } from "@/lib/db";
import { generateToken, sha256 } from "@/lib/crypto";

/**
 * Continuation tokens prove that a browser may continue a specific
 * registration attempt. They are random 256-bit secrets; only their SHA-256
 * hash is stored. Nothing the client sends (attempt IDs, payment references,
 * URL params, local storage) is ever trusted as proof of payment — the server
 * resolves the token, then checks the attempt's *verified* payment status.
 */
export const SESSION_TOKEN_TTL_MS = 24 * 60 * 60 * 1000;
export const EMAIL_LINK_TTL_MS = 2 * 60 * 60 * 1000;

export async function issueSessionToken(client: Tx | typeof db, attemptId: string, now = new Date()) {
  const raw = generateToken();
  await client.continuationToken.create({
    data: {
      tokenHash: sha256(raw),
      purpose: "SESSION",
      attemptId,
      expiresAt: new Date(now.getTime() + SESSION_TOKEN_TTL_MS),
    },
  });
  return raw;
}

export async function issueEmailLinkToken(client: Tx | typeof db, attemptId: string, now = new Date()) {
  const raw = generateToken();
  await client.continuationToken.create({
    data: {
      tokenHash: sha256(raw),
      purpose: "EMAIL_LINK",
      attemptId,
      expiresAt: new Date(now.getTime() + EMAIL_LINK_TTL_MS),
    },
  });
  return raw;
}

/** Returns the attempt ID a session token is valid for, or null. */
export async function resolveSessionToken(raw: string | undefined | null, now = new Date()) {
  if (!raw || raw.length < 20 || raw.length > 100) return null;
  const token = await db.continuationToken.findUnique({ where: { tokenHash: sha256(raw) } });
  if (!token || token.purpose !== "SESSION" || token.expiresAt <= now) return null;
  return token.attemptId;
}

/**
 * Exchanges a single-use email recovery token for a fresh session token.
 * The update is conditional on `usedAt IS NULL`, so two concurrent clicks
 * cannot both succeed.
 */
export async function consumeEmailLinkToken(raw: string, now = new Date()) {
  if (!raw || raw.length < 20 || raw.length > 100) return null;
  return db.$transaction(async (tx) => {
    const tokenHash = sha256(raw);
    const claimed = await tx.continuationToken.updateMany({
      where: { tokenHash, purpose: "EMAIL_LINK", usedAt: null, expiresAt: { gt: now } },
      data: { usedAt: now },
    });
    if (claimed.count !== 1) return null;
    const token = await tx.continuationToken.findUniqueOrThrow({ where: { tokenHash } });
    const sessionToken = await issueSessionToken(tx, token.attemptId, now);
    return { attemptId: token.attemptId, sessionToken };
  });
}

/** Checks a recovery link without consuming it (for the confirm page). */
export async function peekEmailLinkToken(raw: string, now = new Date()) {
  if (!raw || raw.length < 20 || raw.length > 100) return false;
  const token = await db.continuationToken.findUnique({ where: { tokenHash: sha256(raw) } });
  return Boolean(token && token.purpose === "EMAIL_LINK" && !token.usedAt && token.expiresAt > now);
}
