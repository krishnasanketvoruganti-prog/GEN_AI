import { useMemo, useState } from "react";
import { ArrowRight, Sparkles } from "lucide-react";
import { BENCHMARK_PROFILES } from "../data/samplesAndBenchmarks.ts";
import type {
  AugmentedSample,
  GapAuditResponse,
  GapRecipeRecommendation,
  VehicleSpecimen,
} from "../types/augmentation.ts";

interface BenchmarksBalanceProps {
  specimens: VehicleSpecimen[];
  samples: AugmentedSample[];
  onApplyGapRecipe: (recipe: GapRecipeRecommendation) => void;
}

const VEHICLE_CLASSES = [
  "sedan",
  "suv",
  "hatchback",
  "commercial",
  "pickup",
  "coupe",
  "motorcycle",
] as const;
const DAMAGE_CLASSES = ["dent", "scratch", "crack", "shatter", "scuff", "crease"] as const;

export function BenchmarksBalance({
  specimens,
  samples,
  onApplyGapRecipe,
}: BenchmarksBalanceProps) {
  const [mixRatioPct, setMixRatioPct] = useState(30);
  const [gapAudit, setGapAudit] = useState<GapAuditResponse | null>(null);
  const [isAuditing, setIsAuditing] = useState(false);
  const [auditError, setAuditError] = useState<string | null>(null);

  const acceptedSamples = useMemo(
    () =>
      samples.filter(
        (s) =>
          s.humanReview !== "Rejected" &&
          (s.humanReview === "Accepted" || s.quality.autoDecision === "Accepted")
      ),
    [samples]
  );

  const vehicleCounts = useMemo(() => {
    const counts: Record<string, { real: number; synthetic: number }> = {};
    for (const vt of VEHICLE_CLASSES) {
      counts[vt] = { real: 0, synthetic: 0 };
    }
    for (const sp of specimens) {
      if (counts[sp.vehicleType]) counts[sp.vehicleType].real += 1;
    }
    for (const sa of acceptedSamples) {
      if (counts[sa.vehicleType]) counts[sa.vehicleType].synthetic += 1;
    }
    return counts;
  }, [specimens, acceptedSamples]);

  const damageCounts = useMemo(() => {
    const counts: Record<string, { real: number; synthetic: number }> = {};
    for (const dc of DAMAGE_CLASSES) {
      counts[dc] = { real: 0, synthetic: 0 };
    }
    for (const sp of specimens) {
      for (const det of sp.detections) {
        if (counts[det.damageType]) counts[det.damageType].real += 1;
      }
    }
    for (const sa of acceptedSamples) {
      for (const det of sa.transformedDetections) {
        if (counts[det.damageType]) counts[det.damageType].synthetic += 1;
      }
    }
    return counts;
  }, [specimens, acceptedSamples]);

  const lightingCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const sa of acceptedSamples) {
      counts[sa.config.lighting] = (counts[sa.config.lighting] ?? 0) + 1;
    }
    return counts;
  }, [acceptedSamples]);

  const closestBenchmark = useMemo(() => {
    return BENCHMARK_PROFILES.reduce((best, curr) =>
      Math.abs(curr.syntheticSharePct - mixRatioPct) <
      Math.abs(best.syntheticSharePct - mixRatioPct)
        ? curr
        : best
    );
  }, [mixRatioPct]);

  const handleRunGapAudit = async () => {
    setIsAuditing(true);
    setAuditError(null);
    try {
      const res = await fetch("/api/vlm/gap-audit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          vehicleDistribution: vehicleCounts,
          damageDistribution: damageCounts,
          lightingDistribution: lightingCounts,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to run dataset gap audit.");
      }
      setGapAudit(data as GapAuditResponse);
    } catch (err) {
      setAuditError(
        err instanceof Error ? err.message : "Failed to run dataset gap audit."
      );
    } finally {
      setIsAuditing(false);
    }
  };

  return (
    <div className="max-w-[1440px] mx-auto px-6 py-6 space-y-6">
      {/* Top Summary Strip */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-lg font-semibold text-slate-900">
            Dataset Balance & Downstream Benchmark Evaluation
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Track underrepresented vehicle/damage classes and validate synthetic
            mixing ratios against held-out real test metrics (FID, KID, mAP@50,
            Mask IoU, Cost MAE).
          </p>
        </div>
        <button
          type="button"
          onClick={handleRunGapAudit}
          disabled={isAuditing}
          className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-blue-700 hover:bg-blue-800 rounded-lg transition-colors whitespace-nowrap cursor-pointer disabled:opacity-50"
        >
          <Sparkles className="w-3.5 h-3.5" />
          {isAuditing ? "Auditing Dataset Gaps..." : "Run VLM Gap Audit"}
        </button>
      </div>

      {auditError ? (
        <div className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg px-4 py-2.5">
          {auditError}
        </div>
      ) : null}

      {/* VLM Gap Recommendations (when generated) */}
      {gapAudit ? (
        <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="font-display text-sm font-semibold text-slate-900">
                VLM Gap Audit Recommendations
              </h2>
              <p className="text-xs text-slate-600 mt-0.5">{gapAudit.summary}</p>
            </div>
            <div className="text-xs font-medium text-amber-800 bg-amber-50 border border-amber-200 px-3 py-1 rounded-md">
              Primary Gap: {gapAudit.bottleneckClass}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {gapAudit.recipes.map((rec, idx) => (
              <div
                key={`${rec.title}-${idx}`}
                className="border border-slate-200 rounded-lg p-4 flex flex-col justify-between gap-3 bg-slate-50/50"
              >
                <div className="space-y-1.5">
                  <div className="text-xs font-semibold text-slate-900">
                    {rec.title}
                  </div>
                  <div className="text-[11px] text-slate-500">
                    {rec.targetVehicleType} · {rec.targetDamageType} ·{" "}
                    <span className="font-mono tabular-nums">
                      +{rec.recommendedCount} samples
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    {rec.rationale}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => onApplyGapRecipe(rec)}
                  className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-blue-700 bg-white hover:bg-blue-50 border border-blue-200 rounded-md transition-colors cursor-pointer"
                >
                  Apply Recipe in Studio
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {/* Class Distribution Grid: Real vs Accepted Synthetic */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-sm font-semibold text-slate-900">
              Vehicle Body-Type Coverage
            </h2>
            <span className="text-xs text-slate-500">
              Real Source + Accepted Synthetic
            </span>
          </div>
          <div className="space-y-3">
            {VEHICLE_CLASSES.map((vt) => {
              const c = vehicleCounts[vt];
              const total = c.real + c.synthetic;
              const realW = Math.min(100, c.real * 14);
              const synW = Math.min(100 - realW, c.synthetic * 14);
              return (
                <div key={vt} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="capitalize font-medium text-slate-800">
                      {vt}
                    </span>
                    <span className="font-mono tabular-nums text-slate-600">
                      {c.real} real · {c.synthetic} aug ({total} total)
                    </span>
                  </div>
                  <div className="h-2.5 w-full bg-slate-100 rounded-full overflow-hidden flex">
                    <div
                      className="bg-slate-800 h-full"
                      style={{ width: `${realW}%` }}
                    />
                    <div
                      className="bg-blue-600 h-full"
                      style={{ width: `${synW}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-sm font-semibold text-slate-900">
              Damage Class Distribution
            </h2>
            <span className="text-xs text-slate-500">
              Addresses rare severe damage skew
            </span>
          </div>
          <div className="space-y-3">
            {DAMAGE_CLASSES.map((dc) => {
              const c = damageCounts[dc];
              const total = c.real + c.synthetic;
              const realW = Math.min(100, c.real * 12);
              const synW = Math.min(100 - realW, c.synthetic * 12);
              return (
                <div key={dc} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="capitalize font-medium text-slate-800">
                      {dc}
                    </span>
                    <span className="font-mono tabular-nums text-slate-600">
                      {c.real} real · {c.synthetic} aug ({total} total)
                    </span>
                  </div>
                  <div className="h-2.5 w-full bg-slate-100 rounded-full overflow-hidden flex">
                    <div
                      className="bg-slate-800 h-full"
                      style={{ width: `${realW}%` }}
                    />
                    <div
                      className="bg-blue-600 h-full"
                      style={{ width: `${synW}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Real-vs-Synthetic Mixing Ratio Simulator & Benchmark Table */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-200">
          <div>
            <h2 className="font-display text-sm font-semibold text-slate-900">
              Real-Plus-Synthetic Mixing Ratio & Downstream Lift
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Reference validation profile comparing held-out real test
              performance across synthetic mixing ratios. Avoid 100% synthetic
              training to prevent clear-coat texture drift.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs font-medium text-slate-700">
              Synthetic Mix Share:
            </span>
            <input
              type="range"
              min={0}
              max={100}
              step={5}
              value={mixRatioPct}
              onChange={(e) => setMixRatioPct(Number(e.target.value))}
              className="w-40 accent-blue-700"
            />
            <span className="font-mono tabular-nums text-xs font-semibold text-blue-700 w-10 text-right">
              {mixRatioPct}%
            </span>
          </div>
        </div>

        {/* Selected Regime KPI Strip */}
        <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
            <div className="text-[11px] text-slate-500">FID (vs Real)</div>
            <div className="font-mono tabular-nums text-lg font-semibold text-slate-900 mt-0.5">
              {closestBenchmark.fid.toFixed(1)}
            </div>
          </div>
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
            <div className="text-[11px] text-slate-500">KID</div>
            <div className="font-mono tabular-nums text-lg font-semibold text-slate-900 mt-0.5">
              {closestBenchmark.kid.toFixed(3)}
            </div>
          </div>
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
            <div className="text-[11px] text-slate-500">Detection mAP@50</div>
            <div className="font-mono tabular-nums text-lg font-semibold text-blue-700 mt-0.5">
              {(closestBenchmark.map50 * 100).toFixed(1)}%
            </div>
          </div>
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
            <div className="text-[11px] text-slate-500">Seg Mask IoU</div>
            <div className="font-mono tabular-nums text-lg font-semibold text-slate-900 mt-0.5">
              {(closestBenchmark.maskIoU * 100).toFixed(1)}%
            </div>
          </div>
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
            <div className="text-[11px] text-slate-500">Precision / Recall</div>
            <div className="font-mono tabular-nums text-lg font-semibold text-slate-900 mt-0.5">
              {closestBenchmark.precision.toFixed(2)} /{" "}
              {closestBenchmark.recall.toFixed(2)}
            </div>
          </div>
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
            <div className="text-[11px] text-slate-500">Repair Cost MAE</div>
            <div className="font-mono tabular-nums text-lg font-semibold text-slate-900 mt-0.5">
              ${closestBenchmark.costMaeUsd}
            </div>
          </div>
        </div>

        {/* Full Comparison Table */}
        <div className="overflow-x-auto border border-slate-200 rounded-lg">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-600">
              <tr>
                <th className="py-2.5 px-4 font-medium">Training Mix Regime</th>
                <th className="py-2.5 px-4 font-medium text-right">
                  Synthetic %
                </th>
                <th className="py-2.5 px-4 font-medium text-right">FID</th>
                <th className="py-2.5 px-4 font-medium text-right">KID</th>
                <th className="py-2.5 px-4 font-medium text-right">mAP@50</th>
                <th className="py-2.5 px-4 font-medium text-right">Mask IoU</th>
                <th className="py-2.5 px-4 font-medium text-right">Cost MAE</th>
                <th className="py-2.5 px-4 font-medium">
                  Generalization Diagnosis
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {BENCHMARK_PROFILES.map((row) => {
                const isSelected = row.regime === closestBenchmark.regime;
                return (
                  <tr
                    key={row.regime}
                    onClick={() => setMixRatioPct(row.syntheticSharePct)}
                    className={`cursor-pointer transition-colors ${
                      isSelected ? "bg-blue-50/70" : "hover:bg-slate-50"
                    }`}
                  >
                    <td className="py-2.5 px-4 font-semibold text-slate-900">
                      {row.regime}
                    </td>
                    <td className="py-2.5 px-4 text-right font-mono tabular-nums">
                      {row.syntheticSharePct}%
                    </td>
                    <td className="py-2.5 px-4 text-right font-mono tabular-nums">
                      {row.fid.toFixed(1)}
                    </td>
                    <td className="py-2.5 px-4 text-right font-mono tabular-nums">
                      {row.kid.toFixed(3)}
                    </td>
                    <td className="py-2.5 px-4 text-right font-mono tabular-nums font-semibold text-blue-700">
                      {(row.map50 * 100).toFixed(1)}%
                    </td>
                    <td className="py-2.5 px-4 text-right font-mono tabular-nums">
                      {(row.maskIoU * 100).toFixed(1)}%
                    </td>
                    <td className="py-2.5 px-4 text-right font-mono tabular-nums">
                      ${row.costMaeUsd}
                    </td>
                    <td className="py-2.5 px-4 text-slate-600">{row.notes}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
