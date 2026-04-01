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

type ShopeeTextResult = {
  title: string;
  description: string;
  keywords: string[];
};

const shopeeTextSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    title: {
      type: "string",
      description: "SEO title for Shopee with up to 120 characters.",
    },
    description: {
      type: "string",
      description: "Complete product description for Shopee with up to 2000 characters.",
    },
    keywords: {
      type: "array",
      description: "Top 10 Shopee keywords for the product.",
      items: {
        type: "string",
      },
    },
  },
  required: ["title", "description", "keywords"],
};

function sanitizeKeywords(values: unknown) {
  if (!Array.isArray(values)) {
    return [];
  }

  const normalized = values
    .filter((value): value is string => typeof value === "string")
    .map((value) => value.trim())
    .filter(Boolean);

  return [...new Set(normalized)].slice(0, 10);
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { productName, imageBase64, category, quantity, heights } = await req.json();
    const isKit = (quantity ?? 1) > 1;
    const qty = quantity ?? 1;
    const heightList: string[] = Array.isArray(heights)
      ? heights.filter((height: string) => height && height.trim())
      : [];

    if (!productName) {
      throw new Error("productName is required");
    }

    const heightInstruction = heightList.length > 0
      ? `Alturas disponiveis: ${heightList.map((height) => `aproximadamente ${height}cm`).join(", ")}.`
      : "Nao invente alturas se elas nao forem informadas.";

    const prompt = `Voce e um especialista em SEO e vendas na Shopee Brasil.

Crie um JSON valido com title, description e keywords para anunciar o produto "${productName}"${
      category ? ` na categoria "${category}"` : ""
    }.

Regras obrigatorias:
- Nunca mencione material de fabricacao, plastico, PLA, resina, impressao 3D ou similares.
- Se mencionar altura, use sempre a palavra "aproximadamente".
- O titulo precisa ter no maximo 120 caracteres.
- A descricao precisa ter no maximo 2000 caracteres.
- As keywords devem trazer exatamente 10 termos relevantes para busca.
- Escreva em portugues do Brasil com foco em conversao.
- Use emojis e bullets na descricao quando fizer sentido.
- Inclua beneficios claros e um fechamento com chamada para compra.
- ${heightInstruction}
${
      isKit
        ? `- Este anuncio e um kit com ${qty} unidades. O titulo deve comecar com "Kit ${qty}".`
        : ""
    }`;

    const parts: Array<Record<string, unknown>> = [buildTextPart(prompt)];

    if (imageBase64) {
      parts.push(buildImagePart(imageBase64));
    }

    const result = await callGeminiStructuredJson<ShopeeTextResult>(GEMINI_TEXT_MODEL, {
      contents: [
        {
          parts,
        },
      ],
      generationConfig: {
        responseMimeType: "application/json",
        responseJsonSchema: shopeeTextSchema,
      },
    });

    return new Response(
      JSON.stringify({
        title: result.title?.trim() || "",
        description: result.description?.trim() || "",
        keywords: sanitizeKeywords(result.keywords),
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error("generate-shopee-text error:", error);

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
