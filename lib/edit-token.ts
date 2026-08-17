import { createHash, randomBytes } from "crypto";

export function createEditToken(): string {
  return randomBytes(24).toString("base64url");
}

export function hashEditToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function editTokenMatches(token: string, hash: string | null | undefined): boolean {
  if (!token || !hash) {
    return false;
  }

  return hashEditToken(token) === hash;
}
