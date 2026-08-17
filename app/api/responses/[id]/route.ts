import { NextResponse } from "next/server";
import { StorageError, updateResponse } from "@/lib/storage";
import { parseResponsePayload, ValidationError } from "@/lib/validation";

export const runtime = "nodejs";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const payload = await request.json();
    const input = parseResponsePayload(payload);
    const editToken =
      payload && typeof payload === "object" && "editToken" in payload
        ? String((payload as { editToken?: unknown }).editToken ?? "")
        : "";

    const result = await updateResponse(id, editToken, input);

    return NextResponse.json(result);
  } catch (error) {
    const status =
      error instanceof ValidationError || error instanceof StorageError ? error.status : 500;
    const message = error instanceof Error ? error.message : "Unable to update survey.";

    return NextResponse.json({ error: message }, { status });
  }
}
