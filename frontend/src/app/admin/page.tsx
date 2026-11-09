"use client";

import { useEffect, useState } from "react";
import {
  adminCreateAgent,
  adminDeleteAgent,
  adminListAgents,
  adminSeedAgents,
} from "@/lib/api";

interface AgentRow {
  id: string;
  name: string;
  status: string;
  budget_usd: number;
  task_count: number;
  submission_count: number;
  created_at: string | null;
}

interface TaskRow {
  description: string;
  target_contributor: string;
  location_hint: string;
  validation_criteria: string;
  reward_usd: number;
  max_submissions: number;
}

const STATUS_STYLE: Record<string, string> = {
  collecting: "bg-blue-50 text-blue-700 border-blue-100",
  fusing:     "bg-amber-50 text-amber-700 border-amber-100",
  ready:      "bg-emerald-50 text-emerald-700 border-emerald-100",
  sold:       "bg-purple-50 text-purple-700 border-purple-100",
  draft:      "bg-gray-50 text-gray-500 border-gray-100",
  expired:    "bg-red-50 text-red-700 border-red-100",
};

const emptyTask = (): TaskRow => ({
  description: "",
  target_contributor: "",
  location_hint: "",
  validation_criteria: "",
  reward_usd: 20,
  max_submissions: 5,
});

export default function AdminPage() {
  const [agents, setAgents] = useState<AgentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [seedMsg, setSeedMsg] = useState<string | null>(null);
  const [seeding, setSeeding] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Create form state
  const [agentName, setAgentName] = useState("");
  const [mission, setMission] = useState("");
  const [budget, setBudget] = useState("100");
  const [tasks, setTasks] = useState<TaskRow[]>([emptyTask()]);
  const [creating, setCreating] = useState(false);
  const [createMsg, setCreateMsg] = useState<string | null>(null);

  async function loadAgents() {
    setLoading(true);
    try {
      const data = await adminListAgents();
      setAgents(data);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAgents();
  }, []);

  async function handleSeed() {
    setSeeding(true);
    setSeedMsg(null);
    try {
      const res = await adminSeedAgents();
      setSeedMsg(`Done — ${res.created} created, ${res.skipped} already existed`);
      await loadAgents();
    } catch (e: unknown) {
      setSeedMsg(`Error: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setSeeding(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this agent and all its tasks and submissions?")) return;
    setDeletingId(id);
    try {
      await adminDeleteAgent(id);
      setAgents((prev) => prev.filter((a) => a.id !== id));
    } catch (e: unknown) {
      alert(`Delete failed: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setDeletingId(null);
    }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    setCreateMsg(null);
    try {
      const res = await adminCreateAgent({
        agent_name: agentName,
        mission,
        budget_usd: parseFloat(budget),
        tasks,
      });
      setCreateMsg(`Created agent ${res.agent_id} with ${res.tasks_created} tasks`);
      setAgentName("");
      setMission("");
      setBudget("100");
      setTasks([emptyTask()]);
      await loadAgents();
    } catch (e: unknown) {
      setCreateMsg(`Error: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setCreating(false);
    }
  }

  function updateTask(index: number, field: keyof TaskRow, value: string | number) {
    setTasks((prev) => prev.map((t, i) => (i === index ? { ...t, [field]: value } : t)));
  }

  function addTask() {
    setTasks((prev) => [...prev, emptyTask()]);
  }

  function removeTask(index: number) {
    setTasks((prev) => prev.filter((_, i) => i !== index));
  }

  return (
    <main className="max-w-5xl mx-auto px-6 py-12 space-y-10">

      {/* Header */}
      <div>
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-2">Admin</p>
        <h1 className="text-3xl font-bold text-gray-900 mb-1">Agent Management</h1>
        <p className="text-sm text-gray-500">Create and manage demo agents without going through PayPal.</p>
      </div>

      {/* Seed section */}
      <div className="bg-white border border-gray-100 rounded-xl p-6">
        <div className="flex items-center justify-between mb-1">
          <div>
            <h2 className="text-base font-semibold text-gray-900">Seed Demo Agents</h2>
            <p className="text-sm text-gray-400 mt-0.5">Seeds all 9 built-in demo agents. Idempotent — skips any that already exist.</p>
          </div>
          <button
            onClick={handleSeed}
            disabled={seeding}
            className="px-4 py-2 bg-gray-900 text-white text-sm font-semibold rounded-lg hover:bg-gray-700 disabled:opacity-50 transition-colors"
          >
            {seeding ? "Seeding…" : "Seed Demo Agents"}
          </button>
        </div>
        {seedMsg && (
          <p className={`text-sm mt-3 font-medium ${seedMsg.startsWith("Error") ? "text-red-600" : "text-emerald-600"}`}>
            {seedMsg}
          </p>
        )}
      </div>

      {/* Agent list */}
      <div className="bg-white border border-gray-100 rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 bg-gray-50/60">
          <h2 className="text-base font-semibold text-gray-900">All Agents</h2>
        </div>

        {loading ? (
          <div className="py-16 flex justify-center">
            <div className="w-5 h-5 border-2 border-gray-200 border-t-gray-500 rounded-full animate-spin" />
          </div>
        ) : agents.length === 0 ? (
          <div className="py-16 text-center">
            <p className="text-gray-500 font-medium mb-1">No agents yet</p>
            <p className="text-sm text-gray-400">Use "Seed Demo Agents" or create one below.</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {/* Table header */}
            <div className="grid grid-cols-[1fr_auto_auto_auto_auto_auto] gap-4 px-6 py-2.5 text-xs font-semibold text-gray-400 uppercase tracking-widest">
              <span>Name</span>
              <span className="text-right">Status</span>
              <span className="text-right">Budget</span>
              <span className="text-right">Tasks</span>
              <span className="text-right">Submissions</span>
              <span />
            </div>

            {agents.map((a) => (
              <div
                key={a.id}
                className="grid grid-cols-[1fr_auto_auto_auto_auto_auto] gap-4 items-center px-6 py-3.5 hover:bg-gray-50/60 transition-colors"
              >
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-gray-900 truncate">{a.name}</p>
                  <p className="text-xs text-gray-400 truncate">{a.id}</p>
                </div>

                <span
                  className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${STATUS_STYLE[a.status] ?? STATUS_STYLE.draft}`}
                >
                  {a.status}
                </span>

                <span className="text-sm font-semibold text-gray-700 text-right">
                  ${a.budget_usd.toFixed(2)}
                </span>

                <span className="text-sm text-gray-500 text-right">{a.task_count}</span>
                <span className="text-sm text-gray-500 text-right">{a.submission_count}</span>

                <button
                  onClick={() => handleDelete(a.id)}
                  disabled={deletingId === a.id}
                  className="text-xs font-medium text-red-500 hover:text-red-700 disabled:opacity-40 transition-colors"
                >
                  {deletingId === a.id ? "…" : "Delete"}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Create agent form */}
      <div className="bg-white border border-gray-100 rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 bg-gray-50/60">
          <h2 className="text-base font-semibold text-gray-900">Create Agent</h2>
          <p className="text-sm text-gray-400 mt-0.5">Directly creates an agent with status=collecting, no PayPal required.</p>
        </div>

        <form onSubmit={handleCreate} className="p-6 space-y-6">
          {/* Agent fields */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">
                Agent Name
              </label>
              <input
                required
                value={agentName}
                onChange={(e) => setAgentName(e.target.value)}
                placeholder="e.g. London Delivery Intelligence Agent"
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900/10"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">
                Mission / Question
              </label>
              <textarea
                required
                rows={3}
                value={mission}
                onChange={(e) => setMission(e.target.value)}
                placeholder="What question does this agent need answered?"
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900/10 resize-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">
                Budget (USD)
              </label>
              <input
                required
                type="number"
                min="1"
                step="0.01"
                value={budget}
                onChange={(e) => setBudget(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900/10"
              />
            </div>
          </div>

          {/* Task rows */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Tasks</p>
              <button
                type="button"
                onClick={addTask}
                className="text-xs font-semibold text-gray-900 border border-gray-200 px-3 py-1 rounded-lg hover:bg-gray-50 transition-colors"
              >
                + Add Task
              </button>
            </div>

            <div className="space-y-4">
              {tasks.map((task, i) => (
                <div key={i} className="border border-gray-100 rounded-xl p-4 space-y-3 relative">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-semibold text-gray-400">Task {i + 1}</span>
                    {tasks.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeTask(i)}
                        className="text-xs text-red-400 hover:text-red-600 transition-colors"
                      >
                        Remove
                      </button>
                    )}
                  </div>

                  <div>
                    <label className="block text-xs text-gray-400 mb-1">Description</label>
                    <textarea
                      required
                      rows={2}
                      value={task.description}
                      onChange={(e) => updateTask(i, "description", e.target.value)}
                      placeholder="What should contributors do?"
                      className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900/10 resize-none"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs text-gray-400 mb-1">Target Contributor</label>
                      <input
                        value={task.target_contributor}
                        onChange={(e) => updateTask(i, "target_contributor", e.target.value)}
                        placeholder="e.g. delivery_courier"
                        className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900/10"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-400 mb-1">Location Hint</label>
                      <input
                        value={task.location_hint}
                        onChange={(e) => updateTask(i, "location_hint", e.target.value)}
                        placeholder="e.g. East London"
                        className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900/10"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs text-gray-400 mb-1">Validation Criteria</label>
                    <input
                      required
                      value={task.validation_criteria}
                      onChange={(e) => updateTask(i, "validation_criteria", e.target.value)}
                      placeholder="Must include... Must name..."
                      className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900/10"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs text-gray-400 mb-1">Reward (USD)</label>
                      <input
                        required
                        type="number"
                        min="0.01"
                        step="0.01"
                        value={task.reward_usd}
                        onChange={(e) => updateTask(i, "reward_usd", parseFloat(e.target.value))}
                        className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900/10"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-400 mb-1">Max Submissions</label>
                      <input
                        required
                        type="number"
                        min="1"
                        value={task.max_submissions}
                        onChange={(e) => updateTask(i, "max_submissions", parseInt(e.target.value))}
                        className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900/10"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Submit */}
          <div className="flex items-center gap-4 pt-2">
            <button
              type="submit"
              disabled={creating}
              className="px-5 py-2.5 bg-gray-900 text-white text-sm font-semibold rounded-lg hover:bg-gray-700 disabled:opacity-50 transition-colors"
            >
              {creating ? "Creating…" : "Create Agent"}
            </button>
            {createMsg && (
              <p className={`text-sm font-medium ${createMsg.startsWith("Error") ? "text-red-600" : "text-emerald-600"}`}>
                {createMsg}
              </p>
            )}
          </div>
        </form>
      </div>
    </main>
  );
}
