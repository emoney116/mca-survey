"use client";

import { Check, Loader2 } from "lucide-react";
import { FormEvent, useMemo, useState } from "react";
import { GOAL_KEYS, getGoalByKey, type GoalKey } from "@/lib/goals";
import { MetrolinaLogo } from "@/components/MetrolinaLogo";
import { RankingList } from "@/components/RankingList";

type SavedResponseHandle = {
  responseId: string;
  editToken: string;
};

type SubmitState = "idle" | "submitting" | "success" | "error";

function buildRankings(order: GoalKey[]) {
  return order.map((goalKey, index) => {
    const goal = getGoalByKey(goalKey);

    return {
      goalKey,
      goalLabel: goal?.label ?? goalKey,
      rank: index + 1,
    };
  });
}

export function SurveyPage() {
  const [playerName, setPlayerName] = useState("");
  const [personalGoal, setPersonalGoal] = useState("");
  const [additionalNotes, setAdditionalNotes] = useState("");
  const [order, setOrder] = useState<GoalKey[]>([...GOAL_KEYS]);
  const [submitState, setSubmitState] = useState<SubmitState>("idle");
  const [message, setMessage] = useState("");
  const [savedResponse, setSavedResponse] = useState<SavedResponseHandle | null>(null);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [confirmationWasEdit, setConfirmationWasEdit] = useState(false);

  const rankings = useMemo(() => buildRankings(order), [order]);
  const isSubmitting = submitState === "submitting";
  const isEditing = Boolean(savedResponse);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (isSubmitting) {
      return;
    }

    if (!playerName.trim()) {
      setSubmitState("error");
      setMessage("Enter your name before submitting.");
      return;
    }

    if (rankings.length !== GOAL_KEYS.length) {
      setSubmitState("error");
      setMessage("Rank all 10 goals before submitting.");
      return;
    }

    setSubmitState("submitting");
    setMessage("");

    const wasEditing = Boolean(savedResponse);
    const body = {
      playerName,
      personalGoal,
      additionalNotes,
      rankings,
      editToken: savedResponse?.editToken,
    };
    const endpoint = savedResponse ? `/api/responses/${savedResponse.responseId}` : "/api/responses";
    const method = savedResponse ? "PATCH" : "POST";

    try {
      const response = await fetch(endpoint, {
        method,
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });
      const result = (await response.json()) as {
        responseId?: string;
        editToken?: string;
        error?: string;
      };

      if (!response.ok || !result.responseId || !result.editToken) {
        throw new Error(result.error ?? "Submission failed.");
      }

      setSavedResponse({
        responseId: result.responseId,
        editToken: result.editToken,
      });
      setConfirmationWasEdit(wasEditing);
      setSubmitState("success");
      setShowConfirmation(true);
    } catch (error) {
      setSubmitState("error");
      setMessage(error instanceof Error ? error.message : "Submission failed.");
    }
  }

  if (showConfirmation) {
    return (
      <main className="confirmation-shell">
        <section className="confirmation-card" aria-live="polite">
          <MetrolinaLogo className="confirmation-logo" priority />
          <div className="success-mark" aria-hidden="true">
            <Check size={42} strokeWidth={3} />
          </div>
          <h1>{confirmationWasEdit ? "Survey Updated" : "Survey Submitted"}</h1>
          <p>Thanks. Your coaches have received your goals.</p>
          <button
            type="button"
            className="quiet-button"
            onClick={() => {
              setShowConfirmation(false);
              setSubmitState("idle");
              setMessage("");
            }}
          >
            Edit My Response
          </button>
        </section>
      </main>
    );
  }

  return (
    <main className="survey-shell">
      <form className="survey-panel" onSubmit={handleSubmit}>
        <header className="survey-header">
          <MetrolinaLogo className="survey-logo" priority />
          <div>
            <p className="eyebrow">Metrolina Baseball</p>
            <h1>Fall 2026 Development Survey</h1>
            <p className="intro">Rank the areas you want to improve this fall.</p>
          </div>
        </header>

        <section className="form-section">
          <label className="field-label" htmlFor="player-name">
            Player Name
          </label>
          <input
            id="player-name"
            className="text-input"
            type="text"
            autoComplete="name"
            value={playerName}
            onChange={(event) => setPlayerName(event.target.value)}
            placeholder="First and last name"
            required
          />
        </section>

        <section className="form-section ranking-section" aria-labelledby="ranking-heading">
          <div className="ranking-heading">
            <div>
              <h2 id="ranking-heading">Rank Your Goals</h2>
              <p>#1 Highest Priority &middot; #10 Lowest Priority</p>
            </div>
          </div>
          <RankingList order={order} onChange={setOrder} />
        </section>

        <section className="form-section">
          <label className="field-label" htmlFor="personal-goal">
            What is the #1 thing you personally want to accomplish this fall?
          </label>
          <textarea
            id="personal-goal"
            className="text-area"
            value={personalGoal}
            onChange={(event) => setPersonalGoal(event.target.value)}
            rows={3}
            placeholder="Optional"
          />
        </section>

        <section className="form-section">
          <label className="field-label" htmlFor="additional-notes">
            Anything else you'd like the coaching staff to know about your goals?
          </label>
          <textarea
            id="additional-notes"
            className="text-area"
            value={additionalNotes}
            onChange={(event) => setAdditionalNotes(event.target.value)}
            rows={3}
            placeholder="Optional"
          />
        </section>

        <div className="submit-dock">
          {message ? <p className="form-message">{message}</p> : null}
          <button type="submit" className="primary-button" disabled={isSubmitting}>
            {isSubmitting ? (
              <>
                <Loader2 className="spin" size={20} aria-hidden="true" />
                Submitting
              </>
            ) : isEditing ? (
              "Update Survey"
            ) : (
              "Submit Survey"
            )}
          </button>
        </div>
      </form>
    </main>
  );
}
