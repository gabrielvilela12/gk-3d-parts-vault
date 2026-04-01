import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import {
  buildImagePart,
  buildTextPart,
  callGeminiGenerateContent,
  extractGeminiImageDataUrl,
  GEMINI_IMAGE_FALLBACK_MODEL,
  GEMINI_IMAGE_MODEL,
  GeminiHttpError,
} from "../_shared/gemini.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function buildImageConfig(model: string, aspectRatio: string) {
  if (model === GEMINI_IMAGE_FALLBACK_MODEL) {
    return { aspectRatio };
  }

  return {
    aspectRatio,
    imageSize: "1K",
  };
}

async function tryGenerateImage(model: string, prompt: string, imageBase64: string) {
  try {
    const response = await callGeminiGenerateContent(model, {
      contents: [
        {
          parts: [
            buildTextPart(prompt),
            buildImagePart(imageBase64),
          ],
        },
      ],
      generationConfig: {
        responseModalities: ["IMAGE"],
        imageConfig: buildImageConfig(model, "1:1"),
      },
    });

    return extractGeminiImageDataUrl(response);
  } catch (error) {
    if (error instanceof GeminiHttpError && (error.status === 402 || error.status === 429)) {
      throw error;
    }

    console.error(`cleanup-product-image generation failed (${model}):`, error);
    return null;
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { imageBase64, productName } = await req.json();

    if (!imageBase64) {
      throw new Error("imageBase64 is required");
    }

    const primaryPrompt = `Edit this product photo into a clean e-commerce packshot.

Product: "${productName || "product"}"

Rules:
- Remove the background and replace it with pure white.
- Keep the product centered and prominent inside a square frame.
- Preserve the original product shape, color, texture, and fine details.
- Use soft professional studio lighting and subtle shadows.
- Remove watermarks, text, logos, and UI elements.
- Return a polished marketplace-ready product photo.`;

    const fallbackPrompt = `Using the provided image, isolate only the main product on a pure white background. Keep the product exactly the same and centered in a square studio photo.`;

    let imageUrl = await tryGenerateImage(GEMINI_IMAGE_MODEL, primaryPrompt, imageBase64);

    if (!imageUrl) {
      imageUrl = await tryGenerateImage(GEMINI_IMAGE_MODEL, fallbackPrompt, imageBase64);
    }

    if (!imageUrl) {
      imageUrl = await tryGenerateImage(GEMINI_IMAGE_FALLBACK_MODEL, fallbackPrompt, imageBase64);
    }

    if (!imageUrl) {
      throw new Error("Nao foi possivel processar a imagem. Tente com outra foto.");
    }

    return new Response(
      JSON.stringify({ imageUrl }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error("cleanup-product-image error:", error);

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
