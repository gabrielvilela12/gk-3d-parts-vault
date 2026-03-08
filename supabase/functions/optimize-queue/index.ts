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
    const { messages, queueData, mode } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    // Mode "reorder": non-streaming, uses tool calling to get structured order
    if (mode === "reorder") {
      const reorderPrompt = `Você é um otimizador de fila de impressão 3D.

FILA ATUAL (cada item tem um index que identifica sua posição atual):
${JSON.stringify(queueData.map((item: any, i: number) => ({ index: i, ...item })), null, 2)}

Com base na conversa anterior, determine a melhor ordem de impressão.
Use a tool reorder_queue para retornar a nova ordem.

REGRAS:
- Retorne TODOS os itens da fila, apenas reordenados
- Agrupe por cor quando possível para evitar trocas de filamento
- Considere os horários de disponibilidade mencionados pelo usuário
- Coloque peças mais longas para quando o usuário estiver fora
- Coloque peças curtas para quando o usuário estiver presente para trocar rápido`;

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
              { role: "system", content: reorderPrompt },
              ...messages,
            ],
            tools: [
              {
                type: "function",
                function: {
                  name: "reorder_queue",
                  description: "Reorder the print queue. Return all item indices in the new optimal order.",
                  parameters: {
                    type: "object",
                    properties: {
                      ordered_indices: {
                        type: "array",
                        description: "Array of item indices (from the original queue) in the new optimal order",
                        items: { type: "number" },
                      },
                      explanation: {
                        type: "string",
                        description: "Brief explanation of why this order is optimal (in Portuguese)",
                      },
                    },
                    required: ["ordered_indices", "explanation"],
                    additionalProperties: false,
                  },
                },
              },
            ],
            tool_choice: { type: "function", function: { name: "reorder_queue" } },
          }),
        }
      );

      if (!response.ok) {
        const t = await response.text();
        console.error("AI gateway error:", response.status, t);
        return new Response(
          JSON.stringify({ error: "Erro no serviço de IA" }),
          { status: response.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const data = await response.json();
      const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
      if (!toolCall) {
        return new Response(
          JSON.stringify({ error: "IA não retornou uma reorganização" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const args = JSON.parse(toolCall.function.arguments);
      return new Response(JSON.stringify(args), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Mode "chat": streaming conversation
    const systemPrompt = `Você é um assistente especializado em otimizar filas de impressão 3D. 
Você recebe dados da fila atual do usuário e ajuda a reorganizar para minimizar tempo ocioso.

DADOS DA FILA ATUAL:
${JSON.stringify(queueData, null, 2)}

SUAS CAPACIDADES:
- Analisar a fila atual e sugerir a melhor ordem de impressão
- Considerar os horários de disponibilidade do usuário para remover peças da impressora
- Agrupar peças por cor para evitar trocas de filamento desnecessárias
- Sugerir quais peças imprimir enquanto o usuário estiver fora
- Calcular tempos estimados de início e término de cada peça

REGRAS:
- Sempre responda em português brasileiro
- Use os dados reais da fila fornecida
- Quando sugerir uma ordem, liste as peças com horários estimados
- Considere que trocar filamento de cor leva ~5 minutos
- Se o usuário disser horários de disponibilidade, otimize para que peças terminem nesses horários
- Formate a resposta de forma clara com markdown
- Quando sugerir uma ordem, use uma tabela ou lista numerada com: nome da peça, cor, tempo de impressão, horário estimado de início e término
- Seja conciso e prático
- Ao final de cada sugestão de reordenação, pergunte se o usuário quer aplicar a ordem sugerida`;

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
            { role: "system", content: systemPrompt },
            ...messages,
          ],
          stream: true,
        }),
      }
    );

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Limite de requisições excedido. Tente novamente em alguns segundos." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "Créditos insuficientes. Adicione créditos no workspace." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      return new Response(
        JSON.stringify({ error: "Erro no serviço de IA" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("optimize-queue error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
