export const GEMINI_TEXT_MODEL = "gemini-2.5-flash";
export const GEMINI_IMAGE_MODEL = "gemini-3-pro-image-preview";
export const GEMINI_IMAGE_FALLBACK_MODEL = "gemini-2.5-flash-image";

type GeminiInlineData = {
  data?: string;
  mimeType?: string;
  mime_type?: string;
};

type GeminiPart = {
  text?: string;
  inlineData?: GeminiInlineData;
  inline_data?: GeminiInlineData;
};

type GeminiResponse = {
  candidates?: Array<{
    content?: {
      parts?: GeminiPart[];
    };
  }>;
};

export class GeminiHttpError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export function getGeminiApiKey() {
  const apiKey = Deno.env.get("GEMINI_API_KEY");

  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not configured");
  }

  return apiKey;
}

export function parseDataUrl(dataUrl: string) {
  const match = dataUrl.match(/^data:(.+?);base64,(.+)$/);

  if (!match) {
    throw new Error("Expected a base64 data URL");
  }

  return {
    mimeType: match[1],
    data: match[2],
  };
}

export function buildImagePart(dataUrl: string) {
  const { mimeType, data } = parseDataUrl(dataUrl);

  return {
    inline_data: {
      mime_type: mimeType,
      data,
    },
  };
}

export function buildTextPart(text: string) {
  return { text };
}

export async function callGeminiGenerateContent(
  model: string,
  body: Record<string, unknown>,
): Promise<GeminiResponse> {
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
    {
      method: "POST",
      headers: {
        "x-goog-api-key": getGeminiApiKey(),
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    },
  );

  if (!response.ok) {
    const errorText = await response.text();
    console.error("Gemini API error:", response.status, errorText);
    throw mapGeminiError(response.status, errorText);
  }

  return (await response.json()) as GeminiResponse;
}

export function extractGeminiText(response: GeminiResponse) {
  const text = response.candidates
    ?.flatMap((candidate) => candidate.content?.parts || [])
    .map((part) => part.text || "")
    .join("")
    .trim();

  return text || null;
}

export function extractGeminiImageDataUrl(response: GeminiResponse) {
  const parts = response.candidates?.flatMap((candidate) => candidate.content?.parts || []) || [];

  for (const part of parts) {
    const inlineData = part.inlineData || part.inline_data;
    const imageData = inlineData?.data;
    const mimeType = inlineData?.mimeType || inlineData?.mime_type || "image/png";

    if (imageData) {
      return `data:${mimeType};base64,${imageData}`;
    }
  }

  return null;
}

export async function callGeminiStructuredJson<T>(
  model: string,
  body: Record<string, unknown>,
): Promise<T> {
  const response = await callGeminiGenerateContent(model, body);
  const text = extractGeminiText(response);

  if (!text) {
    throw new Error("Gemini did not return text");
  }

  try {
    return JSON.parse(text) as T;
  } catch (_error) {
    throw new Error(`Gemini returned invalid JSON: ${text.slice(0, 300)}`);
  }
}

function mapGeminiError(status: number, errorText: string) {
  const normalized = errorText.toLowerCase();

  if (status === 429) {
    return new GeminiHttpError(429, "Rate limit exceeded. Aguarde um momento e tente novamente.");
  }

  if (
    normalized.includes("resource_exhausted") ||
    normalized.includes("quota") ||
    normalized.includes("billing")
  ) {
    return new GeminiHttpError(
      402,
      "Cota da API Gemini insuficiente ou billing desativado. Verifique sua conta Google AI.",
    );
  }

  return new GeminiHttpError(status, `Gemini API error: ${status}`);
}
