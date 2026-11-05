"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { getTask, submitObservation } from "@/lib/api";

const DEMO_CONTRIBUTOR_IDS = [
  "demo-contributor-001",
  "demo-contributor-002",
  "demo-contributor-003",
];

interface TaskData {
  id: string;
  description: string;
  target_contributor: string;
  location_hint: string;
  validation_criteria: string;
  reward_usd: number;
  max_submissions: number;
  accepted_count: number;
  status: string;
}

interface SubmissionResult {
  id: string;
  status: string;
  relevance_score: number;
  uniqueness_score: number;
  reason: string;
}

export default function TaskSubmitPage() {
  const { id } = useParams<{ id: string }>();
  const [task, setTask] = useState<TaskData | null>(null);
  const [content, setContent] = useState("");
  const [contributorIdx, setContributorIdx] = useState(0);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<SubmissionResult | null>(null);

  useEffect(() => {
    getTask(id)
      .then(setTask)
      .finally(() => setLoading(false));
  }, [id]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setResult(null);

    try {
      const res = await submitObservation(
        id,
        DEMO_CONTRIBUTOR_IDS[contributorIdx],
        content
      );
      setResult(res);
      if (res.status === "accepted") {
        setContent("");
        // Reload task to update counts
        const updated = await getTask(id);
        setTask(updated);
      }
    } catch (err: unknown) {
      setResult({
        id: "",
        status: "error",
        relevance_score: 0,
        uniqueness_score: 0,
        reason: err instanceof Error ? err.message : "Submission failed",
      });
    }
    setSubmitting(false);
  }

  if (loading) {
    return (
      <main className="flex-1 flex items-center justify-center">
        <p className="text-gray-400">Loading task...</p>
      </main>
    );
  }

  if (!task) {
    return (
      <main className="flex-1 flex items-center justify-center">
        <p className="text-red-500">Task not found</p>
      </main>
    );
  }

  return (
    <main className="flex-1 px-6 py-16 max-w-2xl mx-auto w-full">
      <div className="mb-6">
        <h1 className="text-2xl font-bold mb-2">Submit Observation</h1>
        <div className="bg-gray-50 rounded-xl p-4 mb-4">
          <p className="font-medium text-sm mb-2">{task.description}</p>
          <p className="text-xs text-gray-500">
            <span className="font-medium">Validation criteria:</span>{" "}
            {task.validation_criteria}
          </p>
        </div>
        <div className="flex gap-3 text-xs text-gray-400">
          <span className="bg-emerald-50 text-emerald-700 px-2 py-1 rounded">
            ${task.reward_usd} reward
          </span>
          <span>
            {task.accepted_count}/{task.max_submissions} filled
          </span>
          {task.location_hint && <span>📍 {task.location_hint}</span>}
        </div>
      </div>

      {/* Contributor selector (demo only) */}
      <div className="mb-4">
        <label className="block text-xs font-medium text-gray-500 mb-1">
          Demo: Select contributor
        </label>
        <div className="flex gap-2">
          {DEMO_CONTRIBUTOR_IDS.map((cid, i) => (
            <button
              key={cid}
              type="button"
              onClick={() => setContributorIdx(i)}
              className={`text-xs px-3 py-1.5 rounded-lg border transition-all ${
                contributorIdx === i
                  ? "border-emerald-500 bg-emerald-50 text-emerald-700"
                  : "border-gray-200"
              }`}
            >
              Contributor {i + 1}
            </button>
          ))}
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Share your observation here... Be specific: include names, times, locations, and numbers where possible."
          className="w-full h-40 px-4 py-3 border border-gray-200 rounded-xl resize-none focus:outline-none focus:ring-2 focus:ring-emerald-500"
          required
        />

        {result && (
          <div
            className={`rounded-xl p-4 ${
              result.status === "accepted"
                ? "bg-emerald-50 border border-emerald-200"
                : "bg-red-50 border border-red-200"
            }`}
          >
            <p
              className={`font-medium text-sm ${
                result.status === "accepted"
                  ? "text-emerald-800"
                  : "text-red-800"
              }`}
            >
              {result.status === "accepted"
                ? "✓ Submission Accepted"
                : "✗ Submission Rejected"}
            </p>
            <p
              className={`text-sm mt-1 ${
                result.status === "accepted"
                  ? "text-emerald-600"
                  : "text-red-600"
              }`}
            >
              {result.reason}
            </p>
            {result.status === "accepted" && (
              <div className="flex gap-4 mt-2 text-xs text-emerald-500">
                <span>
                  Relevance: {Math.round(result.relevance_score * 100)}%
                </span>
                <span>
                  Uniqueness: {Math.round(result.uniqueness_score * 100)}%
                </span>
              </div>
            )}
          </div>
        )}

        <button
          type="submit"
          disabled={submitting || !content.trim() || task.status !== "open"}
          className="w-full py-3 bg-emerald-600 text-white rounded-xl font-medium hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {submitting ? "AI Validating..." : "Submit Observation"}
        </button>
      </form>
    </main>
  );
}
