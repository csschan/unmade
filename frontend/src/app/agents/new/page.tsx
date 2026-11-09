"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { deployAgent, activateAgent } from "@/lib/api";

const BUDGETS = [50, 100, 250];

const EXAMPLE_MISSIONS = [
  "Which London neighbourhoods have the worst delivery bottlenecks on weekday evenings, and why?",
  "What are the most common reasons customers abandon checkout at physical grocery stores in Singapore?",
  "Which intersections in downtown Toronto have the most unreported near-miss incidents for cyclists?",
];

type Phase = "idle" | "analyzing" | "awaiting_payment" | "activating" | "done";

interface Analysis {
  why_chatgpt_cannot_answer: string;
  information_domains: string[];
  estimated_contributors_needed: number;
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function PayPalButton({ orderId, onApproved }: { orderId: string; onApproved: () => void }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const rendered = useRef(false);

  useEffect(() => {
    if (rendered.current || !containerRef.current) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const paypal = (window as any).paypal;
    if (!paypal) return;
    rendered.current = true;
    paypal.Buttons({
      style: { layout: "vertical", color: "gold", shape: "rect", label: "pay" },
      createOrder: () => orderId,
      onApprove: async () => { onApproved(); },
      onError: (err: unknown) => {
        console.error("PayPal error", err);
        alert("PayPal payment failed. Please try again.");
      },
    }).render(containerRef.current);
  }, [orderId, onApproved]);

  return <div ref={containerRef} className="w-full" />;
}

export default function DeployAgentPage() {
  const router = useRouter();
  const [agentName, setAgentName] = useState("");
  const [mission, setMission] = useState("");
  const [budget, setBudget] = useState(100);
  const [phase, setPhase] = useState<Phase>("idle");
  const [error, setError] = useState("");
  const [rejection, setRejection] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [agentId, setAgentId] = useState("");
  const [orderId, setOrderId] = useState("");
  const [activateLog, setActivateLog] = useState<string[]>([]);

  async function handleAnalyze(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setRejection(null);
    setPhase("analyzing");

    try {
      const result = await deployAgent(agentName, mission, budget);

      if (result.status === "rejected") {
        setRejection(result.reason);
        setPhase("idle");
        return;
      }

      setAnalysis(result.analysis);
      setAgentId(result.agent_id);
      setOrderId(result.order_id);
      setPhase("awaiting_payment");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setPhase("idle");
    }
  }

  async function handlePaymentApproved() {
    setPhase("activating");
    setActivateLog(["Payment confirmed — funding agent wallet..."]);
    await sleep(400);

    try {
      const result = await activateAgent(agentId);
      setActivateLog((p) => [...p, `Mission decomposed into ${result.tasks_created} collection tasks ✓`]);
      await sleep(500);
      setActivateLog((p) => [...p, "Tasks published to /earn — agent is now running ✓"]);
      await sleep(400);
      setPhase("done");
      await sleep(500);
      router.push(`/agents/${agentId}`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Activation failed after payment");
      setPhase("idle");
    }
  }

  /* ── Activating / done ── */
  if (phase === "activating" || phase === "done") {
    return (
      <main className="max-w-xl mx-auto px-6 py-16">
        <div className="border border-gray-100 bg-gray-50 rounded-xl px-5 py-4 mb-10">
          <p className="text-xs text-gray-400 mb-0.5">Activating agent</p>
          <p className="text-sm font-semibold text-gray-900">{agentName}</p>
        </div>
        <div className="space-y-3">
          {activateLog.map((line, i) => (
            <div key={i} className="flex items-start gap-3 animate-fadeUp">
              <div className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center shrink-0 mt-0.5">
                <svg viewBox="0 0 12 12" fill="none" className="w-3 h-3">
                  <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
              <p className="text-sm text-gray-700">{line}</p>
            </div>
          ))}
          {phase === "activating" && (
            <div className="flex items-center gap-3">
              <div className="w-5 h-5 flex items-center justify-center shrink-0">
                <span className="w-3.5 h-3.5 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
              </div>
              <p className="text-sm text-gray-400">Working...</p>
            </div>
          )}
          {phase === "done" && (
            <div className="flex items-center gap-3 mt-2">
              <span className="w-3.5 h-3.5 border-2 border-gray-300 border-t-gray-600 rounded-full animate-spin" />
              <p className="text-sm text-gray-400">Opening agent dashboard...</p>
            </div>
          )}
        </div>
      </main>
    );
  }

  /* ── Awaiting PayPal payment ── */
  if (phase === "awaiting_payment") {
    return (
      <main className="max-w-xl mx-auto px-6 py-16">
        <div className="border border-gray-100 bg-gray-50 rounded-xl px-5 py-4 mb-8">
          <p className="text-xs text-gray-400 mb-0.5">{agentName}</p>
          <p className="text-sm font-medium text-gray-700 line-clamp-2">{mission}</p>
        </div>

        {/* Step 1 done */}
        <div className="flex gap-4 mb-8">
          <div className="shrink-0 mt-0.5">
            <div className="w-6 h-6 rounded-full bg-emerald-500 text-white flex items-center justify-center text-xs font-bold">✓</div>
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold text-emerald-700 mb-2">Mission validated</p>
            {analysis && (
              <div className="animate-fadeUp">
                <div className="bg-blue-50 border border-blue-100 rounded-lg p-3 mb-2">
                  <p className="text-xs font-semibold text-blue-700 mb-1">Why this needs real people</p>
                  <p className="text-xs text-blue-600 leading-relaxed">{analysis.why_chatgpt_cannot_answer}</p>
                </div>
                <div className="flex gap-1.5 flex-wrap">
                  {analysis.information_domains.map((d) => (
                    <span key={d} className="text-xs border border-blue-100 bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full">
                      {d.replace(/_/g, " ")}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Step 2: Fund wallet */}
        <div className="flex gap-4">
          <div className="shrink-0 mt-0.5">
            <div className="w-6 h-6 rounded-full bg-gray-900 text-white flex items-center justify-center text-xs font-bold">2</div>
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold text-gray-900 mb-1">Fund agent wallet via PayPal</p>
            <p className="text-xs text-gray-400 mb-5">
              ${budget} will be held in the agent&apos;s wallet and distributed to contributors as they deliver observations. Agent activates immediately after payment.
            </p>

            <div className="border border-gray-200 rounded-xl p-5">
              <div className="flex items-center justify-between mb-5">
                <div>
                  <p className="text-xs text-gray-400">Wallet amount</p>
                  <p className="text-2xl font-black text-gray-900">${budget}.00</p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-gray-400">Order ID</p>
                  <p className="text-xs font-mono text-gray-500">{orderId.slice(0, 20)}...</p>
                </div>
              </div>

              <PayPalButton orderId={orderId} onApproved={handlePaymentApproved} />

              <p className="text-xs text-gray-400 text-center mt-3">
                Sandbox mode — use a PayPal sandbox buyer account
              </p>
            </div>
          </div>
        </div>
      </main>
    );
  }

  /* ── Initial form ── */
  return (
    <main className="max-w-2xl mx-auto px-6 py-12">
      <div className="mb-10">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-2">Deploy Agent</p>
        <h1 className="text-3xl font-bold text-gray-900 mb-3">Give your AI agent a mission</h1>
        <p className="text-sm text-gray-500 leading-relaxed max-w-lg">
          Your agent runs autonomously — it decomposes the mission, recruits human contributors, validates observations, and pays them from its wallet.
        </p>
      </div>

      <form onSubmit={handleAnalyze} className="space-y-6">
        <div>
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Agent name</label>
          <input
            value={agentName}
            onChange={(e) => setAgentName(e.target.value)}
            placeholder="e.g. London Delivery Intelligence Agent"
            className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm text-gray-900 outline-none focus:border-gray-400 focus:ring-2 focus:ring-gray-100 transition placeholder-gray-300"
            required
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Mission</label>
          <textarea
            value={mission}
            onChange={(e) => setMission(e.target.value)}
            placeholder={EXAMPLE_MISSIONS[0]}
            className="w-full h-28 px-4 py-3 border border-gray-200 rounded-xl text-sm text-gray-900 resize-none outline-none focus:border-gray-400 focus:ring-2 focus:ring-gray-100 transition placeholder-gray-300"
            required
          />
          <div className="mt-2 flex gap-2 flex-wrap">
            {EXAMPLE_MISSIONS.slice(1).map((ex, i) => (
              <button key={i} type="button" onClick={() => setMission(ex)}
                className="text-xs text-blue-600 hover:text-blue-800 underline underline-offset-2">
                Example {i + 2}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Agent wallet (USD)</label>
          <p className="text-xs text-gray-400 mb-3">Funded via PayPal. Agent draws from this to pay contributors. 20% platform fee applies.</p>
          <div className="flex gap-2">
            {BUDGETS.map((b) => (
              <button key={b} type="button" onClick={() => setBudget(b)}
                className={`px-5 py-2 rounded-lg border text-sm font-medium transition-all ${
                  budget === b ? "border-gray-900 bg-gray-900 text-white" : "border-gray-200 text-gray-600 hover:border-gray-400"
                }`}>
                ${b}
              </button>
            ))}
          </div>
        </div>

        {rejection && (
          <div className="border border-amber-200 bg-amber-50 rounded-xl p-4">
            <p className="text-sm font-semibold text-amber-800 mb-1">Mission rejected</p>
            <p className="text-sm text-amber-600">{rejection}</p>
            <p className="text-xs text-amber-500 mt-2">The agent needs a question that requires real-world observations — not something answerable with public data.</p>
          </div>
        )}

        {error && (
          <div className="border border-red-200 bg-red-50 rounded-xl p-4 text-sm text-red-700">{error}</div>
        )}

        <div className="bg-gray-50 border border-gray-100 rounded-xl p-5">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">What happens after you deploy</p>
          <div className="space-y-2">
            {[
              ["AI validates", "Confirms mission requires real-world ground truth"],
              ["Wallet funded", "PayPal holds the budget — only paid out to contributors who deliver"],
              ["Agent activates", "Decomposes mission into tasks, publishes to /earn immediately"],
              ["Agent learns", "Validates submissions, fuses sources, finds hidden patterns"],
              ["Agent requests help", "If a gap is detected, auto-posts a help task to /earn"],
            ].map(([title, desc]) => (
              <div key={title} className="flex gap-3">
                <div className="w-1.5 h-1.5 rounded-full bg-gray-300 mt-1.5 shrink-0" />
                <div>
                  <span className="text-xs font-semibold text-gray-700">{title} — </span>
                  <span className="text-xs text-gray-500">{desc}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <button type="submit" disabled={phase !== "idle" || !agentName.trim() || !mission.trim()}
          className="w-full py-3 bg-gray-900 text-white rounded-xl text-sm font-medium hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
          {phase === "analyzing" ? (
            <span className="flex items-center justify-center gap-2">
              <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              AI analyzing mission...
            </span>
          ) : `Analyze mission — $${budget}`}
        </button>
      </form>
    </main>
  );
}
