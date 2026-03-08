import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

async function tryGenerateImage(apiKey: string, model: string, prompt: string, imageBase64: string): Promise<string | null> {
  const response = await fetch(
    "https://ai.gateway.lovable.dev/v1/chat/completions",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: prompt },
              {
                type: "image_url",
                image_url: { url: imageBase64 },
              },
            ],
          },
        ],
        modalities: ["image", "text"],
      }),
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`AI gateway error (${model}):`, response.status, errorText);
    if (response.status === 429 || response.status === 402) {
      throw { status: response.status };
    }
    return null;
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.images?.[0]?.image_url?.url || null;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { imageBase64, productName } = await req.json();

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    if (!imageBase64) {
      throw new Error("imageBase64 is required");
    }

    const primaryPrompt = `Edit this product photo to create a clean, professional e-commerce product image.

Product: "${productName || "product"}"

Instructions:
- Remove the background and replace with PURE WHITE
- Center the product, filling about 70-80% of the 1024x1024 frame
- Apply professional studio lighting with soft shadows
- Keep the product's original colors, shape and details exactly as they are
- Remove any watermarks, text, logos, or UI elements
- Make it look like a premium product photo for an online store
- Output at 1024x1024 resolution`;

    const fallbackPrompt = `Remove the background from this product photo and place it centered on a clean white background. Keep the product exactly as it is. Output 1024x1024.`;

    // Try primary model first
    let imageUrl = await tryGenerateImage(LOVABLE_API_KEY, "google/gemini-3-pro-image-preview", primaryPrompt, imageBase64);

    // If primary fails, retry with simpler prompt
    if (!imageUrl) {
      console.log("Primary attempt failed, retrying with simpler prompt...");
      imageUrl = await tryGenerateImage(LOVABLE_API_KEY, "google/gemini-3-pro-image-preview", fallbackPrompt, imageBase64);
    }

    // If still fails, try fallback model
    if (!imageUrl) {
      console.log("Retrying with fallback model (gemini-2.5-flash-image)...");
      imageUrl = await tryGenerateImage(LOVABLE_API_KEY, "google/gemini-2.5-flash-image", fallbackPrompt, imageBase64);
    }

    if (!imageUrl) {
      throw new Error("Não foi possível processar a imagem. Tente com outra foto.");
    }

    return new Response(
      JSON.stringify({ imageUrl }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e: any) {
    if (e?.status === 429) {
      return new Response(
        JSON.stringify({ error: "Rate limit exceeded. Aguarde um momento e tente novamente." }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    if (e?.status === 402) {
      return new Response(
        JSON.stringify({ error: "Créditos insuficientes. Adicione créditos no workspace." }),
        { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    console.error("cleanup-product-image error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
