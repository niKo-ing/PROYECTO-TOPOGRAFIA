import { GoogleGenerativeAI } from "@google/generative-ai";
import { getRequiredEnv } from "@/shared/lib/env";
import { coordenadasSchema } from "@/shared/lib/validation/topografia";

let cachedAI = null;

function getAI() {
  if (cachedAI) return cachedAI;
  cachedAI = new GoogleGenerativeAI(getRequiredEnv("GEMINI_API_KEY"));
  return cachedAI;
}

export async function extractCoordenadasFromPdf({ pdfBase64 }) {
  const ai = getAI();
  const modelName = getRequiredEnv("GEMINI_MODEL");
  const model = ai.getGenerativeModel({ model: modelName });

  const prompt = [
    "Actúa como un sistema experto en topografía.",
    "Analiza el PDF adjunto y extrae todas las tablas o listados de coordenadas.",
    "Devuelve ÚNICAMENTE un arreglo JSON con llaves: punto, norte, este, cota_z, descripcion.",
    "norte/este/cota_z deben ser números (sin comillas).",
    "Sin Markdown ni texto adicional.",
  ].join("\n");

  const result = await model.generateContent([
    {
      inlineData: {
        mimeType: "application/pdf",
        data: pdfBase64,
      },
    },
    prompt,
  ]);

  const rawText = result?.response?.text?.() ?? "";
  if (!rawText) {
    throw new Error("Gemini no devolvió contenido");
  }

  let parsed;
  try {
    parsed = JSON.parse(rawText);
  } catch {
    throw new Error("La respuesta de Gemini no fue JSON válido");
  }

  const normalized = normalizeRows(parsed);
  return coordenadasSchema.parse(normalized);
}

export async function extractCoordenadasFromText({ extractedText }) {
  const ai = getAI();
  const modelName = getRequiredEnv("GEMINI_MODEL");
  const model = ai.getGenerativeModel({ model: modelName });

  const prompt = buildPromptFromExtractedText(extractedText);
  const result = await model.generateContent(prompt);

  const rawText = result?.response?.text?.() ?? "";
  if (!rawText) {
    throw new Error("Gemini no devolvió contenido");
  }

  let parsed;
  try {
    parsed = JSON.parse(rawText);
  } catch {
    throw new Error("La respuesta de Gemini no fue JSON válido");
  }

  return coordenadasSchema.parse(normalizeRows(parsed));
}

function buildPromptFromExtractedText(extractedText) {
  return `Actúa como un sistema experto en topografía. Analiza el siguiente texto extraído de un PDF y conviértelo en un arreglo JSON estructurado.

Texto a analizar:
${extractedText}

Reglas estrictas para el JSON:
1. Usa exactamente estas llaves para cada objeto: 'punto', 'norte', 'este', 'cota_z', 'descripcion'.
2. Los valores de 'norte', 'este' y 'cota_z' DEBEN ser números puros (float/number), sin comillas. Remueve cualquier comilla o espacio. Ejemplo: 6345120.45.
3. Las llaves 'punto' y 'descripcion' deben ser strings. En 'descripcion', limpia los saltos de línea intermedios (ej: 'Puntos de Referencia / Monolito').
4. Devuelve ÚNICAMENTE el arreglo JSON, sin bloques de código Markdown (\`\`\`json) ni texto adicional.`;
}

function normalizeRows(parsed) {
  if (!Array.isArray(parsed)) {
    throw new Error("Gemini debe devolver un arreglo JSON");
  }

  return parsed.map((r) => {
    const punto = String(r?.punto ?? "").trim();
    const descripcion = normalizeDescription(r?.descripcion);
    const norte = normalizeNumber(r?.norte);
    const este = normalizeNumber(r?.este);
    const cotaZ = normalizeNumber(r?.cota_z);

    return {
      punto,
      norte,
      este,
      cota_z: cotaZ,
      descripcion,
    };
  });
}

function normalizeDescription(value) {
  const s = value === null || value === undefined ? "" : String(value);
  return s
    .replace(/\r/g, "")
    .split("\n")
    .map((p) => p.trim())
    .filter(Boolean)
    .join(" / ");
}

function normalizeNumber(value) {
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new Error("Número inválido en coordenadas");
    return value;
  }

  if (value === null || value === undefined) {
    throw new Error("Falta un número requerido en coordenadas");
  }

  let s = String(value).trim();
  s = s.replace(/^["']|["']$/g, "");
  s = s.replace(/\s+/g, "");

  const hasDot = s.includes(".");
  const hasComma = s.includes(",");
  if (hasDot && hasComma) {
    s = s.replaceAll(",", "");
  } else if (!hasDot && hasComma) {
    s = s.replaceAll(",", ".");
  }

  const n = Number(s);
  if (!Number.isFinite(n)) {
    throw new Error(`No se pudo convertir a número: ${String(value)}`);
  }
  return n;
}
