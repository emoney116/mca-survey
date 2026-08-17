import { createHmac, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";

export const ADMIN_COOKIE = "mca_admin_session";
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 12;

function getSessionSecret(): string | null {
  return process.env.ADMIN_SESSION_SECRET || process.env.ADMIN_PASSWORD || null;
}

export function hasAdminPassword(): boolean {
  return Boolean(process.env.ADMIN_PASSWORD);
}

function digest(value: string, secret: string): string {
  return createHmac("sha256", secret).update(value).digest("hex");
}

function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);

  if (left.length !== right.length) {
    return false;
  }

  return timingSafeEqual(left, right);
}

export function passwordMatches(candidate: string): boolean {
  const configured = process.env.ADMIN_PASSWORD;
  const secret = getSessionSecret();

  if (!configured || !secret) {
    return false;
  }

  return safeEqual(digest(candidate, secret), digest(configured, secret));
}

export function createAdminSession(): string {
  const secret = getSessionSecret();

  if (!secret) {
    throw new Error("Admin session secret is not configured.");
  }

  const issuedAt = Date.now().toString();
  const signature = digest(issuedAt, secret);

  return `${issuedAt}.${signature}`;
}

export function verifyAdminSession(value: string | undefined): boolean {
  const secret = getSessionSecret();

  if (!value || !secret) {
    return false;
  }

  const [issuedAt, signature] = value.split(".");
  const timestamp = Number(issuedAt);

  if (!issuedAt || !signature || !Number.isFinite(timestamp)) {
    return false;
  }

  const age = Date.now() - timestamp;

  if (age < 0 || age > SESSION_MAX_AGE_SECONDS * 1000) {
    return false;
  }

  return safeEqual(signature, digest(issuedAt, secret));
}

export async function isAdminRequest(): Promise<boolean> {
  const cookieStore = await cookies();

  return verifyAdminSession(cookieStore.get(ADMIN_COOKIE)?.value);
}

export function getAdminCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  };
}
