"use client";

import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { createPurchaseOrder, getProduct, purchaseProduct } from "@/lib/api";

interface Finding {
  claim: string;
  confidence: number;
  novel: boolean;
  cross_validated: boolean;
  supporting_submissions: string[];
  reasoning: string;
}

interface Attribution {
  contributor_id: string;
  marginal_contribution: number;
  reason: string;
  payout_usd: number;
  status: string;
}

interface ProductData {
  id: string;
  title: string;
  summary: string;
  findings: Finding[];
  fusion_metadata: {
    correlations: Array<{ between: string[]; relationship: string; strength: string }>;
    data_quality: { total_sources: number; novel_findings_count: number; overall_confidence: number };
    limitations: string[];
  };
  attributions: Attribution[];
}

const CONTRIBUTOR_INFO: Record<string, { name: string; icon: string }> = {
  "demo-contributor-001": { name: "Alex Chen", icon: "🛵" },
  "demo-contributor-002": { name: "Sam Rodriguez", icon: "🚕" },
  "demo-contributor-003": { name: "Jordan Patel", icon: "🏠" },
};

const STRENGTH_STYLE: Record<string, string> = {
  strong: "bg-emerald-50 text-emerald-700 border-emerald-100",
  moderate: "bg-amber-50 text-amber-700 border-amber-100",
  weak: "bg-gray-50 text-gray-500 border-gray-100",
};

function PayPalBuyButton({ orderId, onApproved }: { orderId: string; onApproved: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const rendered = useRef(false);
  useEffect(() => {
    if (rendered.current || !ref.current) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const paypal = (window as any).paypal;
    if (!paypal) return;
    rendered.current = true;
    paypal.Buttons({
      style: { layout: "vertical", color: "gold", shape: "rect", label: "buynow" },
      createOrder: () => orderId,
      onApprove: () => onApproved(),
      onError: (err: unknown) => { console.error(err); alert("Payment failed."); },
    }).render(ref.current);
  }, [orderId, onApproved]);
  return <div ref={ref} />;
}

export default function ProductPage() {
  const { id } = useParams<{ id: string }>();
  const [product, setProduct] = useState<ProductData | null>(null);
  const [loading, setLoading] = useState(true);
  const [purchaseOrderId, setPurchaseOrderId] = useState<string | null>(null);
  const [preparingOrder, setPreparingOrder] = useState(false);
  const [completing, setCompleting] = useState(false);
  const [purchased, setPurchased] = useState(false);

  useEffect(() => {
    getProduct(id).then(setProduct).finally(() => setLoading(false));
  }, [id]);

  async function handleShowPayPal() {
    setPreparingOrder(true);
    try {
      const res = await createPurchaseOrder(id);
      setPurchaseOrderId(res.order_id);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Failed to create order");
    }
    setPreparingOrder(false);
  }

  async function handlePaymentApproved() {
    setCompleting(true);
    try {
      await purchaseProduct(id);
      setPurchased(true);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Purchase failed");
    }
    setCompleting(false);
  }

  if (loading) {
    return (
      <main className="flex-1 flex items-center justify-center">
        <div className="w-5 h-5 border-2 border-gray-200 border-t-gray-500 rounded-full animate-spin" />
      </main>
    );
  }

  if (!product) {
    return (
      <main className="flex-1 flex items-center justify-center">
        <p className="text-sm text-red-500">Product not found</p>
      </main>
    );
  }

  const totalPayout = product.attributions.reduce((s, a) => s + a.payout_usd, 0);
  const platformFee = totalPayout > 0 ? Math.round(totalPayout / 4) : 20;
  const totalPrice = totalPayout + platformFee;

  return (
    <main className="max-w-3xl mx-auto px-6 py-12">

      {/* Header */}
      <div className="mb-8">
        <span className="inline-block text-xs font-semibold text-violet-600 uppercase tracking-widest mb-3">
          Intelligence Product
        </span>
        <h1 className="text-2xl font-bold text-gray-900 mb-3">{product.title}</h1>
        <p className="text-sm text-gray-500 leading-relaxed">{product.summary}</p>
      </div>

      {/* Quality badges */}
      {product.fusion_metadata?.data_quality && (
        <div className="flex gap-2 flex-wrap mb-8">
          <Badge label={`${product.fusion_metadata.data_quality.total_sources} independent sources`} color="blue" />
          <Badge label={`${product.fusion_metadata.data_quality.novel_findings_count} novel findings`} color="violet" />
          <Badge label={`${Math.round(product.fusion_metadata.data_quality.overall_confidence * 100)}% confidence`} color="emerald" />
        </div>
      )}

      {/* Findings */}
      <section className="mb-10">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-4">Findings</p>
        <div className="space-y-3">
          {product.findings.map((f, i) => (
            <div
              key={i}
              className={`rounded-xl p-5 border-l-4 border ${
                f.novel
                  ? "border-l-violet-400 border-violet-100 bg-violet-50/30"
                  : "border-l-gray-200 border-gray-100 bg-gray-50/40"
              }`}
            >
              <div className="flex items-start justify-between gap-3 mb-3">
                <p className="text-sm font-medium text-gray-900 leading-snug">{f.claim}</p>
                <div className="flex gap-1.5 shrink-0">
                  {f.novel && (
                    <span className="text-xs bg-violet-100 text-violet-700 border border-violet-200 px-2 py-0.5 rounded-full font-semibold">
                      Novel
                    </span>
                  )}
                  {f.cross_validated && (
                    <span className="text-xs bg-emerald-100 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-full font-semibold">
                      Validated
                    </span>
                  )}
                </div>
              </div>

              {/* Confidence */}
              <div className="flex items-center gap-2 mb-3">
                <span className="text-xs text-gray-400 w-16 shrink-0">Confidence</span>
                <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full ${
                      f.confidence > 0.7 ? "bg-emerald-500" : f.confidence > 0.5 ? "bg-amber-500" : "bg-red-400"
                    }`}
                    style={{ width: `${f.confidence * 100}%` }}
                  />
                </div>
                <span className="text-xs font-semibold text-gray-600 w-8 text-right">
                  {Math.round(f.confidence * 100)}%
                </span>
              </div>

              <details className="text-xs text-gray-400">
                <summary className="cursor-pointer hover:text-gray-700 transition-colors font-medium">
                  How was this derived?
                </summary>
                <p className="mt-2 leading-relaxed text-gray-500">{f.reasoning}</p>
              </details>
            </div>
          ))}
        </div>
      </section>

      {/* Correlations */}
      {product.fusion_metadata?.correlations?.length > 0 && (
        <section className="mb-10">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-4">Correlations Discovered by AI</p>
          <div className="space-y-3">
            {product.fusion_metadata.correlations.map((c, i) => (
              <div key={i} className="border border-violet-100 bg-violet-50/30 rounded-xl p-4">
                <p className="text-sm text-gray-700 leading-relaxed mb-2">{c.relationship}</p>
                <span className={`text-xs px-2 py-0.5 rounded-full border font-semibold ${
                  STRENGTH_STYLE[c.strength] ?? STRENGTH_STYLE.weak
                }`}>
                  {c.strength} correlation
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Value attribution */}
      <section className="mb-10">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-4">Value Attribution</p>

        {/* Revenue flow */}
        <div className="border border-gray-100 rounded-xl p-5 mb-4 bg-gray-50/40">
          <div className="flex items-center justify-between mb-5 flex-wrap gap-4">
            <div className="text-center">
              <p className="text-2xl font-black text-gray-900">${totalPrice}</p>
              <p className="text-xs text-gray-400 mt-0.5">Buyer pays</p>
            </div>
            <div className="text-gray-200 text-xl">→</div>
            <div className="text-center">
              <p className="text-xl font-bold text-gray-400">${platformFee}</p>
              <p className="text-xs text-gray-400 mt-0.5">Platform (20%)</p>
            </div>
            <div className="text-gray-200 text-xl">→</div>
            <div className="text-center">
              <p className="text-2xl font-black text-emerald-600">${totalPayout.toFixed(0)}</p>
              <p className="text-xs text-gray-400 mt-0.5">To contributors</p>
            </div>
          </div>

          <div className="space-y-3">
            {product.attributions.map((a) => {
              const info = CONTRIBUTOR_INFO[a.contributor_id] ?? {
                name: a.contributor_id.slice(0, 15),
                icon: "👤",
              };
              return (
                <div key={a.contributor_id} className="bg-white border border-gray-100 rounded-xl p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xl">{info.icon}</span>
                      <span className="text-sm font-semibold text-gray-900">{info.name}</span>
                    </div>
                    <span className="font-bold text-emerald-600">${a.payout_usd.toFixed(2)}</span>
                  </div>
                  <div className="flex items-center gap-2 mb-2">
                    <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-emerald-400 rounded-full"
                        style={{ width: `${a.marginal_contribution * 100}%` }}
                      />
                    </div>
                    <span className="text-xs text-gray-500 w-8 text-right font-medium">
                      {Math.round(a.marginal_contribution * 100)}%
                    </span>
                  </div>
                  <p className="text-xs text-gray-400">{a.reason}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Purchase */}
      {!purchased ? (
        <div className="border border-gray-200 rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-xs text-gray-400">Total</p>
              <p className="text-2xl font-black text-gray-900">${totalPrice}</p>
            </div>
            <div className="text-right text-xs text-gray-400">
              <p>${platformFee} platform (20%)</p>
              <p className="text-emerald-600 font-medium">${totalPayout.toFixed(0)} to contributors</p>
            </div>
          </div>

          {completing ? (
            <div className="py-4 text-center">
              <div className="w-5 h-5 border-2 border-gray-300 border-t-gray-600 rounded-full animate-spin mx-auto mb-2" />
              <p className="text-sm text-gray-500">Triggering PayPal payouts to contributors...</p>
            </div>
          ) : purchaseOrderId ? (
            <>
              <PayPalBuyButton orderId={purchaseOrderId} onApproved={handlePaymentApproved} />
              <p className="text-xs text-gray-400 text-center mt-2">Sandbox mode — use a PayPal sandbox buyer account</p>
            </>
          ) : (
            <button
              onClick={handleShowPayPal}
              disabled={preparingOrder}
              className="w-full py-3 bg-gray-900 text-white rounded-xl text-sm font-semibold hover:bg-gray-700 disabled:opacity-40 transition-colors"
            >
              {preparingOrder ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Creating PayPal order...
                </span>
              ) : `Purchase for $${totalPrice} via PayPal`}
            </button>
          )}
        </div>
      ) : (
        <div className="border border-emerald-200 bg-emerald-50 rounded-xl p-6 text-center animate-scaleIn">
          <div className="w-10 h-10 bg-emerald-500 text-white rounded-full flex items-center justify-center text-lg mx-auto mb-3">✓</div>
          <p className="font-bold text-emerald-800 text-lg mb-1">Purchase Complete</p>
          <p className="text-sm text-emerald-600 mb-5">PayPal has distributed earnings to all contributors.</p>
          <div className="flex justify-center gap-6">
            {product.attributions.map((a) => {
              const info = CONTRIBUTOR_INFO[a.contributor_id] ?? { name: "Contributor", icon: "👤" };
              return (
                <div key={a.contributor_id} className="text-center">
                  <div className="text-2xl mb-1">{info.icon}</div>
                  <p className="text-xs text-gray-500">{info.name}</p>
                  <p className="font-bold text-emerald-600 text-sm">${a.payout_usd.toFixed(2)}</p>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </main>
  );
}

function Badge({ label, color }: { label: string; color: string }) {
  const styles: Record<string, string> = {
    blue: "bg-blue-50 text-blue-700 border-blue-100",
    violet: "bg-violet-50 text-violet-700 border-violet-100",
    emerald: "bg-emerald-50 text-emerald-700 border-emerald-100",
  };
  return (
    <span className={`text-xs px-3 py-1 rounded-full border font-medium ${styles[color]}`}>
      {label}
    </span>
  );
}
