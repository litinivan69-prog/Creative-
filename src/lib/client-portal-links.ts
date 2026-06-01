import { createHash, randomBytes } from "node:crypto";

export function generatePortalToken() {
  return randomBytes(32).toString("hex");
}

export function hashPortalToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export function tokenPrefix(token: string) {
  return token.slice(0, 8);
}
