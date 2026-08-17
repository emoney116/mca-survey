import { promises as fs } from "fs";
import path from "path";
import { randomUUID } from "crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { getGoalByKey } from "@/lib/goals";
import { createEditToken, editTokenMatches, hashEditToken } from "@/lib/edit-token";
import type { ResponseInput, SubmitResult, SurveyResponse } from "@/lib/types";

type DevResponseRecord = SurveyResponse & {
  editTokenHash: string;
};

type SupabaseRankingRow = {
  goal_key: string;
  goal_label: string;
  rank: number;
};

type SupabaseResponseRow = {
  id: string;
  player_name: string;
  personal_goal: string | null;
  additional_notes: string | null;
  created_at: string;
  updated_at: string;
  survey_rankings: SupabaseRankingRow[] | null;
};

export class StorageError extends Error {
  status = 500;
}

export class StorageNotConfiguredError extends StorageError {
  constructor() {
    super("Supabase environment variables are required in production.");
  }
}

export class ResponseNotFoundError extends StorageError {
  status = 404;

  constructor() {
    super("Response not found.");
  }
}

export class EditTokenError extends StorageError {
  status = 403;

  constructor() {
    super("This response cannot be edited from this device.");
  }
}

const devDataPath = path.join(process.cwd(), "data", "dev-responses.json");
let cachedSupabase: SupabaseClient | null = null;
let cachedSurveyId: string | null = null;

function hasSupabaseConfig(): boolean {
  return Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

function useDevStore(): boolean {
  return !hasSupabaseConfig() && process.env.NODE_ENV !== "production";
}

function getSupabase(): SupabaseClient | null {
  if (!hasSupabaseConfig()) {
    return null;
  }

  if (!cachedSupabase) {
    cachedSupabase = createClient(
      process.env.SUPABASE_URL as string,
      process.env.SUPABASE_SERVICE_ROLE_KEY as string,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      },
    );
  }

  return cachedSupabase;
}

async function getActiveSurveyId(supabase: SupabaseClient): Promise<string> {
  if (process.env.SUPABASE_SURVEY_ID) {
    return process.env.SUPABASE_SURVEY_ID;
  }

  if (cachedSurveyId) {
    return cachedSurveyId;
  }

  const { data, error } = await supabase
    .from("surveys")
    .select("id")
    .eq("active", true)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new StorageError(error.message);
  }

  if (data?.id) {
    cachedSurveyId = data.id;
    return data.id;
  }

  const { data: created, error: createError } = await supabase
    .from("surveys")
    .insert({
      title: "Metrolina Baseball Fall Development Survey",
      active: true,
    })
    .select("id")
    .single();

  if (createError || !created?.id) {
    throw new StorageError(createError?.message ?? "Unable to create active survey.");
  }

  cachedSurveyId = created.id;
  return created.id;
}

async function readDevRecords(): Promise<DevResponseRecord[]> {
  try {
    const contents = await fs.readFile(devDataPath, "utf8");
    return JSON.parse(contents) as DevResponseRecord[];
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return [];
    }

    throw error;
  }
}

async function writeDevRecords(records: DevResponseRecord[]): Promise<void> {
  await fs.mkdir(path.dirname(devDataPath), { recursive: true });
  await fs.writeFile(devDataPath, JSON.stringify(records, null, 2), "utf8");
}

function publicResponse(record: DevResponseRecord): SurveyResponse {
  const { editTokenHash: _editTokenHash, ...response } = record;
  return response;
}

function normalizeSupabaseResponse(row: SupabaseResponseRow): SurveyResponse {
  return {
    id: row.id,
    playerName: row.player_name,
    personalGoal: row.personal_goal ?? "",
    additionalNotes: row.additional_notes ?? "",
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    rankings: (row.survey_rankings ?? [])
      .flatMap((ranking) => {
        const goal = getGoalByKey(ranking.goal_key);

        if (!goal) {
          return [];
        }

        return [
          {
            goalKey: goal.key,
            goalLabel: goal.label,
            rank: ranking.rank,
          },
        ];
      })
      .sort((a, b) => a.rank - b.rank),
  };
}

function ensureStorageAvailable(): SupabaseClient | "dev" {
  const supabase = getSupabase();

  if (supabase) {
    return supabase;
  }

  if (useDevStore()) {
    return "dev";
  }

  throw new StorageNotConfiguredError();
}

export async function listResponses(): Promise<SurveyResponse[]> {
  const storage = ensureStorageAvailable();

  if (storage === "dev") {
    const records = await readDevRecords();
    return records
      .map(publicResponse)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  const surveyId = await getActiveSurveyId(storage);
  const { data, error } = await storage
    .from("survey_responses")
    .select(
      "id, player_name, personal_goal, additional_notes, created_at, updated_at, survey_rankings(goal_key, goal_label, rank)",
    )
    .eq("survey_id", surveyId)
    .order("created_at", { ascending: false });

  if (error) {
    throw new StorageError(error.message);
  }

  return ((data ?? []) as SupabaseResponseRow[]).map(normalizeSupabaseResponse);
}

export async function deleteAllResponses(): Promise<number> {
  const storage = ensureStorageAvailable();

  if (storage === "dev") {
    const records = await readDevRecords();
    await writeDevRecords([]);
    return records.length;
  }

  const surveyId = await getActiveSurveyId(storage);
  const { count, error } = await storage
    .from("survey_responses")
    .delete({ count: "exact" })
    .eq("survey_id", surveyId);

  if (error) {
    throw new StorageError(error.message);
  }

  return count ?? 0;
}

export async function deleteResponse(responseId: string): Promise<void> {
  const storage = ensureStorageAvailable();

  if (storage === "dev") {
    const records = await readDevRecords();
    const nextRecords = records.filter((record) => record.id !== responseId);

    if (nextRecords.length === records.length) {
      throw new ResponseNotFoundError();
    }

    await writeDevRecords(nextRecords);
    return;
  }

  const surveyId = await getActiveSurveyId(storage);
  const { count, error } = await storage
    .from("survey_responses")
    .delete({ count: "exact" })
    .eq("id", responseId)
    .eq("survey_id", surveyId);

  if (error) {
    throw new StorageError(error.message);
  }

  if (!count) {
    throw new ResponseNotFoundError();
  }
}

export async function createResponse(input: ResponseInput): Promise<SubmitResult> {
  const storage = ensureStorageAvailable();
  const editToken = createEditToken();
  const editTokenHash = hashEditToken(editToken);

  if (storage === "dev") {
    const records = await readDevRecords();
    const now = new Date().toISOString();
    const response: DevResponseRecord = {
      id: randomUUID(),
      playerName: input.playerName,
      personalGoal: input.personalGoal,
      additionalNotes: input.additionalNotes,
      createdAt: now,
      updatedAt: now,
      rankings: input.rankings,
      editTokenHash,
    };

    records.push(response);
    await writeDevRecords(records);

    return {
      responseId: response.id,
      editToken,
    };
  }

  const surveyId = await getActiveSurveyId(storage);
  const { data: response, error } = await storage
    .from("survey_responses")
    .insert({
      survey_id: surveyId,
      player_name: input.playerName,
      personal_goal: input.personalGoal || null,
      additional_notes: input.additionalNotes || null,
      edit_token_hash: editTokenHash,
    })
    .select("id")
    .single();

  if (error || !response?.id) {
    throw new StorageError(error?.message ?? "Unable to save response.");
  }

  const { error: rankingsError } = await storage.from("survey_rankings").insert(
    input.rankings.map((ranking) => ({
      response_id: response.id,
      goal_key: ranking.goalKey,
      goal_label: ranking.goalLabel,
      rank: ranking.rank,
    })),
  );

  if (rankingsError) {
    await storage.from("survey_responses").delete().eq("id", response.id);
    throw new StorageError(rankingsError.message);
  }

  return {
    responseId: response.id,
    editToken,
  };
}

export async function updateResponse(
  responseId: string,
  editToken: string,
  input: ResponseInput,
): Promise<SubmitResult> {
  const storage = ensureStorageAvailable();
  const editTokenHash = hashEditToken(editToken);

  if (storage === "dev") {
    const records = await readDevRecords();
    const index = records.findIndex((record) => record.id === responseId);

    if (index === -1) {
      throw new ResponseNotFoundError();
    }

    if (!editTokenMatches(editToken, records[index].editTokenHash)) {
      throw new EditTokenError();
    }

    records[index] = {
      ...records[index],
      playerName: input.playerName,
      personalGoal: input.personalGoal,
      additionalNotes: input.additionalNotes,
      updatedAt: new Date().toISOString(),
      rankings: input.rankings,
    };

    await writeDevRecords(records);

    return {
      responseId,
      editToken,
    };
  }

  const { data: existing, error: existingError } = await storage
    .from("survey_responses")
    .select("id")
    .eq("id", responseId)
    .eq("edit_token_hash", editTokenHash)
    .maybeSingle();

  if (existingError) {
    throw new StorageError(existingError.message);
  }

  if (!existing?.id) {
    throw new EditTokenError();
  }

  const { error: updateError } = await storage
    .from("survey_responses")
    .update({
      player_name: input.playerName,
      personal_goal: input.personalGoal || null,
      additional_notes: input.additionalNotes || null,
    })
    .eq("id", responseId);

  if (updateError) {
    throw new StorageError(updateError.message);
  }

  const { error: deleteError } = await storage
    .from("survey_rankings")
    .delete()
    .eq("response_id", responseId);

  if (deleteError) {
    throw new StorageError(deleteError.message);
  }

  const { error: insertError } = await storage.from("survey_rankings").insert(
    input.rankings.map((ranking) => ({
      response_id: responseId,
      goal_key: ranking.goalKey,
      goal_label: ranking.goalLabel,
      rank: ranking.rank,
    })),
  );

  if (insertError) {
    throw new StorageError(insertError.message);
  }

  return {
    responseId,
    editToken,
  };
}
