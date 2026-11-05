"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { getProduct, purchaseProduct } from "@/lib/api";

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
    correlations: Array<{
      between: string[];
      relationship: string;
      strength: string;
    }>;
    data_quality: {
      total_sources: number;
      novel_findings_count: number;
      overall_confidence: number;
    };
    limitations: string[];
  };
  attributions: Attribution[];
}

export default function ProductPage() {
  const { id } = useParams<{ id: string }>();
  const [product, setProduct] = useState<ProductData | null>(null);
  const [loading, setLoading] = useState(true);
  const [purchasing, setPurchasing] = useState(false);
  const [purchased, setPurchased] = useState(false);

  useEffect(() => {
    getProduct(id)
      .then(setProduct)
      .finally(() => setLoading(false));
  }, [id]);

  async function handlePurchase() {
    setPurchasing(true);
    try {
      await purchaseProduct(id);
      setPurchased(true);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Purchase failed");
    }
    setPurchasing(false);
  }

  if (loading) {
    return (
      <main className="flex-1 flex items-center justify-center">
        <p className="text-gray-400">Loading product...</p>
      </main>
    );
  }

  if (!product) {
    return (
      <main className="flex-1 flex items-center justify-center">
        <p className="text-red-500">Product not found</p>
      </main>
    );
  }

  return (
    <main className="flex-1 px-6 py-16 max-w-3xl mx-auto w-full">
      <h1 className="text-2xl font-bold mb-2">{product.title}</h1>
      <p className="text-gray-600 mb-6">{product.summary}</p>

      {/* Data quality badge */}
      {product.fusion_metadata?.data_quality && (
        <div className="flex gap-4 mb-8 text-sm">
          <span className="bg-blue-50 text-blue-700 px-3 py-1 rounded-full">
            {product.fusion_metadata.data_quality.total_sources} sources
          </span>
          <span className="bg-purple-50 text-purple-700 px-3 py-1 rounded-full">
            {product.fusion_metadata.data_quality.novel_findings_count} novel
            findings
          </span>
          <span className="bg-emerald-50 text-emerald-700 px-3 py-1 rounded-full">
            {Math.round(
              product.fusion_metadata.data_quality.overall_confidence * 100
            )}
            % confidence
          </span>
        </div>
      )}

      {/* Findings */}
      <h2 className="text-lg font-semibold mb-3">Findings</h2>
      <div className="space-y-4 mb-8">
        {product.findings.map((f, i) => (
          <div
            key={i}
            className={`border rounded-xl p-4 ${
              f.novel
                ? "border-purple-200 bg-purple-50/50"
                : "border-gray-200"
            }`}
          >
            <div className="flex items-start justify-between gap-4">
              <p className="font-medium text-sm">{f.claim}</p>
              <div className="flex gap-2 shrink-0">
                {f.novel && (
                  <span className="bg-purple-100 text-purple-700 px-2 py-0.5 rounded text-xs">
                    Novel
                  </span>
                )}
                {f.cross_validated && (
                  <span className="bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded text-xs">
                    Validated
                  </span>
                )}
              </div>
            </div>
            {/* Confidence bar */}
            <div className="mt-3 flex items-center gap-2">
              <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-blue-500 rounded-full"
                  style={{ width: `${f.confidence * 100}%` }}
                />
              </div>
              <span className="text-xs text-gray-400">
                {Math.round(f.confidence * 100)}%
              </span>
            </div>
            <p className="text-xs text-gray-400 mt-2">{f.reasoning}</p>
          </div>
        ))}
      </div>

      {/* Correlations */}
      {product.fusion_metadata?.correlations?.length > 0 && (
        <div className="mb-8">
          <h2 className="text-lg font-semibold mb-3">
            Correlations Discovered
          </h2>
          <div className="space-y-2">
            {product.fusion_metadata.correlations.map((c, i) => (
              <div
                key={i}
                className="border border-gray-200 rounded-xl p-3 text-sm"
              >
                <p className="text-gray-700">{c.relationship}</p>
                <span
                  className={`text-xs mt-1 inline-block px-2 py-0.5 rounded ${
                    c.strength === "strong"
                      ? "bg-emerald-100 text-emerald-700"
                      : c.strength === "moderate"
                        ? "bg-amber-100 text-amber-700"
                        : "bg-gray-100 text-gray-500"
                  }`}
                >
                  {c.strength}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Attribution */}
      {product.attributions?.length > 0 && (
        <div className="mb-8">
          <h2 className="text-lg font-semibold mb-3">Value Attribution</h2>
          <div className="border border-gray-200 rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left p-3 font-medium">Contributor</th>
                  <th className="text-left p-3 font-medium">Contribution</th>
                  <th className="text-right p-3 font-medium">Payout</th>
                </tr>
              </thead>
              <tbody>
                {product.attributions.map((a, i) => (
                  <tr key={i} className="border-t border-gray-100">
                    <td className="p-3 text-gray-600">
                      {a.contributor_id.slice(0, 12)}...
                    </td>
                    <td className="p-3">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-emerald-500 rounded-full"
                            style={{
                              width: `${a.marginal_contribution * 100}%`,
                            }}
                          />
                        </div>
                        <span className="text-xs text-gray-400">
                          {Math.round(a.marginal_contribution * 100)}%
                        </span>
                      </div>
                      <p className="text-xs text-gray-400 mt-1">{a.reason}</p>
                    </td>
                    <td className="p-3 text-right font-medium text-emerald-600">
                      ${a.payout_usd.toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Purchase button */}
      {!purchased ? (
        <button
          onClick={handlePurchase}
          disabled={purchasing}
          className="w-full py-3 bg-emerald-600 text-white rounded-xl font-medium hover:bg-emerald-700 disabled:opacity-50"
        >
          {purchasing ? "Processing payment..." : "Purchase & Pay Contributors"}
        </button>
      ) : (
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 text-center">
          <p className="text-emerald-800 font-medium">Purchase Complete</p>
          <p className="text-emerald-600 text-sm">
            Contributors have been paid via PayPal.
          </p>
        </div>
      )}
    </main>
  );
}
