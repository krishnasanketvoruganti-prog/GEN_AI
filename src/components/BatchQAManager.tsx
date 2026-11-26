import { useMemo, useState } from "react";
import { Check, Download, ShieldCheck, Trash2, X } from "lucide-react";
import { LIGHTING_PRESETS, PARADIGM_OPTIONS } from "../data/samplesAndBenchmarks.ts";
import type { AugmentedSample, VlmQaAuditResult } from "../types/augmentation.ts";
import { imageUrlToBase64 } from "../utils/imageAugmentor.ts";

interface BatchQAManagerProps {
  samples: AugmentedSample[];
  onUpdateSample: (id: string, patch: Partial<AugmentedSample>) => void;
  onRemoveSample: (id: string) => void;
  onExportCoco: () => void;
  onExportYolo: () => void;
  onGoToStudio: () => void;
}

export function BatchQAManager({
  samples,
  onUpdateSample,
  onRemoveSample,
  onExportCoco,
  onExportYolo,
  onGoToStudio,
}: BatchQAManagerProps) {
  const [filter, setFilter] = useState<"all" | "accepted" | "flagged">("all");
  const [minIou, setMinIou] = useState(0.72);
  const [maxClipPct, setMaxClipPct] = useState(14.5);
  const [minSharpness, setMinSharpness] = useState(45);
  const [auditingId, setAuditingId] = useState<string | null>(null);
  const [auditError, setAuditError] = useState<string | null>(null);

  const evaluatedSamples = useMemo(() => {
    return samples.map((s) => {
      const passesThresholds =
        s.quality.bboxIouRetention >= minIou &&
        s.quality.highlightClippingPct <= maxClipPct &&
        s.quality.laplacianSharpness >= minSharpness;
      const effectiveStatus =
        s.humanReview === "Rejected"
          ? "Rejected"
          : s.humanReview === "Accepted"
          ? "Accepted"
          : passesThresholds
          ? "Accepted"
          : "Flagged";
      return { sample: s, passesThresholds, effectiveStatus };
    });
  }, [samples, minIou, maxClipPct, minSharpness]);

  const filtered = useMemo(() => {
    return evaluatedSamples.filter((row) => {
      if (filter === "accepted") return row.effectiveStatus === "Accepted";
      if (filter === "flagged")
        return row.effectiveStatus === "Flagged" || row.effectiveStatus === "Rejected";
      return true;
    });
  }, [evaluatedSamples, filter]);

  const acceptedCount = evaluatedSamples.filter(
    (r) => r.effectiveStatus === "Accepted"
  ).length;
  const flaggedCount = evaluatedSamples.length - acceptedCount;

  const handleRunVlmQa = async (sample: AugmentedSample) => {
    setAuditingId(sample.id);
    setAuditError(null);
    try {
      const { base64, mimeType } = await imageUrlToBase64(sample.imageDataUrl);
      const lightingLabel =
        LIGHTING_PRESETS.find((l) => l.id === sample.config.lighting)?.label ??
        sample.config.lighting;
      const paradigmName =
        PARADIGM_OPTIONS.find((p) => p.id === sample.config.paradigm)?.name ??
        sample.config.paradigm;

      const res = await fetch("/api/vlm/qa-audit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          imageBase64: base64,
          mimeType,
          targetCondition: lightingLabel,
          expectedPart: sample.primaryPart,
          expectedDamageType: sample.primaryDamageType,
          paradigm: paradigmName,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "VLM QA audit failed");
      }

      const verdictRaw = String(data.verdict ?? "REVIEW").toUpperCase();
      const verdict: VlmQaAuditResult["verdict"] =
        verdictRaw === "PASS" || verdictRaw === "REJECT" ? verdictRaw : "REVIEW";

      const vlmAudit: VlmQaAuditResult = {
        labelPreserved: Boolean(data.labelPreserved ?? true),
        specularRealismScore: Math.max(
          0,
          Math.min(100, Number(data.specularRealismScore ?? 80))
        ),
        artifactFlags: Array.isArray(data.artifactFlags)
          ? data.artifactFlags.map(String)
          : [],
        verdict,
        reasoning: String(data.reasoning ?? "Completed VLM semantic review."),
      };

      onUpdateSample(sample.id, { vlmAudit });
    } catch (err) {
      setAuditError(
        err instanceof Error ? err.message : "VLM QA audit request failed."
      );
    } finally {
      setAuditingId(null);
    }
  };

  if (samples.length === 0) {
    return (
      <div className="max-w-4xl mx-auto px-6 py-16">
        <div className="bg-white border border-slate-200 rounded-xl p-10 text-center space-y-4">
          <h2 className="font-display text-lg font-semibold text-slate-900">
            No Augmented Variations Queued Yet
          </h2>
          <p className="text-sm text-slate-600 max-w-lg mx-auto">
            Generate domain-shifted or mask-inpainted samples in Pipeline Studio
            to run sharpness, glare clipping, label IoU, and VLM semantic QA
            filtering.
          </p>
          <button
            type="button"
            onClick={onGoToStudio}
            className="px-4 py-2 text-xs font-semibold text-white bg-blue-700 hover:bg-blue-800 rounded-lg transition-colors cursor-pointer"
          >
            Open Pipeline Studio
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-[1440px] mx-auto px-6 py-6 space-y-6">
      {/* Header & Filter Controls */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-lg font-semibold text-slate-900">
            Quality Filtering & Spot-Check Queue
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Screen out blur, glare blowout, and label drift before mixing synthetic
            images with real training claims.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
            <button
              type="button"
              onClick={() => setFilter("all")}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                filter === "all"
                  ? "bg-white text-slate-900 shadow-sm"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              All ({samples.length})
            </button>
            <button
              type="button"
              onClick={() => setFilter("accepted")}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                filter === "accepted"
                  ? "bg-white text-slate-900 shadow-sm"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Accepted ({acceptedCount})
            </button>
            <button
              type="button"
              onClick={() => setFilter("flagged")}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                filter === "flagged"
                  ? "bg-white text-slate-900 shadow-sm"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Flagged ({flaggedCount})
            </button>
          </div>

          <button
            type="button"
            onClick={onExportCoco}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-blue-700 hover:bg-blue-800 rounded-lg transition-colors whitespace-nowrap cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            Export COCO JSON
          </button>

          <button
            type="button"
            onClick={onExportYolo}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-slate-800 bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded-lg transition-colors whitespace-nowrap cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            Export YOLO TXT
          </button>
        </div>
      </div>

      {/* Automated Filter Thresholds */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 grid grid-cols-1 md:grid-cols-3 gap-6">
        <label className="space-y-1.5">
          <div className="flex justify-between text-xs">
            <span className="font-medium text-slate-700">
              Minimum Label IoU Retention
            </span>
            <span className="font-mono tabular-nums text-slate-900 font-semibold">
              {minIou.toFixed(2)}
            </span>
          </div>
          <input
            type="range"
            min={0.5}
            max={0.98}
            step={0.02}
            value={minIou}
            onChange={(e) => setMinIou(Number(e.target.value))}
            className="w-full accent-blue-700"
          />
        </label>

        <label className="space-y-1.5">
          <div className="flex justify-between text-xs">
            <span className="font-medium text-slate-700">
              Max Highlight Clipping %
            </span>
            <span className="font-mono tabular-nums text-slate-900 font-semibold">
              {maxClipPct.toFixed(1)}%
            </span>
          </div>
          <input
            type="range"
            min={2}
            max={35}
            step={0.5}
            value={maxClipPct}
            onChange={(e) => setMaxClipPct(Number(e.target.value))}
            className="w-full accent-blue-700"
          />
        </label>

        <label className="space-y-1.5">
          <div className="flex justify-between text-xs">
            <span className="font-medium text-slate-700">
              Min Laplacian Sharpness
            </span>
            <span className="font-mono tabular-nums text-slate-900 font-semibold">
              {minSharpness}
            </span>
          </div>
          <input
            type="range"
            min={10}
            max={140}
            step={5}
            value={minSharpness}
            onChange={(e) => setMinSharpness(Number(e.target.value))}
            className="w-full accent-blue-700"
          />
        </label>
      </div>

      {auditError ? (
        <div className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg px-4 py-2.5">
          {auditError}
        </div>
      ) : null}

      {/* Sample Cards & QA Telemetry Table */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-600">
              <tr>
                <th className="py-3 px-4 font-medium">Augmented Frame</th>
                <th className="py-3 px-4 font-medium">Paradigm & Condition</th>
                <th className="py-3 px-4 font-medium">Target Label</th>
                <th className="py-3 px-4 font-medium text-right">Sharpness</th>
                <th className="py-3 px-4 font-medium text-right">Glare Clip</th>
                <th className="py-3 px-4 font-medium text-right">Label IoU</th>
                <th className="py-3 px-4 font-medium">Filter Status</th>
                <th className="py-3 px-4 font-medium">VLM QA Audit</th>
                <th className="py-3 px-4 font-medium text-right">Spot-Check</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map(({ sample, effectiveStatus }) => {
                const lightingLabel =
                  LIGHTING_PRESETS.find((l) => l.id === sample.config.lighting)
                    ?.label ?? sample.config.lighting;
                const paradigmName =
                  PARADIGM_OPTIONS.find((p) => p.id === sample.config.paradigm)
                    ?.name ?? sample.config.paradigm;

                return (
                  <tr key={sample.id} className="hover:bg-slate-50/70 align-top">
                    <td className="py-3 px-4">
                      <div className="w-28 aspect-[4/3] rounded-md overflow-hidden bg-slate-900 border border-slate-200">
                        <img
                          src={sample.imageDataUrl}
                          alt={sample.sourceName}
                          referrerPolicy="no-referrer"
                          className="w-full h-full object-cover"
                        />
                      </div>
                    </td>

                    <td className="py-3 px-4">
                      <div className="font-semibold text-slate-900">
                        {lightingLabel}
                      </div>
                      <div className="text-slate-500 mt-0.5">
                        {paradigmName}
                      </div>
                      <div className="text-[11px] font-mono text-slate-500 mt-1 tabular-nums">
                        Yaw {sample.config.perspectiveYawDeg > 0 ? "+" : ""}
                        {sample.config.perspectiveYawDeg}° · Seed #
                        {sample.config.seed}
                      </div>
                    </td>

                    <td className="py-3 px-4">
                      <div className="font-medium text-slate-900">
                        {sample.primaryPart}
                      </div>
                      <div className="text-slate-600 capitalize mt-0.5">
                        {sample.vehicleType} · {sample.primaryDamageType} (
                        {sample.severity})
                      </div>
                      {sample.hasInpaintedDamage ? (
                        <div className="text-[11px] text-rose-700 mt-0.5">
                          Masked Damage Inpainted
                        </div>
                      ) : null}
                    </td>

                    <td className="py-3 px-4 text-right font-mono tabular-nums text-slate-800">
                      {sample.quality.laplacianSharpness}
                    </td>

                    <td className="py-3 px-4 text-right font-mono tabular-nums text-slate-800">
                      {sample.quality.highlightClippingPct}%
                    </td>

                    <td className="py-3 px-4 text-right font-mono tabular-nums text-slate-800">
                      {sample.quality.bboxIouRetention.toFixed(2)}
                    </td>

                    <td className="py-3 px-4">
                      <span
                        className={`font-semibold ${
                          effectiveStatus === "Accepted"
                            ? "text-emerald-700"
                            : effectiveStatus === "Flagged"
                            ? "text-amber-700"
                            : "text-red-700"
                        }`}
                      >
                        {effectiveStatus}
                      </span>
                      {sample.quality.flagReason ? (
                        <p className="text-[11px] text-slate-500 max-w-[180px] mt-0.5 leading-snug">
                          {sample.quality.flagReason}
                        </p>
                      ) : null}
                    </td>

                    <td className="py-3 px-4 max-w-[230px]">
                      {sample.vlmAudit ? (
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span
                              className={`font-semibold ${
                                sample.vlmAudit.verdict === "PASS"
                                  ? "text-emerald-700"
                                  : sample.vlmAudit.verdict === "REVIEW"
                                  ? "text-amber-700"
                                  : "text-red-700"
                              }`}
                            >
                              VLM {sample.vlmAudit.verdict}
                            </span>
                            <span className="font-mono tabular-nums text-slate-500">
                              Realism {sample.vlmAudit.specularRealismScore}/100
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-600 leading-snug">
                            {sample.vlmAudit.reasoning}
                          </p>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleRunVlmQa(sample)}
                          disabled={auditingId === sample.id}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-md transition-colors whitespace-nowrap cursor-pointer disabled:opacity-50"
                        >
                          <ShieldCheck className="w-3.5 h-3.5" />
                          {auditingId === sample.id
                            ? "Auditing..."
                            : "Run VLM QA"}
                        </button>
                      )}
                    </td>

                    <td className="py-3 px-4 text-right">
                      <div className="inline-flex items-center gap-1">
                        <button
                          type="button"
                          title="Accept sample"
                          onClick={() =>
                            onUpdateSample(sample.id, {
                              humanReview: "Accepted",
                            })
                          }
                          className={`p-1.5 rounded-md border transition-colors cursor-pointer ${
                            sample.humanReview === "Accepted"
                              ? "border-emerald-600 bg-emerald-50 text-emerald-700"
                              : "border-slate-200 text-slate-600 hover:bg-slate-50"
                          }`}
                        >
                          <Check className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          title="Reject sample"
                          onClick={() =>
                            onUpdateSample(sample.id, {
                              humanReview: "Rejected",
                            })
                          }
                          className={`p-1.5 rounded-md border transition-colors cursor-pointer ${
                            sample.humanReview === "Rejected"
                              ? "border-red-600 bg-red-50 text-red-700"
                              : "border-slate-200 text-slate-600 hover:bg-slate-50"
                          }`}
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          title="Remove from queue"
                          onClick={() => onRemoveSample(sample.id)}
                          className="p-1.5 rounded-md border border-slate-200 text-slate-500 hover:text-red-700 hover:bg-red-50 transition-colors cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
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
