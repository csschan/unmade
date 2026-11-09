"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { getAgent, agentThink } from "@/lib/api";

interface AgentTask {
  id: string;
  description: string;
  target_contributor: string;
  location_hint: string;
  reward_usd: number;
  accepted_count: number;
  total_submissions: number;
  status: string;
  is_help_task: boolean;
}

interface Finding {
  claim: string;
  confidence: number;
  novel: boolean;
  cross_validated: boolean;
  supporting_submissions?: string[];
  reasoning?: string;
}

interface Attribution {
  contributor_id: string;
  marginal_contribution: number;
  payout_usd: number;
  reason: string;
  payout_status: "pending" | "sent" | "completed" | "failed";
}

interface Observation {
  contributor_name: string;
  task_description: string;
  content: string;
}

interface Agent {
  id: string;
  agent_name: string;
  mission: string;
  status: string;
  budget_total: number;
  budget_spent: number;
  budget_remaining: number;
  tasks: AgentTask[];
  findings: Finding[];
  confidence: number | null;
  attributions: Attribution[];
  observations: Observation[];
  analysis: Record<string, unknown>;
}

const STATUS_LABEL: Record<string, { label: string; color: string; dot: string }> = {
  collecting: { label: "Collecting", color: "text-blue-700 bg-blue-50 border-blue-100", dot: "bg-blue-400 animate-pulse" },
  fusing:     { label: "Thinking",   color: "text-purple-700 bg-purple-50 border-purple-100", dot: "bg-purple-400 animate-pulse" },
  ready:      { label: "Ready",      color: "text-emerald-700 bg-emerald-50 border-emerald-100", dot: "bg-emerald-400" },
  sold:       { label: "Complete",   color: "text-gray-600 bg-gray-50 border-gray-200", dot: "bg-gray-400" },
  draft:      { label: "Starting",   color: "text-gray-500 bg-gray-50 border-gray-100", dot: "bg-gray-300 animate-pulse" },
};

function BudgetMeter({ spent, total }: { spent: number; total: number }) {
  const pct = Math.min((spent / total) * 100, 100);
  const remaining = total - spent;
  return (
    <div className="bg-white border border-gray-100 rounded-xl p-5">
      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-4">Agent Wallet</p>
      <div className="flex items-end justify-between mb-3">
        <div>
          <p className="text-2xl font-black text-gray-900">${spent.toFixed(2)}</p>
          <p className="text-xs text-gray-400">spent</p>
        </div>
        <div className="text-right">
          <p className="text-lg font-bold text-emerald-600">${remaining.toFixed(2)}</p>
          <p className="text-xs text-gray-400">remaining</p>
        </div>
      </div>
      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
        <div
          className="h-full bg-gray-900 rounded-full transition-all duration-700"
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className="text-xs text-gray-400 mt-2">of ${total} total funded via PayPal</p>
    </div>
  );
}

function ConfidenceRing({ confidence }: { confidence: number }) {
  const r = 28;
  const circ = 2 * Math.PI * r;
  const fill = circ * (1 - confidence);
  const color = confidence >= 0.75 ? "#10b981" : confidence >= 0.55 ? "#f59e0b" : "#ef4444";
  return (
    <svg width="72" height="72" className="shrink-0">
      <circle cx="36" cy="36" r={r} fill="none" stroke="#f3f4f6" strokeWidth="6" />
      <circle
        cx="36" cy="36" r={r} fill="none"
        stroke={color} strokeWidth="6"
        strokeDasharray={circ} strokeDashoffset={fill}
        strokeLinecap="round"
        style={{ transform: "rotate(-90deg)", transformOrigin: "36px 36px", transition: "stroke-dashoffset 0.8s ease" }}
      />
      <text x="36" y="40" textAnchor="middle" fontSize="13" fontWeight="700" fill="#111">
        {Math.round(confidence * 100)}%
      </text>
    </svg>
  );
}

export default function AgentDashboardPage() {
  const { id } = useParams<{ id: string }>();
  const [agent, setAgent] = useState<Agent | null>(null);
  const [loading, setLoading] = useState(true);
  const [thinking, setThinking] = useState(false);
  const [thinkResult, setThinkResult] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await getAgent(id);
      setAgent(data);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleThink() {
    setThinking(true);
    setThinkResult(null);
    try {
      const res = await agentThink(id);
      if (res.status === "thought") {
        setThinkResult(
          `Agent fused ${res.findings_count} findings with ${Math.round((res.confidence ?? 0) * 100)}% confidence.${res.agent_help_task ? " Posted 1 help task for a knowledge gap." : ""}`
        );
      } else {
        setThinkResult(res.detail || "Not enough data yet.");
      }
      await load();
    } catch (err: unknown) {
      setThinkResult(err instanceof Error ? err.message : "Think failed");
    } finally {
      setThinking(false);
    }
  }

  if (loading) {
    return (
      <main className="max-w-5xl mx-auto px-6 py-16 text-center">
        <div className="w-5 h-5 border-2 border-gray-200 border-t-gray-600 rounded-full animate-spin mx-auto" />
      </main>
    );
  }

  if (!agent) {
    return (
      <main className="max-w-5xl mx-auto px-6 py-16 text-center">
        <p className="text-gray-500">Agent not found.</p>
        <Link href="/agents/new" className="text-sm text-blue-600 underline mt-2 inline-block">Deploy a new agent</Link>
      </main>
    );
  }

  const statusInfo = STATUS_LABEL[agent.status] ?? STATUS_LABEL.collecting;
  const normalTasks = agent.tasks.filter((t) => !t.is_help_task);
  const helpTasks = agent.tasks.filter((t) => t.is_help_task);
  const totalAccepted = agent.tasks.reduce((s, t) => s + t.accepted_count, 0);

  return (
    <main className="max-w-5xl mx-auto px-6 py-10">

      {/* ── Header ── */}
      <div className="flex items-start justify-between gap-4 mb-8">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 mb-1">
            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${statusInfo.color}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${statusInfo.dot}`} />
              {statusInfo.label}
            </span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 truncate">{agent.agent_name}</h1>
          <p className="text-sm text-gray-500 mt-1 max-w-2xl leading-relaxed">{agent.mission}</p>
        </div>

        {/* Analyze button — only when still collecting (has unprocessed data) */}
        {agent.status === "collecting" && (
          <button
            onClick={handleThink}
            disabled={thinking}
            className="shrink-0 px-5 py-2.5 bg-gray-900 text-white rounded-xl text-sm font-medium hover:bg-gray-700 disabled:opacity-50 transition-colors flex items-center gap-2"
          >
            {thinking ? (
              <>
                <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Analyzing...
              </>
            ) : (
              "Analyze observations"
            )}
          </button>
        )}
      </div>

      {thinkResult && (
        <div className="mb-6 border border-blue-100 bg-blue-50 rounded-xl px-4 py-3 text-sm text-blue-800">
          {thinkResult}
        </div>
      )}

      {/* ── Stats row ── */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        <div className="bg-white border border-gray-100 rounded-xl p-4 text-center">
          <p className="text-2xl font-black text-gray-900">{totalAccepted}</p>
          <p className="text-xs text-gray-400 mt-0.5">observations collected</p>
        </div>
        <div className="bg-white border border-gray-100 rounded-xl p-4 text-center">
          <p className="text-2xl font-black text-gray-900">{agent.findings.length}</p>
          <p className="text-xs text-gray-400 mt-0.5">findings synthesized</p>
        </div>
        <div className="bg-white border border-gray-100 rounded-xl p-4 text-center">
          <p className="text-2xl font-black text-gray-900">{helpTasks.length}</p>
          <p className="text-xs text-gray-400 mt-0.5">help requests posted</p>
        </div>
      </div>

      {/* ── Main grid ── */}
      <div className="grid grid-cols-5 gap-6">

        {/* Left: Budget + Tasks */}
        <div className="col-span-2 space-y-5">
          <BudgetMeter spent={agent.budget_spent} total={agent.budget_total} />

          {/* Collection tasks */}
          <div className="bg-white border border-gray-100 rounded-xl p-5">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-4">
              Collection Tasks ({normalTasks.length})
            </p>
            <div className="space-y-3">
              {normalTasks.map((t) => (
                <Link
                  key={t.id}
                  href={`/earn/task/${t.id}`}
                  className="block border border-gray-100 rounded-lg p-3 hover:border-gray-300 transition-colors group"
                >
                  <div className="flex items-start justify-between gap-2 mb-1.5">
                    <p className="text-xs font-medium text-gray-700 leading-snug line-clamp-2 flex-1 group-hover:text-gray-900">
                      {t.description.slice(0, 90)}...
                    </p>
                    <span className="shrink-0 text-xs font-bold text-emerald-600">${t.reward_usd}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex-1 h-1 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-emerald-400 rounded-full"
                        style={{ width: `${Math.min((t.accepted_count / (t.total_submissions || 1)) * 100, 100)}%` }}
                      />
                    </div>
                    <span className="text-xs text-gray-400">{t.accepted_count} accepted</span>
                  </div>
                </Link>
              ))}
            </div>
          </div>

          {/* Help tasks (watchdog) */}
          {helpTasks.length > 0 && (
            <div className="bg-white border border-blue-100 rounded-xl p-5">
              <div className="flex items-center gap-2 mb-4">
                <span className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" />
                <p className="text-xs font-semibold text-blue-700 uppercase tracking-wide">
                  Agent Help Requests ({helpTasks.length})
                </p>
              </div>
              <div className="space-y-3">
                {helpTasks.map((t) => (
                  <Link
                    key={t.id}
                    href={`/earn/task/${t.id}`}
                    className="block border border-blue-100 rounded-lg p-3 hover:border-blue-300 transition-colors"
                  >
                    <p className="text-xs text-blue-800 leading-snug line-clamp-3">
                      {t.description.replace("[AI Help Request] ", "")}
                    </p>
                    <div className="flex items-center justify-between mt-2">
                      <span className="text-xs text-blue-500">Auto-generated by agent</span>
                      <span className="text-xs font-bold text-blue-700">${t.reward_usd}</span>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right: Findings */}
        <div className="col-span-3 space-y-5">

          {agent.findings.length > 0 ? (
            <>
              {/* Confidence header */}
              <div className="bg-white border border-gray-100 rounded-xl p-5">
                <div className="flex items-center gap-5">
                  {agent.confidence != null && (
                    <ConfidenceRing confidence={agent.confidence} />
                  )}
                  <div>
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">
                      Intelligence Quality
                    </p>
                    <p className="text-sm font-semibold text-gray-900">
                      {agent.findings.length} findings synthesized
                    </p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {agent.findings.filter((f) => f.novel).length} novel ·{" "}
                      {agent.findings.filter((f) => f.cross_validated).length} cross-validated
                    </p>
                  </div>
                </div>
              </div>

              {/* Finding cards */}
              <div className="space-y-3">
                {agent.findings.map((f, i) => (
                  <div key={i} className={`bg-white rounded-xl p-4 border ${f.cross_validated ? "border-blue-100" : "border-gray-100"}`}>
                    <div className="flex items-start gap-3">
                      <div className="shrink-0 mt-0.5">
                        <div
                          className={`text-xs font-bold px-2 py-0.5 rounded-full border ${
                            f.confidence >= 0.75
                              ? "bg-emerald-50 text-emerald-700 border-emerald-100"
                              : f.confidence >= 0.55
                              ? "bg-amber-50 text-amber-700 border-amber-100"
                              : "bg-red-50 text-red-700 border-red-100"
                          }`}
                        >
                          {Math.round(f.confidence * 100)}%
                        </div>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-gray-800 leading-relaxed">{f.claim}</p>

                        {/* Badges + source count */}
                        <div className="flex items-center gap-2 mt-2 flex-wrap">
                          {f.novel && (
                            <span className="text-xs bg-purple-50 text-purple-600 border border-purple-100 px-2 py-0.5 rounded-full font-medium">
                              Novel
                            </span>
                          )}
                          {f.cross_validated && (
                            <span className="text-xs bg-blue-50 text-blue-600 border border-blue-100 px-2 py-0.5 rounded-full font-medium">
                              Cross-validated
                            </span>
                          )}
                          {f.supporting_submissions && f.supporting_submissions.length > 0 && (
                            <span className="text-xs text-gray-400">
                              {f.supporting_submissions.length} independent source{f.supporting_submissions.length > 1 ? "s" : ""}
                            </span>
                          )}
                        </div>

                        {/* Cross-validation reasoning */}
                        {f.cross_validated && f.reasoning && (
                          <div className="mt-3 bg-blue-50 border border-blue-100 rounded-lg px-3 py-2.5">
                            <p className="text-xs font-semibold text-blue-700 mb-1">Why the agent cross-validated this</p>
                            <p className="text-xs text-blue-600 leading-relaxed">{f.reasoning}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Attributions */}
              {agent.attributions.length > 0 && (
                <div className="bg-white border border-gray-100 rounded-xl p-5">
                  <div className="flex items-center justify-between mb-4">
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
                      Contributor Payouts
                    </p>
                    {agent.attributions.every(a => a.payout_status === "completed") && (
                      <span className="text-xs font-semibold text-emerald-600 bg-emerald-50 border border-emerald-100 px-2 py-0.5 rounded-full">
                        All paid via PayPal
                      </span>
                    )}
                  </div>
                  <div className="space-y-3">
                    {agent.attributions.map((a, i) => {
                      const statusBadge = {
                        completed: { label: "Paid", color: "text-emerald-600 bg-emerald-50 border-emerald-100" },
                        sent:      { label: "Sent", color: "text-blue-600 bg-blue-50 border-blue-100" },
                        pending:   { label: "Pending", color: "text-amber-600 bg-amber-50 border-amber-100" },
                        failed:    { label: "Failed", color: "text-red-600 bg-red-50 border-red-100" },
                      }[a.payout_status] ?? { label: "Pending", color: "text-gray-500 bg-gray-50 border-gray-100" };
                      return (
                        <div key={i} className="flex items-center gap-3">
                          <div className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center text-xs font-bold text-gray-500 shrink-0">
                            {a.contributor_id.slice(-3).toUpperCase()}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-xs text-gray-600 truncate">{a.reason?.slice(0, 55)}...</span>
                              <div className="flex items-center gap-2 shrink-0 ml-2">
                                <span className={`text-xs font-semibold px-1.5 py-0.5 rounded border ${statusBadge.color}`}>
                                  {statusBadge.label}
                                </span>
                                <span className="text-xs font-bold text-emerald-600">${a.payout_usd.toFixed(2)}</span>
                              </div>
                            </div>
                            <div className="h-1 bg-gray-100 rounded-full overflow-hidden">
                              <div
                                className="h-full bg-emerald-400 rounded-full"
                                style={{ width: `${a.marginal_contribution * 100}%` }}
                              />
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </>
          ) : (
            /* Collecting — show raw observations */
            <div className="space-y-4">
              {agent.observations.length > 0 ? (
                <>
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
                      Collected Observations ({agent.observations.length})
                    </p>
                    <span className="text-xs text-gray-400">Waiting for analysis →</span>
                  </div>
                  {agent.observations.map((obs, i) => (
                    <div key={i} className="bg-white border border-gray-100 rounded-xl p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center text-xs font-bold text-gray-500 shrink-0">
                          {obs.contributor_name.split(" ").map((n: string) => n[0]).join("").slice(0, 2)}
                        </div>
                        <span className="text-xs font-semibold text-gray-700">{obs.contributor_name}</span>
                        <span className="text-xs text-gray-400 truncate">· {obs.task_description}</span>
                      </div>
                      <p className="text-sm text-gray-700 leading-relaxed">{obs.content}</p>
                    </div>
                  ))}
                </>
              ) : (
                <div className="bg-white border border-gray-100 rounded-xl p-10 text-center">
                  <div className="w-12 h-12 rounded-full bg-gray-50 border border-gray-100 flex items-center justify-center mx-auto mb-4">
                    <span className="text-xl">🧠</span>
                  </div>
                  <p className="text-sm font-semibold text-gray-700 mb-1">Waiting for first observations</p>
                  <p className="text-xs text-gray-400 max-w-xs mx-auto leading-relaxed mb-5">
                    Contributors on the ground submit what they see. Accepted observations appear here.
                  </p>
                  <Link href="/earn" className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-600 hover:text-blue-800 underline underline-offset-2">
                    View open tasks →
                  </Link>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
