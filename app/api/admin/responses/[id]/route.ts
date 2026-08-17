import { NextResponse } from "next/server";
import { deleteResponse, StorageError } from "@/lib/storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const body = (await request.json().catch(() => null)) as { confirmation?: string } | null;

    if (body?.confirmation !== "DELETE") {
      return NextResponse.json({ error: "Type DELETE to confirm deletion." }, { status: 400 });
    }

    await deleteResponse(id);

    return NextResponse.json(
      {
        ok: true,
      },
      {
        headers: {
          "Cache-Control": "no-store",
        },
      },
    );
  } catch (error) {
    const status = error instanceof StorageError ? error.status : 500;
    const message = error instanceof Error ? error.message : "Unable to delete submission.";

    return NextResponse.json({ error: message }, { status });
  }
}
