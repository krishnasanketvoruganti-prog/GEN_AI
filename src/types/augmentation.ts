export type VehicleType =
  | "sedan"
  | "suv"
  | "hatchback"
  | "commercial"
  | "motorcycle"
  | "pickup"
  | "coupe";

export type DamageType =
  | "dent"
  | "scratch"
  | "crack"
  | "shatter"
  | "scuff"
  | "crease"
  | "none";

export type SeverityLevel = "minor" | "moderate" | "severe" | "undamaged";

export type LightingConditionId =
  | "overcast"
  | "night_lot"
  | "midday_glare"
  | "wet_rain"
  | "dim_workshop"
  | "harsh_flash";

export type ParadigmId =
  | "diffusion_controlnet"
  | "spade_layout"
  | "cyclegan_domain"
  | "pix2pix_mask"
  | "classical_baseline";

export type PaintPresetId =
  | "original"
  | "obsidian_black"
  | "crimson_red"
  | "deep_cobalt"
  | "forest_metallic"
  | "pearl_silver";

export type ConditioningMapMode = "rgb" | "canny" | "normal" | "semantic";

export type StudioViewportMode =
  | "conditioning"
  | "split_compare"
  | "inpaint_mask"
  | "classical_vs_genai";

export type WorkbenchTab = "studio" | "batch_qa" | "benchmarks" | "paradigms";

export interface DamageDetection {
  id: string;
  part: string;
  damageType: DamageType;
  severity: SeverityLevel;
  confidence: number;
  /** [ymin, xmin, ymax, xmax] normalized 0..1000 */
  bbox: [number, number, number, number];
  repairCostMin: number;
  repairCostMax: number;
  synthetic?: boolean;
}

export interface VehicleSpecimen {
  id: string;
  name: string;
  imageUrl: string;
  vehicleType: VehicleType;
  carMakeModel?: string;
  primaryDamageType?: DamageType;
  overallSeverity?: SeverityLevel;
  damageSummary?: string;
  paintFinish: string;
  lighting: string;
  cameraAngle: string;
  detections: DamageDetection[];
  syntheticCaptionPrompt?: string;
  recommendedAugmentations?: string[];
  isUserUploaded?: boolean;
}

export interface AugmentationConfig {
  paradigm: ParadigmId;
  lighting: LightingConditionId;
  glareIntensity: number; // 0..100
  wetnessLevel: number; // 0..100
  perspectiveYawDeg: number; // -18..18
  paintColor: PaintPresetId;
  seed: number;
  // Classical baseline toggles
  classicalFlip: boolean;
  classicalCropPercent: number; // 0..20
  classicalBrightnessJitter: number; // -30..30
  // Inpainting brush params
  inpaintDamageType: Exclude<DamageType, "none">;
  inpaintSeverity: Exclude<SeverityLevel, "undamaged">;
  brushRadiusPx: number;
}

export interface BrushPoint {
  x: number; // normalized 0..1
  y: number; // normalized 0..1
  radius: number; // normalized 0..1 relative to width
}

export interface QualityMetrics {
  laplacianSharpness: number;
  highlightClippingPct: number;
  shadowCrushPct: number;
  bboxIouRetention: number; // 0..1
  autoDecision: "Accepted" | "Flagged";
  flagReason?: string;
}

export interface VlmQaAuditResult {
  labelPreserved: boolean;
  specularRealismScore: number;
  artifactFlags: string[];
  verdict: "PASS" | "REVIEW" | "REJECT";
  reasoning: string;
}

export interface AugmentedSample {
  id: string;
  sourceSpecimenId: string;
  sourceName: string;
  vehicleType: VehicleType;
  primaryPart: string;
  primaryDamageType: DamageType;
  severity: SeverityLevel;
  imageDataUrl: string;
  config: AugmentationConfig;
  transformedDetections: DamageDetection[];
  quality: QualityMetrics;
  humanReview: "Pending" | "Accepted" | "Rejected";
  vlmAudit?: VlmQaAuditResult;
  createdAt: string;
  hasInpaintedDamage: boolean;
}

export interface GapRecipeRecommendation {
  title: string;
  paradigm: ParadigmId;
  targetCondition: LightingConditionId;
  targetVehicleType: string;
  targetDamageType: string;
  recommendedCount: number;
  rationale: string;
}

export interface GapAuditResponse {
  summary: string;
  bottleneckClass: string;
  recipes: GapRecipeRecommendation[];
}
