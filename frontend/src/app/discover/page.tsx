"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createProject } from "@/lib/api";

const DEMO_USER_ID = "demo-business-001";
const BUDGETS = [50, 100, 200];

export default function DiscoverPage() {
  const router = useRouter();
  const [question, setQuestion] = useState("");
  const [budget, setBudget] = useState(100);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [rejection, setRejection] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    setRejection(null);

    try {
      const result = await createProject(DEMO_USER_ID, question, budget);
      if (result.status === "rejected") {
        setRejection(result.reason);
      } else {
        router.push(`/discover/${result.project.id}`);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex-1 flex flex-col items-center px-6 py-16">
      <div className="w-full max-w-2xl">
        <h1 className="text-3xl font-bold mb-2">Discover</h1>
        <p className="text-gray-500 mb-8">
          Ask a question that requires real-world knowledge. AI will determine
          if it needs ground-truth information that no public dataset can
          provide.
        </p>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-sm font-medium mb-2">
              What do you need to know?
            </label>
            <textarea
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="Which London neighbourhoods have the worst delivery bottlenecks on weekday evenings, and why?"
              className="w-full h-32 px-4 py-3 border border-gray-200 rounded-xl resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Budget</label>
            <div className="flex gap-3">
              {BUDGETS.map((b) => (
                <button
                  key={b}
                  type="button"
                  onClick={() => setBudget(b)}
                  className={`px-6 py-2 rounded-lg border transition-all ${
                    budget === b
                      ? "border-blue-500 bg-blue-50 text-blue-700"
                      : "border-gray-200 hover:border-gray-300"
                  }`}
                >
                  ${b}
                </button>
              ))}
            </div>
          </div>

          {rejection && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
              <p className="text-amber-800 font-medium mb-1">
                This question was rejected
              </p>
              <p className="text-amber-600 text-sm">{rejection}</p>
              <p className="text-amber-500 text-xs mt-2">
                UNMADE only works with questions that require real-world
                observations. Try rephrasing to focus on ground-truth
                information.
              </p>
            </div>
          )}

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-700 text-sm">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading || !question.trim()}
            className="w-full py-3 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? "Analyzing with AI..." : "Submit Question"}
          </button>
        </form>
      </div>
    </main>
  );
}
