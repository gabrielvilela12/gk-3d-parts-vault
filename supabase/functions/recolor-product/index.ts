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

const aspectRatios: Record<string, string> = {
  square: "1:1",
  story: "9:16",
  banner: "16:9",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { imageBase64, colorName, colorHex, productName, format } = await req.json();

    if (!imageBase64) {
      throw new Error("imageBase64 is required");
    }

    const aspectRatio = aspectRatios[format] || "1:1";
    const prompt = `Recolor only the main product in this image.

Product name: "${productName || "product"}"
Target color: "${colorName}" (${colorHex})

Absolute rules:
- Change only the color of the main product.
- Keep the background, lighting, shadows, framing, angle, scale, and composition exactly the same.
- Preserve every texture, detail, pattern, and surface feature of the product.
- Do not add or remove objects.
- Do not add text, labels, badges, watermarks, or overlays.
- The result must look like the same photo, with only the product color changed.`;

    const response = await callGeminiGenerateContent(GEMINI_IMAGE_MODEL, {
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
        imageConfig: {
          aspectRatio,
          imageSize: "1K",
        },
      },
    });

    const imageUrl = extractGeminiImageDataUrl(response);

    if (!imageUrl) {
      throw new Error("Gemini nao retornou uma imagem recolorida.");
    }

    return new Response(
      JSON.stringify({ imageUrl }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error("recolor-product error:", error);

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
