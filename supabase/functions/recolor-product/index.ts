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

    const prompt = `Edit this image. Change ONLY the color of the main highlighted product/object to the color "${colorName}" (hex: ${colorHex}).

ABSOLUTE RULES - DO NOT BREAK:
- Keep the EXACT same image: same background, same lighting, same shadows, same composition, same angle, same position, same proportions.
- Keep ALL details, textures, patterns, and surface features of the product exactly as they are.
- Do NOT add any text, labels, badges, watermarks, or overlays.
- Do NOT change the background in any way.
- Do NOT move, resize, rotate, or reshape the product.
- Do NOT add or remove any objects.
- The ONLY change should be the color/hue of the main product object changing to ${colorName} (${colorHex}).
- Output the image at the same resolution as the input.`;

    const response = await fetch(
      "https://ai.gateway.lovable.dev/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-3-pro-image-preview",
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
