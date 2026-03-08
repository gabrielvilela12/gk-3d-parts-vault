

## Plano: Gerar Titulo e Descrição otimizados para Shopee via IA

### O que será feito

Adicionar uma **Fase 3** no gerador de imagens que, após gerar as imagens (recolor + marketing), chama a IA para criar um **titulo** e **descrição** do produto otimizados com as melhores palavras-chave da Shopee.

### Mudanças

#### 1. Nova Edge Function: `supabase/functions/generate-shopee-text/index.ts`
- Recebe `productName`, `imageBase64` (opcional, para contexto visual), e `category` (opcional)
- Usa o modelo `google/gemini-3-flash-preview` (texto puro, rápido e barato)
- Prompt especializado em SEO Shopee:
  - Gera um **titulo** com até 120 caracteres usando palavras-chave de alto volume da Shopee
  - Gera uma **descrição** estruturada com emojis, bullet points, palavras-chave relevantes, e call-to-action
  - Retorna JSON estruturado via tool calling: `{ title: string, description: string, keywords: string[] }`
- Registrar em `supabase/config.toml` com `verify_jwt = false`

#### 2. Atualizar `src/pages/ImageGenerator.tsx`
- Adicionar estado para `generatedTitle`, `generatedDescription`, `generatedKeywords`
- Adicionar checkbox/toggle "Gerar Titulo e Descrição Shopee" na UI (ativado por padrão)
- Na `handleGenerate`, após Fase 2 (marketing), executar **Fase 3**: chamar `generate-shopee-text`
- Exibir resultado em um Card abaixo das imagens com:
  - Titulo gerado (com botão copiar)
  - Descrição gerada (com botão copiar)
  - Lista de palavras-chave sugeridas como badges
- Botão "Copiar Tudo" para facilitar colar na Shopee

#### 3. Prompt da IA (dentro da edge function)
```text
Você é um especialista em SEO e vendas na Shopee Brasil.
Gere um TÍTULO e DESCRIÇÃO otimizados para o produto "{productName}".

TÍTULO (max 120 caracteres):
- Use palavras-chave de alto volume de busca na Shopee
- Inclua variações relevantes (ex: "Suporte Celular Carro Veicular Universal")
- Formato: Palavra-chave principal + Características + Diferencial

DESCRIÇÃO:
- Use emojis estrategicamente
- Bullet points com benefícios
- Palavras-chave naturais no texto
- Call-to-action no final
- Máximo 2000 caracteres

Também retorne as 10 melhores palavras-chave para esse produto na Shopee.
```

### Nenhuma mudança no banco de dados
Os textos gerados serão exibidos na UI para o usuário copiar. Não precisa de nova tabela.

