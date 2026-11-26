import type {
  AugmentationConfig,
  LightingConditionId,
  PaintPresetId,
  ParadigmId,
  VehicleSpecimen,
} from "../types/augmentation.ts";

export const INITIAL_SPECIMENS: VehicleSpecimen[] = [
  {
    id: "spec-sedan-dent",
    name: "Silver Sedan · Rear-Left Quarter Dent",
    imageUrl: "/src/assets/images/sample_sedan_dent_1795673563863.jpg",
    vehicleType: "sedan",
    carMakeModel: "Honda Civic Sedan",
    primaryDamageType: "dent",
    overallSeverity: "moderate",
    damageSummary: "Compact 4-door sedan with a moderate rear-left quarter panel dent and minor bumper corner scuff.",
    paintFinish: "Metallic Silver Clear-Coat",
    lighting: "Overcast parking lot",
    cameraAngle: "Rear-left 3/4 low angle",
    detections: [
      {
        id: "det-1",
        part: "Rear-Left Quarter Panel",
        damageType: "dent",
        severity: "moderate",
        confidence: 0.96,
        bbox: [295, 395, 520, 625],
        repairCostMin: 680,
        repairCostMax: 1150,
      },
      {
        id: "det-2",
        part: "Rear Bumper Corner",
        damageType: "scuff",
        severity: "minor",
        confidence: 0.91,
        bbox: [515, 585, 685, 790],
        repairCostMin: 240,
        repairCostMax: 420,
      },
    ],
    syntheticCaptionPrompt:
      "Metallic silver sedan rear-left quarter panel crease dent and bumper clear-coat scuff, preserve exact panel gap and wheel arch edge geometry",
    recommendedAugmentations: [
      "Nighttime parking lot sodium vapor lighting with specular highlight roll-off",
      "Wet asphalt rain sheen to test curved metallic clear-coat reflections",
      "Yaw perspective tilt +14 deg while locking quarter panel bounding box",
    ],
  },
  {
    id: "spec-suv-scratch",
    name: "Navy SUV · Front Bumper Scratch & Crack",
    imageUrl: "/src/assets/images/sample_suv_scratch_1795673564702.jpg",
    vehicleType: "suv",
    carMakeModel: "Toyota RAV4 Crossover SUV",
    primaryDamageType: "scratch",
    overallSeverity: "severe",
    damageSummary: "Mid-size crossover SUV with deep primer-exposed front bumper scratches and a cracked lower trim bezel.",
    paintFinish: "Dark Navy Metallic",
    lighting: "Afternoon curb sunlight",
    cameraAngle: "Front-right close-up",
    detections: [
      {
        id: "det-3",
        part: "Front Bumper Corner",
        damageType: "scratch",
        severity: "moderate",
        confidence: 0.95,
        bbox: [215, 255, 650, 485],
        repairCostMin: 450,
        repairCostMax: 790,
      },
      {
        id: "det-4",
        part: "Lower Bumper Trim Bezel",
        damageType: "crack",
        severity: "severe",
        confidence: 0.93,
        bbox: [535, 600, 840, 855],
        repairCostMin: 520,
        repairCostMax: 940,
      },
    ],
    syntheticCaptionPrompt:
      "Dark navy SUV front bumper deep primer abrasions and fractured matte plastic lower valance, maintain fog lamp bezel geometry",
    recommendedAugmentations: [
      "Direct midday sun glare on dark clear-coat to reduce glare false negatives",
      "Dim workshop fluorescent lighting for body-shop intake generalization",
    ],
  },
  {
    id: "spec-clean-hatchback",
    name: "White Hatchback · Undamaged Inpaint Base",
    imageUrl: "/src/assets/images/sample_clean_hatchback_1795673564892.jpg",
    vehicleType: "hatchback",
    carMakeModel: "Volkswagen Golf R Hatchback",
    primaryDamageType: "none",
    overallSeverity: "undamaged",
    damageSummary: "Undamaged pearl white compact hatchback suitable for mask-guided synthetic dent, scratch, or crack synthesis.",
    paintFinish: "Pearl White Gloss",
    lighting: "Diffused courtyard daylight",
    cameraAngle: "Rear-right 3/4 view",
    detections: [],
    syntheticCaptionPrompt:
      "Clean pearl white compact hatchback rear 3/4 view suitable for mask-guided dent, scratch, and tail-lamp fracture synthesis",
    recommendedAugmentations: [
      "Paint an inpainting mask on the rear door or bumper to synthesize rare severe damage",
      "Translate clear-coat color to Crimson Red or Obsidian Black with wet rain reflections",
    ],
  },
  {
    id: "spec-headlight-crack",
    name: "Charcoal Sedan · Shattered Headlight Lens",
    imageUrl: "/src/assets/images/sample_headlight_crack_1795673565666.jpg",
    vehicleType: "sedan",
    carMakeModel: "BMW 3 Series Sedan",
    primaryDamageType: "shatter",
    overallSeverity: "severe",
    damageSummary: "Luxury sport sedan with a shattered front-left polycarbonate headlight lens and adjacent fender crease.",
    paintFinish: "Charcoal Gray Metallic",
    lighting: "Garage apron ambient",
    cameraAngle: "Front-left tight inspection",
    detections: [
      {
        id: "det-5",
        part: "Headlight Assembly",
        damageType: "shatter",
        severity: "severe",
        confidence: 0.97,
        bbox: [365, 195, 685, 865],
        repairCostMin: 890,
        repairCostMax: 1650,
      },
      {
        id: "det-6",
        part: "Front Left Fender Edge",
        damageType: "crease",
        severity: "moderate",
        confidence: 0.89,
        bbox: [220, 740, 445, 955],
        repairCostMin: 540,
        repairCostMax: 920,
      },
    ],
    syntheticCaptionPrompt:
      "Charcoal metallic front-left headlamp polycarbonate spiderweb fracture and fender crease, preserve grille and hood seam edges",
    recommendedAugmentations: [
      "Harsh smartphone LED flash inspection in low light to accentuate lens crack refraction",
      "Nighttime wet reflection shift for low-visibility claim submissions",
    ],
  },
  {
    id: "spec-commercial-van",
    name: "Commercial Van · Sliding Door Scrape",
    imageUrl: "/src/assets/images/sample_commercial_van_1795673566014.jpg",
    vehicleType: "commercial",
    carMakeModel: "Ford Transit Commercial Van",
    primaryDamageType: "scratch",
    overallSeverity: "severe",
    damageSummary: "Commercial cargo van with a long horizontal primer-deep scrape and crease across the left sliding door.",
    paintFinish: "Fleet Gloss White",
    lighting: "Concrete depot daylight",
    cameraAngle: "Left broadside 3/4",
    detections: [
      {
        id: "det-7",
        part: "Side Sliding Door",
        damageType: "scratch",
        severity: "severe",
        confidence: 0.94,
        bbox: [455, 325, 765, 710],
        repairCostMin: 950,
        repairCostMax: 1720,
      },
    ],
    syntheticCaptionPrompt:
      "White commercial fleet delivery van sliding door long horizontal primer scrape and crease, preserve rocker panel and door seam",
    recommendedAugmentations: [
      "Dim fleet depot dusk lighting + perspective yaw -15 deg",
      "Rainy wet road spray shift to expand underrepresented commercial fleet samples",
    ],
  },
];

export const DEFAULT_AUGMENTATION_CONFIG: AugmentationConfig = {
  paradigm: "diffusion_controlnet",
  lighting: "night_lot",
  glareIntensity: 48,
  wetnessLevel: 25,
  perspectiveYawDeg: 8,
  paintColor: "original",
  seed: 4072,
  classicalFlip: false,
  classicalCropPercent: 8,
  classicalBrightnessJitter: 12,
  inpaintDamageType: "dent",
  inpaintSeverity: "moderate",
  brushRadiusPx: 28,
};

export interface LightingPresetMeta {
  id: LightingConditionId;
  label: string;
  shortTag: string;
  description: string;
}

export const LIGHTING_PRESETS: LightingPresetMeta[] = [
  {
    id: "overcast",
    label: "Overcast Neutral",
    shortTag: "Flat Daylight",
    description: "Diffused sky illumination with soft clear-coat reflections and minimal shadow crush.",
  },
  {
    id: "night_lot",
    label: "Night Parking Lot",
    shortTag: "Low-Light Tungsten",
    description: "Warm overhead sodium/LED streetlamps with deep ambient shadows and localized specular falloff.",
  },
  {
    id: "midday_glare",
    label: "Direct Midday Glare",
    shortTag: "High Specular Sun",
    description: "Harsh zenith solar highlight streaks across curved clear-coat paint that often hide shallow dents.",
  },
  {
    id: "wet_rain",
    label: "Wet Rain & Asphalt",
    shortTag: "Rain & Reflections",
    description: "Overcast cool cast, diagonal rain streaks, and high-gloss wet clear-coat surface micro-reflections.",
  },
  {
    id: "dim_workshop",
    label: "Dim Dusty Workshop",
    shortTag: "Body-Shop Bay",
    description: "Fluorescent bay cast, subtle atmospheric dust haze, and garage edge vignette.",
  },
  {
    id: "harsh_flash",
    label: "Harsh Flash Inspection",
    shortTag: "Smartphone LED",
    description: "On-axis mobile flash hotspot on curved sheet metal paired with rapid peripheral falloff.",
  },
];

export interface PaintPresetMeta {
  id: PaintPresetId;
  label: string;
  swatchHex: string;
  targetHue: number | null;
  satBoost: number;
  valScale: number;
}

export const PAINT_PRESETS: PaintPresetMeta[] = [
  { id: "original", label: "Original Paint", swatchHex: "#94A3B8", targetHue: null, satBoost: 1, valScale: 1 },
  { id: "obsidian_black", label: "Obsidian Black", swatchHex: "#1E293B", targetHue: 215, satBoost: 0.25, valScale: 0.42 },
  { id: "crimson_red", label: "Crimson Red", swatchHex: "#B91C1C", targetHue: 356, satBoost: 1.45, valScale: 0.92 },
  { id: "deep_cobalt", label: "Deep Cobalt", swatchHex: "#1D4ED8", targetHue: 222, satBoost: 1.4, valScale: 0.88 },
  { id: "forest_metallic", label: "Forest Metallic", swatchHex: "#15803D", targetHue: 148, satBoost: 1.25, valScale: 0.82 },
  { id: "pearl_silver", label: "Pearl Silver", swatchHex: "#CBD5E1", targetHue: 210, satBoost: 0.15, valScale: 1.12 },
];

export interface ParadigmMeta {
  id: ParadigmId;
  name: string;
  family: "GAN" | "Diffusion / Spatial" | "Classical";
  summary: string;
  conditioningSignal: string;
  strengths: string;
  watchouts: string;
}

export const PARADIGM_OPTIONS: ParadigmMeta[] = [
  {
    id: "diffusion_controlnet",
    name: "Diffusion + ControlNet",
    family: "Diffusion / Spatial",
    summary: "Latent diffusion denoiser locked to Canny edges & depth proxies for realistic lighting/weather shifts.",
    conditioningSignal: "Canny Edges + Depth Gradient",
    strengths: "High textural diversity and photorealistic clear-coat highlights without mode collapse.",
    watchouts: "Requires strict structural adapter weight to prevent dent location drift.",
  },
  {
    id: "spade_layout",
    name: "SPADE / GauGAN Layout",
    family: "GAN",
    summary: "Spatially adaptive denormalization preserving exact pixel-to-mask alignment for part & damage labels.",
    conditioningSignal: "Semantic Part & Damage Mask",
    strengths: "Maintains near-1.0 segmentation IoU alignment between synthetic pixels and ground-truth masks.",
    watchouts: "Can soften fine metal grain if style encoder lacks multi-scale detail.",
  },
  {
    id: "cyclegan_domain",
    name: "CycleGAN Domain Shift",
    family: "GAN",
    summary: "Unpaired image-to-image translation using cycle-consistency loss for day-to-night or dry-to-wet shifts.",
    conditioningSignal: "Unpaired Domain Translation",
    strengths: "Needs zero paired before/after photos to adapt daylight datasets to night or rain.",
    watchouts: "Sensitive to glare hallucinations if discriminator overfits streetlamp halos.",
  },
  {
    id: "pix2pix_mask",
    name: "pix2pix Mask-to-Photo",
    family: "GAN",
    summary: "Paired conditional GAN translating edge maps or painted damage masks directly into vehicle surface damage.",
    conditioningSignal: "Paired Edge + Inpaint Mask",
    strengths: "Fast single-pass synthesis for localized scratches, dents, and cracked lenses.",
    watchouts: "Needs L1 + perceptual loss balancing to avoid blurred clear-coat edges.",
  },
  {
    id: "classical_baseline",
    name: "Classical Aug Baseline",
    family: "Classical",
    summary: "Geometric flip, crop, and linear brightness/contrast jitter without physics-aware clear-coat synthesis.",
    conditioningSignal: "Affine + Pixel Jitter",
    strengths: "Zero compute overhead; preserves exact pixel authenticity.",
    watchouts: "Cannot synthesize curved paint reflections, rain sheen, or novel dent shading.",
  },
];

export interface BenchmarkProfile {
  regime: string;
  syntheticSharePct: number;
  fid: number;
  kid: number;
  precision: number;
  recall: number;
  map50: number;
  maskIoU: number;
  costMaeUsd: number;
  notes: string;
}

export const BENCHMARK_PROFILES: BenchmarkProfile[] = [
  {
    regime: "Real-Only Baseline (0% Synthetic)",
    syntheticSharePct: 0,
    fid: 0.0,
    kid: 0.0,
    precision: 0.78,
    recall: 0.64,
    map50: 0.69,
    maskIoU: 0.66,
    costMaeUsd: 268,
    notes: "Overfits daylight studio claims; misses subtle dents under glare or night lots.",
  },
  {
    regime: "Classical Flip/Crop/Jitter (+30%)",
    syntheticSharePct: 25,
    fid: 9.4,
    kid: 0.008,
    precision: 0.80,
    recall: 0.68,
    map50: 0.72,
    maskIoU: 0.68,
    costMaeUsd: 241,
    notes: "Slight geometric robustness; fails on wet reflections, harsh flash, and rare shattered parts.",
  },
  {
    regime: "Conditioned GenAI Mix (70% Real / 30% Filtered)",
    syntheticSharePct: 30,
    fid: 14.2,
    kid: 0.011,
    precision: 0.88,
    recall: 0.83,
    map50: 0.85,
    maskIoU: 0.81,
    costMaeUsd: 146,
    notes: "Optimal sim-to-real transfer: balances rare damage coverage with real sensor noise.",
  },
  {
    regime: "Heavy GenAI Mix (50% Real / 50% Filtered)",
    syntheticSharePct: 50,
    fid: 16.8,
    kid: 0.015,
    precision: 0.86,
    recall: 0.84,
    map50: 0.83,
    maskIoU: 0.79,
    costMaeUsd: 159,
    notes: "Strong recall on edge cases; slight calibration drift if QA filter threshold is relaxed.",
  },
  {
    regime: "100% Synthetic Only (Model Drift Risk)",
    syntheticSharePct: 100,
    fid: 24.5,
    kid: 0.029,
    precision: 0.72,
    recall: 0.71,
    map50: 0.68,
    maskIoU: 0.65,
    costMaeUsd: 289,
    notes: "Severe domain shift and clear-coat texture overfitting; underscores need for real-data mixing.",
  },
];

export const FOUR_PILLARS = [
  {
    index: "01",
    title: "Data Scarcity & Class Imbalance",
    detail:
      "Real insurance and collision photos are privacy-restricted, costly to annotate, and heavily skewed toward minor bumper scuffs over severe quarter-panel creases, shattered headlamps, or commercial fleet damage.",
  },
  {
    index: "02",
    title: "Classical vs. Generative Augmentation",
    detail:
      "Flips, crops, and linear gamma jitter cannot bend sheet metal, render curved clear-coat specular highlights, or translate an overcast parking photo into wet nighttime asphalt.",
  },
  {
    index: "03",
    title: "Sim-to-Real & Synthetic-to-Real Transfer",
    detail:
      "Blending real smartphone claim photos with spatially conditioned generative variations expands rare-event coverage while keeping real-world sensor characteristics anchored.",
  },
  {
    index: "04",
    title: "Downstream Estimation Tasks",
    detail:
      "Every augmented sample exports aligned part localization boxes, pixel masks, damage class tags, severity tiers, and repair cost bounds ready for detection, segmentation, and cost-estimation training.",
  },
];

export const PIPELINE_STAGES = [
  {
    stage: "Stage 1",
    title: "Conditioned Generation",
    description:
      "Extract Canny edges, surface normal/depth gradients, and semantic part masks before synthesis so dents and scratches remain locked to the exact panel.",
  },
  {
    stage: "Stage 2",
    title: "Targeted Domain & Lighting Shifts",
    description:
      "Shift illumination into nighttime parking lots, direct midday glare, wet rain reflections, or dusty workshops while shifting vehicle clear-coat colors.",
  },
  {
    stage: "Stage 3",
    title: "Inpainting & Damage Synthesis",
    description:
      "Paint localized damage masks onto clean panels to synthesize indented dents, primer-depth scratches, or spiderweb lens cracks with matching specular highlights.",
  },
  {
    stage: "Stage 4",
    title: "Quality Filtering & Real-Data Mixing",
    description:
      "Screen outputs via Laplacian sharpness, highlight clipping, post-warp IoU retention, and VLM QA checks, then mix 25–35% synthetic with real images.",
  },
  {
    stage: "Stage 5",
    title: "Multimodal VLM Metadata & Gap Audit",
    description:
      "Use Vision-Language Models to auto-label parts/severity, craft conditioning prompts, flag artifacts, and target underrepresented vehicle and damage classes.",
  },
];

export const GAN_TOPICS = [
  {
    title: "Conditional GANs (cGANs)",
    role: "Class & Attribute Targeting",
    description:
      "Conditions both generator and discriminator on vehicle type, part label, and damage severity so generation targets underrepresented classes instead of random outputs.",
    challengeMitigated: "Fixes random sampling blind spots on rare severe damage.",
  },
  {
    title: "pix2pix (Paired Image-to-Image)",
    role: "Mask & Edge Translation",
    description:
      "Learns paired mappings from structural edge maps or painted damage masks directly to realistic automotive sheet metal and paint damage pixels.",
    challengeMitigated: "Enforces pixel-level boundary fidelity via L1 + adversarial patch loss.",
  },
  {
    title: "CycleGAN (Unpaired Translation)",
    role: "Day-to-Night & Weather Shift",
    description:
      "Translates daytime inspection datasets into nighttime, rain, or workshop domains without 1-to-1 paired photos using cycle-consistency loss.",
    challengeMitigated: "Unlocks lighting robustness when paired before/after claims do not exist.",
  },
  {
    title: "StyleGAN & Style Mixing",
    role: "Coarse Geometry vs. Fine Paint Texture",
    description:
      "Decouples coarse vehicle pose and body silhouette from fine style latents (metallic flake, clear-coat gloss, dust, and lighting temperature).",
    challengeMitigated: "Supports controlled appearance sweeps without altering dent topology.",
  },
  {
    title: "SPADE / GauGAN Normalization",
    role: "Semantic Mask Alignment",
    description:
      "Injects semantic part and damage segmentation masks at multiple decoder scales via spatially adaptive normalization so labels never drift.",
    challengeMitigated: "Eliminates label mismatch between synthetic pixels and COCO masks.",
  },
  {
    title: "GAN Training Challenges",
    role: "Mode Collapse & Clear-Coat Artifacts",
    description:
      "Automotive gloss requires realistic curved specular highlights; mode collapse produces repetitive scratch textures, while discriminator imbalance creates checkerboard halos.",
    challengeMitigated: "Mitigated via multi-scale discriminators, diversity seeds, and QA filtering.",
  },
];

export const BROADER_GENAI_TOPICS = [
  {
    title: "Latent Diffusion Models (LDM)",
    category: "Generative Backbone",
    description:
      "Iteratively denoises latent representations from Gaussian noise, excelling at fine primer texture, clear-coat micro-scratches, and lighting diversity.",
  },
  {
    title: "ControlNet & T2I-Adapters",
    category: "Structural Conditioning",
    description:
      "Locks diffusion generation to Canny edges, depth maps, or segmentation layouts so camera angle and damage coordinates remain invariant.",
  },
  {
    title: "Inpainting & Outpainting",
    category: "Localized Synthesis",
    description:
      "Regenerates masked vehicle regions to insert scratches, dents, or shattered lenses onto clean cars while blending ambient lighting seams.",
  },
  {
    title: "3D-Aware & Novel View Synthesis",
    category: "Viewpoint Consistency",
    description:
      "Combines perspective homographies and multi-view cues so 2D yaw shifts preserve consistent dent depth and bumper curvature across angles.",
  },
  {
    title: "Variational Autoencoders (VAEs)",
    category: "Latent Inspection & Compression",
    description:
      "Encodes vehicle imagery into structured latent spaces for latent diffusion compression and out-of-distribution outlier detection during dataset curation.",
  },
  {
    title: "Vision-Language Models (VLMs)",
    category: "Automated QA & Prompting",
    description:
      "Power automated damage localization, synthetic caption generation, dataset gap auditing, and semantic artifact filtering across large batches.",
  },
];
