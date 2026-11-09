"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createProject, fundProject, captureFunding } from "@/lib/api";

const DEMO_USER_ID = "demo-business-001";
const BUDGETS = [50, 100, 200];

type Phase =
  | "idle"
  | "analyzing"
  | "awaiting_payment"   // show PayPal button
  | "decomposing"
  | "done";

interface Analysis {
  why_chatgpt_cannot_answer: string;
  information_domains: string[];
  estimated_contributors_needed: number;
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

// PayPal button wrapper
function PayPalButton({
  orderId,
  onApproved,
}: {
  orderId: string;
  onApproved: () => void;
}) {
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
      createOrder: () => orderId,         // reuse the order we already created
      onApprove: async () => {
        onApproved();
      },
      onError: (err: unknown) => {
        console.error("PayPal error", err);
        alert("PayPal payment failed. Please try again.");
      },
    }).render(containerRef.current);
  }, [orderId, onApproved]);

  return <div ref={containerRef} className="w-full" />;
}

export default function DiscoverPage() {
  const router = useRouter();
  const [question, setQuestion] = useState("");
  const [budget, setBudget] = useState(100);
  const [phase, setPhase] = useState<Phase>("idle");
  const [error, setError] = useState("");
  const [rejection, setRejection] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [projectId, setProjectId] = useState("");
  const [orderId, setOrderId] = useState("");
  const [tasks, setTasks] = useState<string[]>([]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setRejection(null);
    setPhase("analyzing");
    await sleep(800);

    try {
      const result = await createProject(DEMO_USER_ID, question, budget);
      if (result.status === "rejected") {
        setRejection(result.reason);
        setPhase("idle");
        return;
      }

      const pid = result.project.id;
      setProjectId(pid);
      setAnalysis(result.project.analysis);

      // Create PayPal order
      const fundResult = await fundProject(pid);
      setOrderId(fundResult.order_id);

      // Show PayPal button
      setPhase("awaiting_payment");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setPhase("idle");
    }
  }

  async function handlePaymentApproved() {
    setPhase("decomposing");
    try {
      const captureResult = await captureFunding(projectId);
      await sleep(400);

      const taskCount = captureResult.tasks_created || 3;
      const taskLabels = analysis?.information_domains || [];
      for (let i = 0; i < taskCount; i++) {
        setTasks((prev) => [...prev, taskLabels[i] || `Task ${i + 1}`]);
        await sleep(600);
      }

      await sleep(600);
      setPhase("done");
      await sleep(400);
      router.push(`/discover/${projectId}`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong after payment");
      setPhase("idle");
    }
  }

  /* ── Decomposing / done view ── */
  if (phase === "decomposing" || phase === "done") {
    return (
      <main className="max-w-xl mx-auto px-6 py-16">
        <div className="border border-gray-100 bg-gray-50 rounded-xl px-5 py-4 mb-10">
          <p className="text-xs text-gray-400 mb-1">Your question</p>
          <p className="text-sm font-medium text-gray-900">{question}</p>
        </div>

        <div className="space-y-8">
          <Step n={1} title="AI ground-truth check" done active={false}>
            {analysis && (
              <div className="mt-3">
                <div className="bg-blue-50 border border-blue-100 rounded-lg p-4 mb-3">
                  <p className="text-xs font-semibold text-blue-700 mb-1">Why this needs real people</p>
                  <p className="text-xs text-blue-600 leading-relaxed">{analysis.why_chatgpt_cannot_answer}</p>
                </div>
                <div className="flex gap-2 flex-wrap">
                  {analysis.information_domains.map((d) => (
                    <span key={d} className="text-xs border border-blue-100 bg-blue-50 text-blue-600 px-2.5 py-0.5 rounded-full">
                      {d.replace(/_/g, " ")}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </Step>

          <Step n={2} title="Budget secured via PayPal" done active={false}>
            <p className="mt-1 text-xs text-gray-400">${budget} order confirmed — released to contributors on purchase</p>
          </Step>

          <Step n={3} title="Decomposing into collection tasks" done={phase === "done"} active={phase === "decomposing"}>
            <div className="mt-3 space-y-2">
              {tasks.map((t, i) => (
                <div key={i} className="flex items-center gap-3 animate-slideRight" style={{ animationDelay: `${i * 100}ms` }}>
                  <div className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center text-xs font-bold shrink-0">{i + 1}</div>
                  <span className="text-sm text-gray-700">{t.replace(/_/g, " ")}</span>
                </div>
              ))}
              {phase === "decomposing" && tasks.length < 3 && (
                <div className="flex items-center gap-3">
                  <div className="w-5 h-5 rounded-full bg-gray-100 flex items-center justify-center shrink-0">
                    <span className="w-2.5 h-2.5 border border-gray-300 border-t-transparent rounded-full animate-spin" />
                  </div>
                  <span className="text-xs text-gray-400">Identifying next task...</span>
                </div>
              )}
            </div>
          </Step>
        </div>

        {phase === "done" && (
          <div className="mt-10 text-center animate-fadeUp">
            <div className="w-4 h-4 border-2 border-gray-300 border-t-gray-600 rounded-full animate-spin mx-auto mb-2" />
            <p className="text-xs text-gray-400">Redirecting to project...</p>
          </div>
        )}
      </main>
    );
  }

  /* ── Awaiting PayPal payment ── */
  if (phase === "awaiting_payment") {
    return (
      <main className="max-w-xl mx-auto px-6 py-16">
        <div className="border border-gray-100 bg-gray-50 rounded-xl px-5 py-4 mb-8">
          <p className="text-xs text-gray-400 mb-1">Your question</p>
          <p className="text-sm font-medium text-gray-900">{question}</p>
        </div>

        {/* Step 1 done */}
        <div className="mb-8">
          <Step n={1} title="AI ground-truth check" done active={false}>
            {analysis && (
              <div className="mt-3 animate-fadeUp">
                <div className="bg-blue-50 border border-blue-100 rounded-lg p-4 mb-3">
                  <p className="text-xs font-semibold text-blue-700 mb-1">Why this needs real people</p>
                  <p className="text-xs text-blue-600 leading-relaxed">{analysis.why_chatgpt_cannot_answer}</p>
                </div>
                <div className="flex gap-2 flex-wrap">
                  {analysis.information_domains.map((d) => (
                    <span key={d} className="text-xs border border-blue-100 bg-blue-50 text-blue-600 px-2.5 py-0.5 rounded-full">
                      {d.replace(/_/g, " ")}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </Step>
        </div>

        {/* Step 2: PayPal payment */}
        <div className="flex gap-4">
          <div className="shrink-0 mt-0.5">
            <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold bg-gray-900 text-white">2</div>
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold text-gray-900 mb-1">Fund your budget via PayPal</p>
            <p className="text-xs text-gray-400 mb-5">
              ${budget} will be held and released to contributors when you purchase the finished intelligence product.
            </p>

            <div className="border border-gray-200 rounded-xl p-5">
              <div className="flex items-center justify-between mb-5">
                <div>
                  <p className="text-xs text-gray-400">Order total</p>
                  <p className="text-2xl font-black text-gray-900">${budget}.00</p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-gray-400">Order ID</p>
                  <p className="text-xs font-mono text-gray-500">{orderId.slice(0, 16)}...</p>
                </div>
              </div>

              {/* PayPal JS SDK button renders here */}
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
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-2">Discover</p>
        <h1 className="text-3xl font-bold text-gray-900 mb-3">Ask a question that requires real people</h1>
        <p className="text-sm text-gray-500 leading-relaxed max-w-lg">
          If the answer doesn't exist in public data, UNMADE recruits observers who can find it.
          AI validates your question, decomposes it into tasks, and routes it to the right contributors.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Your question</label>
          <textarea
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="Which London neighbourhoods have the worst delivery bottlenecks on weekday evenings, and why?"
            className="w-full h-32 px-4 py-3 border border-gray-200 rounded-xl text-sm text-gray-900 resize-none outline-none focus:border-gray-400 focus:ring-2 focus:ring-gray-100 transition placeholder-gray-300"
            required
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Budget</label>
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
            <p className="text-sm font-semibold text-amber-800 mb-1">Question rejected</p>
            <p className="text-sm text-amber-600">{rejection}</p>
          </div>
        )}
        {error && (
          <div className="border border-red-200 bg-red-50 rounded-xl p-4 text-sm text-red-700">{error}</div>
        )}

        <button type="submit" disabled={phase !== "idle" || !question.trim()}
          className="w-full py-3 bg-gray-900 text-white rounded-xl text-sm font-medium hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
          {phase === "analyzing" ? (
            <span className="flex items-center justify-center gap-2">
              <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              AI analyzing your question...
            </span>
          ) : "Submit question"}
        </button>
      </form>
    </main>
  );
}

function Step({ n, title, active, done, children }: {
  n: number; title: string; active: boolean; done: boolean; children?: React.ReactNode;
}) {
  return (
    <div className="flex gap-4">
      <div className="shrink-0 mt-0.5">
        <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
          done ? "bg-emerald-500 text-white" : active ? "bg-gray-900 text-white" : "bg-gray-100 text-gray-400"
        }`}>
          {done ? "✓" : n}
        </div>
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className={`text-sm font-semibold ${done ? "text-emerald-700" : active ? "text-gray-900" : "text-gray-400"}`}>
            {title}
          </p>
          {active && <span className="w-3.5 h-3.5 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />}
        </div>
        {children}
      </div>
    </div>
  );
}
