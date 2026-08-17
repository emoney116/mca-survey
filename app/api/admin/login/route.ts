import { NextResponse } from "next/server";
import {
  ADMIN_COOKIE,
  createAdminSession,
  getAdminCookieOptions,
  hasAdminPassword,
  passwordMatches,
} from "@/lib/admin-auth";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const payload = await request.json().catch(() => null);
  const password =
    payload && typeof payload === "object" && "password" in payload
      ? String((payload as { password?: unknown }).password ?? "")
      : "";

  if (!hasAdminPassword()) {
    return NextResponse.json(
      { error: "Admin password is not configured on this deployment." },
      { status: 500 },
    );
  }

  if (!passwordMatches(password)) {
    return NextResponse.json({ error: "Incorrect password." }, { status: 401 });
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set(ADMIN_COOKIE, createAdminSession(), getAdminCookieOptions());

  return response;
}
