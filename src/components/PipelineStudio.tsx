import { useEffect, useRef, useState } from "react";
import {
  Download,
  Eraser,
  Eye,
  EyeOff,
  Layers,
  Paintbrush,
  RefreshCw,
  ScanSearch,
  Sparkles,
  Upload,
} from "lucide-react";
import {
  LIGHTING_PRESETS,
  PAINT_PRESETS,
  PARADIGM_OPTIONS,
} from "../data/samplesAndBenchmarks.ts";
import type {
  AugmentationConfig,
  BrushPoint,
  ConditioningMapMode,
  DamageDetection,
  QualityMetrics,
  StudioViewportMode,
  VehicleSpecimen,
} from "../types/augmentation.ts";
import {
  imageUrlToBase64,
  renderConditioningMap,
  runAugmentationPipeline,
} from "../utils/imageAugmentor.ts";

interface PipelineStudioProps {
  specimens: VehicleSpecimen[];
  activeSpecimenId: string;
  onSelectSpecimen: (id: string) => void;
  onAddSpecimen: (specimen: VehicleSpecimen) => void;
  onUpdateSpecimen: (specimen: VehicleSpecimen) => void;
  config: AugmentationConfig;
  onChangeConfig: (next: AugmentationConfig) => void;
  onAddBatchSamples: (
    items: Array<{
      imageDataUrl: string;
      config: AugmentationConfig;
      transformedDetections: DamageDetection[];
      quality: QualityMetrics;
      hasInpaintedDamage: boolean;
    }>
  ) => void;
}

const VIEWPORT_MODES: { id: StudioViewportMode; label: string }[] = [
  { id: "conditioning", label: "Conditioning & Synthesis" },
  { id: "split_compare", label: "Split Compare" },
  { id: "inpaint_mask", label: "Inpaint Mask Brush" },
  { id: "classical_vs_genai", label: "Classical vs. GenAI" },
];

const MAP_MODES: { id: ConditioningMapMode; label: string }[] = [
  { id: "rgb", label: "Source RGB" },
  { id: "canny", label: "Canny Edges" },
  { id: "normal", label: "Surface Normals" },
  { id: "semantic", label: "SPADE Mask" },
];

export function PipelineStudio({
  specimens,
  activeSpecimenId,
  onSelectSpecimen,
  onAddSpecimen,
  onUpdateSpecimen,
  config,
  onChangeConfig,
  onAddBatchSamples,
}: PipelineStudioProps) {
  const specimen =
    specimens.find((s) => s.id === activeSpecimenId) ?? specimens[0];

  const [viewportMode, setViewportMode] =
    useState<StudioViewportMode>("conditioning");
  const [mapMode, setMapMode] = useState<ConditioningMapMode>("rgb");
  const [showBoxes, setShowBoxes] = useState(true);
  const [splitPct, setSplitPct] = useState(52);

  const [conditioningUrl, setConditioningUrl] = useState<string>(
    specimen.imageUrl
  );
  const [augmentedUrl, setAugmentedUrl] = useState<string>(specimen.imageUrl);
  const [classicalUrl, setClassicalUrl] = useState<string>(specimen.imageUrl);
  const [transformedDetections, setTransformedDetections] = useState<
    DamageDetection[]
  >(specimen.detections);
  const [quality, setQuality] = useState<QualityMetrics | null>(null);
  const [hasInpainted, setHasInpainted] = useState(false);

  const [brushPoints, setBrushPoints] = useState<BrushPoint[]>([]);
  const [isDrawing, setIsDrawing] = useState(false);

  const [isRendering, setIsRendering] = useState(false);
  const [isBatchGenerating, setIsBatchGenerating] = useState(false);
  const [isVlmLoading, setIsVlmLoading] = useState(false);
  const [vlmError, setVlmError] = useState<string | null>(null);
  const [batchFeedback, setBatchFeedback] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const maskCanvasRef = useRef<HTMLCanvasElement | null>(null);

  // Reset brush when changing specimen
  useEffect(() => {
    setBrushPoints([]);
    setVlmError(null);
    setBatchFeedback(null);
  }, [specimen.id]);

  // Render conditioning map whenever specimen, mapMode, or brushPoints changes
  useEffect(() => {
    let cancelled = false;
    renderConditioningMap(
      specimen.imageUrl,
      mapMode,
      specimen.detections,
      brushPoints
    )
      .then((url) => {
        if (!cancelled) setConditioningUrl(url);
      })
      .catch(() => {
        if (!cancelled) setConditioningUrl(specimen.imageUrl);
      });
    return () => {
      cancelled = true;
    };
  }, [specimen.imageUrl, specimen.detections, mapMode, brushPoints]);

  // Run live augmentation render when specimen, config, or brushPoints updates
  useEffect(() => {
    let cancelled = false;
    setIsRendering(true);
    const timer = window.setTimeout(async () => {
      try {
        const res = await runAugmentationPipeline(
          specimen,
          config,
          brushPoints
        );
        if (cancelled) return;
        setAugmentedUrl(res.imageDataUrl);
        setTransformedDetections(res.transformedDetections);
        setQuality(res.quality);
        setHasInpainted(res.hasInpaintedDamage);

        if (viewportMode === "classical_vs_genai") {
          const classicalRes = await runAugmentationPipeline(
            specimen,
            { ...config, paradigm: "classical_baseline" },
            []
          );
          if (!cancelled) setClassicalUrl(classicalRes.imageDataUrl);
        }
      } catch (err) {
        console.error(err);
      } finally {
        if (!cancelled) setIsRendering(false);
      }
    }, 60);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [specimen, config, brushPoints, viewportMode]);

  // Paint brush overlay preview onto the interactive mask canvas
  useEffect(() => {
    const canvas = maskCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (brushPoints.length === 0) return;

    ctx.fillStyle = "rgba(239, 68, 68, 0.45)";
    ctx.strokeStyle = "rgba(255, 255, 255, 0.85)";
    ctx.lineWidth = 1.5;
    for (const pt of brushPoints) {
      const cx = pt.x * canvas.width;
      const cy = pt.y * canvas.height;
      const r = Math.max(6, pt.radius * canvas.width);
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fill();
    }
  }, [brushPoints, viewportMode]);

  const handleCanvasPointer = (
    e: React.PointerEvent<HTMLCanvasElement>,
    forceDraw = false
  ) => {
    if (!isDrawing && !forceDraw) return;
    const canvas = maskCanvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const y = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height));
    const radius = config.brushRadiusPx / 720;
    setBrushPoints((prev) => [...prev, { x, y, radius }]);
  };

  const processUploadedFile = (file: File) => {
    if (!file.type.startsWith("image/")) return;
    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === "string" ? reader.result : "";
      if (!result) return;
      const newSpecimen: VehicleSpecimen = {
        id: `spec-upload-${Date.now()}`,
        name: file.name.replace(/\.[^.]+$/, ""),
        imageUrl: result,
        vehicleType: "sedan",
        carMakeModel: "Detecting car make & model...",
        primaryDamageType: "none",
        overallSeverity: "undamaged",
        damageSummary: "Analyzing uploaded vehicle photo for car type and damage classes...",
        paintFinish: "Detecting finish...",
        lighting: "Detecting lighting...",
        cameraAngle: "Detecting angle...",
        detections: [],
        isUserUploaded: true,
      };
      onAddSpecimen(newSpecimen);
      onSelectSpecimen(newSpecimen.id);
      void handleRunVlmInspect(newSpecimen);
    };
    reader.readAsDataURL(file);
  };

  const handleUploadPhoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    processUploadedFile(file);
    e.target.value = "";
  };

  const handleRunVlmInspect = async (target?: VehicleSpecimen) => {
    const targetSpecimen = target ?? specimen;
    setIsVlmLoading(true);
    setVlmError(null);
    try {
      const { base64, mimeType } = await imageUrlToBase64(targetSpecimen.imageUrl);
      const res = await fetch("/api/vlm/inspect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          imageBase64: base64,
          mimeType,
          vehicleHint: targetSpecimen.name,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "VLM inspection failed");
      }

      const validTypes = new Set([
        "sedan",
        "suv",
        "hatchback",
        "commercial",
        "motorcycle",
        "pickup",
        "coupe",
      ]);
      const validDamage = new Set([
        "dent",
        "scratch",
        "crack",
        "shatter",
        "scuff",
        "crease",
        "none",
      ]);
      const validSeverity = new Set([
        "minor",
        "moderate",
        "severe",
        "undamaged",
      ]);

      const parsedDetections: DamageDetection[] = Array.isArray(data.detections)
        ? data.detections.map((d: Record<string, unknown>, idx: number) => {
            const rawBox = Array.isArray(d.bbox) ? d.bbox : [300, 300, 600, 600];
            const bbox: [number, number, number, number] = [
              Number(rawBox[0] ?? 300),
              Number(rawBox[1] ?? 300),
              Number(rawBox[2] ?? 600),
              Number(rawBox[3] ?? 600),
            ];
            const dt = String(d.damageType ?? "dent").toLowerCase();
            const sev = String(d.severity ?? "moderate").toLowerCase();
            return {
              id: `vlm-${Date.now()}-${idx}`,
              part: String(d.part ?? "Vehicle Panel"),
              damageType: validDamage.has(dt)
                ? (dt as DamageDetection["damageType"])
                : "dent",
              severity: validSeverity.has(sev)
                ? (sev as DamageDetection["severity"])
                : "moderate",
              confidence: Math.min(1, Math.max(0.1, Number(d.confidence ?? 0.9))),
              bbox,
              repairCostMin: Number(d.repairCostMin ?? 300),
              repairCostMax: Number(d.repairCostMax ?? 650),
            };
          })
        : targetSpecimen.detections;

      const vt = String(data.vehicleType ?? targetSpecimen.vehicleType).toLowerCase();
      const pdt = String(
        data.primaryDamageType ??
          parsedDetections[0]?.damageType ??
          "none"
      ).toLowerCase();
      const osev = String(
        data.overallSeverity ??
          parsedDetections[0]?.severity ??
          "undamaged"
      ).toLowerCase();

      onUpdateSpecimen({
        ...targetSpecimen,
        vehicleType: validTypes.has(vt)
          ? (vt as VehicleSpecimen["vehicleType"])
          : targetSpecimen.vehicleType,
        carMakeModel:
          typeof data.carMakeModel === "string" && data.carMakeModel.trim()
            ? data.carMakeModel.trim()
            : targetSpecimen.carMakeModel,
        primaryDamageType: validDamage.has(pdt)
          ? (pdt as VehicleSpecimen["primaryDamageType"])
          : targetSpecimen.primaryDamageType,
        overallSeverity: validSeverity.has(osev)
          ? (osev as VehicleSpecimen["overallSeverity"])
          : targetSpecimen.overallSeverity,
        damageSummary:
          typeof data.damageSummary === "string" && data.damageSummary.trim()
            ? data.damageSummary.trim()
            : targetSpecimen.damageSummary,
        paintFinish: String(data.paintFinish ?? targetSpecimen.paintFinish),
        lighting: String(data.detectedLighting ?? targetSpecimen.lighting),
        cameraAngle: String(data.cameraAngle ?? targetSpecimen.cameraAngle),
        detections: parsedDetections,
        syntheticCaptionPrompt:
          typeof data.syntheticCaptionPrompt === "string"
            ? data.syntheticCaptionPrompt
            : targetSpecimen.syntheticCaptionPrompt,
        recommendedAugmentations: Array.isArray(data.recommendedAugmentations)
          ? data.recommendedAugmentations.map(String)
          : targetSpecimen.recommendedAugmentations,
      });
    } catch (err) {
      setVlmError(
        err instanceof Error ? err.message : "Unable to complete VLM inspection."
      );
    } finally {
      setIsVlmLoading(false);
    }
  };

  const handleAddCurrentToBatch = () => {
    if (!quality) return;
    onAddBatchSamples([
      {
        imageDataUrl: augmentedUrl,
        config: { ...config },
        transformedDetections,
        quality,
        hasInpaintedDamage: hasInpainted,
      },
    ]);
    setBatchFeedback("Added current variation to Batch & QA queue.");
    window.setTimeout(() => setBatchFeedback(null), 3000);
  };

  const handleGenerateMatrix = async () => {
    setIsBatchGenerating(true);
    setBatchFeedback(null);
    try {
      const matrixConfigs: AugmentationConfig[] = [
        { ...config, lighting: "night_lot", glareIntensity: 55, perspectiveYawDeg: -10, seed: config.seed + 1 },
        { ...config, lighting: "midday_glare", glareIntensity: 78, perspectiveYawDeg: 12, seed: config.seed + 2 },
        { ...config, lighting: "wet_rain", wetnessLevel: 82, perspectiveYawDeg: 6, seed: config.seed + 3 },
        { ...config, lighting: "dim_workshop", paintColor: "crimson_red", perspectiveYawDeg: -6, seed: config.seed + 4 },
      ];
      const results = await Promise.all(
        matrixConfigs.map(async (mc) => {
          const out = await runAugmentationPipeline(specimen, mc, brushPoints);
          return {
            imageDataUrl: out.imageDataUrl,
            config: mc,
            transformedDetections: out.transformedDetections,
            quality: out.quality,
            hasInpaintedDamage: out.hasInpaintedDamage,
          };
        })
      );
      onAddBatchSamples(results);
      setBatchFeedback("Generated 4-variant lighting & angle batch in QA queue.");
      window.setTimeout(() => setBatchFeedback(null), 3500);
    } finally {
      setIsBatchGenerating(false);
    }
  };

  const handleDownloadCurrent = () => {
    const a = document.createElement("a");
    a.href = augmentedUrl;
    a.download = `${specimen.id}-${config.lighting}-${config.seed}.jpg`;
    a.click();
  };

  const renderBoundingBoxes = (
    boxes: DamageDetection[],
    labelPrefix = ""
  ) => {
    if (!showBoxes || boxes.length === 0) return null;
    return (
      <svg
        viewBox="0 0 1000 1000"
        preserveAspectRatio="none"
        className="pointer-events-none absolute inset-0 w-full h-full"
      >
        {boxes.map((det) => {
          const [ymin, xmin, ymax, xmax] = det.bbox;
          const color = det.synthetic
            ? "#f43f5e"
            : det.severity === "severe"
            ? "#ef4444"
            : det.severity === "moderate"
            ? "#f59e0b"
            : "#38bdf8";
          const label = `${labelPrefix}${det.part} · ${det.damageType} (${det.severity})`;
          return (
            <g key={det.id}>
              <rect
                x={xmin}
                y={ymin}
                width={Math.max(8, xmax - xmin)}
                height={Math.max(8, ymax - ymin)}
                fill="none"
                stroke={color}
                strokeWidth="4"
                strokeDasharray={det.synthetic ? "10 6" : undefined}
              />
              <rect
                x={xmin}
                y={Math.max(0, ymin - 34)}
                width={Math.min(1000 - xmin, Math.max(180, label.length * 10.5))}
                height="32"
                fill="rgba(15, 23, 42, 0.86)"
              />
              <text
                x={xmin + 8}
                y={Math.max(22, ymin - 12)}
                fill="#ffffff"
                fontSize="19"
                fontFamily="JetBrains Mono, monospace"
              >
                {label}
              </text>
            </g>
          );
        })}
      </svg>
    );
  };

  const activeParadigm = PARADIGM_OPTIONS.find((p) => p.id === config.paradigm);

  return (
    <div className="max-w-[1440px] mx-auto px-6 py-6 grid grid-cols-1 lg:grid-cols-[260px_minmax(0,1fr)_320px] gap-6 items-start">
      {/* LEFT RAIL: Specimen Library */}
      <aside
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          const file = e.dataTransfer.files?.[0];
          if (file) processUploadedFile(file);
        }}
        className="bg-white border border-slate-200 rounded-xl p-4 space-y-4"
      >
        <div className="flex items-center justify-between gap-2">
          <h2 className="font-display text-sm font-semibold text-slate-900">
            Vehicle Specimens
          </h2>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Upload className="w-3.5 h-3.5" />
            Upload Photo
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={handleUploadPhoto}
            className="hidden"
          />
        </div>
        <p className="text-[11px] text-slate-500 -mt-2">
          Drop any car photo here to auto-detect car type and damage classes.
        </p>

        <div className="space-y-2">
          {specimens.map((item) => {
            const selected = item.id === specimen.id;
            const primaryDet = item.detections[0];
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onSelectSpecimen(item.id)}
                className={`w-full text-left rounded-lg border p-2.5 transition-colors cursor-pointer ${
                  selected
                    ? "border-blue-600 bg-blue-50/50"
                    : "border-slate-200 bg-white hover:bg-slate-50"
                }`}
              >
                <div className="aspect-[4/3] w-full rounded-md overflow-hidden bg-slate-900 mb-2">
                  <img
                    src={item.imageUrl}
                    alt={item.name}
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="text-xs font-semibold text-slate-900 truncate">
                  {item.name}
                </div>
                <div className="mt-1 text-[11px] text-slate-500 flex items-center gap-1.5 truncate">
                  <span className="capitalize">{item.vehicleType}</span>
                  <span aria-hidden="true">·</span>
                  <span>
                    {primaryDet
                      ? `${primaryDet.damageType} (${item.detections.length})`
                      : "Undamaged base"}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </aside>

      {/* CENTER WORKBENCH: Inspection & Synthesis Viewport */}
      <section className="space-y-5 min-w-0">
        {/* Viewport Mode & Overlay Toolbar */}
        <div className="bg-white border border-slate-200 rounded-xl p-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg overflow-x-auto">
            {VIEWPORT_MODES.map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => setViewportMode(m.id)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  viewportMode === m.id
                    ? "bg-white text-slate-900 shadow-sm"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setShowBoxes((v) => !v)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-slate-200 rounded-lg text-slate-700 hover:bg-slate-50 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              {showBoxes ? (
                <Eye className="w-3.5 h-3.5" />
              ) : (
                <EyeOff className="w-3.5 h-3.5" />
              )}
              {showBoxes ? "Boxes On" : "Boxes Off"}
            </button>

            <button
              type="button"
              onClick={handleDownloadCurrent}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-slate-200 rounded-lg text-slate-700 hover:bg-slate-50 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              Save JPG
            </button>
          </div>
        </div>

        {/* Car Type & Damage Type Identification Strip */}
        <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="space-y-0.5 min-w-0">
              <div className="text-xs font-semibold text-slate-900">
                Detected Car Type & Damage Classification
              </div>
              <p className="text-xs text-slate-600">
                {specimen.damageSummary ??
                  `${specimen.vehicleType} · ${
                    transformedDetections.length > 0
                      ? transformedDetections
                          .map((d) => `${d.damageType} on ${d.part}`)
                          .join(", ")
                      : "Undamaged vehicle base"
                  }`}
              </p>
            </div>

            <button
              type="button"
              onClick={() => void handleRunVlmInspect()}
              disabled={isVlmLoading}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-blue-700 hover:bg-blue-800 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-50"
            >
              <ScanSearch className="w-3.5 h-3.5" />
              {isVlmLoading ? "Detecting Car & Damage..." : "Detect Car & Damage"}
            </button>
          </div>

          {vlmError ? (
            <div className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              {vlmError}
            </div>
          ) : null}

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-2 border-t border-slate-100">
            <div>
              <label className="block text-[11px] text-slate-500 mb-1">
                Car Body Type
              </label>
              <select
                value={specimen.vehicleType}
                onChange={(e) =>
                  onUpdateSpecimen({
                    ...specimen,
                    vehicleType: e.target.value as VehicleSpecimen["vehicleType"],
                  })
                }
                className="w-full border border-slate-200 rounded-md px-2 py-1 text-xs font-semibold text-slate-900 bg-slate-50 capitalize"
              >
                <option value="sedan">Sedan</option>
                <option value="suv">SUV / Crossover</option>
                <option value="hatchback">Hatchback</option>
                <option value="commercial">Commercial Van</option>
                <option value="pickup">Pickup Truck</option>
                <option value="coupe">Coupe</option>
                <option value="motorcycle">Motorcycle</option>
              </select>
            </div>

            <div>
              <div className="text-[11px] text-slate-500 mb-1">
                Make & Model
              </div>
              <div className="text-xs font-semibold text-slate-900 truncate py-1">
                {specimen.carMakeModel ?? `${specimen.vehicleType.toUpperCase()} Specimen`}
              </div>
            </div>

            <div>
              <label className="block text-[11px] text-slate-500 mb-1">
                Primary Damage Type
              </label>
              <select
                value={
                  specimen.primaryDamageType ??
                  transformedDetections[0]?.damageType ??
                  "none"
                }
                onChange={(e) =>
                  onUpdateSpecimen({
                    ...specimen,
                    primaryDamageType: e.target
                      .value as VehicleSpecimen["primaryDamageType"],
                  })
                }
                className="w-full border border-slate-200 rounded-md px-2 py-1 text-xs font-semibold text-slate-900 bg-slate-50 capitalize"
              >
                <option value="dent">Dent</option>
                <option value="scratch">Scratch</option>
                <option value="crack">Crack</option>
                <option value="shatter">Shatter</option>
                <option value="scuff">Scuff</option>
                <option value="crease">Crease</option>
                <option value="none">Undamaged</option>
              </select>
            </div>

            <div>
              <div className="text-[11px] text-slate-500 mb-1">
                Severity & Damage Count
              </div>
              <div className="text-xs font-semibold text-slate-900 capitalize py-1 tabular-nums">
                {specimen.overallSeverity ??
                  transformedDetections[0]?.severity ??
                  "undamaged"}
                <span className="text-slate-500 font-normal ml-1.5">
                  ({transformedDetections.length}{" "}
                  {transformedDetections.length === 1 ? "region" : "regions"})
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Main Image Viewport */}
        <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-4">
          {viewportMode === "conditioning" && (
            <>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="text-xs text-slate-600">
                  <span className="font-semibold text-slate-900">
                    Structural Conditioning & Output Preview
                  </span>
                  <span className="mx-2 text-slate-300" aria-hidden="true">
                    |
                  </span>
                  <span>{activeParadigm?.conditioningSignal}</span>
                </div>
                <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
                  {MAP_MODES.map((mm) => (
                    <button
                      key={mm.id}
                      type="button"
                      onClick={() => setMapMode(mm.id)}
                      className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                        mapMode === mm.id
                          ? "bg-white text-slate-900 shadow-sm"
                          : "text-slate-600 hover:text-slate-900"
                      }`}
                    >
                      {mm.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs text-slate-500">
                    <span>
                      Input Signal:{" "}
                      {MAP_MODES.find((m) => m.id === mapMode)?.label}
                    </span>
                    <span className="font-mono tabular-nums">
                      {specimen.detections.length} ground-truth boxes
                    </span>
                  </div>
                  <div className="relative aspect-[4/3] w-full rounded-lg overflow-hidden canvas-grid-bg border border-slate-200">
                    <img
                      src={conditioningUrl}
                      alt={`${specimen.name} conditioning map`}
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover"
                    />
                    {renderBoundingBoxes(specimen.detections)}
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs text-slate-500">
                    <span>
                      Augmented Output:{" "}
                      {
                        LIGHTING_PRESETS.find((l) => l.id === config.lighting)
                          ?.label
                      }
                    </span>
                    <span className="font-mono tabular-nums">
                      {isRendering ? "Synthesizing..." : `Seed #${config.seed}`}
                    </span>
                  </div>
                  <div className="relative aspect-[4/3] w-full rounded-lg overflow-hidden canvas-grid-bg border border-slate-200">
                    <img
                      src={augmentedUrl}
                      alt={`${specimen.name} augmented output`}
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover"
                    />
                    {renderBoundingBoxes(transformedDetections)}
                  </div>
                </div>
              </div>
            </>
          )}

          {viewportMode === "split_compare" && (
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs text-slate-600">
                <span>
                  Drag divider to verify panel geometry & bounding box alignment
                  between Source and Augmented Output
                </span>
                <span className="font-mono tabular-nums">
                  Split: {splitPct}%
                </span>
              </div>

              <div className="relative aspect-[4/3] w-full max-w-2xl mx-auto rounded-lg overflow-hidden canvas-grid-bg border border-slate-200 select-none">
                {/* Right side: Augmented */}
                <img
                  src={augmentedUrl}
                  alt="Augmented comparison"
                  referrerPolicy="no-referrer"
                  className="absolute inset-0 w-full h-full object-cover"
                />
                {renderBoundingBoxes(transformedDetections)}

                {/* Left side: Original clipped */}
                <div
                  className="absolute inset-0 overflow-hidden"
                  style={{ clipPath: `inset(0 ${100 - splitPct}% 0 0)` }}
                >
                  <img
                    src={specimen.imageUrl}
                    alt="Original comparison"
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover"
                  />
                  {renderBoundingBoxes(specimen.detections)}
                </div>

                {/* Vertical divider line */}
                <div
                  className="absolute inset-y-0 w-0.5 bg-white shadow pointer-events-none"
                  style={{ left: `${splitPct}%` }}
                />

                <div className="absolute top-3 left-3 bg-slate-900/80 text-white text-[11px] font-medium px-2 py-1 rounded">
                  Original Source
                </div>
                <div className="absolute top-3 right-3 bg-blue-700/90 text-white text-[11px] font-medium px-2 py-1 rounded">
                  Conditioned Output
                </div>
              </div>

              <div className="max-w-2xl mx-auto flex items-center gap-3">
                <span className="text-xs text-slate-500 whitespace-nowrap">
                  Original
                </span>
                <input
                  type="range"
                  min={5}
                  max={95}
                  value={splitPct}
                  onChange={(e) => setSplitPct(Number(e.target.value))}
                  aria-label="Comparison split slider"
                  className="w-full accent-blue-700"
                />
                <span className="text-xs text-slate-500 whitespace-nowrap">
                  Augmented
                </span>
              </div>
            </div>
          )}

          {viewportMode === "inpaint_mask" && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-200">
                <div className="flex flex-wrap items-center gap-3">
                  <label className="text-xs font-medium text-slate-700 flex items-center gap-2">
                    <span>Damage Class</span>
                    <select
                      value={config.inpaintDamageType}
                      onChange={(e) =>
                        onChangeConfig({
                          ...config,
                          inpaintDamageType: e.target
                            .value as AugmentationConfig["inpaintDamageType"],
                        })
                      }
                      className="border border-slate-200 rounded-md px-2 py-1 text-xs bg-white text-slate-900"
                    >
                      <option value="dent">Sheet-Metal Dent</option>
                      <option value="crease">Panel Crease</option>
                      <option value="scratch">Deep Primer Scratch</option>
                      <option value="scuff">Clear-Coat Scuff</option>
                      <option value="crack">Lens / Trim Crack</option>
                      <option value="shatter">Spiderweb Shatter</option>
                    </select>
                  </label>

                  <label className="text-xs font-medium text-slate-700 flex items-center gap-2">
                    <span>Severity</span>
                    <select
                      value={config.inpaintSeverity}
                      onChange={(e) =>
                        onChangeConfig({
                          ...config,
                          inpaintSeverity: e.target
                            .value as AugmentationConfig["inpaintSeverity"],
                        })
                      }
                      className="border border-slate-200 rounded-md px-2 py-1 text-xs bg-white text-slate-900"
                    >
                      <option value="minor">Minor</option>
                      <option value="moderate">Moderate</option>
                      <option value="severe">Severe</option>
                    </select>
                  </label>

                  <label className="text-xs font-medium text-slate-700 flex items-center gap-2">
                    <span>Brush</span>
                    <input
                      type="range"
                      min={12}
                      max={54}
                      value={config.brushRadiusPx}
                      onChange={(e) =>
                        onChangeConfig({
                          ...config,
                          brushRadiusPx: Number(e.target.value),
                        })
                      }
                      className="w-24 accent-blue-700"
                    />
                  </label>
                </div>

                <button
                  type="button"
                  onClick={() => setBrushPoints([])}
                  disabled={brushPoints.length === 0}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-slate-200 rounded-lg text-slate-700 hover:bg-slate-50 disabled:opacity-40 cursor-pointer"
                >
                  <Eraser className="w-3.5 h-3.5" />
                  Clear Mask
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs text-slate-500">
                    <span className="inline-flex items-center gap-1.5 font-medium text-slate-700">
                      <Paintbrush className="w-3.5 h-3.5 text-blue-700" />
                      Paint Mask Region on Vehicle
                    </span>
                    <span className="font-mono tabular-nums">
                      {brushPoints.length} mask points
                    </span>
                  </div>
                  <div className="relative aspect-[4/3] w-full rounded-lg overflow-hidden canvas-grid-bg border border-slate-200">
                    <img
                      src={specimen.imageUrl}
                      alt={specimen.name}
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover pointer-events-none select-none"
                    />
                    <canvas
                      ref={maskCanvasRef}
                      width={720}
                      height={540}
                      onPointerDown={(e) => {
                        setIsDrawing(true);
                        handleCanvasPointer(e, true);
                      }}
                      onPointerMove={(e) => handleCanvasPointer(e, false)}
                      onPointerUp={() => setIsDrawing(false)}
                      onPointerLeave={() => setIsDrawing(false)}
                      className="absolute inset-0 w-full h-full cursor-crosshair touch-none"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs text-slate-500">
                    <span>Inpainted Output + Auto-Generated Box</span>
                    <span>
                      {hasInpainted
                        ? "Synthetic box attached"
                        : "Paint left canvas to synthesize"}
                    </span>
                  </div>
                  <div className="relative aspect-[4/3] w-full rounded-lg overflow-hidden canvas-grid-bg border border-slate-200">
                    <img
                      src={augmentedUrl}
                      alt="Inpainted synthesis output"
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover"
                    />
                    {renderBoundingBoxes(transformedDetections)}
                  </div>
                </div>
              </div>
            </div>
          )}

          {viewportMode === "classical_vs_genai" && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-slate-900">
                      Classical Baseline (Flip · Crop · Brightness)
                    </span>
                    <span className="text-slate-500">No physical specular cues</span>
                  </div>
                  <div className="relative aspect-[4/3] w-full rounded-lg overflow-hidden canvas-grid-bg border border-slate-200">
                    <img
                      src={classicalUrl}
                      alt="Classical baseline augmentation"
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    Linear RGB offsets and crops cannot bend sheet metal, add
                    streetlamp specular roll-off, or simulate wet clear-coat
                    rain streaks.
                  </p>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-blue-700">
                      Conditioned GenAI ({activeParadigm?.name})
                    </span>
                    <span className="text-slate-500">Geometry + Clear-Coat Physics</span>
                  </div>
                  <div className="relative aspect-[4/3] w-full rounded-lg overflow-hidden canvas-grid-bg border border-slate-200">
                    <img
                      src={augmentedUrl}
                      alt="Conditioned GenAI augmentation"
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover"
                    />
                    {renderBoundingBoxes(transformedDetections)}
                  </div>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    Preserves panel edges and bounding boxes under yaw and
                    domain shift while modeling specular glare, wet asphalt
                    reflections, and localized dent indentation.
                  </p>
                </div>
              </div>

              <div className="pt-3 border-t border-slate-200 flex flex-wrap items-center gap-6 text-xs">
                <label className="inline-flex items-center gap-2 text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={config.classicalFlip}
                    onChange={(e) =>
                      onChangeConfig({
                        ...config,
                        classicalFlip: e.target.checked,
                      })
                    }
                    className="rounded accent-blue-700"
                  />
                  Classical Horizontal Flip
                </label>
                <label className="inline-flex items-center gap-2 text-slate-700">
                  <span>Crop {config.classicalCropPercent}%</span>
                  <input
                    type="range"
                    min={0}
                    max={20}
                    value={config.classicalCropPercent}
                    onChange={(e) =>
                      onChangeConfig({
                        ...config,
                        classicalCropPercent: Number(e.target.value),
                      })
                    }
                    className="w-24 accent-blue-700"
                  />
                </label>
                <label className="inline-flex items-center gap-2 text-slate-700">
                  <span>
                    Brightness {config.classicalBrightnessJitter > 0 ? "+" : ""}
                    {config.classicalBrightnessJitter}
                  </span>
                  <input
                    type="range"
                    min={-30}
                    max={30}
                    value={config.classicalBrightnessJitter}
                    onChange={(e) =>
                      onChangeConfig({
                        ...config,
                        classicalBrightnessJitter: Number(e.target.value),
                      })
                    }
                    className="w-24 accent-blue-700"
                  />
                </label>
              </div>
            </div>
          )}
        </div>

        {/* VLM Multimodal Inspection & Label Table */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="font-display text-sm font-semibold text-slate-900">
                VLM Structural & Damage Metadata
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                <span className="capitalize">{specimen.vehicleType}</span>
                <span className="mx-1.5" aria-hidden="true">
                  ·
                </span>
                <span>{specimen.paintFinish}</span>
                <span className="mx-1.5" aria-hidden="true">
                  ·
                </span>
                <span>{specimen.lighting}</span>
                <span className="mx-1.5" aria-hidden="true">
                  ·
                </span>
                <span>{specimen.cameraAngle}</span>
              </p>
            </div>

            <button
              type="button"
              onClick={() => void handleRunVlmInspect()}
              disabled={isVlmLoading}
              className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-slate-900 bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-50"
            >
              <ScanSearch className="w-3.5 h-3.5 text-blue-700" />
              {isVlmLoading ? "Inspecting Photo..." : "Re-Run VLM Inspection"}
            </button>
          </div>

          {vlmError ? (
            <div className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              {vlmError}
            </div>
          ) : null}

          {transformedDetections.length > 0 ? (
            <div className="overflow-x-auto border border-slate-200 rounded-lg">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-600">
                  <tr>
                    <th className="py-2 px-3 font-medium">Vehicle Part</th>
                    <th className="py-2 px-3 font-medium">Damage Class</th>
                    <th className="py-2 px-3 font-medium">Severity</th>
                    <th className="py-2 px-3 font-medium text-right">
                      Confidence
                    </th>
                    <th className="py-2 px-3 font-medium text-right">
                      Est. Repair (USD)
                    </th>
                    <th className="py-2 px-3 font-medium text-right">
                      Synced BBox [y,x,y,x]
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {transformedDetections.map((det) => (
                    <tr key={det.id} className="hover:bg-slate-50/70">
                      <td className="py-2 px-3 font-medium text-slate-900">
                        {det.part}
                        {det.synthetic ? (
                          <span className="ml-1.5 text-[11px] text-rose-700 font-normal">
                            (Inpainted)
                          </span>
                        ) : null}
                      </td>
                      <td className="py-2 px-3 capitalize text-slate-700">
                        {det.damageType}
                      </td>
                      <td className="py-2 px-3 capitalize">
                        <span
                          className={
                            det.severity === "severe"
                              ? "text-red-700 font-medium"
                              : det.severity === "moderate"
                              ? "text-amber-700 font-medium"
                              : "text-slate-700"
                          }
                        >
                          {det.severity}
                        </span>
                      </td>
                      <td className="py-2 px-3 text-right font-mono tabular-nums text-slate-700">
                        {(det.confidence * 100).toFixed(0)}%
                      </td>
                      <td className="py-2 px-3 text-right font-mono tabular-nums text-slate-700">
                        ${det.repairCostMin}–${det.repairCostMax}
                      </td>
                      <td className="py-2 px-3 text-right font-mono tabular-nums text-slate-500">
                        [{det.bbox.join(", ")}]
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-xs text-slate-500 border border-dashed border-slate-200 rounded-lg p-3">
              No damage labels attached yet. Paint a damage region in{" "}
              <button
                type="button"
                onClick={() => setViewportMode("inpaint_mask")}
                className="text-blue-700 font-medium hover:underline cursor-pointer"
              >
                Inpaint Mask Brush
              </button>{" "}
              or click Run VLM Inspection to auto-detect existing damage.
            </div>
          )}

          {specimen.syntheticCaptionPrompt ? (
            <div className="pt-2 border-t border-slate-100 space-y-1.5">
              <div className="text-[11px] font-medium text-slate-500">
                Conditioning Prompt
              </div>
              <p className="text-xs font-mono text-slate-700 bg-slate-50 border border-slate-200 rounded-lg p-2.5 leading-relaxed">
                {specimen.syntheticCaptionPrompt}
              </p>
            </div>
          ) : null}
        </div>
      </section>

      {/* RIGHT RAIL: Conditioning & Domain Controls */}
      <aside className="bg-white border border-slate-200 rounded-xl p-4 space-y-5">
        <div>
          <h2 className="font-display text-sm font-semibold text-slate-900">
            Augmentation Conditioning
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Preserve geometry while shifting domain, lighting, and viewpoint.
          </p>
        </div>

        {/* Paradigm Select */}
        <div className="space-y-1.5">
          <label className="block text-xs font-medium text-slate-700">
            Generative Paradigm
          </label>
          <select
            value={config.paradigm}
            onChange={(e) =>
              onChangeConfig({
                ...config,
                paradigm: e.target.value as AugmentationConfig["paradigm"],
              })
            }
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-xs font-medium text-slate-900 bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
          >
            {PARADIGM_OPTIONS.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} ({p.family})
              </option>
            ))}
          </select>
        </div>

        {/* Domain & Lighting Shift Presets */}
        <div className="space-y-2">
          <div className="text-xs font-medium text-slate-700">
            Aftermarket Domain & Lighting
          </div>
          <div className="grid grid-cols-2 gap-1.5">
            {LIGHTING_PRESETS.map((lp) => {
              const active = config.lighting === lp.id;
              return (
                <button
                  key={lp.id}
                  type="button"
                  onClick={() =>
                    onChangeConfig({
                      ...config,
                      lighting: lp.id,
                      paradigm:
                        config.paradigm === "classical_baseline"
                          ? "diffusion_controlnet"
                          : config.paradigm,
                    })
                  }
                  className={`text-left px-2.5 py-2 rounded-lg border text-xs transition-colors cursor-pointer ${
                    active
                      ? "border-blue-600 bg-blue-50 text-blue-900 font-semibold"
                      : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                  }`}
                >
                  <div className="truncate">{lp.label}</div>
                  <div className="text-[10px] text-slate-500 font-normal truncate">
                    {lp.shortTag}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Environmental & Perspective Sliders */}
        <div className="space-y-3.5 pt-2 border-t border-slate-100">
          <label className="block space-y-1">
            <div className="flex justify-between text-xs">
              <span className="text-slate-700 font-medium">
                Specular Clear-Coat Glare
              </span>
              <span className="font-mono tabular-nums text-slate-600">
                {config.glareIntensity}%
              </span>
            </div>
            <input
              type="range"
              min={0}
              max={100}
              value={config.glareIntensity}
              onChange={(e) =>
                onChangeConfig({
                  ...config,
                  glareIntensity: Number(e.target.value),
                })
              }
              className="w-full accent-blue-700"
            />
          </label>

          <label className="block space-y-1">
            <div className="flex justify-between text-xs">
              <span className="text-slate-700 font-medium">
                Rain & Wet Surface Sheen
              </span>
              <span className="font-mono tabular-nums text-slate-600">
                {config.wetnessLevel}%
              </span>
            </div>
            <input
              type="range"
              min={0}
              max={100}
              value={config.wetnessLevel}
              onChange={(e) =>
                onChangeConfig({
                  ...config,
                  wetnessLevel: Number(e.target.value),
                })
              }
              className="w-full accent-blue-700"
            />
          </label>

          <label className="block space-y-1">
            <div className="flex justify-between text-xs">
              <span className="text-slate-700 font-medium">
                Perspective Camera Yaw
              </span>
              <span className="font-mono tabular-nums text-slate-600">
                {config.perspectiveYawDeg > 0 ? "+" : ""}
                {config.perspectiveYawDeg}°
              </span>
            </div>
            <input
              type="range"
              min={-18}
              max={18}
              value={config.perspectiveYawDeg}
              onChange={(e) =>
                onChangeConfig({
                  ...config,
                  perspectiveYawDeg: Number(e.target.value),
                })
              }
              className="w-full accent-blue-700"
            />
          </label>
        </div>

        {/* Clear-Coat Paint Color Shift */}
        <div className="space-y-2 pt-2 border-t border-slate-100">
          <div className="text-xs font-medium text-slate-700">
            Vehicle Clear-Coat Shift
          </div>
          <div className="grid grid-cols-3 gap-1.5">
            {PAINT_PRESETS.map((pp) => {
              const active = config.paintColor === pp.id;
              return (
                <button
                  key={pp.id}
                  type="button"
                  onClick={() =>
                    onChangeConfig({ ...config, paintColor: pp.id })
                  }
                  className={`flex items-center gap-1.5 px-2 py-1.5 rounded-lg border text-[11px] transition-colors cursor-pointer ${
                    active
                      ? "border-blue-600 bg-blue-50 text-blue-900 font-semibold"
                      : "border-slate-200 text-slate-700 hover:bg-slate-50"
                  }`}
                >
                  <span
                    className="w-2.5 h-2.5 rounded-sm border border-slate-300 shrink-0"
                    style={{ backgroundColor: pp.swatchHex }}
                  />
                  <span className="truncate">{pp.label.split(" ")[0]}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Diversity Seed */}
        <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-100">
          <div className="text-xs text-slate-700">
            <span className="font-medium">Diversity Seed</span>
            <span className="ml-2 font-mono tabular-nums text-slate-500">
              #{config.seed}
            </span>
          </div>
          <button
            type="button"
            onClick={() =>
              onChangeConfig({
                ...config,
                seed: Math.floor(1000 + Math.random() * 8999),
              })
            }
            className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-slate-700 border border-slate-200 rounded-md hover:bg-slate-50 cursor-pointer"
          >
            <RefreshCw className="w-3 h-3" />
            Vary
          </button>
        </div>

        {/* Live Pixel Quality Gate Readout */}
        {quality ? (
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-slate-800">
                Quality Gate Check
              </span>
              <span
                className={`font-semibold ${
                  quality.autoDecision === "Accepted"
                    ? "text-emerald-700"
                    : "text-amber-700"
                }`}
              >
                {quality.autoDecision}
              </span>
            </div>
            <div className="grid grid-cols-3 gap-2 text-[11px]">
              <div>
                <div className="text-slate-500">Sharpness</div>
                <div className="font-mono tabular-nums font-medium text-slate-900">
                  {quality.laplacianSharpness}
                </div>
              </div>
              <div>
                <div className="text-slate-500">Glare Clip</div>
                <div className="font-mono tabular-nums font-medium text-slate-900">
                  {quality.highlightClippingPct}%
                </div>
              </div>
              <div>
                <div className="text-slate-500">Label IoU</div>
                <div className="font-mono tabular-nums font-medium text-slate-900">
                  {quality.bboxIouRetention.toFixed(2)}
                </div>
              </div>
            </div>
            {quality.flagReason ? (
              <p className="text-[11px] text-amber-800 leading-snug">
                {quality.flagReason}
              </p>
            ) : null}
          </div>
        ) : null}

        {/* Pipeline Actions */}
        <div className="space-y-2 pt-1">
          <button
            type="button"
            onClick={handleAddCurrentToBatch}
            disabled={isRendering || !quality}
            className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-semibold text-white bg-blue-700 hover:bg-blue-800 rounded-lg transition-colors cursor-pointer disabled:opacity-50"
          >
            <Layers className="w-3.5 h-3.5" />
            Add Variation to Batch
          </button>

          <button
            type="button"
            onClick={handleGenerateMatrix}
            disabled={isBatchGenerating}
            className="w-full inline-flex items-center justify-center gap-2 px-4 py-2 text-xs font-semibold text-slate-800 bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded-lg transition-colors cursor-pointer disabled:opacity-50"
          >
            <Sparkles className="w-3.5 h-3.5 text-blue-700" />
            {isBatchGenerating
              ? "Generating 4 Variants..."
              : "Generate 4-Variant Matrix"}
          </button>

          {batchFeedback ? (
            <p className="text-xs text-emerald-700 font-medium text-center">
              {batchFeedback}
            </p>
          ) : null}
        </div>
      </aside>
    </div>
  );
}
