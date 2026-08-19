import { GOALS } from "@/lib/goals";
import type { SurveyResponse } from "@/lib/types";

function csvCell(value: string | number | null | undefined): string {
  const text = String(value ?? "");
  const escaped = text.replaceAll('"', '""');

  return `"${escaped}"`;
}

export function responsesToCsv(responses: SurveyResponse[]): string {
  const headers = [
    "Player name",
    ...Array.from({ length: 10 }, (_, index) => `Rank ${index + 1}`),
    ...GOALS.map((goal) => `${goal.label} numeric rank`),
    "Personal goal response",
    "Additional notes",
    "Submitted timestamp",
    "Updated timestamp",
    "Hitting Program",
    "Throwing Program",
    "Weight Room Program",
  ];

  const rows = responses.map((response) => {
    const byRank = Array.from({ length: 10 }, (_, index) => {
      const rank = index + 1;
      return response.rankings.find((ranking) => ranking.rank === rank)?.goalLabel ?? "";
    });
    const numericRanks = GOALS.map(
      (goal) => response.rankings.find((ranking) => ranking.goalKey === goal.key)?.rank ?? "",
    );

    return [
      response.playerName,
      ...byRank,
      ...numericRanks,
      response.personalGoal,
      response.additionalNotes,
      response.createdAt,
      response.updatedAt,
      response.hittingProgram,
      response.throwingProgram,
      response.weightRoomProgram,
    ]
      .map(csvCell)
      .join(",");
  });

  return [headers.map(csvCell).join(","), ...rows].join("\r\n");
}
