"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { getProject, triggerFusion } from "@/lib/api";

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

interface ProjectData {
  id: string;
  question: string;
  budget_usd: number;
  status: string;
  analysis: Record<string, unknown>;
  tasks: Task[];
}

type FusionPhase = "idle" | "collecting_sources" | "cross_validating" | "discovering" | "generating" | "done";

const FUSION_STEPS: { phase: FusionPhase; label: string; detail: string }[] = [
  { phase: "collecting_sources", label: "Gathering independent observations", detail: "Loading accepted submissions from contributors..." },
  { phase: "cross_validating", label: "Cross-validating sources", detail: "Checking if independent observers corroborate each other..." },
  { phase: "discovering", label: "Discovering hidden correlations", detail: "Analyzing relationships between traffic, restaurants, and infrastructure..." },
  { phase: "generating", label: "Generating intelligence product", detail: "Assembling findings with confidence scores and data provenance..." },
];

const CONTRIBUTOR_ICONS: Record<string, string> = {
  delivery_courier: "🛵",
  rideshare_driver: "🚕",
  local_resident: "🏠",
};

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

export default function ProjectPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [project, setProject] = useState<ProjectData | null>(null);
  const [loading, setLoading] = useState(true);
  const [fusionPhase, setFusionPhase] = useState<FusionPhase>("idle");
  const [fusionFindings, setFusionFindings] = useState<string[]>([]);

  async function load() {
    const data = await getProject(id);
    setProject(data);
    setLoading(false);
  }

  useEffect(() => {
    load();
    const interval = setInterval(load, 3000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function handleFuse() {
    setFusionPhase("collecting_sources");
    await sleep(1500);
    setFusionPhase("cross_validating");
    await sleep(2000);
    setFusionPhase("discovering");
    const fusePromise = triggerFusion(id);
    await sleep(1500);
    setFusionFindings(["Compound effect: street market + construction diversion"]);
    await sleep(1200);
    setFusionFindings((p) => [...p, "Time-limited pattern: Fridays 6–8 PM only"]);
    await sleep(1000);
    setFusionPhase("generating");
    try {
      await fusePromise;
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Fusion failed");
      setFusionPhase("idle");
      return;
    }
    await sleep(1500);
    setFusionPhase("done");
    await sleep(800);
    router.push(`/discover/${id}/product`);
  }

  if (loading) {
    return (
      <main className="flex-1 flex items-center justify-center">
        <div className="w-5 h-5 border-2 border-gray-200 border-t-gray-500 rounded-full animate-spin" />
      </main>
    );
  }

  if (!project) {
    return (
      <main className="flex-1 flex items-center justify-center">
        <p className="text-sm text-red-500">Project not found</p>
      </main>
    );
  }

  /* ══════════ FUSION VISUALIZATION ══════════ */
  if (fusionPhase !== "idle") {
    const currentIdx = FUSION_STEPS.findIndex((s) => s.phase === fusionPhase);
    const totalObs = project.tasks.reduce((s, t) => s + t.accepted_count, 0);

    return (
      <main className="max-w-2xl mx-auto px-6 py-12">
        <div className="mb-8">
          <p className="text-xs font-semibold text-violet-600 uppercase tracking-widest mb-2">Information Fusion Engine</p>
          <h1 className="text-2xl font-bold text-gray-900 mb-1">Fusing {totalObs} independent observations</h1>
          <p className="text-sm text-gray-500">AI is discovering patterns no single observer could see</p>
        </div>

        {/* Source cards */}
        <div className="grid grid-cols-3 gap-3 mb-8">
          {project.tasks.map((task, i) => (
            <div
              key={task.id}
              className={`border rounded-xl p-4 text-center transition-all duration-500 ${
                currentIdx >= 0 ? "border-violet-200 bg-violet-50/40" : "border-gray-100"
              }`}
            >
              <div className="text-2xl mb-2">
                {CONTRIBUTOR_ICONS[task.target_contributor] ?? (i === 0 ? "🛵" : i === 1 ? "🚕" : "🏠")}
              </div>
              <p className="text-xs font-medium text-gray-700">{task.target_contributor?.replace(/_/g, " ")}</p>
              <p className="text-xs text-gray-400 mt-1">{task.accepted_count} observation{task.accepted_count !== 1 ? "s" : ""}</p>
            </div>
          ))}
        </div>

        {/* Convergence arrow */}
        {currentIdx >= 1 && (
          <div className="flex justify-center mb-6 animate-fadeUp">
            <div className="flex flex-col items-center gap-0">
              <div className="flex gap-14">
                {[0, 1, 2].map((i) => <div key={i} className="w-px h-6 bg-violet-200" />)}
              </div>
              <div className="w-40 h-px bg-violet-200" />
              <div className="w-px h-6 bg-violet-400" />
              <div className="text-violet-400 text-sm">▼</div>
            </div>
          </div>
        )}

        {/* AI Fusion box */}
        {currentIdx >= 1 && (
          <div className="border border-violet-200 bg-violet-50/40 rounded-xl p-5 mb-8 animate-fadeUp">
            <div className="flex items-center gap-2 mb-4">
              <span className="w-3.5 h-3.5 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
              <span className="text-sm font-semibold text-violet-700">AI Fusion Engine</span>
            </div>
            {fusionFindings.length > 0 && (
              <div className="space-y-2">
                {fusionFindings.map((f, i) => (
                  <div key={i} className="flex items-start gap-2 animate-slideRight" style={{ animationDelay: `${i * 100}ms` }}>
                    <span className="text-violet-400 mt-0.5 text-xs">◆</span>
                    <span className="text-sm text-violet-800">{f}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Steps */}
        <div className="space-y-4">
          {FUSION_STEPS.map((step, i) => {
            const isDone = i < currentIdx || fusionPhase === "done";
            const isActive = i === currentIdx && fusionPhase !== "done";
            if (i > currentIdx && fusionPhase !== "done") return null;

            return (
              <div key={step.phase} className="flex gap-3 items-start animate-fadeUp">
                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 mt-0.5 ${
                  isDone ? "bg-emerald-500 text-white" : isActive ? "bg-violet-600 text-white" : "bg-gray-100 text-gray-400"
                }`}>
                  {isDone ? "✓" : i + 1}
                </div>
                <div>
                  <p className={`text-sm font-medium ${
                    isDone ? "text-emerald-700" : isActive ? "text-violet-700" : "text-gray-400"
                  }`}>
                    {step.label}
                  </p>
                  {isActive && <p className="text-xs text-gray-400 mt-0.5">{step.detail}</p>}
                </div>
              </div>
            );
          })}
        </div>

        {fusionPhase === "done" && (
          <div className="mt-10 text-center animate-fadeUp">
            <div className="w-4 h-4 border-2 border-emerald-300 border-t-emerald-600 rounded-full animate-spin mx-auto mb-2" />
            <p className="text-xs text-gray-400">Product ready — loading results...</p>
          </div>
        )}
      </main>
    );
  }

  /* ══════════ NORMAL PROJECT VIEW ══════════ */
  const totalSubmissions = project.tasks.reduce((sum, t) => sum + t.accepted_count, 0);
  const allTasksFilled = project.tasks.length > 0 && project.tasks.every((t) => t.accepted_count > 0);

  return (
    <main className="max-w-3xl mx-auto px-6 py-12">
      {/* Header */}
      <div className="mb-8">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-2">Intelligence Project</p>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">{project.question}</h1>
        <div className="flex gap-3 text-sm">
          <span className="text-gray-400">Budget: ${project.budget_usd}</span>
          <span className="text-gray-200">·</span>
          <span className={`font-medium ${
            project.status === "collecting" ? "text-amber-600"
            : project.status === "ready" ? "text-emerald-600"
            : project.status === "sold" ? "text-blue-600"
            : "text-gray-500"
          }`}>
            {project.status}
          </span>
        </div>
      </div>

      {/* AI analysis */}
      {!!project.analysis?.why_chatgpt_cannot_answer && (
        <div className="border border-blue-100 bg-blue-50/50 rounded-xl p-5 mb-6">
          <p className="text-xs font-semibold text-blue-700 mb-1">Why this needs real people</p>
          <p className="text-sm text-blue-600">{project.analysis.why_chatgpt_cannot_answer as string}</p>
        </div>
      )}

      {/* Status banners */}
      {project.status === "collecting" && !allTasksFilled && (
        <div className="border border-amber-200 bg-amber-50 rounded-xl p-5 mb-6">
          <p className="font-semibold text-sm text-amber-800 mb-1">
            Waiting for observations ({totalSubmissions}/{project.tasks.length})
          </p>
          <p className="text-sm text-amber-600 mb-3">Contributors need to submit for each task below.</p>
          <Link
            href="/earn"
            className="inline-block px-4 py-2 bg-amber-500 text-white text-sm font-medium rounded-lg hover:bg-amber-600 transition-colors"
          >
            Go to Earn to submit →
          </Link>
        </div>
      )}

      {project.status === "collecting" && allTasksFilled && (
        <button
          onClick={handleFuse}
          className="w-full py-3 bg-violet-600 text-white rounded-xl text-sm font-medium hover:bg-violet-700 transition-colors mb-6"
        >
          All {totalSubmissions} observations received — Fuse Intelligence
        </button>
      )}

      {project.status === "ready" && (
        <Link
          href={`/discover/${id}/product`}
          className="block w-full py-3 bg-emerald-600 text-white rounded-xl text-sm font-medium text-center hover:bg-emerald-700 transition-colors mb-6"
        >
          View Intelligence Product →
        </Link>
      )}

      {project.status === "sold" && (
        <div className="border border-emerald-200 bg-emerald-50 rounded-xl p-5 mb-6 text-center">
          <p className="text-sm font-semibold text-emerald-800">Product purchased. Contributors have been paid.</p>
        </div>
      )}

      {/* Tasks */}
      {project.tasks.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-4">Collection Tasks</p>
          <div className="space-y-3">
            {project.tasks.map((task) => (
              <div
                key={task.id}
                className={`border rounded-xl p-4 ${
                  task.accepted_count > 0 ? "border-emerald-200 bg-emerald-50/30" : "border-gray-200"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-900 mb-2">{task.description}</p>
                    <div className="flex flex-wrap gap-2 text-xs">
                      <span className="bg-gray-100 text-gray-500 px-2 py-0.5 rounded">
                        {task.target_contributor?.replace(/_/g, " ")}
                      </span>
                      {task.location_hint && (
                        <span className="bg-blue-50 text-blue-600 border border-blue-100 px-2 py-0.5 rounded">
                          📍 {task.location_hint}
                        </span>
                      )}
                      <span className="text-gray-400">${task.reward_usd}/submission</span>
                    </div>
                  </div>
                  <div className="shrink-0">
                    {task.accepted_count > 0 ? (
                      <span className="text-xs font-semibold text-emerald-600">✓ {task.accepted_count} received</span>
                    ) : (
                      <span className="text-xs text-gray-300">waiting</span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </main>
  );
}
