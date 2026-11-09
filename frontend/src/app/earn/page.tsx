"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { listTasks } from "@/lib/api";

interface ProjectContext {
  id: string;
  question: string;
  budget_usd: number;
  requester: string;
  why_ground_truth: string;
  total_tasks: number;
}

interface TaskItem {
  id: string;
  description: string;
  target_contributor: string;
  location_hint: string;
  reward_usd: number;
  max_submissions: number;
  accepted_count: number;
  status: string;
  project?: ProjectContext;
}

const ICONS: Record<string, string> = {
  delivery_courier: "🛵",
  rideshare_driver: "🚕",
  local_resident: "🏠",
};

export default function EarnPage() {
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    listTasks("open")
      .then(setTasks)
      .catch(() => setTasks([]))
      .finally(() => setLoading(false));
  }, []);

  // Group tasks by project
  const grouped = tasks.reduce<Record<string, { project: ProjectContext | null; tasks: TaskItem[] }>>((acc, task) => {
    const pid = task.project?.id ?? "__no_project";
    if (!acc[pid]) {
      acc[pid] = { project: task.project ?? null, tasks: [] };
    }
    acc[pid].tasks.push(task);
    return acc;
  }, {});

  return (
    <main className="max-w-3xl mx-auto px-6 py-12">
      {/* Header */}
      <div className="mb-10">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-2">Earn</p>
        <h1 className="text-3xl font-bold text-gray-900 mb-3">Share what you know. Get paid.</h1>
        <p className="text-sm text-gray-500 leading-relaxed max-w-lg">
          Businesses post questions that only real-world observers can answer. AI decomposes them
          into specific tasks — these are the tasks. Complete one, get paid via PayPal.
        </p>
      </div>

      {loading ? (
        <div className="py-20 text-center">
          <div className="w-5 h-5 border-2 border-gray-200 border-t-gray-500 rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm text-gray-400">Loading tasks...</p>
        </div>
      ) : tasks.length === 0 ? (
        <div className="border border-dashed border-gray-200 rounded-xl py-20 text-center">
          <p className="text-gray-500 font-medium mb-1">No open tasks right now</p>
          <p className="text-sm text-gray-400">New tasks appear when businesses ask questions.</p>
        </div>
      ) : (
        <div className="space-y-8">
          {Object.entries(grouped).map(([pid, group]) => (
            <div key={pid}>
              {/* Agent request card */}
              {group.project && (
                <div className="border border-blue-100 bg-blue-50/40 rounded-xl p-5 mb-3">
                  <div className="flex items-start gap-3">
                    <div className="shrink-0 mt-0.5">
                      <div className="w-7 h-7 rounded-lg bg-blue-600 flex items-center justify-center">
                        <span className="text-white text-xs font-bold">AI</span>
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className="text-xs font-semibold text-blue-700 uppercase tracking-wide">Agent Request</span>
                        <span className="text-xs text-gray-400">·</span>
                        <span className="text-xs text-gray-500">posted by <span className="font-medium text-gray-700">{group.project.requester}</span></span>
                        <span className="text-xs text-gray-400">·</span>
                        <span className="text-xs text-gray-500">budget <span className="font-medium text-gray-700">${group.project.budget_usd}</span></span>
                      </div>
                      <p className="text-sm font-semibold text-gray-900 mb-2">"{group.project.question}"</p>
                      <p className="text-xs text-blue-600 leading-relaxed">{group.project.why_ground_truth}</p>
                    </div>
                  </div>
                  <div className="mt-3 pt-3 border-t border-blue-100 flex items-center justify-between">
                    <span className="text-xs text-gray-500">
                      AI decomposed this into <span className="font-semibold text-gray-700">{group.project.total_tasks} tasks</span> — complete any one to contribute
                    </span>
                    <Link href={`/agents/${group.project.id}`} className="text-xs text-blue-600 hover:underline">
                      View agent dashboard →
                    </Link>
                  </div>
                </div>
              )}

              {/* Task cards */}
              <div className="space-y-2 pl-4 border-l-2 border-blue-100">
                {group.tasks.map((task) => {
                  const icon = ICONS[task.target_contributor] ?? "👤";
                  const filled = task.accepted_count;
                  const total = task.max_submissions;
                  const pct = Math.round((filled / total) * 100);

                  return (
                    <Link
                      key={task.id}
                      href={`/earn/task/${task.id}`}
                      className="flex gap-4 items-start bg-white border border-gray-200 rounded-xl p-4 hover:border-gray-400 hover:shadow-sm transition-all group"
                    >
                      <div className="w-9 h-9 bg-gray-100 rounded-lg flex items-center justify-center text-lg shrink-0">
                        {icon}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 mb-2 leading-snug line-clamp-2">
                          {task.description}
                        </p>
                        <div className="flex flex-wrap gap-2 items-center mb-2">
                          <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded">
                            {task.target_contributor.replace(/_/g, " ")}
                          </span>
                          {task.location_hint && (
                            <span className="text-xs text-gray-400">📍 {task.location_hint}</span>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-1 bg-gray-100 rounded-full overflow-hidden">
                            <div className="h-full bg-emerald-400 rounded-full" style={{ width: `${pct}%` }} />
                          </div>
                          <span className="text-xs text-gray-400">{filled}/{total} slots</span>
                        </div>
                      </div>
                      <div className="text-right shrink-0 ml-2">
                        <p className="font-bold text-emerald-600">${task.reward_usd}</p>
                        <p className="text-xs text-gray-400 mt-0.5 group-hover:text-gray-600 transition-colors">submit →</p>
                      </div>
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
