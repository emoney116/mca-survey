import { NextResponse } from "next/server";
import { createResponse, StorageError } from "@/lib/storage";
import { parseResponsePayload, ValidationError } from "@/lib/validation";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const payload = await request.json();
    const input = parseResponsePayload(payload);
    const result = await createResponse(input);

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    const status =
      error instanceof ValidationError || error instanceof StorageError ? error.status : 500;
    const message = error instanceof Error ? error.message : "Unable to submit survey.";

    return NextResponse.json({ error: message }, { status });
  }
}
