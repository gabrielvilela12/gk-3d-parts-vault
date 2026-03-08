import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { imageBase64, colorName, colorHex, productName, backgroundStyle, format } = await req.json();

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    if (!imageBase64) {
      throw new Error("imageBase64 is required");
    }

    // Build dimensions text
    const dims: Record<string, string> = {
      square: "1080x1080",
      story: "1080x1920 (vertical/portrait)",
      banner: "1920x1080 (horizontal/landscape)",
    };
    const dimText = dims[format] || "1080x1080";

    // Build background instruction
    let bgInstruction = "";
    if (backgroundStyle === "white") {
      bgInstruction = "Place the product on a clean, pure white background.";
    } else if (backgroundStyle === "promo") {
      bgInstruction =
        "Place the product on a warm yellow/golden promotional background. Add a small red diagonal ribbon/banner in the top-right corner with the text 'PROMOÇÃO' in white.";
    } else if (backgroundStyle === "premium") {
      bgInstruction =
        "Place the product on a dark, elegant gradient background (deep indigo/navy). Add subtle dot pattern for luxury feel.";
    }

    const prompt = `You are a product photography editor. Take this product image and create a professional advertisement image.

CRITICAL INSTRUCTIONS:
1. Change ONLY the color of the main product/object to ${colorName} (${colorHex}). Keep the product shape, texture, and details intact.
2. ${bgInstruction}
3. The output must be exactly ${dimText} pixels.
4. At the bottom of the image, add a small color label/badge showing the color name "${colorName}" with the background color ${colorHex}.
${productName ? `5. Add the product name "${productName}" in elegant text above the color badge.` : ""}
6. Keep the image professional and ready for e-commerce/marketplace listing.
7. Do NOT change the shape or design of the product, only its color.`;

    const response = await fetch(
      "https://ai.gateway.lovable.dev/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash-image",
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
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Aguarde um momento e tente novamente." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "Créditos insuficientes. Adicione créditos no workspace." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const data = await response.json();
    const generatedImageUrl =
      data.choices?.[0]?.message?.images?.[0]?.image_url?.url;

    if (!generatedImageUrl) {
      console.error("No image in response:", JSON.stringify(data).slice(0, 500));
      throw new Error("AI did not return an image");
    }

    return new Response(
      JSON.stringify({ imageUrl: generatedImageUrl }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("recolor-product error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
