import { NextResponse } from "next/server";
import { isAdminRequest } from "@/lib/admin-auth";
import { responsesToCsv } from "@/lib/csv";
import { listResponses, StorageError } from "@/lib/storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  if (!(await isAdminRequest())) {
    return NextResponse.json({ error: "Admin login required." }, { status: 401 });
  }

  try {
    const responses = await listResponses();
    const csv = responsesToCsv(responses);

    return new NextResponse(csv, {
      headers: {
        "Cache-Control": "no-store",
        "Content-Disposition": 'attachment; filename="metrolina-fall-development-survey.csv"',
        "Content-Type": "text/csv; charset=utf-8",
      },
    });
  } catch (error) {
    const status = error instanceof StorageError ? error.status : 500;
    const message = error instanceof Error ? error.message : "Unable to export responses.";

    return NextResponse.json({ error: message }, { status });
  }
}
