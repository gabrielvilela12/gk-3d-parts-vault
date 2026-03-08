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
    const { imageBase64 } = await req.json();

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    if (!imageBase64) {
      throw new Error("imageBase64 is required");
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
          model: "google/gemini-3-flash-preview",
          messages: [
            {
              role: "system",
              content: `Você é um especialista em identificar produtos e em marketing para e-commerce. Analise a imagem e:
1. Identifique o produto com precisão
2. Sugira os melhores ambientes/cenários para fotografar esse produto (entre: living_room, office, outdoor, kitchen, bedroom, bathroom, studio)
3. Sugira o principal benefício desse produto para usar em imagens de marketing
Escolha APENAS ambientes que façam sentido para o produto. Ex: um vaso decorativo → sala, escritório. Um utensílio de cozinha → cozinha. Um item de jardim → outdoor.`,
            },
            {
              role: "user",
              content: [
                {
                  type: "text",
                  text: `Analise esta foto de produto e retorne:
1. Nome do produto (curto, específico, como seria listado em marketplace)
2. Descrição curta (1-2 frases)
3. Lista dos ambientes mais adequados para fotografar esse produto (apenas os que fazem sentido)
4. Uma frase descrevendo o principal benefício do produto para imagens de marketing`,
                },
                {
                  type: "image_url",
                  image_url: { url: imageBase64 },
                },
              ],
            },
          ],
          tools: [
            {
              type: "function",
              function: {
                name: "identify_product",
                description: "Return the identified product info with suggested environments and benefit.",
                parameters: {
                  type: "object",
                  properties: {
                    name: {
                      type: "string",
                      description: "Product name, short and specific (e.g. 'Suporte de Celular Veicular')",
                    },
                    description: {
                      type: "string",
                      description: "Short product description (1-2 sentences)",
                    },
                    suggested_environments: {
                      type: "array",
                      items: {
                        type: "string",
                        enum: ["living_room", "office", "outdoor", "kitchen", "bedroom", "bathroom", "studio"],
                      },
                      description: "List of environments that make sense for this product (2-4 items)",
                    },
                    benefit_prompt: {
                      type: "string",
                      description: "A sentence describing the main benefit of this product for marketing images (e.g. 'Transforma qualquer ambiente com elegância e sofisticação')",
                    },
                  },
                  required: ["name", "description", "suggested_environments", "benefit_prompt"],
                  additionalProperties: false,
                },
              },
            },
          ],
          tool_choice: { type: "function", function: { name: "identify_product" } },
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
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall || toolCall.function.name !== "identify_product") {
      console.error("Unexpected response:", JSON.stringify(data).slice(0, 500));
      throw new Error("AI did not return structured product identification");
    }

    const result = JSON.parse(toolCall.function.arguments);

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("identify-product error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
