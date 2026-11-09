"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { getTask, preValidateObservation, submitObservation } from "@/lib/api";

const CONTRIBUTORS = [
  { id: "demo-contributor-001", label: "Alex Chen",      icon: "🛵", role: "Courier"  },
  { id: "demo-contributor-002", label: "Sam Rodriguez",  icon: "🚕", role: "Driver"   },
  { id: "demo-contributor-003", label: "Jordan Patel",   icon: "🏠", role: "Resident" },
];

interface SiblingTask {
  id: string; description: string; target_contributor: string; reward_usd: number; accepted_count: number;
}
interface ProjectContext {
  id: string; question: string; budget_usd: number;
  requester: string; why_ground_truth: string; total_tasks: number;
  sibling_tasks?: SiblingTask[];
}
interface TaskData {
  id: string; description: string; target_contributor: string;
  location_hint: string; validation_criteria: string;
  reward_usd: number; max_submissions: number;
  accepted_count: number; status: string;
  project?: ProjectContext;
}
interface SubmissionResult {
  id: string; status: string;
  relevance_score: number; uniqueness_score: number; reason: string;
}
interface DimensionResult {
  pass: boolean; score: number; note: string;
}
interface PreValidation {
  overall_score: number;
  ready_to_submit: boolean;
  dimensions: {
    relevance:    DimensionResult;
    specificity:  DimensionResult;
    first_hand:   DimensionResult;
    completeness: DimensionResult;
  };
  missing: string[];
  tip: string;
}

// ── Local instant checks (no API) ────────────────────────────────────────────
function localCheck(text: string) {
  const words = text.trim().split(/\s+/).filter(Boolean);
  const lower = text.toLowerCase();
  return {
    minLength:    words.length >= 15,
    hasProperNoun: /\b[A-Z][a-z]{2,}\b/.test(text),
    hasNumber:    /\d/.test(text),
    noSecondHand: !/(according to|it is reported|studies show|experts say|i heard that)/i.test(lower),
    hasFirstPerson: /\b(i |i've|i'm|my |we )\b/i.test(lower),
  };
}

type LocalCheck = ReturnType<typeof localCheck>;

// ── Score ring ────────────────────────────────────────────────────────────────
function ScoreRing({ score, size = 56 }: { score: number; size?: number }) {
  const r = (size / 2) - 5;
  const circ = 2 * Math.PI * r;
  const fill = (score / 100) * circ;
  const color = score >= 70 ? "#10b981" : score >= 40 ? "#f59e0b" : "#ef4444";
  return (
    <svg width={size} height={size} className="-rotate-90">
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="#f3f4f6" strokeWidth="4" />
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth="4"
        strokeDasharray={`${fill} ${circ}`} strokeLinecap="round"
        style={{ transition: "stroke-dasharray 0.4s ease" }} />
    </svg>
  );
}

// ── Dimension row ─────────────────────────────────────────────────────────────
function DimRow({ label, dim, loading }: { label: string; dim?: DimensionResult; loading: boolean }) {
  if (loading || !dim) {
    return (
      <div className="flex items-center gap-3 py-1.5">
        <div className="w-4 h-4 rounded-full bg-gray-100 shrink-0" />
        <div className="flex-1">
          <div className="h-2.5 bg-gray-100 rounded w-24 mb-1 animate-pulse" />
          <div className="h-1.5 bg-gray-100 rounded w-36 animate-pulse" />
        </div>
        <div className="w-8 h-1.5 bg-gray-100 rounded animate-pulse" />
      </div>
    );
  }
  const color = dim.pass ? "text-emerald-500" : dim.score > 40 ? "text-amber-500" : "text-red-400";
  const bg    = dim.pass ? "bg-emerald-500" : dim.score > 40 ? "bg-amber-400" : "bg-red-400";
  const icon  = dim.pass ? "✓" : dim.score > 40 ? "~" : "✗";
  return (
    <div className="flex items-start gap-3 py-1.5">
      <div className={`w-4 h-4 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0 mt-0.5 ${bg}`}>
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-semibold text-gray-700">{label}</p>
        <p className="text-xs text-gray-400 leading-tight">{dim.note}</p>
      </div>
      <span className={`text-xs font-bold ${color} shrink-0`}>{dim.score}</span>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function TaskSubmitPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [task, setTask] = useState<TaskData | null>(null);
  // Per-contributor state — keyed by contributor index
  const [contents, setContents] = useState<string[]>(["", "", ""]);
  const [preVals, setPreVals] = useState<(PreValidation | null)[]>([null, null, null]);
  const [localChecksList, setLocalChecksList] = useState<(LocalCheck | null)[]>([null, null, null]);
  const [contributorIdx, setContributorIdx] = useState(0);
  const [pageLoading, setPageLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<SubmissionResult | null>(null);

  // Pre-validation state
  const [preValLoading, setPreValLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Helpers — read/write current contributor's slice
  const content = contents[contributorIdx];
  const preVal = preVals[contributorIdx];
  const localChecks = localChecksList[contributorIdx];

  function setContent(val: string) {
    setContents(prev => { const a = [...prev]; a[contributorIdx] = val; return a; });
  }
  function setPreVal(val: PreValidation | null) {
    setPreVals(prev => { const a = [...prev]; a[contributorIdx] = val; return a; });
  }
  function setLocalChecks(val: LocalCheck | null) {
    setLocalChecksList(prev => { const a = [...prev]; a[contributorIdx] = val; return a; });
  }

  useEffect(() => {
    getTask(id).then(setTask).finally(() => setPageLoading(false));
  }, [id]);

  // ── Live local checks + debounced semantic pre-validate ──
  function handleContentChange(val: string) {
    setContent(val);

    // Instant local checks
    setLocalChecks(val.trim().length > 10 ? localCheck(val) : null);

    // Reset semantic result while typing
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (val.trim().split(/\s+/).length < 5) {
      setPreVal(null);
      setPreValLoading(false);
      return;
    }

    // Semantic call after 1.5s pause
    setPreValLoading(true);
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await preValidateObservation(id, val);
        setPreVal(res);
      } catch {
        // silent fail — don't block user
      } finally {
        setPreValLoading(false);
      }
    }, 1500);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setResult(null);
    try {
      const res = await submitObservation(id, CONTRIBUTORS[contributorIdx].id, content);
      setResult(res);
      if (res.status === "accepted") {
        setContent("");
        setPreVal(null);
        setLocalChecks(null);
        const updated = await getTask(id);
        setTask(updated);
        if (updated.project?.id) {
          setTimeout(() => router.push(`/agents/${updated.project!.id}`), 1500);
        }
      }
    } catch (err: unknown) {
      setResult({ id: "", status: "error", relevance_score: 0, uniqueness_score: 0,
        reason: err instanceof Error ? err.message : "Submission failed" });
    }
    setSubmitting(false);
  }

  if (pageLoading) return (
    <main className="flex-1 flex items-center justify-center">
      <div className="w-5 h-5 border-2 border-gray-200 border-t-gray-500 rounded-full animate-spin" />
    </main>
  );

  if (!task) return (
    <main className="flex-1 flex items-center justify-center">
      <p className="text-sm text-red-500">Task not found</p>
    </main>
  );

  const filled = task.accepted_count;
  const total  = task.max_submissions;
  const wordCount = content.trim().split(/\s+/).filter(Boolean).length;
  const overallScore = preVal?.overall_score ?? 0;
  const showPanel = wordCount >= 5;

  return (
    <main className="max-w-4xl mx-auto px-6 py-12">
      <Link href="/earn" className="inline-flex items-center gap-1 text-sm text-gray-400 hover:text-gray-900 transition-colors mb-8">
        ← Back to tasks
      </Link>

      {/* Agent Request banner */}
      {task.project && (
        <div className="border border-blue-100 bg-blue-50/40 rounded-xl p-5 mb-6">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-6 h-6 rounded-md bg-blue-600 flex items-center justify-center shrink-0">
              <span className="text-white text-xs font-bold">AI</span>
            </div>
            <span className="text-xs font-semibold text-blue-700 uppercase tracking-wide">Agent Request</span>
            <span className="text-xs text-gray-400">·</span>
            <span className="text-xs text-gray-500">by <span className="font-medium text-gray-700">{task.project.requester}</span></span>
            <span className="text-xs text-gray-400">·</span>
            <span className="text-xs text-gray-500">${task.project.budget_usd} budget · {task.project.total_tasks} tasks</span>
          </div>
          <p className="text-sm font-semibold text-gray-900 mb-1">"{task.project.question}"</p>
          <p className="text-xs text-blue-600 leading-relaxed">{task.project.why_ground_truth}</p>
        </div>
      )}

      {/* Task card */}
      <div className="border border-gray-200 rounded-xl p-5 mb-6">
        <div className="flex items-start justify-between gap-4 mb-4">
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Your task</p>
            <p className="font-semibold text-gray-900 leading-snug text-sm">{task.description}</p>
          </div>
          <div className="shrink-0 text-right">
            <p className="text-2xl font-black text-emerald-600">${task.reward_usd}</p>
            <p className="text-xs text-gray-400">per submission</p>
          </div>
        </div>
        <div className="flex items-center gap-3 pt-4 border-t border-gray-100">
          {task.location_hint && (
            <span className="text-xs bg-blue-50 text-blue-600 border border-blue-100 px-2.5 py-1 rounded-full">
              📍 {task.location_hint}
            </span>
          )}
          <div className="flex items-center gap-2 flex-1">
            <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
              <div className="h-full bg-emerald-400 rounded-full" style={{ width: `${Math.round((filled / total) * 100)}%` }} />
            </div>
            <span className="text-xs text-gray-400">{filled}/{total} filled</span>
          </div>
        </div>
      </div>

      {/* Contributor selector */}
      <div className="mb-6">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Demo — select contributor</p>
        <div className="flex gap-2 mb-3">
          {CONTRIBUTORS.map((c, i) => (
            <button key={c.id} type="button" onClick={() => {
              if (debounceRef.current) clearTimeout(debounceRef.current);
              setPreValLoading(false);
              setContributorIdx(i);
            }}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm transition-all ${
                contributorIdx === i ? "border-gray-900 bg-gray-900 text-white" : "border-gray-200 text-gray-600 hover:border-gray-400"
              }`}>
              <span>{c.icon}</span>
              <span className="font-medium">{c.label}</span>
              <span className="text-xs opacity-60">{c.role}</span>
            </button>
          ))}
        </div>
        {/* Active contributor identity indicator */}
        <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 border border-gray-100 rounded-lg w-fit">
          <span className="text-base">{CONTRIBUTORS[contributorIdx].icon}</span>
          <span className="text-xs text-gray-500">Submitting as</span>
          <span className="text-xs font-semibold text-gray-800">{CONTRIBUTORS[contributorIdx].label}</span>
          <span className="text-xs text-gray-400">·</span>
          <span className="text-xs text-gray-500">{CONTRIBUTORS[contributorIdx].role}</span>
        </div>
      </div>

      {/* Two-column layout: textarea + live validation */}
      <div className="grid md:grid-cols-5 gap-5">

        {/* Left: textarea */}
        <div className="md:col-span-3">
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
            Your observation
          </label>
          <textarea
            value={content}
            onChange={(e) => handleContentChange(e.target.value)}
            placeholder="Be specific — include names, street names, times, and numbers. Vague submissions are rejected by AI."
            className="w-full h-52 px-4 py-3 border border-gray-200 rounded-xl text-sm text-gray-900 resize-none outline-none focus:border-gray-400 focus:ring-2 focus:ring-gray-100 transition placeholder-gray-300"
            required
          />
          <div className="flex items-center justify-between mt-1.5">
            <span className={`text-xs ${wordCount < 15 ? "text-red-400" : "text-gray-400"}`}>
              {wordCount} words {wordCount < 15 ? `(need ${15 - wordCount} more)` : ""}
            </span>
            {preValLoading && (
              <span className="flex items-center gap-1.5 text-xs text-blue-500">
                <span className="w-3 h-3 border border-blue-400 border-t-transparent rounded-full animate-spin" />
                AI analyzing...
              </span>
            )}
          </div>
        </div>

        {/* Right: live validation panel */}
        <div className="md:col-span-2">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Live AI check</p>
          <div className="border border-gray-100 rounded-xl p-4 bg-gray-50/40 min-h-52">

            {!showPanel ? (
              <div className="h-full flex flex-col items-center justify-center text-center py-6">
                <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center mb-3">
                  <span className="text-gray-400 text-lg">✦</span>
                </div>
                <p className="text-xs text-gray-400">Start writing to see<br />real-time AI feedback</p>
              </div>
            ) : (
              <>
                {/* Score */}
                <div className="flex items-center gap-3 mb-4 pb-4 border-b border-gray-100">
                  <div className="relative shrink-0">
                    <ScoreRing score={preVal?.overall_score ?? 0} size={52} />
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className={`text-xs font-black ${
                        overallScore >= 70 ? "text-emerald-600"
                        : overallScore >= 40 ? "text-amber-500"
                        : "text-red-500"
                      }`}>{preValLoading ? "…" : overallScore}</span>
                    </div>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-gray-700">
                      {preValLoading ? "Analyzing..." : preVal?.ready_to_submit ? "Ready to submit" : "Needs improvement"}
                    </p>
                    <p className="text-xs text-gray-400">
                      {preValLoading ? "AI is reading your draft"
                        : preVal?.ready_to_submit ? "AI will likely accept this"
                        : "See suggestions below"}
                    </p>
                  </div>
                </div>

                {/* Instant local checks */}
                {localChecks && (
                  <div className="mb-3 pb-3 border-b border-gray-100">
                    <p className="text-xs text-gray-400 mb-2 font-medium">Instant checks</p>
                    {[
                      { label: "Min. length (15 words)", ok: localChecks.minLength },
                      { label: "Has specific names", ok: localChecks.hasProperNoun },
                      { label: "Has numbers / times", ok: localChecks.hasNumber },
                      { label: "First-hand language", ok: localChecks.hasFirstPerson },
                      { label: "No second-hand phrases", ok: localChecks.noSecondHand },
                    ].map(({ label, ok }) => (
                      <div key={label} className="flex items-center gap-2 py-0.5">
                        <span className={`text-xs font-bold ${ok ? "text-emerald-500" : "text-gray-300"}`}>
                          {ok ? "✓" : "○"}
                        </span>
                        <span className={`text-xs ${ok ? "text-gray-600" : "text-gray-400"}`}>{label}</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Semantic dimensions */}
                <div className="space-y-0.5">
                  <p className="text-xs text-gray-400 mb-1 font-medium">Semantic analysis</p>
                  <DimRow label="Relevance"    dim={preVal?.dimensions.relevance}    loading={preValLoading} />
                  <DimRow label="Specificity"  dim={preVal?.dimensions.specificity}  loading={preValLoading} />
                  <DimRow label="First-hand"   dim={preVal?.dimensions.first_hand}   loading={preValLoading} />
                  <DimRow label="Completeness" dim={preVal?.dimensions.completeness} loading={preValLoading} />
                </div>

                {/* Missing elements */}
                {!preValLoading && preVal?.missing && preVal.missing.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-gray-100">
                    <p className="text-xs text-gray-400 mb-1.5 font-medium">Still missing</p>
                    {preVal.missing.map((m, i) => (
                      <div key={i} className="flex items-center gap-1.5">
                        <span className="text-amber-400 text-xs">▸</span>
                        <span className="text-xs text-gray-600">{m}</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Tip */}
                {!preValLoading && preVal?.tip && (
                  <div className="mt-3 pt-3 border-t border-gray-100">
                    <p className="text-xs text-blue-600 leading-relaxed">
                      <span className="font-semibold">Tip: </span>{preVal.tip}
                    </p>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {/* Final submit result */}
      {result && (
        <div className={`mt-5 rounded-xl p-4 border ${
          result.status === "accepted" ? "bg-emerald-50 border-emerald-200" : "bg-red-50 border-red-200"
        }`}>
          <p className={`font-semibold text-sm mb-1 ${result.status === "accepted" ? "text-emerald-800" : "text-red-800"}`}>
            {result.status === "accepted" ? "✓ Accepted by AI" : "✗ Rejected by AI"}
          </p>
          <p className={`text-sm ${result.status === "accepted" ? "text-emerald-600" : "text-red-600"}`}>
            {result.reason}
          </p>
          {result.status === "accepted" && (
            <>
              <div className="flex gap-6 mt-3 pt-3 border-t border-emerald-100">
                <div>
                  <p className="text-xs text-emerald-500">Relevance score</p>
                  <p className="font-bold text-emerald-700">{Math.round(result.relevance_score * 100)}%</p>
                </div>
                <div>
                  <p className="text-xs text-emerald-500">Uniqueness score</p>
                  <p className="font-bold text-emerald-700">{Math.round(result.uniqueness_score * 100)}%</p>
                </div>
              </div>
              {task.project && (
                <div className="mt-3 pt-3 border-t border-emerald-100 flex items-center justify-between">
                  <p className="text-xs text-emerald-700">
                    Redirecting to agent dashboard...
                  </p>
                  <Link
                    href={`/agents/${task.project.id}`}
                    className="text-xs font-semibold text-emerald-700 hover:text-emerald-900 underline underline-offset-2 shrink-0 ml-3"
                  >
                    View agent dashboard →
                  </Link>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Submit button */}
      <form onSubmit={handleSubmit}>
        <button
          type="submit"
          disabled={submitting || !content.trim() || task.status !== "open" || wordCount < 15}
          className="w-full mt-5 py-3 bg-gray-900 text-white rounded-xl text-sm font-medium hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          {submitting ? (
            <span className="flex items-center justify-center gap-2">
              <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              AI final validation...
            </span>
          ) : "Submit observation"}
        </button>
      </form>
    </main>
  );
}
