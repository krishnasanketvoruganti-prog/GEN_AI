import "dotenv/config";
import express from "express";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { GoogleGenAI, Type } from "@google/genai";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = 3000;
const ALLOWED_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
]);
const MAX_BASE64_BYTES = 12 * 1024 * 1024;

function getGeminiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not configured in the server environment.");
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        "User-Agent": "aistudio-build",
      },
    },
  });
}

function validateImagePayload(
  imageBase64: unknown,
  mimeType: unknown
): { data: string; mime: string } {
  if (typeof imageBase64 !== "string" || imageBase64.length === 0) {
    throw new Error("Missing or empty imageBase64 payload.");
  }
  if (typeof mimeType !== "string" || !ALLOWED_MIME_TYPES.has(mimeType)) {
    throw new Error("Unsupported image MIME type. Use image/jpeg, image/png, or image/webp.");
  }
  const cleaned = imageBase64.replace(/^data:[^;]+;base64,/, "");
  if (cleaned.length > MAX_BASE64_BYTES) {
    throw new Error("Image payload exceeds maximum 12MB size limit.");
  }
  return { data: cleaned, mime: mimeType };
}

function formatGeminiError(err: unknown): { status: number; message: string } {
  const rawMessage = err instanceof Error ? err.message : "Unknown Gemini API error";
  if (rawMessage.includes("403") || rawMessage.includes("PERMISSION_DENIED")) {
    return {
      status: 403,
      message: "Gemini API permission denied. Please verify your API key in Settings > Secrets.",
    };
  }
  if (rawMessage.includes("400") || rawMessage.includes("API_KEY_INVALID")) {
    return {
      status: 400,
      message: "Invalid Gemini API request or key. Please check Settings > Secrets.",
    };
  }
  if (rawMessage.includes("429") || rawMessage.includes("RESOURCE_EXHAUSTED")) {
    return {
      status: 429,
      message: "Gemini API quota reached. Retry shortly or upgrade your key in Settings > Secrets.",
    };
  }
  if (rawMessage.includes("GEMINI_API_KEY is not configured")) {
    return { status: 503, message: rawMessage };
  }
  return { status: 500, message: rawMessage };
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: "16mb" }));

  app.get("/api/health", (_req, res) => {
    res.json({ ok: true });
  });

  app.post("/api/vlm/inspect", async (req, res) => {
    try {
      const { imageBase64, mimeType, vehicleHint } = req.body ?? {};
      const { data, mime } = validateImagePayload(imageBase64, mimeType);
      const ai = getGeminiClient();

      const hintText =
        typeof vehicleHint === "string" && vehicleHint.trim().length > 0
          ? `Context hint: ${vehicleHint.trim().slice(0, 120)}.`
          : "";

      const response = await ai.models.generateContent({
        model: "gemini-4-hydrogen",
        contents: {
          parts: [
            {
              inlineData: {
                mimeType: mime,
                data,
              },
            },
            {
              text:
                `You are an automotive computer vision and collision appraisal engineer. ` +
                `Inspect this vehicle photo to identify the exact car type (body style and likely make/model), ` +
                `all visible damage types (dent, scratch, crack, shatter, scuff, crease, or none if undamaged), affected body parts, and severity. ${hintText} ` +
                `Return accurate normalized bounding boxes in [ymin, xmin, ymax, xmax] scaled 0 to 1000. ` +
                `If the vehicle is undamaged, return an empty detections array, primaryDamageType "none", overallSeverity "undamaged", and suggest high-value damage synthesis targets.`,
            },
          ],
        },
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              vehicleType: {
                type: Type.STRING,
                description: "One of: sedan, suv, hatchback, commercial, motorcycle, pickup, coupe",
              },
              carMakeModel: {
                type: Type.STRING,
                description: "Identified or estimated make, model, and era e.g. 'Honda Civic Sedan' or 'Toyota RAV4 SUV'",
              },
              primaryDamageType: {
                type: Type.STRING,
                description: "Dominant damage type found, one of: dent, scratch, crack, shatter, scuff, crease, none",
              },
              overallSeverity: {
                type: Type.STRING,
                description: "Overall damage severity, one of: minor, moderate, severe, undamaged",
              },
              damageSummary: {
                type: Type.STRING,
                description: "Concise 1-sentence summary of the car type and all damage types detected",
              },
              paintFinish: {
                type: Type.STRING,
                description: "Concise color and clear-coat finish description",
              },
              detectedLighting: {
                type: Type.STRING,
                description: "Current lighting/weather environment in the image",
              },
              cameraAngle: {
                type: Type.STRING,
                description: "Camera viewpoint e.g. rear-left 3/4, front-right close-up",
              },
              detections: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    part: { type: Type.STRING },
                    damageType: {
                      type: Type.STRING,
                      description: "One of: dent, scratch, crack, shatter, scuff, crease",
                    },
                    severity: {
                      type: Type.STRING,
                      description: "One of: minor, moderate, severe",
                    },
                    confidence: { type: Type.NUMBER },
                    bbox: {
                      type: Type.ARRAY,
                      items: { type: Type.INTEGER },
                      description: "[ymin, xmin, ymax, xmax] normalized 0..1000",
                    },
                    repairCostMin: { type: Type.INTEGER },
                    repairCostMax: { type: Type.INTEGER },
                  },
                },
              },
              syntheticCaptionPrompt: {
                type: Type.STRING,
                description:
                  "ControlNet / Diffusion / cGAN conditioning prompt preserving panel geometry while describing realistic clear-coat specular cues",
              },
              recommendedAugmentations: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description: "3 concise domain/lighting or damage variation recommendations",
              },
            },
          },
        },
      });

      const rawText = (response.text ?? "{}").trim();
      const parsed = JSON.parse(rawText);
      res.json(parsed);
    } catch (err) {
      const { status, message } = formatGeminiError(err);
      res.status(status).json({ error: message });
    }
  });

  app.post("/api/vlm/qa-audit", async (req, res) => {
    try {
      const {
        imageBase64,
        mimeType,
        targetCondition,
        expectedPart,
        expectedDamageType,
        paradigm,
      } = req.body ?? {};
      const { data, mime } = validateImagePayload(imageBase64, mimeType);
      const ai = getGeminiClient();

      const conditionDesc =
        typeof targetCondition === "string" ? targetCondition.slice(0, 120) : "Augmented";
      const partDesc = typeof expectedPart === "string" ? expectedPart.slice(0, 80) : "vehicle panel";
      const damageDesc =
        typeof expectedDamageType === "string" ? expectedDamageType.slice(0, 80) : "damage";
      const paradigmDesc =
        typeof paradigm === "string" ? paradigm.slice(0, 80) : "Conditioned GenAI";

      const response = await ai.models.generateContent({
        model: "gemini-4-hydrogen",
        contents: {
          parts: [
            {
              inlineData: {
                mimeType: mime,
                data,
              },
            },
            {
              text:
                `Audit this synthetic/augmented vehicle training image generated via "${paradigmDesc}" ` +
                `under target condition "${conditionDesc}". Expected ground-truth label: ${damageDesc} on ${partDesc}. ` +
                `Evaluate whether the damage remains clearly visible, geometry/labels stay aligned, and paint specular reflections look physically plausible without severe artifacts.`,
            },
          ],
        },
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              labelPreserved: { type: Type.BOOLEAN },
              specularRealismScore: {
                type: Type.INTEGER,
                description: "0 to 100 perceptual realism score for paint reflections and lighting",
              },
              artifactFlags: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
              },
              verdict: {
                type: Type.STRING,
                description: "One of: PASS, REVIEW, REJECT",
              },
              reasoning: {
                type: Type.STRING,
                description: "Concise 1-2 sentence technical QA diagnosis",
              },
            },
          },
        },
      });

      const rawText = (response.text ?? "{}").trim();
      const parsed = JSON.parse(rawText);
      res.json(parsed);
    } catch (err) {
      const { status, message } = formatGeminiError(err);
      res.status(status).json({ error: message });
    }
  });

  app.post("/api/vlm/gap-audit", async (req, res) => {
    try {
      const { vehicleDistribution, damageDistribution, lightingDistribution } = req.body ?? {};
      if (!vehicleDistribution || !damageDistribution) {
        return res.status(400).json({ error: "Missing dataset distribution summaries." });
      }
      const ai = getGeminiClient();

      const response = await ai.models.generateContent({
        model: "gemini-4-hydrogen",
        contents:
          `Analyze this automotive damage training dataset distribution and recommend 3 high-impact synthetic augmentation recipes to fix class imbalance and domain shift gaps.\n` +
          `Vehicle counts: ${JSON.stringify(vehicleDistribution)}\n` +
          `Damage counts: ${JSON.stringify(damageDistribution)}\n` +
          `Lighting/environment counts: ${JSON.stringify(lightingDistribution ?? {})}\n` +
          `Choose targetCondition from: "night_lot", "midday_glare", "wet_rain", "dim_workshop", "harsh_flash", "overcast".\n` +
          `Choose paradigm from: "diffusion_controlnet", "spade_layout", "cyclegan_domain", "pix2pix_mask", "classical_baseline".`,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              summary: { type: Type.STRING },
              bottleneckClass: { type: Type.STRING },
              recipes: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    title: { type: Type.STRING },
                    paradigm: { type: Type.STRING },
                    targetCondition: { type: Type.STRING },
                    targetVehicleType: { type: Type.STRING },
                    targetDamageType: { type: Type.STRING },
                    recommendedCount: { type: Type.INTEGER },
                    rationale: { type: Type.STRING },
                  },
                },
              },
            },
          },
        },
      });

      const rawText = (response.text ?? "{}").trim();
      const parsed = JSON.parse(rawText);
      res.json(parsed);
    } catch (err) {
      const { status, message } = formatGeminiError(err);
      res.status(status).json({ error: message });
    }
  });

  const isProd = process.env.NODE_ENV === "production" || fs.existsSync(path.join(__dirname, "dist", "index.html"));

  if (!isProd || process.env.VITE_DEV_MIDDLEWARE === "true") {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.join(__dirname, "dist");
    app.use(express.static(distDir));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(distDir, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`DamageAugment AI server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error("Failed to start DamageAugment AI server:", err);
  process.exit(1);
});
