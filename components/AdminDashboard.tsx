"use client";

import QRCode from "qrcode";
import {
  BarChart3,
  Check,
  Copy,
  Download,
  Loader2,
  Lock,
  LogOut,
  QrCode,
  RefreshCw,
  Search,
  Share2,
  Users,
  X,
} from "lucide-react";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { GOALS, getGoalByKey, type GoalKey } from "@/lib/goals";
import type { GoalSummary, SurveyAnalysis, SurveyResponse } from "@/lib/types";
import { MetrolinaLogo } from "@/components/MetrolinaLogo";

type AdminPayload = {
  responses: SurveyResponse[];
  analysis: SurveyAnalysis;
};

type AdminTab = "overview" | "players" | "share";
type AuthState = "checking" | "login" | "authed";

const emptyAnalysis: SurveyAnalysis = {
  totalResponses: 0,
  lastResponseAt: null,
  topTeamPriority: null,
  mostCommonNumberOne: null,
  mostCommonTopThree: null,
  summaries: GOALS.map((goal, index) => ({
    goalKey: goal.key,
    goalLabel: goal.label,
    shortLabel: goal.shortLabel,
    teamRank: index + 1,
    averageRank: 0,
    firstVotes: 0,
    top3Votes: 0,
    top3Percent: 0,
    bottom3Votes: 0,
  })),
};

function formatDateTime(value: string | null): string {
  if (!value) {
    return "No responses yet";
  }

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function formatAverage(value: number): string {
  return value > 0 ? value.toFixed(1) : "-";
}

function topGoal(response: SurveyResponse): GoalKey | "" {
  return response.rankings.find((ranking) => ranking.rank === 1)?.goalKey ?? "";
}

function rankingLabel(response: SurveyResponse, rank: number): string {
  return response.rankings.find((ranking) => ranking.rank === rank)?.goalLabel ?? "";
}

function getSurveyUrl(): string {
  const configured = process.env.NEXT_PUBLIC_SURVEY_URL?.trim();
  const url = configured || `${window.location.origin}/`;

  return url.endsWith("/") ? url : `${url}/`;
}

function MetricCard({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail?: string;
}) {
  return (
    <div className="metric-card">
      <span>{label}</span>
      <strong>{value}</strong>
      {detail ? <small>{detail}</small> : null}
    </div>
  );
}

function PriorityChart({ summaries, totalResponses }: { summaries: GoalSummary[]; totalResponses: number }) {
  return (
    <section className="dashboard-block" aria-labelledby="priority-chart">
      <div className="block-heading">
        <BarChart3 size={20} aria-hidden="true" />
        <h2 id="priority-chart">Team Priority Ranking</h2>
      </div>
      <div className="bar-list">
        {summaries.map((summary) => {
          const width =
            totalResponses > 0 ? Math.max(8, Math.round(((11 - summary.averageRank) / 10) * 100)) : 0;

          return (
            <div className="bar-row" key={summary.goalKey}>
              <div className="bar-label">
                <span>{summary.teamRank}</span>
                <strong>{summary.shortLabel}</strong>
              </div>
              <div className="bar-track" aria-hidden="true">
                <div className="bar-fill" style={{ width: `${width}%` }} />
              </div>
              <span className="bar-value">Avg {formatAverage(summary.averageRank)}</span>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function VoteChart({
  title,
  summaries,
  metric,
}: {
  title: string;
  summaries: GoalSummary[];
  metric: "firstVotes" | "top3Votes";
}) {
  const max = Math.max(1, ...summaries.map((summary) => summary[metric]));

  return (
    <section className="dashboard-block compact-chart" aria-labelledby={title.replaceAll(" ", "-")}>
      <div className="block-heading">
        <h2 id={title.replaceAll(" ", "-")}>{title}</h2>
      </div>
      <div className="mini-bars">
        {summaries.map((summary) => {
          const value = summary[metric];
          const width = value > 0 ? Math.max(7, Math.round((value / max) * 100)) : 0;

          return (
            <div className="mini-bar-row" key={summary.goalKey}>
              <span>{summary.shortLabel}</span>
              <div className="mini-track" aria-hidden="true">
                <div className="mini-fill" style={{ width: `${width}%` }} />
              </div>
              <strong>{metric === "top3Votes" ? `${summary.top3Percent}%` : value}</strong>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function GoalTable({ summaries }: { summaries: GoalSummary[] }) {
  return (
    <section className="dashboard-block" aria-labelledby="team-analysis">
      <div className="block-heading">
        <h2 id="team-analysis">Team Goal Analysis</h2>
      </div>
      <div className="table-wrap">
        <table className="analysis-table">
          <thead>
            <tr>
              <th>Team Rank</th>
              <th>Goal</th>
              <th>Avg Rank</th>
              <th>#1 Votes</th>
              <th>Top 3</th>
              <th>Bottom 3</th>
            </tr>
          </thead>
          <tbody>
            {summaries.map((summary) => (
              <tr key={summary.goalKey}>
                <td>{summary.teamRank}</td>
                <td>{summary.goalLabel}</td>
                <td>{formatAverage(summary.averageRank)}</td>
                <td>{summary.firstVotes}</td>
                <td>
                  {summary.top3Votes} <span className="muted">({summary.top3Percent}%)</span>
                </td>
                <td>{summary.bottom3Votes}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function SharePanel() {
  const [surveyUrl, setSurveyUrl] = useState("");
  const [qrDataUrl, setQrDataUrl] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setSurveyUrl(getSurveyUrl());
  }, []);

  useEffect(() => {
    if (!surveyUrl) {
      return;
    }

    QRCode.toDataURL(surveyUrl, {
      width: 440,
      margin: 2,
      color: {
        dark: "#941f47",
        light: "#ffffff",
      },
    }).then(setQrDataUrl);
  }, [surveyUrl]);

  async function copyLink() {
    await navigator.clipboard.writeText(surveyUrl);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1400);
  }

  function downloadQr() {
    if (!qrDataUrl) {
      return;
    }

    const anchor = document.createElement("a");
    anchor.href = qrDataUrl;
    anchor.download = "metrolina-survey-qr.png";
    anchor.click();
  }

  return (
    <section className="share-card" aria-labelledby="share-survey">
      <div className="share-copy">
        <div className="block-heading">
          <Share2 size={20} aria-hidden="true" />
          <h2 id="share-survey">Share Survey</h2>
        </div>
        <div className="link-box">
          <span>{surveyUrl || "Loading link..."}</span>
          <button type="button" className="secondary-icon-button" onClick={copyLink} disabled={!surveyUrl}>
            {copied ? <Check size={18} aria-hidden="true" /> : <Copy size={18} aria-hidden="true" />}
            {copied ? "Copied" : "Copy Link"}
          </button>
        </div>
        <button type="button" className="secondary-button" onClick={downloadQr} disabled={!qrDataUrl}>
          <Download size={18} aria-hidden="true" />
          Download QR Code
        </button>
      </div>
      <div className="qr-frame">
        {qrDataUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={qrDataUrl} alt="QR code for the Metrolina survey link" />
        ) : (
          <QrCode size={88} aria-hidden="true" />
        )}
      </div>
    </section>
  );
}

function EmptyState() {
  return (
    <div className="empty-state">
      <h2>No responses yet</h2>
      <p>Share the survey link with your players and responses will appear here automatically.</p>
      <SharePanel />
    </div>
  );
}

function PlayerDetail({
  response,
  onClose,
}: {
  response: SurveyResponse;
  onClose: () => void;
}) {
  return (
    <div className="modal-backdrop" role="presentation" onClick={onClose}>
      <section className="player-detail" role="dialog" aria-modal="true" onClick={(event) => event.stopPropagation()}>
        <button type="button" className="close-button" onClick={onClose} aria-label="Close player response">
          <X size={20} aria-hidden="true" />
        </button>
        <div className="detail-header">
          <span>Player Response</span>
          <h2>{response.playerName}</h2>
          <p>{formatDateTime(response.createdAt)}</p>
        </div>
        <ol className="detail-ranking">
          {response.rankings.map((ranking) => (
            <li key={ranking.goalKey}>
              <span>{ranking.rank}</span>
              {ranking.goalLabel}
            </li>
          ))}
        </ol>
        <div className="written-responses">
          <div>
            <span>Personal Goal</span>
            <p>{response.personalGoal || "No response"}</p>
          </div>
          <div>
            <span>Additional Notes</span>
            <p>{response.additionalNotes || "No response"}</p>
          </div>
        </div>
      </section>
    </div>
  );
}

function PlayersPanel({ responses }: { responses: SurveyResponse[] }) {
  const [query, setQuery] = useState("");
  const [goalFilter, setGoalFilter] = useState<GoalKey | "all">("all");
  const [selected, setSelected] = useState<SurveyResponse | null>(null);

  const filtered = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return responses.filter((response) => {
      const matchesName =
        !normalizedQuery || response.playerName.toLowerCase().includes(normalizedQuery);
      const matchesGoal = goalFilter === "all" || topGoal(response) === goalFilter;

      return matchesName && matchesGoal;
    });
  }, [goalFilter, query, responses]);

  return (
    <section className="players-panel">
      <div className="player-filters">
        <label className="search-field">
          <Search size={18} aria-hidden="true" />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search players"
          />
        </label>
        <label className="select-field">
          <span>#1 Priority</span>
          <select
            value={goalFilter}
            onChange={(event) => setGoalFilter(event.target.value as GoalKey | "all")}
          >
            <option value="all">All goals</option>
            {GOALS.map((goal) => (
              <option key={goal.key} value={goal.key}>
                {goal.label}
              </option>
            ))}
          </select>
        </label>
      </div>
      {filtered.length === 0 ? (
        <div className="small-empty">No players match that filter.</div>
      ) : (
        <div className="player-list">
          {filtered.map((response) => {
            const firstGoal = getGoalByKey(topGoal(response));

            return (
              <button
                type="button"
                className="player-card"
                key={response.id}
                onClick={() => setSelected(response)}
              >
                <span>{response.playerName}</span>
                <strong>{firstGoal?.label ?? "No #1 ranking"}</strong>
                <ol>
                  {Array.from({ length: 4 }, (_, index) => index + 1).map((rank) => (
                    <li key={rank}>
                      {rank}. {rankingLabel(response, rank)}
                    </li>
                  ))}
                </ol>
              </button>
            );
          })}
        </div>
      )}
      {selected ? <PlayerDetail response={selected} onClose={() => setSelected(null)} /> : null}
    </section>
  );
}

function LoginPanel({
  onLogin,
  error,
  isSubmitting,
}: {
  onLogin: (password: string) => void;
  error: string;
  isSubmitting: boolean;
}) {
  const [password, setPassword] = useState("");

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onLogin(password);
  }

  return (
    <main className="admin-login-shell">
      <form className="admin-login-card" onSubmit={handleSubmit}>
        <MetrolinaLogo className="admin-login-logo" priority />
        <div className="login-title">
          <Lock size={22} aria-hidden="true" />
          <h1>Coach Dashboard</h1>
        </div>
        <input
          className="text-input"
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          placeholder="Admin password"
          autoComplete="current-password"
          required
        />
        {error ? <p className="form-message">{error}</p> : null}
        <button type="submit" className="primary-button" disabled={isSubmitting}>
          {isSubmitting ? (
            <>
              <Loader2 className="spin" size={20} aria-hidden="true" />
              Signing In
            </>
          ) : (
            "Sign In"
          )}
        </button>
      </form>
    </main>
  );
}

export function AdminDashboard() {
  const [authState, setAuthState] = useState<AuthState>("checking");
  const [activeTab, setActiveTab] = useState<AdminTab>("overview");
  const [data, setData] = useState<AdminPayload>({
    responses: [],
    analysis: emptyAnalysis,
  });
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  async function loadData(silent = false) {
    if (!silent) {
      setIsLoading(true);
    }

    try {
      const response = await fetch("/api/admin/responses", {
        cache: "no-store",
      });

      if (response.status === 401) {
        setAuthState("login");
        setIsLoading(false);
        return;
      }

      const payload = (await response.json()) as AdminPayload & { error?: string };

      if (!response.ok) {
        throw new Error(payload.error ?? "Unable to load dashboard.");
      }

      setData({
        responses: payload.responses,
        analysis: payload.analysis,
      });
      setAuthState("authed");
      setLastUpdated(new Date());
      setError("");
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load dashboard.");
    } finally {
      setIsLoading(false);
    }
  }

  async function handleLogin(password: string) {
    setIsLoggingIn(true);
    setError("");

    try {
      const response = await fetch("/api/admin/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ password }),
      });
      const payload = (await response.json()) as { error?: string };

      if (!response.ok) {
        throw new Error(payload.error ?? "Unable to sign in.");
      }

      await loadData();
    } catch (loginError) {
      setError(loginError instanceof Error ? loginError.message : "Unable to sign in.");
    } finally {
      setIsLoggingIn(false);
    }
  }

  async function handleLogout() {
    await fetch("/api/admin/logout", { method: "POST" });
    setAuthState("login");
    setData({ responses: [], analysis: emptyAnalysis });
  }

  async function handleExport() {
    try {
      const response = await fetch("/api/admin/export", {
        cache: "no-store",
      });

      if (!response.ok) {
        const payload = (await response.json()) as { error?: string };
        throw new Error(payload.error ?? "Unable to export CSV.");
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = "metrolina-fall-development-survey.csv";
      anchor.click();
      URL.revokeObjectURL(url);
    } catch (exportError) {
      setError(exportError instanceof Error ? exportError.message : "Unable to export CSV.");
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (authState !== "authed") {
      return;
    }

    const timer = window.setInterval(() => {
      loadData(true);
    }, 6000);

    return () => window.clearInterval(timer);
  }, [authState]);

  if (authState === "checking" && isLoading) {
    return (
      <main className="admin-loading">
        <Loader2 className="spin" size={26} aria-hidden="true" />
      </main>
    );
  }

  if (authState !== "authed") {
    return <LoginPanel onLogin={handleLogin} error={error} isSubmitting={isLoggingIn} />;
  }

  const { analysis, responses } = data;
  const hasResponses = responses.length > 0;

  return (
    <main className="admin-shell">
      <header className="admin-header">
        <div className="admin-brand">
          <MetrolinaLogo className="admin-logo" priority />
          <div>
            <span>Fall Development Survey</span>
            <h1>Coach Results</h1>
          </div>
        </div>
        <div className="admin-actions">
          <button type="button" className="secondary-icon-button" onClick={() => loadData()}>
            <RefreshCw size={18} aria-hidden="true" />
            Refresh
          </button>
          <button type="button" className="secondary-icon-button" onClick={handleExport}>
            <Download size={18} aria-hidden="true" />
            Export CSV
          </button>
          <button
            type="button"
            className="icon-only-button"
            onClick={handleLogout}
            aria-label="Sign out"
            title="Sign out"
          >
            <LogOut size={19} aria-hidden="true" />
          </button>
        </div>
      </header>

      <nav className="tabs" aria-label="Dashboard sections">
        {(["overview", "players", "share"] as AdminTab[]).map((tab) => (
          <button
            type="button"
            key={tab}
            className={activeTab === tab ? "is-active" : ""}
            onClick={() => setActiveTab(tab)}
          >
            {tab === "overview" ? "Overview" : tab === "players" ? "Players" : "Share"}
          </button>
        ))}
      </nav>

      {error ? <div className="admin-error">{error}</div> : null}

      {activeTab === "overview" ? (
        <div className="dashboard-grid">
          <section className="metrics-grid" aria-label="Survey summary">
            <MetricCard label="Responses" value={`${analysis.totalResponses}`} detail="Total submitted" />
            <MetricCard
              label="Top Team Priority"
              value={analysis.topTeamPriority?.goalLabel ?? "No responses"}
              detail="Lowest average rank"
            />
            <MetricCard
              label="Most Common #1"
              value={analysis.mostCommonNumberOne?.goalLabel ?? "No responses"}
              detail={
                analysis.mostCommonNumberOne
                  ? `${analysis.mostCommonNumberOne.firstVotes} first-place votes`
                  : undefined
              }
            />
            <MetricCard
              label="Last Response"
              value={formatDateTime(analysis.lastResponseAt)}
              detail={lastUpdated ? `Updated ${lastUpdated.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}` : undefined}
            />
          </section>

          {!hasResponses ? (
            <EmptyState />
          ) : (
            <>
              <PriorityChart summaries={analysis.summaries} totalResponses={analysis.totalResponses} />
              <div className="chart-pair">
                <VoteChart title="#1 Choices" summaries={analysis.summaries} metric="firstVotes" />
                <VoteChart title="Top-3 Frequency" summaries={analysis.summaries} metric="top3Votes" />
              </div>
              <GoalTable summaries={analysis.summaries} />
            </>
          )}
        </div>
      ) : null}

      {activeTab === "players" ? (
        hasResponses ? (
          <PlayersPanel responses={responses} />
        ) : (
          <EmptyState />
        )
      ) : null}

      {activeTab === "share" ? <SharePanel /> : null}
    </main>
  );
}
