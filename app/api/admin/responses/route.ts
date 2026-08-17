import { NextResponse } from "next/server";
import { buildAnalysis } from "@/lib/analysis";
import { isAdminRequest } from "@/lib/admin-auth";
import { listResponses, StorageError } from "@/lib/storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  if (!(await isAdminRequest())) {
    return NextResponse.json({ error: "Admin login required." }, { status: 401 });
  }

  try {
    const responses = await listResponses();

    return NextResponse.json(
      {
        responses,
        analysis: buildAnalysis(responses),
      },
      {
        headers: {
          "Cache-Control": "no-store",
        },
      },
    );
  } catch (error) {
    const status = error instanceof StorageError ? error.status : 500;
    const message = error instanceof Error ? error.message : "Unable to load responses.";

    return NextResponse.json({ error: message }, { status });
  }
}
