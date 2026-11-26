import { useEffect, useState } from "react";
import { BatchQAManager } from "./components/BatchQAManager.tsx";
import { BenchmarksBalance } from "./components/BenchmarksBalance.tsx";
import { GenAIParadigms } from "./components/GenAIParadigms.tsx";
import { PipelineStudio } from "./components/PipelineStudio.tsx";
import { TopNav } from "./components/TopNav.tsx";
import {
  DEFAULT_AUGMENTATION_CONFIG,
  INITIAL_SPECIMENS,
} from "./data/samplesAndBenchmarks.ts";
import type {
  AugmentationConfig,
  AugmentedSample,
  DamageDetection,
  GapRecipeRecommendation,
  ParadigmId,
  QualityMetrics,
  VehicleSpecimen,
  WorkbenchTab,
} from "./types/augmentation.ts";
import { runAugmentationPipeline } from "./utils/imageAugmentor.ts";

export default function App() {
  const [activeTab, setActiveTab] = useState<WorkbenchTab>("studio");
  const [specimens, setSpecimens] =
    useState<VehicleSpecimen[]>(INITIAL_SPECIMENS);
  const [activeSpecimenId, setActiveSpecimenId] = useState<string>(
    INITIAL_SPECIMENS[0].id
  );
  const [config, setConfig] = useState<AugmentationConfig>(
    DEFAULT_AUGMENTATION_CONFIG
  );
  const [batchSamples, setBatchSamples] = useState<AugmentedSample[]>([]);

  // Seed initial real augmented samples on mount so Batch & QA Filter starts populated
  useEffect(() => {
    let cancelled = false;
    async function seedInitialBatch() {
      const seedPlans: Array<{
        specimen: VehicleSpecimen;
        cfg: AugmentationConfig;
      }> = [
        {
          specimen: INITIAL_SPECIMENS[0],
          cfg: {
            ...DEFAULT_AUGMENTATION_CONFIG,
            paradigm: "diffusion_controlnet",
            lighting: "night_lot",
            perspectiveYawDeg: 8,
            seed: 4072,
          },
        },
        {
          specimen: INITIAL_SPECIMENS[1],
          cfg: {
            ...DEFAULT_AUGMENTATION_CONFIG,
            paradigm: "spade_layout",
            lighting: "wet_rain",
            wetnessLevel: 76,
            perspectiveYawDeg: -6,
            seed: 5184,
          },
        },
        {
          specimen: INITIAL_SPECIMENS[3],
          cfg: {
            ...DEFAULT_AUGMENTATION_CONFIG,
            paradigm: "cyclegan_domain",
            lighting: "harsh_flash",
            glareIntensity: 84,
            perspectiveYawDeg: 5,
            seed: 6291,
          },
        },
      ];

      const seeded: AugmentedSample[] = [];
      for (const plan of seedPlans) {
        try {
          const out = await runAugmentationPipeline(
            plan.specimen,
            plan.cfg,
            []
          );
          const primaryDet = out.transformedDetections[0];
          seeded.push({
            id: `batch-seed-${plan.cfg.seed}`,
            sourceSpecimenId: plan.specimen.id,
            sourceName: plan.specimen.name,
            vehicleType: plan.specimen.vehicleType,
            primaryPart: primaryDet?.part ?? "Full Vehicle",
            primaryDamageType: primaryDet?.damageType ?? "none",
            severity: primaryDet?.severity ?? "undamaged",
            imageDataUrl: out.imageDataUrl,
            config: plan.cfg,
            transformedDetections: out.transformedDetections,
            quality: out.quality,
            humanReview: "Pending",
            createdAt: new Date().toISOString(),
            hasInpaintedDamage: out.hasInpaintedDamage,
          });
        } catch {
          // Ignore seed failure if browser canvas is unavailable
        }
      }
      if (!cancelled && seeded.length > 0) {
        setBatchSamples((prev) => (prev.length === 0 ? seeded : prev));
      }
    }
    seedInitialBatch();
    return () => {
      cancelled = true;
    };
  }, []);

  const activeSpecimen =
    specimens.find((s) => s.id === activeSpecimenId) ?? specimens[0];

  const handleAddSpecimen = (next: VehicleSpecimen) => {
    setSpecimens((prev) => [next, ...prev]);
  };

  const handleUpdateSpecimen = (updated: VehicleSpecimen) => {
    setSpecimens((prev) =>
      prev.map((s) => (s.id === updated.id ? updated : s))
    );
  };

  const handleAddBatchSamples = (
    items: Array<{
      imageDataUrl: string;
      config: AugmentationConfig;
      transformedDetections: DamageDetection[];
      quality: QualityMetrics;
      hasInpaintedDamage: boolean;
    }>
  ) => {
    const created: AugmentedSample[] = items.map((item, idx) => {
      const primaryDet = item.transformedDetections[0];
      return {
        id: `batch-${Date.now()}-${idx}-${item.config.seed}`,
        sourceSpecimenId: activeSpecimen.id,
        sourceName: activeSpecimen.name,
        vehicleType: activeSpecimen.vehicleType,
        primaryPart: primaryDet?.part ?? "Full Vehicle",
        primaryDamageType: primaryDet?.damageType ?? "none",
        severity: primaryDet?.severity ?? "undamaged",
        imageDataUrl: item.imageDataUrl,
        config: item.config,
        transformedDetections: item.transformedDetections,
        quality: item.quality,
        humanReview: "Pending",
        createdAt: new Date().toISOString(),
        hasInpaintedDamage: item.hasInpaintedDamage,
      };
    });
    setBatchSamples((prev) => [...created, ...prev]);
  };

  const handleUpdateBatchSample = (
    id: string,
    patch: Partial<AugmentedSample>
  ) => {
    setBatchSamples((prev) =>
      prev.map((s) => (s.id === id ? { ...s, ...patch } : s))
    );
  };

  const handleRemoveBatchSample = (id: string) => {
    setBatchSamples((prev) => prev.filter((s) => s.id !== id));
  };

  const handleExportCoco = () => {
    const accepted = batchSamples.filter(
      (s) =>
        s.humanReview !== "Rejected" &&
        (s.humanReview === "Accepted" || s.quality.autoDecision === "Accepted")
    );
    const categories = [
      { id: 1, name: "dent" },
      { id: 2, name: "scratch" },
      { id: 3, name: "crack" },
      { id: 4, name: "shatter" },
      { id: 5, name: "scuff" },
      { id: 6, name: "crease" },
    ];
    const catMap = new Map(categories.map((c) => [c.name, c.id]));

    const images = accepted.map((s, idx) => ({
      id: idx + 1,
      file_name: `${s.sourceSpecimenId}_${s.config.lighting}_${s.config.seed}.jpg`,
      width: 720,
      height: 540,
      vehicle_type: s.vehicleType,
      augmentation_paradigm: s.config.paradigm,
      lighting_condition: s.config.lighting,
      perspective_yaw_deg: s.config.perspectiveYawDeg,
      quality_metrics: s.quality,
    }));

    let annId = 1;
    const annotations = accepted.flatMap((s, imgIdx) =>
      s.transformedDetections.map((det) => {
        const [ymin, xmin, ymax, xmax] = det.bbox;
        const x = Math.round((xmin / 1000) * 720);
        const y = Math.round((ymin / 1000) * 540);
        const w = Math.round(((xmax - xmin) / 1000) * 720);
        const h = Math.round(((ymax - ymin) / 1000) * 540);
        return {
          id: annId++,
          image_id: imgIdx + 1,
          category_id: catMap.get(det.damageType) ?? 1,
          part_label: det.part,
          severity: det.severity,
          bbox: [x, y, w, h],
          area: w * h,
          iscrowd: 0,
          synthetic_inpaint: Boolean(det.synthetic),
        };
      })
    );

    const payload = {
      info: {
        description: "DamageAugment AI Augmented Automotive Damage Dataset",
        date_created: new Date().toISOString(),
      },
      categories,
      images,
      annotations,
    };

    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `damage-augment-coco-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExportYolo = () => {
    const classOrder = ["dent", "scratch", "crack", "shatter", "scuff", "crease"];
    const accepted = batchSamples.filter(
      (s) =>
        s.humanReview !== "Rejected" &&
        (s.humanReview === "Accepted" || s.quality.autoDecision === "Accepted")
    );
    const lines = accepted.flatMap((s) => {
      const file = `${s.sourceSpecimenId}_${s.config.lighting}_${s.config.seed}.jpg`;
      if (s.transformedDetections.length === 0) {
        return [`# ${file} (undamaged)`];
      }
      return s.transformedDetections.map((det) => {
        const clsIdx = Math.max(0, classOrder.indexOf(det.damageType));
        const [ymin, xmin, ymax, xmax] = det.bbox;
        const cx = ((xmin + xmax) / 2000).toFixed(4);
        const cy = ((ymin + ymax) / 2000).toFixed(4);
        const bw = ((xmax - xmin) / 1000).toFixed(4);
        const bh = ((ymax - ymin) / 1000).toFixed(4);
        return `${file}: ${clsIdx} ${cx} ${cy} ${bw} ${bh} # ${det.part} (${det.severity})`;
      });
    });

    const blob = new Blob([lines.join("\n")], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `damage-augment-yolo-${Date.now()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleApplyGapRecipe = (recipe: GapRecipeRecommendation) => {
    const match = specimens.find(
      (s) => s.vehicleType === recipe.targetVehicleType.toLowerCase()
    );
    if (match) {
      setActiveSpecimenId(match.id);
    }
    setConfig((prev) => ({
      ...prev,
      paradigm: recipe.paradigm,
      lighting: recipe.targetCondition,
      seed: Math.floor(1000 + Math.random() * 8999),
    }));
    setActiveTab("studio");
  };

  const handleSelectParadigmInStudio = (paradigm: ParadigmId) => {
    setConfig((prev) => ({
      ...prev,
      paradigm,
    }));
    setActiveTab("studio");
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col">
      <TopNav
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        batchCount={batchSamples.length}
        onExportDataset={handleExportCoco}
      />

      {/* Mobile Tab Switcher (kept concise, <=15% height) */}
      <div className="md:hidden bg-white border-b border-slate-200 px-4 py-2 flex items-center gap-2 overflow-x-auto">
        {(
          [
            { id: "studio", label: "Studio" },
            { id: "batch_qa", label: `Batch (${batchSamples.length})` },
            { id: "benchmarks", label: "Balance" },
            { id: "paradigms", label: "Paradigms" },
          ] as const
        ).map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={`px-3 py-1.5 text-xs font-medium rounded-md whitespace-nowrap shrink-0 ${
              activeTab === tab.id
                ? "bg-blue-700 text-white"
                : "bg-slate-100 text-slate-700"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <main className="flex-1">
        {activeTab === "studio" && (
          <PipelineStudio
            specimens={specimens}
            activeSpecimenId={activeSpecimenId}
            onSelectSpecimen={setActiveSpecimenId}
            onAddSpecimen={handleAddSpecimen}
            onUpdateSpecimen={handleUpdateSpecimen}
            config={config}
            onChangeConfig={setConfig}
            onAddBatchSamples={handleAddBatchSamples}
          />
        )}

        {activeTab === "batch_qa" && (
          <BatchQAManager
            samples={batchSamples}
            onUpdateSample={handleUpdateBatchSample}
            onRemoveSample={handleRemoveBatchSample}
            onExportCoco={handleExportCoco}
            onExportYolo={handleExportYolo}
            onGoToStudio={() => setActiveTab("studio")}
          />
        )}

        {activeTab === "benchmarks" && (
          <BenchmarksBalance
            specimens={specimens}
            samples={batchSamples}
            onApplyGapRecipe={handleApplyGapRecipe}
          />
        )}

        {activeTab === "paradigms" && (
          <GenAIParadigms
            onSelectParadigmInStudio={handleSelectParadigmInStudio}
          />
        )}
      </main>
    </div>
  );
}
