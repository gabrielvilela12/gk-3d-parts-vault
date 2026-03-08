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
    const { imageBase64, productName, marketingType } = await req.json();

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    if (!imageBase64) {
      throw new Error("imageBase64 is required");
    }

    const prompts: Record<string, string> = {
      pain_point: `You are a professional product photographer and marketing expert. 
Edit this product image to create a compelling marketing photo that highlights the PROBLEM this product solves.

Product: "${productName || "this product"}"

RULES:
- Keep the product as the MAIN FOCUS, centered and prominent.
- Use a CLEAN WHITE background as the base.
- Add subtle visual context that shows the PAIN POINT or PROBLEM the product solves.
- Make it look like a professional e-commerce/marketplace listing photo.
- The image should make the viewer FEEL they NEED this product.
- Do NOT add any text, labels, watermarks, or overlays.
- Keep it clean, professional, and eye-catching.
- Output at 1024x1024 resolution.`,

      usage: `You are a professional product photographer and marketing expert.
Edit this product image to create a compelling marketing photo showing the product IN USE.

Product: "${productName || "this product"}"

RULES:
- Keep the product as the MAIN FOCUS, centered and prominent.
- Use a CLEAN WHITE or very light neutral background.
- Show the product being used in a natural, aspirational lifestyle context.
- Make it look like a premium e-commerce product photo with context.
- Do NOT add any text, labels, watermarks, or overlays.
- Keep it clean, professional, and eye-catching.
- Output at 1024x1024 resolution.`,

      highlight: `You are a professional product photographer and marketing expert.
Edit this product image to create an eye-catching hero product photo.

Product: "${productName || "this product"}"

RULES:
- Keep the product as the MAIN FOCUS, centered and prominent.
- Use a CLEAN WHITE background with subtle professional lighting effects.
- Make the product look PREMIUM and DESIRABLE.
- Add subtle depth: soft shadow beneath the product, slight glow or rim lighting.
- Do NOT add any text, labels, watermarks, or overlays.
- Do NOT change the product's color, shape, or details.
- Keep it clean, minimal, and high-end.
- Output at 1024x1024 resolution.`,

      benefit: `You are a professional product photographer and marketing expert.
Edit this product image to create a compelling photo that highlights the MAIN BENEFIT of using this product.

Product: "${productName || "this product"}"

RULES:
- Keep the product as the MAIN FOCUS, centered and prominent.
- Show a BEFORE/AFTER or TRANSFORMATION visual that demonstrates the key benefit.
- The image should clearly communicate WHY someone should buy this product.
- Show the positive outcome or result of using the product.
- Use clean, bright lighting and professional composition.
- Do NOT add any text, labels, watermarks, or overlays.
- Keep it clean, professional, and aspirational.
- Output at 1024x1024 resolution.`,

      environment_living_room: `You are a professional product photographer and interior design expert.
Edit this product image to show it in a beautiful LIVING ROOM environment.

Product: "${productName || "this product"}"

RULES:
- Place the product naturally in a modern, well-decorated living room setting.
- The product should be the MAIN FOCUS but integrated into the environment.
- Use warm, inviting lighting typical of a cozy living room.
- Include subtle decor elements (sofa, shelves, plants) to create context WITHOUT overwhelming the product.
- Make it look like a high-end lifestyle/interior design photo.
- Do NOT add any text, labels, watermarks, or overlays.
- Keep it professional and aspirational.
- Output at 1024x1024 resolution.`,

      environment_office: `You are a professional product photographer and interior design expert.
Edit this product image to show it in a modern OFFICE or WORKSPACE environment.

Product: "${productName || "this product"}"

RULES:
- Place the product naturally on a desk or workspace setting.
- The product should be the MAIN FOCUS but integrated into the environment.
- Use clean, professional lighting typical of a modern office.
- Include subtle office elements (desk, monitor, stationery) to create context WITHOUT overwhelming the product.
- Make it look like a professional workspace lifestyle photo.
- Do NOT add any text, labels, watermarks, or overlays.
- Keep it clean and professional.
- Output at 1024x1024 resolution.`,

      environment_outdoor: `You are a professional product photographer.
Edit this product image to show it in a beautiful OUTDOOR environment.

Product: "${productName || "this product"}"

RULES:
- Place the product naturally in an outdoor setting (garden, patio, terrace, or nature).
- The product should be the MAIN FOCUS but integrated into the environment.
- Use natural sunlight and fresh, vibrant colors.
- Include subtle outdoor elements (plants, sky, natural textures) to create context WITHOUT overwhelming the product.
- Make it look like a premium outdoor lifestyle photo.
- Do NOT add any text, labels, watermarks, or overlays.
- Keep it natural and aspirational.
- Output at 1024x1024 resolution.`,

      environment_kitchen: `You are a professional product photographer and interior design expert.
Edit this product image to show it in a modern KITCHEN or DINING environment.

Product: "${productName || "this product"}"

RULES:
- Place the product naturally in a kitchen or dining area setting.
- The product should be the MAIN FOCUS but integrated into the environment.
- Use warm, appetizing lighting typical of kitchen photography.
- Include subtle kitchen/dining elements (countertop, tableware, ingredients) to create context WITHOUT overwhelming the product.
- Make it look like a high-end kitchen lifestyle photo.
- Do NOT add any text, labels, watermarks, or overlays.
- Keep it warm, inviting, and professional.
- Output at 1024x1024 resolution.`,
    };

    const prompt = prompts[marketingType] || prompts.highlight;

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
