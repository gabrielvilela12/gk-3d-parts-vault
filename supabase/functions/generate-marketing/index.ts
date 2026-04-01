import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import {
  buildImagePart,
  buildTextPart,
  callGeminiGenerateContent,
  extractGeminiImageDataUrl,
  GEMINI_IMAGE_MODEL,
  GeminiHttpError,
} from "../_shared/gemini.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const environmentLabels: Record<string, { name: string; description: string }> = {
  living_room: {
    name: "Sala de Estar",
    description: "a modern and tasteful living room with warm lighting, sofa, shelves, and decor",
  },
  office: {
    name: "Escritorio",
    description: "a modern workspace with desk, monitor, accessories, and professional lighting",
  },
  outdoor: {
    name: "Area Externa",
    description: "an outdoor setting such as garden, patio, terrace, or nature with natural daylight",
  },
  kitchen: {
    name: "Cozinha",
    description: "a bright modern kitchen or dining area with countertop and tableware",
  },
  bedroom: {
    name: "Quarto",
    description: "a cozy bedroom with soft lighting, bed, nightstand, and warm textiles",
  },
  bathroom: {
    name: "Banheiro",
    description: "a clean modern bathroom with elegant fixtures and a refined atmosphere",
  },
  studio: {
    name: "Estudio",
    description: "a premium photography studio with controlled light and a polished set",
  },
};

function buildPrompt(params: {
  productName?: string;
  marketingType?: string;
  benefitPrompt?: string;
  benefitIndex?: number;
  mainColor?: string;
  mainColorHex?: string;
}) {
  const {
    productName,
    marketingType,
    benefitPrompt,
    benefitIndex,
    mainColor,
    mainColorHex,
  } = params;

  const colorInstruction = mainColor
    ? `\n- The product must appear in the color "${mainColor}" (${mainColorHex}).`
    : "";
  const normalizedMarketingType = marketingType?.startsWith("environment_")
    ? marketingType.replace("environment_", "")
    : marketingType;

  if (normalizedMarketingType === "benefit") {
    return `Create a premium marketing image from the provided product photo.

Product: "${productName || "this product"}"
Benefit to communicate: "${benefitPrompt || "the main benefit of this product"}"
Variation number: ${benefitIndex || 1} of 3

Rules:
- Keep the product as the hero element and preserve its core identity.
- Visually communicate the stated benefit in a clear and aspirational way.
- Make this variation distinct in angle, composition, or visual storytelling.
- Use polished lighting and premium art direction.${colorInstruction}
- Do not add labels, watermarks, banners, or any text overlay.`;
  }

  if (normalizedMarketingType && environmentLabels[normalizedMarketingType]) {
    const environment = environmentLabels[normalizedMarketingType];

    return `Transform the provided product image into a lifestyle marketing photo.

Product: "${productName || "this product"}"
Environment: ${environment.name}

Rules:
- Place the product naturally inside ${environment.description}.
- Keep the product as the main focus while integrating it believably into the scene.
- Make the final result feel premium, tasteful, and ready for e-commerce marketing.${colorInstruction}
- Do not add labels, watermarks, banners, or any text overlay.`;
  }

  return `Create a premium hero image from the provided product photo.

Product: "${productName || "this product"}"

Rules:
- Keep the product centered and visually dominant.
- Use a clean premium composition with refined lighting.
- Preserve the recognizable identity and details of the product.${colorInstruction}
- Do not add labels, watermarks, banners, or any text overlay.`;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { imageBase64, productName, marketingType, benefitPrompt, benefitIndex, mainColor, mainColorHex } =
      await req.json();

    if (!imageBase64) {
      throw new Error("imageBase64 is required");
    }

    const response = await callGeminiGenerateContent(GEMINI_IMAGE_MODEL, {
      contents: [
        {
          parts: [
            buildTextPart(
              buildPrompt({
                productName,
                marketingType,
                benefitPrompt,
                benefitIndex,
                mainColor,
                mainColorHex,
              }),
            ),
            buildImagePart(imageBase64),
          ],
        },
      ],
      generationConfig: {
        responseModalities: ["IMAGE"],
        imageConfig: {
          aspectRatio: "1:1",
          imageSize: "1K",
        },
      },
    });

    const imageUrl = extractGeminiImageDataUrl(response);

    if (!imageUrl) {
      throw new Error("Gemini nao retornou uma imagem de marketing.");
    }

    return new Response(
      JSON.stringify({ imageUrl }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error("generate-marketing error:", error);

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
