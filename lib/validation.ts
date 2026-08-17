import { GOAL_KEYS, getGoalByKey } from "@/lib/goals";
import type { Ranking, ResponseInput } from "@/lib/types";

export class ValidationError extends Error {
  status = 400;
}

function cleanText(value: unknown, maxLength: number): string {
  if (typeof value !== "string") {
    return "";
  }

  return value.trim().slice(0, maxLength);
}

export function parseResponsePayload(payload: unknown): ResponseInput {
  if (!payload || typeof payload !== "object") {
    throw new ValidationError("Invalid survey response.");
  }

  const body = payload as Record<string, unknown>;
  const playerName = cleanText(body.playerName, 80);
  const personalGoal = cleanText(body.personalGoal, 600);
  const additionalNotes = cleanText(body.additionalNotes, 900);

  if (!playerName) {
    throw new ValidationError("Player name is required.");
  }

  if (!Array.isArray(body.rankings) || body.rankings.length !== GOAL_KEYS.length) {
    throw new ValidationError("Rank all 10 goals before submitting.");
  }

  const seenGoals = new Set<string>();
  const seenRanks = new Set<number>();
  const rankings: Ranking[] = [];

  for (const item of body.rankings) {
    if (!item || typeof item !== "object") {
      throw new ValidationError("Invalid ranking.");
    }

    const ranking = item as Record<string, unknown>;
    const goalKey = typeof ranking.goalKey === "string" ? ranking.goalKey : "";
    const rank = Number(ranking.rank);
    const goal = getGoalByKey(goalKey);

    if (!goal || !Number.isInteger(rank) || rank < 1 || rank > GOAL_KEYS.length) {
      throw new ValidationError("Each goal needs one rank from 1 through 10.");
    }

    if (seenGoals.has(goalKey) || seenRanks.has(rank)) {
      throw new ValidationError("Rankings cannot be duplicated.");
    }

    seenGoals.add(goalKey);
    seenRanks.add(rank);
    rankings.push({
      goalKey: goal.key,
      goalLabel: goal.label,
      rank,
    });
  }

  if (seenGoals.size !== GOAL_KEYS.length || seenRanks.size !== GOAL_KEYS.length) {
    throw new ValidationError("Rank all 10 goals exactly once.");
  }

  return {
    playerName,
    personalGoal,
    additionalNotes,
    rankings: rankings.sort((a, b) => a.rank - b.rank),
  };
}
