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
    const { imageBase64, productName, marketingType, benefitPrompt, benefitIndex, mainColor, mainColorHex } = await req.json();

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    if (!imageBase64) {
      throw new Error("imageBase64 is required");
    }

    const environmentLabels: Record<string, { name: string; description: string }> = {
      living_room: { name: "Sala de Estar", description: "modern, well-decorated living room with warm lighting, cozy sofa, shelves, plants" },
      office: { name: "Escritório", description: "modern office or workspace with clean desk, monitor, stationery, professional lighting" },
      outdoor: { name: "Área Externa", description: "outdoor setting like garden, patio, terrace, or nature with natural sunlight and vibrant colors" },
      kitchen: { name: "Cozinha", description: "modern kitchen or dining area with warm appetizing lighting, countertop, tableware" },
      bedroom: { name: "Quarto", description: "cozy bedroom with soft lighting, bed, nightstand, warm textiles" },
      bathroom: { name: "Banheiro", description: "clean modern bathroom with tiles, mirror, elegant fixtures" },
      studio: { name: "Estúdio", description: "professional photography studio with controlled lighting, clean backdrop" },
    };

    let prompt: string;

    if (marketingType === "benefit") {
      prompt = `You are a professional product photographer and marketing expert.
Edit this product image to create a compelling photo that highlights a specific BENEFIT of using this product.

Product: "${productName || "this product"}"
Benefit to highlight: "${benefitPrompt || "the main benefit of this product"}"
Image variation: ${benefitIndex || 1} of 3 (make each variation UNIQUE and DIFFERENT from the others)

RULES:
- Keep the product as the MAIN FOCUS, centered and prominent.
- Visually represent the described benefit in a creative, eye-catching way.
- The image should clearly communicate the benefit to the viewer.
- Show the positive outcome or result described.
- Use clean, bright lighting and professional composition.
- Each variation should use a DIFFERENT angle, composition, or visual metaphor.
- Do NOT add any text, labels, watermarks, or overlays.
- Keep it clean, professional, and aspirational.
- Output at 1024x1024 resolution.`;
    } else if (marketingType.startsWith("environment_")) {
      // Legacy support for old format
      const envKey = marketingType.replace("environment_", "");
      const env = environmentLabels[envKey] || environmentLabels["living_room"];
      prompt = `You are a professional product photographer and interior design expert.
Edit this product image to show it in a beautiful ${env.name} environment.

Product: "${productName || "this product"}"

RULES:
- Place the product naturally in a ${env.description} setting.
- The product should be the MAIN FOCUS but integrated into the environment.
- Make it look like a high-end lifestyle/interior design photo.
- Do NOT add any text, labels, watermarks, or overlays.
- Keep it professional and aspirational.
- Output at 1024x1024 resolution.`;
    } else if (environmentLabels[marketingType]) {
      // New direct environment key format
      const env = environmentLabels[marketingType];
      prompt = `You are a professional product photographer and interior design expert.
Edit this product image to show it in a beautiful ${env.name} environment.

Product: "${productName || "this product"}"

RULES:
- Place the product naturally in a ${env.description} setting.
- The product should be the MAIN FOCUS but integrated into the environment.
- Make it look like a high-end lifestyle/interior design photo.
- Do NOT add any text, labels, watermarks, or overlays.
- Keep it professional and aspirational.
- Output at 1024x1024 resolution.`;
    } else {
      prompt = `You are a professional product photographer and marketing expert.
Edit this product image to create an eye-catching hero product photo.

Product: "${productName || "this product"}"

RULES:
- Keep the product as the MAIN FOCUS, centered and prominent.
- Use a CLEAN WHITE background with subtle professional lighting effects.
- Make the product look PREMIUM and DESIRABLE.
- Do NOT add any text, labels, watermarks, or overlays.
- Keep it clean, minimal, and high-end.
- Output at 1024x1024 resolution.`;
    }

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
    console.error("generate-marketing error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
