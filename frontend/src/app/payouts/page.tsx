"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { listTransactions } from "@/lib/api";

interface Transaction {
  agent_id: string;
  agent_name: string;
  contributor_name: string;
  paypal_email: string | null;
  payout_usd: number;
  marginal_contribution: number;
  reason: string;
  payout_status: "pending" | "sent" | "completed" | "failed";
  paid_at: string | null;
}

interface Summary {
  total_transactions: number;
  total_paid_usd: number;
  agents_completed: number;
}

const STATUS_STYLE: Record<string, string> = {
  completed: "bg-emerald-50 text-emerald-700 border-emerald-100",
  sent:      "bg-blue-50 text-blue-700 border-blue-100",
  pending:   "bg-amber-50 text-amber-700 border-amber-100",
  failed:    "bg-red-50 text-red-700 border-red-100",
};

const STATUS_DOT: Record<string, string> = {
  completed: "bg-emerald-400",
  sent:      "bg-blue-400",
  pending:   "bg-amber-400 animate-pulse",
  failed:    "bg-red-400",
};

export default function PayoutsPage() {
  const [data, setData] = useState<{ transactions: Transaction[]; summary: Summary } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    listTransactions()
      .then(setData)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <main className="max-w-4xl mx-auto px-6 py-16 text-center">
        <div className="w-5 h-5 border-2 border-gray-200 border-t-gray-500 rounded-full animate-spin mx-auto" />
      </main>
    );
  }

  const txns = data?.transactions ?? [];
  const summary = data?.summary ?? { total_transactions: 0, total_paid_usd: 0, agents_completed: 0 };

  // Group by agent
  const grouped = txns.reduce<Record<string, Transaction[]>>((acc, t) => {
    if (!acc[t.agent_id]) acc[t.agent_id] = [];
    acc[t.agent_id].push(t);
    return acc;
  }, {});

  return (
    <main className="max-w-4xl mx-auto px-6 py-12">

      {/* Header */}
      <div className="mb-10">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-2">PayPal Payouts</p>
        <h1 className="text-3xl font-bold text-gray-900 mb-3">Transaction Records</h1>
        <p className="text-sm text-gray-500">
          Every contributor payout executed by agent wallets via PayPal Payouts API.
        </p>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-3 gap-4 mb-10">
        <div className="bg-white border border-gray-100 rounded-xl p-5 text-center">
          <p className="text-3xl font-black text-gray-900">${summary.total_paid_usd.toFixed(2)}</p>
          <p className="text-xs text-gray-400 mt-1">total paid out</p>
        </div>
        <div className="bg-white border border-gray-100 rounded-xl p-5 text-center">
          <p className="text-3xl font-black text-gray-900">{summary.total_transactions}</p>
          <p className="text-xs text-gray-400 mt-1">contributor payments</p>
        </div>
        <div className="bg-white border border-gray-100 rounded-xl p-5 text-center">
          <p className="text-3xl font-black text-gray-900">{summary.agents_completed}</p>
          <p className="text-xs text-gray-400 mt-1">agents completed</p>
        </div>
      </div>

      {txns.length === 0 ? (
        <div className="border border-dashed border-gray-200 rounded-xl py-20 text-center">
          <p className="text-gray-500 font-medium mb-1">No payouts yet</p>
          <p className="text-sm text-gray-400">Payouts happen automatically when an agent completes analysis.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {Object.entries(grouped).map(([agentId, agentTxns]) => {
            const agentTotal = agentTxns.reduce((s, t) => s + t.payout_usd, 0);
            const allPaid = agentTxns.every(t => t.payout_status === "completed" || t.payout_status === "sent");
            return (
              <div key={agentId} className="bg-white border border-gray-100 rounded-xl overflow-hidden">
                {/* Agent header */}
                <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 bg-gray-50/60">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-7 h-7 rounded-lg bg-blue-600 flex items-center justify-center shrink-0">
                      <span className="text-white text-xs font-bold">AI</span>
                    </div>
                    <div className="min-w-0">
                      <Link href={`/agents/${agentId}`} className="text-sm font-semibold text-gray-900 hover:underline truncate block">
                        {agentTxns[0].agent_name}
                      </Link>
                      <p className="text-xs text-gray-400">{agentTxns[0].paid_at ? new Date(agentTxns[0].paid_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "—"}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    {allPaid && (
                      <span className="text-xs font-semibold text-emerald-600 bg-emerald-50 border border-emerald-100 px-2 py-0.5 rounded-full">
                        All paid via PayPal
                      </span>
                    )}
                    <span className="text-sm font-black text-gray-900">${agentTotal.toFixed(2)}</span>
                  </div>
                </div>

                {/* Transaction rows */}
                <div className="divide-y divide-gray-50">
                  {agentTxns.map((t, i) => (
                    <div key={i} className="flex items-center gap-4 px-5 py-3.5">
                      {/* Avatar */}
                      <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-xs font-bold text-gray-500 shrink-0">
                        {t.contributor_name.split(" ").map(n => n[0]).join("").slice(0, 2)}
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className="text-sm font-semibold text-gray-800">{t.contributor_name}</span>
                          <span className="text-xs text-gray-400">·</span>
                          <span className="text-xs text-gray-500">{Math.round(t.marginal_contribution * 100)}% contribution</span>
                        </div>
                        <p className="text-xs text-gray-400 truncate">{t.paypal_email}</p>
                        <p className="text-xs text-gray-400 mt-0.5 line-clamp-1">{t.reason?.slice(0, 80)}...</p>
                      </div>

                      {/* Amount + status */}
                      <div className="text-right shrink-0">
                        <p className="text-base font-black text-gray-900">${t.payout_usd.toFixed(2)}</p>
                        <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full border mt-1 ${STATUS_STYLE[t.payout_status] ?? STATUS_STYLE.pending}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${STATUS_DOT[t.payout_status] ?? ""}`} />
                          {t.payout_status === "completed" ? "Paid" : t.payout_status === "sent" ? "Sent" : t.payout_status}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Total row */}
                <div className="flex items-center justify-between px-5 py-3 bg-gray-50/60 border-t border-gray-100">
                  <span className="text-xs text-gray-400">{agentTxns.length} payments · via PayPal Payouts API</span>
                  <span className="text-sm font-black text-emerald-600">${agentTotal.toFixed(2)} total</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </main>
  );
}
