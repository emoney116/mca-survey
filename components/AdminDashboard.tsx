"use client";

import QRCode from "qrcode";
import {
  AlertTriangle,
  BarChart3,
  ChevronRight,
  Check,
  Copy,
  Download,
  Filter,
  Loader2,
  QrCode,
  RefreshCw,
  Search,
  Share2,
  Trash2,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { GOALS, getGoalByKey, type GoalKey } from "@/lib/goals";
import type { GoalSummary, SurveyAnalysis, SurveyResponse } from "@/lib/types";
import { MetrolinaLogo } from "@/components/MetrolinaLogo";

type AdminPayload = {
  responses: SurveyResponse[];
  analysis: SurveyAnalysis;
};

type AdminTab = "overview" | "players" | "share";
type PlayerSort = "name" | "recent" | "priority";

const COMPACT_GOAL_LABELS: Record<GoalKey, string> = {
  "get-stronger": "Get stronger",
  "sprint-speed": "Improve sprint speed",
  agility: "Improve agility",
  "lose-body-fat": "Lose body fat",
  "gain-weight": "Gain weight",
  nutrition: "Improve nutrition",
  "flexibility-mobility": "Improve flexibility & mobility",
  conditioning: "Improve stamina & conditioning",
  "core-strength": "Improve core strength",
  "sleep-schedule": "Improve sleep schedule",
};

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

function formatLastResponse(value: string | null): string {
  if (!value) {
    return "None";
  }

  return new Intl.DateTimeFormat(undefined, {
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function formatSubmittedDate(value: string): string {
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
  }).format(new Date(value));
}

function formatAverage(value: number): string {
  return value > 0 ? value.toFixed(1) : "-";
}

function compactGoalLabel(goalKey: GoalKey | ""): string {
  return goalKey ? COMPACT_GOAL_LABELS[goalKey] : "";
}

function compactSummaryLabel(summary: GoalSummary | null): string {
  return summary ? compactGoalLabel(summary.goalKey) : "No responses";
}

function topGoal(response: SurveyResponse): GoalKey | "" {
  return response.rankings.find((ranking) => ranking.rank === 1)?.goalKey ?? "";
}

function rankingLabel(response: SurveyResponse, rank: number): string {
  const ranking = response.rankings.find((item) => item.rank === rank);

  return ranking ? compactGoalLabel(ranking.goalKey) : "";
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

function TeamPriorities({
  summaries,
  totalResponses,
}: {
  summaries: GoalSummary[];
  totalResponses: number;
}) {
  return (
    <section className="dashboard-block team-priorities" aria-labelledby="team-priorities">
      <div className="block-heading">
        <BarChart3 size={20} aria-hidden="true" />
        <h2 id="team-priorities">Team Priorities</h2>
      </div>
      <p className="priority-note">Lower average rank means stronger team priority.</p>
      <div className="priority-list">
        {summaries.map((summary) => {
          const width =
            totalResponses > 0 ? Math.max(8, Math.round(((11 - summary.averageRank) / 10) * 100)) : 0;

          return (
            <div className="priority-row" key={summary.goalKey}>
              <div className="priority-main">
                <span>{summary.teamRank}</span>
                <strong>{compactGoalLabel(summary.goalKey)}</strong>
              </div>
              <div className="priority-track" aria-hidden="true">
                <div className="priority-fill" style={{ width: `${width}%` }} />
              </div>
              <div className="priority-meta">
                <span>Avg {formatAverage(summary.averageRank)}</span>
                <span>{summary.firstVotes} #1 votes</span>
                <span>{summary.top3Percent}% Top 3</span>
              </div>
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
              <span>{compactGoalLabel(summary.goalKey)}</span>
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
    <details className="dashboard-block detail-stats">
      <summary>Detailed Statistics</summary>
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
                <td>{compactGoalLabel(summary.goalKey)}</td>
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
        <div className="analysis-list">
          {summaries.map((summary) => (
            <div className="analysis-list-row" key={summary.goalKey}>
              <div>
                <span>{summary.teamRank}</span>
                <strong>{compactGoalLabel(summary.goalKey)}</strong>
              </div>
              <p>
                Avg {formatAverage(summary.averageRank)} &middot; {summary.firstVotes} #1 &middot;{" "}
                {summary.top3Votes} Top 3 ({summary.top3Percent}%) &middot;{" "}
                {summary.bottom3Votes} Bottom 3
              </p>
            </div>
          ))}
        </div>
      </div>
    </details>
  );
}

function SharePanel({
  onExport,
  isExporting,
}: {
  onExport: () => void;
  isExporting: boolean;
}) {
  const [surveyUrl, setSurveyUrl] = useState("");
  const [qrDataUrl, setQrDataUrl] = useState("");
  const [copied, setCopied] = useState(false);
  const [canNativeShare, setCanNativeShare] = useState(false);

  useEffect(() => {
    setSurveyUrl(getSurveyUrl());
  }, []);

  useEffect(() => {
    setCanNativeShare(Boolean(navigator.share));
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

  async function nativeShare() {
    if (!navigator.share || !surveyUrl) {
      return;
    }

    try {
      await navigator.share({
        title: "Metrolina Baseball Fall Development Survey",
        text: "Rank your fall development goals.",
        url: surveyUrl,
      });
    } catch {
      // Ignore canceled native share sheets.
    }
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
    <div className="share-tab">
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
          <div className="share-actions-row">
            {canNativeShare ? (
              <button type="button" className="secondary-button" onClick={nativeShare} disabled={!surveyUrl}>
                <Share2 size={18} aria-hidden="true" />
                Share Survey
              </button>
            ) : null}
            <button type="button" className="secondary-button" onClick={downloadQr} disabled={!qrDataUrl}>
              <Download size={18} aria-hidden="true" />
              Download QR Code
            </button>
          </div>
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
      <section className="data-card" aria-labelledby="share-data">
        <div>
          <span>Data</span>
          <h2 id="share-data">CSV Export</h2>
        </div>
        <button type="button" className="secondary-button" onClick={onExport} disabled={isExporting}>
          <Download size={18} aria-hidden="true" />
          {isExporting ? "Exporting" : "Export CSV"}
        </button>
      </section>
    </div>
  );
}

function EmptyState({
  onExport,
  isExporting,
}: {
  onExport: () => void;
  isExporting: boolean;
}) {
  return (
    <div className="empty-state">
      <h2>No responses yet</h2>
      <p>Share the survey link with your players and responses will appear here automatically.</p>
      <SharePanel onExport={onExport} isExporting={isExporting} />
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
  const firstGoal = response.rankings.find((ranking) => ranking.rank === 1);

  return (
    <div className="modal-backdrop" role="presentation" onClick={onClose}>
      <section className="player-detail" role="dialog" aria-modal="true" onClick={(event) => event.stopPropagation()}>
        <button type="button" className="close-button" onClick={onClose} aria-label="Close player response">
          <X size={20} aria-hidden="true" />
        </button>
        <div className="detail-header">
          <h2>{response.playerName}</h2>
          <p>Submitted {formatDateTime(response.createdAt)}</p>
        </div>
        <div className="top-priority-callout">
          <span>#1 Priority</span>
          <strong>{firstGoal ? compactGoalLabel(firstGoal.goalKey) : "No #1 ranking"}</strong>
        </div>
        <ol className="detail-ranking">
          {response.rankings.map((ranking) => (
            <li key={ranking.goalKey} className={ranking.rank <= 3 ? "is-top-three" : ""}>
              <span>{ranking.rank}</span>
              {compactGoalLabel(ranking.goalKey)}
            </li>
          ))}
        </ol>
        <div className="written-responses">
          {response.personalGoal ? (
            <div>
              <span>Personal Goal</span>
              <p>{response.personalGoal}</p>
            </div>
          ) : (
            <p className="quiet-empty">Personal Goal: No response.</p>
          )}
          {response.additionalNotes ? (
            <div>
              <span>Additional Notes</span>
              <p>{response.additionalNotes}</p>
            </div>
          ) : (
            <p className="quiet-empty">Additional Notes: No response.</p>
          )}
        </div>
      </section>
    </div>
  );
}

function PlayersPanel({ responses }: { responses: SurveyResponse[] }) {
  const [query, setQuery] = useState("");
  const [goalFilter, setGoalFilter] = useState<GoalKey | "all">("all");
  const [sortMode, setSortMode] = useState<PlayerSort>("name");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [selected, setSelected] = useState<SurveyResponse | null>(null);

  const filtered = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return responses
      .filter((response) => {
        const matchesName =
          !normalizedQuery || response.playerName.toLowerCase().includes(normalizedQuery);
        const matchesGoal = goalFilter === "all" || topGoal(response) === goalFilter;

        return matchesName && matchesGoal;
      })
      .sort((a, b) => {
        if (sortMode === "recent") {
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        }

        if (sortMode === "priority") {
          return rankingLabel(a, 1).localeCompare(rankingLabel(b, 1));
        }

        return a.playerName.localeCompare(b.playerName);
      });
  }, [goalFilter, query, responses, sortMode]);

  return (
    <section className="players-panel">
      <div className="players-heading">
        <h2>Player Responses</h2>
        <span>{filtered.length} shown</span>
      </div>
      <div className="player-toolbar">
        <label className="search-field">
          <Search size={18} aria-hidden="true" />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search players"
          />
        </label>
        <button
          type="button"
          className={`filter-toggle ${filtersOpen ? "is-active" : ""}`}
          onClick={() => setFiltersOpen((open) => !open)}
          aria-expanded={filtersOpen}
          aria-controls="player-filter-panel"
          aria-label="Filter player responses"
          title="Filter player responses"
        >
          <Filter size={18} aria-hidden="true" />
        </button>
      </div>
      <div id="player-filter-panel" className={`player-filters ${filtersOpen ? "is-open" : ""}`}>
        <label className="select-field">
          <span>Sort</span>
          <select value={sortMode} onChange={(event) => setSortMode(event.target.value as PlayerSort)}>
            <option value="name">Name</option>
            <option value="recent">Most recent</option>
            <option value="priority">#1 priority</option>
          </select>
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
                {compactGoalLabel(goal.key)}
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
                <strong>#1 {firstGoal ? compactGoalLabel(firstGoal.key) : "No #1 ranking"}</strong>
                <small>Submitted {formatSubmittedDate(response.createdAt)}</small>
                <ChevronRight size={20} aria-hidden="true" />
              </button>
            );
          })}
        </div>
      )}
      {selected ? <PlayerDetail response={selected} onClose={() => setSelected(null)} /> : null}
    </section>
  );
}

function DeleteAllDialog({
  onCancel,
  onConfirm,
  isDeleting,
  error,
}: {
  onCancel: () => void;
  onConfirm: () => void;
  isDeleting: boolean;
  error: string;
}) {
  const [confirmation, setConfirmation] = useState("");
  const canDelete = confirmation === "DELETE" && !isDeleting;

  return (
    <div
      className="modal-backdrop delete-backdrop"
      role="presentation"
      onClick={() => {
        if (!isDeleting) {
          onCancel();
        }
      }}
    >
      <section
        className="delete-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="delete-dialog-title"
        aria-describedby="delete-dialog-description"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="delete-dialog-icon">
          <AlertTriangle size={22} aria-hidden="true" />
        </div>
        <div className="delete-dialog-copy">
          <h2 id="delete-dialog-title">Delete all submissions?</h2>
          <p id="delete-dialog-description">
            This will permanently delete every current survey response and all associated rankings.
            This cannot be undone.
          </p>
        </div>
        <label className="delete-confirm-field">
          <span>
            Type <strong>DELETE</strong> to confirm
          </span>
          <input
            value={confirmation}
            onChange={(event) => setConfirmation(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
              }
            }}
            autoCapitalize="characters"
            autoComplete="off"
            autoFocus
            spellCheck={false}
            aria-label="Type DELETE to confirm deletion"
          />
        </label>
        {error ? <p className="delete-error">{error}</p> : null}
        <div className="delete-dialog-actions">
          <button type="button" className="secondary-button" onClick={onCancel} disabled={isDeleting}>
            Cancel
          </button>
          <button type="button" className="danger-button" onClick={onConfirm} disabled={!canDelete}>
            {isDeleting ? "Deleting" : "Delete All Submissions"}
          </button>
        </div>
      </section>
    </div>
  );
}

export function AdminDashboard() {
  const [activeTab, setActiveTab] = useState<AdminTab>("overview");
  const [data, setData] = useState<AdminPayload>({
    responses: [],
    analysis: emptyAnalysis,
  });
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteError, setDeleteError] = useState("");
  const [toast, setToast] = useState("");
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  async function loadData(silent = false) {
    if (!silent) {
      setIsLoading(true);
    }

    try {
      const response = await fetch("/api/admin/responses", {
        cache: "no-store",
      });

      const payload = (await response.json()) as AdminPayload & { error?: string };

      if (!response.ok) {
        throw new Error(payload.error ?? "Unable to load dashboard.");
      }

      setData({
        responses: payload.responses,
        analysis: payload.analysis,
      });
      setLastUpdated(new Date());
      setError("");
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load dashboard.");
    } finally {
      setIsLoading(false);
    }
  }

  async function handleExport() {
    setIsExporting(true);

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
    } finally {
      setIsExporting(false);
    }
  }

  async function handleRefresh() {
    setIsRefreshing(true);
    await loadData(true);
    setIsRefreshing(false);
  }

  async function handleDeleteAllSubmissions() {
    setIsDeleting(true);
    setDeleteError("");

    try {
      const response = await fetch("/api/admin/responses", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ confirmation: "DELETE" }),
      });
      const payload = (await response.json().catch(() => null)) as { error?: string } | null;

      if (!response.ok) {
        throw new Error(payload?.error ?? "Unable to delete submissions.");
      }

      setDeleteDialogOpen(false);
      setToast("All submissions deleted");
      await loadData(true);
      window.setTimeout(() => setToast(""), 2400);
    } catch (deleteAllError) {
      setDeleteError(
        deleteAllError instanceof Error ? deleteAllError.message : "Unable to delete submissions.",
      );
    } finally {
      setIsDeleting(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => {
      loadData(true);
    }, 6000);

    return () => window.clearInterval(timer);
  }, []);

  if (isLoading) {
    return (
      <main className="admin-loading">
        <Loader2 className="spin" size={26} aria-hidden="true" />
      </main>
    );
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
          <button
            type="button"
            className="delete-icon-button"
            onClick={() => {
              setDeleteError("");
              setDeleteDialogOpen(true);
            }}
            aria-label="Delete all submissions"
            title="Delete all submissions"
            disabled={isDeleting}
          >
            <Trash2 size={18} aria-hidden="true" />
          </button>
          <button
            type="button"
            className="refresh-button"
            onClick={handleRefresh}
            aria-label="Refresh results"
            title="Refresh results"
            disabled={isRefreshing}
          >
            <RefreshCw className={isRefreshing ? "spin" : ""} size={18} aria-hidden="true" />
          </button>
          <button type="button" className="secondary-icon-button desktop-export" onClick={handleExport} disabled={isExporting}>
            <Download size={18} aria-hidden="true" />
            {isExporting ? "Exporting" : "Export CSV"}
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
            <MetricCard label="Responses" value={`${analysis.totalResponses}`} />
            <MetricCard
              label="Top Priority"
              value={compactSummaryLabel(analysis.topTeamPriority)}
            />
            <MetricCard
              label="Most #1 Votes"
              value={compactSummaryLabel(analysis.mostCommonNumberOne)}
              detail={
                analysis.mostCommonNumberOne
                  ? `${analysis.mostCommonNumberOne.firstVotes} first-place votes`
                  : undefined
              }
            />
            <MetricCard
              label="Last Response"
              value={formatLastResponse(analysis.lastResponseAt)}
              detail={lastUpdated ? `Updated ${lastUpdated.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}` : undefined}
            />
          </section>

          {!hasResponses ? (
            <EmptyState onExport={handleExport} isExporting={isExporting} />
          ) : (
            <>
              <TeamPriorities summaries={analysis.summaries} totalResponses={analysis.totalResponses} />
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
          <EmptyState onExport={handleExport} isExporting={isExporting} />
        )
      ) : null}

      {activeTab === "share" ? <SharePanel onExport={handleExport} isExporting={isExporting} /> : null}

      {deleteDialogOpen ? (
        <DeleteAllDialog
          error={deleteError}
          isDeleting={isDeleting}
          onCancel={() => {
            if (!isDeleting) {
              setDeleteDialogOpen(false);
            }
          }}
          onConfirm={handleDeleteAllSubmissions}
        />
      ) : null}
      {toast ? (
        <div className="admin-toast" role="status" aria-live="polite">
          {toast}
        </div>
      ) : null}
    </main>
  );
}
