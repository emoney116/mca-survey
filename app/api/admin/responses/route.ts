import { NextResponse } from "next/server";
import { buildAnalysis } from "@/lib/analysis";
import { deleteAllResponses, listResponses, StorageError } from "@/lib/storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
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

export async function DELETE(request: Request) {
  try {
    const body = (await request.json().catch(() => null)) as { confirmation?: string } | null;

    if (body?.confirmation !== "DELETE") {
      return NextResponse.json({ error: "Type DELETE to confirm deletion." }, { status: 400 });
    }

    const deletedCount = await deleteAllResponses();

    return NextResponse.json(
      {
        ok: true,
        deletedCount,
      },
      {
        headers: {
          "Cache-Control": "no-store",
        },
      },
    );
  } catch (error) {
    const status = error instanceof StorageError ? error.status : 500;
    const message = error instanceof Error ? error.message : "Unable to delete submissions.";

    return NextResponse.json({ error: message }, { status });
  }
}
