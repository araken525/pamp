// src/app/api/ai/theme/route.ts
import { NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const tags: string[] = body.tags ?? [];
    const style: string = body.style ?? "classic";
    const description: string = body.description ?? "";

    const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        {
          ok: false,
          error: "API Key not found",
          hint: "Set GEMINI_API_KEY (or GOOGLE_API_KEY) in .env.local, then restart `npm run dev`.",
        },
        { status: 400 }
      );
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    // NOTE: Use a model name that is enabled for your project/key.
    // If you change this, keep it consistent with what worked in your curl tests.
    const model = genAI.getGenerativeModel({ model: process.env.GEMINI_MODEL ?? "gemini-2.0-flash" });

    const prompt = `
You are a design generator for a concert web program.
Return ONLY valid JSON. No prose. No markdown.

Schema:
{
  "palette":{"bg":"#","card":"#","text":"#","muted":"#","accent":"#","border":"#"},
  "variants":{"hero":"poster|minimal","card":"glass|plain","program":"timeline|list"},
  "custom_css":"",
  "typography":{"body":"sans|serif|rounded","heading":"sans|serif|rounded"},
  "background_pattern":""
}

Inputs (JSON):
${JSON.stringify({ tags, style, description }, null, 2)}
`;

    const result = await model.generateContent(prompt);
    const text = result.response.text();

    // --- Robust JSON extraction ---
    const stripCodeFences = (s: string) => s.replace(/```(?:json)?/gi, "").replace(/```/g, "").trim();
    const extractJsonObject = (s: string) => {
      const t = stripCodeFences(s);
      // 1) try direct parse first
      try {
        return JSON.parse(t);
      } catch {
        // 2) fallback: take substring from first "{" to last "}"
        const start = t.indexOf("{");
        const end = t.lastIndexOf("}");
        if (start >= 0 && end > start) {
          const candidate = t.slice(start, end + 1);
          return JSON.parse(candidate);
        }
        throw new Error("AI returned non-JSON response");
      }
    };

    const defaults = {
      palette: {
        bg: "#ffffff",
        card: "#f8fafc",
        text: "#1e293b",
        muted: "#64748b",
        accent: "#3b82f6",
        border: "#e2e8f0",
      },
      variants: { hero: "poster", card: "plain", program: "list" },
      custom_css: "",
      typography: { body: "sans", heading: "sans" },
      background_pattern: "",
    };

    const raw = extractJsonObject(text) as any;

    // Normalize/merge to guarantee shape
    const theme = {
      ...defaults,
      ...raw,
      palette: { ...defaults.palette, ...(raw?.palette ?? {}) },
      variants: { ...defaults.variants, ...(raw?.variants ?? {}) },
      typography: { ...defaults.typography, ...(raw?.typography ?? {}) },
      custom_css: typeof raw?.custom_css === "string" ? raw.custom_css : defaults.custom_css,
      background_pattern: typeof raw?.background_pattern === "string" ? raw.background_pattern : defaults.background_pattern,
    };

    // Minimal allow-list validation to avoid breaking the viewer
    const heroAllowed = new Set(["poster", "minimal"]);
    const cardAllowed = new Set(["glass", "plain"]);
    const programAllowed = new Set(["timeline", "list"]);
    if (!heroAllowed.has(theme.variants.hero)) theme.variants.hero = defaults.variants.hero;
    if (!cardAllowed.has(theme.variants.card)) theme.variants.card = defaults.variants.card;
    if (!programAllowed.has(theme.variants.program)) theme.variants.program = defaults.variants.program;

    return NextResponse.json({ ok: true, theme });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? "unknown" }, { status: 500 });
  }
}