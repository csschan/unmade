"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  getProject,
  fundProject,
  captureFunding,
  triggerFusion,
} from "@/lib/api";

const STATUS_LABELS: Record<string, string> = {
  draft: "Awaiting Funding",
  collecting: "Collecting Observations",
  fusing: "AI Fusing Intelligence...",
  ready: "Product Ready",
  sold: "Sold",
};

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-gray-100 text-gray-700",
  collecting: "bg-blue-100 text-blue-700",
  fusing: "bg-purple-100 text-purple-700",
  ready: "bg-emerald-100 text-emerald-700",
  sold: "bg-amber-100 text-amber-700",
};

interface Task {
  id: string;
  description: string;
  target_contributor: string;
  location_hint: string;
  reward_usd: number;
  max_submissions: number;
  accepted_count: number;
  status: string;
}

export default function ProjectPage() {
  const { id } = useParams<{ id: string }>();
  const [project, setProject] = useState<{
    id: string;
    question: string;
    budget_usd: number;
    status: string;
    analysis: Record<string, unknown>;
    tasks: Task[];
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  async function load() {
    const data = await getProject(id);
    setProject(data);
    setLoading(false);
  }

  useEffect(() => {
    load();
    const interval = setInterval(load, 5000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function handleFund() {
    setActionLoading(true);
    try {
      // For demo: create order then auto-capture (skip PayPal popup in sandbox)
      await fundProject(id);
      await captureFunding(id);
      await load();
    } catch {
      alert("Funding failed — check PayPal sandbox config");
    }
    setActionLoading(false);
  }

  async function handleFuse() {
    setActionLoading(true);
    try {
      await triggerFusion(id);
      await load();
    } catch (err: unknown) {
      alert(
        err instanceof Error ? err.message : "Fusion failed"
      );
    }
    setActionLoading(false);
  }

  if (loading) {
    return (
      <main className="flex-1 flex items-center justify-center">
        <p className="text-gray-400">Loading project...</p>
      </main>
    );
  }

  if (!project) {
    return (
      <main className="flex-1 flex items-center justify-center">
        <p className="text-red-500">Project not found</p>
      </main>
    );
  }

  const allTasksFilled =
    project.tasks.length > 0 &&
    project.tasks.every(
      (t: Task) => t.accepted_count > 0
    );

  return (
    <main className="flex-1 px-6 py-16 max-w-3xl mx-auto w-full">
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <h1 className="text-2xl font-bold">Project</h1>
          <span
            className={`px-3 py-1 rounded-full text-xs font-medium ${STATUS_COLORS[project.status] || "bg-gray-100"}`}
          >
            {STATUS_LABELS[project.status] || project.status}
          </span>
        </div>
        <p className="text-gray-600">{project.question}</p>
        <p className="text-sm text-gray-400 mt-1">
          Budget: ${project.budget_usd}
        </p>
      </div>

      {/* Analysis */}
      {project.analysis && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-6">
          <p className="text-blue-800 font-medium text-sm mb-1">
            AI Analysis
          </p>
          <p className="text-blue-600 text-sm">
            {(project.analysis as Record<string, unknown>).why_chatgpt_cannot_answer as string}
          </p>
          <p className="text-blue-500 text-xs mt-2">
            Domains:{" "}
            {((project.analysis as Record<string, unknown>).information_domains as string[])?.join(", ")}
          </p>
        </div>
      )}

      {/* Action buttons */}
      {project.status === "draft" && (
        <button
          onClick={handleFund}
          disabled={actionLoading}
          className="w-full py-3 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 disabled:opacity-50 mb-6"
        >
          {actionLoading
            ? "Processing..."
            : `Fund Project — $${project.budget_usd}`}
        </button>
      )}

      {project.status === "collecting" && allTasksFilled && (
        <button
          onClick={handleFuse}
          disabled={actionLoading}
          className="w-full py-3 bg-purple-600 text-white rounded-xl font-medium hover:bg-purple-700 disabled:opacity-50 mb-6"
        >
          {actionLoading
            ? "Fusing intelligence..."
            : "All tasks filled — Fuse Intelligence"}
        </button>
      )}

      {project.status === "ready" && (
        <Link
          href={`/discover/${id}/product`}
          className="block w-full py-3 bg-emerald-600 text-white rounded-xl font-medium text-center hover:bg-emerald-700 mb-6"
        >
          View Intelligence Product
        </Link>
      )}

      {/* Tasks */}
      {project.tasks.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold mb-3">Collection Tasks</h2>
          <div className="space-y-3">
            {project.tasks.map((task: Task) => (
              <div
                key={task.id}
                className="border border-gray-200 rounded-xl p-4"
              >
                <p className="font-medium text-sm">{task.description}</p>
                <div className="flex gap-4 mt-2 text-xs text-gray-400">
                  <span>Target: {task.target_contributor}</span>
                  <span>
                    {task.accepted_count}/{task.max_submissions} submissions
                  </span>
                  <span>${task.reward_usd}/each</span>
                  <span
                    className={
                      task.accepted_count > 0
                        ? "text-emerald-500"
                        : "text-gray-400"
                    }
                  >
                    {task.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </main>
  );
}
