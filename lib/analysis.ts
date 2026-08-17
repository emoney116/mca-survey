import { GOALS } from "@/lib/goals";
import type { GoalSummary, SurveyAnalysis, SurveyResponse } from "@/lib/types";

export function buildAnalysis(responses: SurveyResponse[]): SurveyAnalysis {
  const totalResponses = responses.length;
  const lastResponseAt =
    responses
      .map((response) => response.createdAt)
      .sort((a, b) => new Date(b).getTime() - new Date(a).getTime())[0] ?? null;

  const summaries = GOALS.map((goal) => {
    const ranks = responses
      .map((response) => response.rankings.find((ranking) => ranking.goalKey === goal.key)?.rank)
      .filter((rank): rank is number => typeof rank === "number");
    const totalRank = ranks.reduce((sum, rank) => sum + rank, 0);
    const firstVotes = ranks.filter((rank) => rank === 1).length;
    const top3Votes = ranks.filter((rank) => rank <= 3).length;
    const bottom3Votes = ranks.filter((rank) => rank >= 8).length;
    const averageRank = ranks.length > 0 ? totalRank / ranks.length : 0;

    return {
      goalKey: goal.key,
      goalLabel: goal.label,
      shortLabel: goal.shortLabel,
      teamRank: 0,
      averageRank,
      firstVotes,
      top3Votes,
      top3Percent: totalResponses > 0 ? Math.round((top3Votes / totalResponses) * 100) : 0,
      bottom3Votes,
    };
  })
    .sort((a, b) => {
      if (a.averageRank !== b.averageRank) {
        if (a.averageRank === 0) {
          return 1;
        }

        if (b.averageRank === 0) {
          return -1;
        }

        return a.averageRank - b.averageRank;
      }

      if (a.top3Votes !== b.top3Votes) {
        return b.top3Votes - a.top3Votes;
      }

      return b.firstVotes - a.firstVotes;
    })
    .map((summary, index) => ({
      ...summary,
      teamRank: index + 1,
    }));

  const mostCommonNumberOne = [...summaries].sort((a, b) => b.firstVotes - a.firstVotes)[0] ?? null;
  const mostCommonTopThree = [...summaries].sort((a, b) => b.top3Votes - a.top3Votes)[0] ?? null;

  return {
    totalResponses,
    lastResponseAt,
    topTeamPriority: totalResponses > 0 ? summaries[0] : null,
    mostCommonNumberOne:
      totalResponses > 0 && mostCommonNumberOne?.firstVotes ? mostCommonNumberOne : null,
    mostCommonTopThree:
      totalResponses > 0 && mostCommonTopThree?.top3Votes ? mostCommonTopThree : null,
    summaries,
  };
}
