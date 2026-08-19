import type { GoalKey } from "@/lib/goals";

export type Ranking = {
  goalKey: GoalKey;
  goalLabel: string;
  rank: number;
};

export type SurveyResponse = {
  id: string;
  playerName: string;
  hittingProgram: string;
  throwingProgram: string;
  weightRoomProgram: string;
  personalGoal: string;
  additionalNotes: string;
  createdAt: string;
  updatedAt: string;
  rankings: Ranking[];
};

export type ResponseInput = {
  playerName: string;
  hittingProgram: string;
  throwingProgram: string;
  weightRoomProgram: string;
  personalGoal: string;
  additionalNotes: string;
  rankings: Ranking[];
};

export type SubmitResult = {
  responseId: string;
  editToken: string;
};

export type GoalSummary = {
  goalKey: GoalKey;
  goalLabel: string;
  shortLabel: string;
  teamRank: number;
  averageRank: number;
  firstVotes: number;
  top3Votes: number;
  top3Percent: number;
  bottom3Votes: number;
};

export type SurveyAnalysis = {
  totalResponses: number;
  lastResponseAt: string | null;
  topTeamPriority: GoalSummary | null;
  mostCommonNumberOne: GoalSummary | null;
  mostCommonTopThree: GoalSummary | null;
  summaries: GoalSummary[];
};
