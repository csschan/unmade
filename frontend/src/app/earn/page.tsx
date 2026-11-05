"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { listTasks } from "@/lib/api";

interface TaskItem {
  id: string;
  description: string;
  target_contributor: string;
  location_hint: string;
  reward_usd: number;
  max_submissions: number;
  accepted_count: number;
  status: string;
}

export default function EarnPage() {
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    listTasks("open")
      .then(setTasks)
      .catch(() => setTasks([]))
      .finally(() => setLoading(false));
  }, []);

  return (
    <main className="flex-1 px-6 py-16 max-w-3xl mx-auto w-full">
      <h1 className="text-3xl font-bold mb-2">Earn</h1>
      <p className="text-gray-500 mb-8">
        Your everyday knowledge could be valuable. Complete tasks by sharing
        what you observe in your daily life.
      </p>

      {loading ? (
        <p className="text-gray-400">Loading tasks...</p>
      ) : tasks.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-gray-400 text-lg">No open tasks right now</p>
          <p className="text-gray-300 text-sm mt-2">
            Check back soon — new collection tasks are created when businesses
            ask questions.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {tasks.map((task) => (
            <Link
              key={task.id}
              href={`/earn/task/${task.id}`}
              className="block border border-gray-200 rounded-xl p-5 hover:border-emerald-300 hover:shadow-sm transition-all"
            >
              <p className="font-medium mb-2">{task.description}</p>
              <div className="flex flex-wrap gap-3 text-xs text-gray-400">
                <span className="bg-emerald-50 text-emerald-700 px-2 py-1 rounded">
                  ${task.reward_usd} per submission
                </span>
                <span className="bg-gray-100 px-2 py-1 rounded">
                  {task.target_contributor}
                </span>
                {task.location_hint && (
                  <span className="bg-blue-50 text-blue-600 px-2 py-1 rounded">
                    📍 {task.location_hint}
                  </span>
                )}
                <span>
                  {task.accepted_count}/{task.max_submissions} filled
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </main>
  );
}
