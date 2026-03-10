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
    const { products, pieces } = await req.json();

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    if (!products?.length || !pieces?.length) {
      throw new Error("products and pieces arrays are required");
    }

    // Build piece list for the prompt
    const pieceList = pieces
      .map((p: { id: string; name: string }, i: number) => `${i + 1}. id="${p.id}" name="${p.name}"`)
      .join("\n");

    // Build content array with all product images
    const contentParts: any[] = [
      {
        type: "text",
        text: `Você precisa associar cada produto do Excel a uma peça do catálogo.

CATÁLOGO DE PEÇAS DISPONÍVEIS:
${pieceList}

Abaixo estão ${products.length} imagens de produtos do Excel, na ordem. Para cada imagem, identifique visualmente qual peça do catálogo corresponde.

IMPORTANTE:
- Compare as imagens com os NOMES das peças. As peças são impressões 3D decorativas.
- Se não conseguir identificar com certeza, retorne null para o pieceId.
- Cada produto pode corresponder a uma peça diferente, preste atenção nos detalhes visuais.
- Produtos com nomes parecidos podem ser peças DIFERENTES (ex: "Escultura Decorativa Abstrata" vs "Escultura Decorativa com Flores" são peças distintas).`,
      },
    ];

    // Add each product image with its index
    for (let i = 0; i < products.length; i++) {
      const p = products[i];
      contentParts.push({
        type: "text",
        text: `\n--- Produto ${i + 1}: "${p.productName}" ---`,
      });
      if (p.imageUrl) {
        contentParts.push({
          type: "image_url",
          image_url: { url: p.imageUrl },
        });
      }
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
              role: "user",
              content: contentParts,
            },
          ],
          tools: [
            {
              type: "function",
              function: {
                name: "match_products",
                description:
                  "Return the matching piece ID for each product, in the same order as the input products.",
                parameters: {
                  type: "object",
                  properties: {
                    matches: {
                      type: "array",
                      items: {
                        type: "object",
                        properties: {
                          productIndex: {
                            type: "number",
                            description: "0-based index of the product",
                          },
                          pieceId: {
                            type: "string",
                            description:
                              "The id of the matched piece from the catalog, or null if no match",
                          },
                          confidence: {
                            type: "string",
                            enum: ["high", "medium", "low"],
                            description: "How confident the match is",
                          },
                        },
                        required: ["productIndex", "pieceId", "confidence"],
                        additionalProperties: false,
                      },
                    },
                  },
                  required: ["matches"],
                  additionalProperties: false,
                },
              },
            },
          ],
          tool_choice: {
            type: "function",
            function: { name: "match_products" },
          },
        }),
      }
    );

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Aguarde e tente novamente." }),
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
    if (!toolCall || toolCall.function.name !== "match_products") {
      console.error("Unexpected response:", JSON.stringify(data).slice(0, 500));
      throw new Error("AI did not return structured matches");
    }

    const result = JSON.parse(toolCall.function.arguments);

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("match-product-image error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
