import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY");

    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY não configurado");

    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) throw new Error("Não autenticado");

    // Parse body first (fixes "Cannot access 'messages' before initialization")
    const { messages } = await req.json();
    if (!messages || !Array.isArray(messages)) throw new Error("Mensagens inválidas");

    // Validate JWT using getClaims (recommended approach)
    const supabaseAuth = createClient(SUPABASE_URL!, SUPABASE_ANON_KEY!, {
      global: { headers: { Authorization: authHeader } },
    });

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: authError } = await supabaseAuth.auth.getClaims(token);
    if (authError || !claimsData?.claims) throw new Error("Usuário não autenticado");

    const userId = claimsData.claims.sub;

    // Create admin client to fetch data
    const supabaseAdmin = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);

    // ── Fetch user's business data ──────────────────────────────────────────

    const [piecesRes, expensesRes, ordersRes, filamentsRes] = await Promise.all([
      supabaseAdmin.from("pieces").select("name, material, cost, preco_venda, is_selling, peso_g, tempo_impressao_min, category, custo_material, custo_energia, custo_acessorios, created_at").eq("user_id", user.id),
      supabaseAdmin.from("expenses").select("expense_type, order_value, amount, estimated_profit, product_name, platform, order_status, order_date, payment_date, quantity, description, category").eq("user_id", user.id),
      supabaseAdmin.from("orders").select("quantity, is_printed, created_at, printed_at, color").eq("user_id", user.id),
      supabaseAdmin.from("filaments").select("name, color, custo_kg").eq("user_id", user.id),
    ]);

    const pieces = piecesRes.data || [];
    const expenses = expensesRes.data || [];
    const orders = ordersRes.data || [];
    const filaments = filamentsRes.data || [];

    // ── Compute aggregate stats ─────────────────────────────────────────────

    const shopeeOrders = expenses.filter(e => e.expense_type === "order");
    const manualExpenses = expenses.filter(e => e.expense_type !== "order");

    const totalReceived = shopeeOrders.reduce((s, e) => s + (e.order_value || 0), 0);
    const totalProductionCost = shopeeOrders.reduce((s, e) => s + (e.amount || 0), 0);
    const totalProfit = shopeeOrders.reduce((s, e) => s + (e.estimated_profit || 0), 0);
    const totalManualExpenses = manualExpenses.reduce((s, e) => s + (e.amount || 0), 0);

    const printedOrders = orders.filter(o => o.is_printed).length;
    const pendingOrders = orders.filter(o => !o.is_printed).length;

    // Filament usage estimate from pieces (grams)
    const totalGrams = pieces.reduce((s, p) => s + (p.peso_g || 0), 0);
    const totalMinutes = pieces.reduce((s, p) => s + (p.tempo_impressao_min || 0), 0);

    // Categorize pieces
    const categoryCounts: Record<string, number> = {};
    pieces.forEach(p => {
      const cat = p.category || "Sem categoria";
      categoryCounts[cat] = (categoryCounts[cat] || 0) + 1;
    });

    // Material breakdown
    const materialCounts: Record<string, number> = {};
    pieces.forEach(p => {
      const mat = p.material || "Desconhecido";
      materialCounts[mat] = (materialCounts[mat] || 0) + 1;
    });

    // Monthly revenue breakdown
    const monthlyRevenue: Record<string, { received: number; cost: number; profit: number; count: number }> = {};
    shopeeOrders.forEach(e => {
      if (!e.order_date) return;
      const key = e.order_date.slice(0, 7); // YYYY-MM
      if (!monthlyRevenue[key]) monthlyRevenue[key] = { received: 0, cost: 0, profit: 0, count: 0 };
      monthlyRevenue[key].received += e.order_value || 0;
      monthlyRevenue[key].cost += e.amount || 0;
      monthlyRevenue[key].profit += e.estimated_profit || 0;
      monthlyRevenue[key].count += 1;
    });

    // Top products by revenue
    const productRevenue: Record<string, number> = {};
    shopeeOrders.forEach(e => {
      if (!e.product_name) return;
      productRevenue[e.product_name] = (productRevenue[e.product_name] || 0) + (e.order_value || 0);
    });
    const topProducts = Object.entries(productRevenue)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([name, revenue]) => ({ name, revenue }));

    // ── System context ──────────────────────────────────────────────────────

    const systemPrompt = `Você é um assistente inteligente de negócios para um empreendedor de impressão 3D.
Responda sempre em português. Seja direto, claro e use formatação markdown quando útil (listas, tabelas, negrito).
Use R$ para valores monetários. Formate datas no padrão brasileiro (dd/MM/yyyy).

## Dados atuais do negócio (${new Date().toLocaleDateString("pt-BR")}):

### Catálogo de Peças (${pieces.length} peças):
${pieces.slice(0, 30).map(p => `- ${p.name}: custo=R$${(p.cost || 0).toFixed(2)}, venda=R$${(p.preco_venda || 0).toFixed(2)}, material=${p.material || "N/A"}, categoria=${p.category || "N/A"}, peso=${p.peso_g || 0}g, tempo=${p.tempo_impressao_min || 0}min, vendendo=${p.is_selling ? "sim" : "não"}`).join("\n")}
${pieces.length > 30 ? `...e mais ${pieces.length - 30} peças` : ""}

### Filamentos cadastrados (${filaments.length}):
${filaments.map(f => `- ${f.name} (${f.color || "sem cor"}): R$${f.custo_kg}/kg`).join("\n") || "Nenhum filamento cadastrado"}

### Resumo Financeiro Global (pedidos Shopee):
- Total recebido: R$${totalReceived.toFixed(2)}
- Custo de produção: R$${totalProductionCost.toFixed(2)}
- Lucro líquido: R$${totalProfit.toFixed(2)}
- Despesas manuais/parcelas: R$${totalManualExpenses.toFixed(2)}
- Total de pedidos: ${shopeeOrders.length}

### Receita por Mês:
${Object.entries(monthlyRevenue).sort(([a], [b]) => b.localeCompare(a)).slice(0, 12).map(([month, data]) =>
  `- ${month}: recebido=R$${data.received.toFixed(2)}, custo=R$${data.cost.toFixed(2)}, lucro=R$${data.profit.toFixed(2)}, pedidos=${data.count}`
).join("\n") || "Sem dados mensais"}

### Top 10 Produtos por Receita:
${topProducts.map((p, i) => `${i + 1}. ${p.name}: R$${p.revenue.toFixed(2)}`).join("\n") || "Sem dados"}

### Fila de Impressão:
- Pedidos pendentes: ${pendingOrders}
- Pedidos impressos: ${printedOrders}

### Categorias de Peças:
${Object.entries(categoryCounts).map(([cat, count]) => `- ${cat}: ${count} peça(s)`).join("\n") || "Sem categorias"}

### Materiais:
${Object.entries(materialCounts).map(([mat, count]) => `- ${mat}: ${count} peça(s)`).join("\n") || "Sem materiais"}

### Uso estimado de filamento:
- Total de gramas em peças: ${totalGrams.toFixed(1)}g
- Tempo total de impressão estimado: ${(totalMinutes / 60).toFixed(1)} horas

### Despesas Manuais/Parcelas recentes:
${manualExpenses.slice(0, 15).map(e => `- ${e.description || "Sem desc."} (${e.category || "sem categoria"}): R$${(e.amount || 0).toFixed(2)} - status: ${e.order_status || "pendente"}`).join("\n") || "Nenhuma despesa manual"}

Responda perguntas com base nesses dados. Se o usuário perguntar sobre um período específico, use os dados de receita mensal.
Se não souber a resposta ou os dados não estiverem disponíveis, diga claramente.`;

    // ── Stream from Lovable AI ──────────────────────────────────────────────

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
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
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Limite de requisições atingido, tente novamente em instantes." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Créditos insuficientes no Lovable AI." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      throw new Error("Erro no gateway de IA");
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("business-assistant error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
