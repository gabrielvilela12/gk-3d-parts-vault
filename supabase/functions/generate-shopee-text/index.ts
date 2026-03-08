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
    const { productName, imageBase64, category } = await req.json();

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    if (!productName) {
      throw new Error("productName is required");
    }

    const systemPrompt = `Você é um especialista em SEO e vendas na Shopee Brasil. Você conhece profundamente as palavras-chave mais buscadas, técnicas de ranqueamento e copywriting que converte na plataforma.`;

    const userPrompt = `Gere um TÍTULO e DESCRIÇÃO otimizados para vender o produto "${productName}"${category ? ` na categoria "${category}"` : ""} na Shopee Brasil.

TÍTULO (máximo 120 caracteres):
- Use palavras-chave de ALTO VOLUME de busca na Shopee
- Inclua variações e sinônimos relevantes
- Formato: Palavra-chave principal + Características + Diferencial
- Exemplo: "Suporte Celular Carro Veicular Universal Ventosa 360 Graus GPS"

DESCRIÇÃO (máximo 2000 caracteres):
- Use emojis estrategicamente para chamar atenção
- Bullet points com benefícios claros
- Palavras-chave distribuídas naturalmente no texto
- Inclua especificações técnicas quando relevante
- Call-to-action convincente no final
- Formato profissional de anúncio Shopee

Também retorne as 10 melhores palavras-chave/tags para esse produto na Shopee.`;

    const messages: any[] = [
      { role: "system", content: systemPrompt },
    ];

    if (imageBase64) {
      messages.push({
        role: "user",
        content: [
          { type: "text", text: userPrompt },
          { type: "image_url", image_url: { url: imageBase64 } },
        ],
      });
    } else {
      messages.push({ role: "user", content: userPrompt });
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
          messages,
          tools: [
            {
              type: "function",
              function: {
                name: "shopee_product_text",
                description: "Return optimized Shopee product title, description and keywords.",
                parameters: {
                  type: "object",
                  properties: {
                    title: {
                      type: "string",
                      description: "SEO-optimized product title for Shopee (max 120 chars)",
                    },
                    description: {
                      type: "string",
                      description: "Full product description with emojis, bullet points, and CTA (max 2000 chars)",
                    },
                    keywords: {
                      type: "array",
                      items: { type: "string" },
                      description: "Top 10 search keywords/tags for this product on Shopee",
                    },
                  },
                  required: ["title", "description", "keywords"],
                  additionalProperties: false,
                },
              },
            },
          ],
          tool_choice: { type: "function", function: { name: "shopee_product_text" } },
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
    if (!toolCall || toolCall.function.name !== "shopee_product_text") {
      console.error("Unexpected response:", JSON.stringify(data).slice(0, 500));
      throw new Error("AI did not return structured product text");
    }

    const result = JSON.parse(toolCall.function.arguments);

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("generate-shopee-text error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
