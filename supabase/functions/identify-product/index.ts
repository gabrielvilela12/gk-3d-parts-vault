import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import {
  buildImagePart,
  buildTextPart,
  callGeminiStructuredJson,
  GEMINI_TEXT_MODEL,
  GeminiHttpError,
} from "../_shared/gemini.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const allowedEnvironments = [
  "living_room",
  "office",
  "outdoor",
  "kitchen",
  "bedroom",
  "bathroom",
  "studio",
] as const;

type EnvironmentKey = (typeof allowedEnvironments)[number];

type IdentifyProductResult = {
  name: string;
  description: string;
  suggested_environments: EnvironmentKey[];
  benefit_prompt: string;
};

const identifyProductSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    name: {
      type: "string",
      description: "Short and specific product name, suitable for a marketplace listing.",
    },
    description: {
      type: "string",
      description: "Short product description in 1 to 2 sentences.",
    },
    suggested_environments: {
      type: "array",
      description: "Only environments that genuinely fit the product.",
      items: {
        type: "string",
        enum: [...allowedEnvironments],
      },
    },
    benefit_prompt: {
      type: "string",
      description: "A short marketing sentence describing the product's main benefit.",
    },
  },
  required: ["name", "description", "suggested_environments", "benefit_prompt"],
};

function sanitizeEnvironments(values: unknown): EnvironmentKey[] {
  if (!Array.isArray(values)) {
    return [];
  }

  const uniqueValues = new Set<EnvironmentKey>();

  for (const value of values) {
    if (typeof value === "string" && allowedEnvironments.includes(value as EnvironmentKey)) {
      uniqueValues.add(value as EnvironmentKey);
    }
  }

  return [...uniqueValues];
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { imageBase64 } = await req.json();

    if (!imageBase64) {
      throw new Error("imageBase64 is required");
    }

    const prompt = `Voce e um especialista em identificar produtos para e-commerce e criar direcionamento de marketing.

Analise a imagem enviada e retorne um JSON valido com:
- name: nome curto e especifico do produto, como seria anunciado em marketplace.
- description: descricao curta de 1 a 2 frases.
- suggested_environments: escolha apenas entre ${allowedEnvironments.join(", ")}.
- benefit_prompt: uma frase curta explicando o principal beneficio do produto para criativos de marketing.

Escolha somente ambientes que facam sentido real para o produto.`;

    const result = await callGeminiStructuredJson<IdentifyProductResult>(GEMINI_TEXT_MODEL, {
      contents: [
        {
          parts: [
            buildTextPart(prompt),
            buildImagePart(imageBase64),
          ],
        },
      ],
      generationConfig: {
        responseMimeType: "application/json",
        responseJsonSchema: identifyProductSchema,
      },
    });

    return new Response(
      JSON.stringify({
        name: result.name?.trim() || "",
        description: result.description?.trim() || "",
        suggested_environments: sanitizeEnvironments(result.suggested_environments),
        benefit_prompt: result.benefit_prompt?.trim() || "",
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error("identify-product error:", error);

    if (error instanceof GeminiHttpError) {
      return new Response(
        JSON.stringify({ error: error.message }),
        { status: error.status, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
