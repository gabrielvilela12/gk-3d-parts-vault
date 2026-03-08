

## Nova Página: Links de GPTs

Criar uma nova página "GPTs" acessível pela navbar, exibindo cards com links para os GPTs customizados do projeto.

### GPTs a incluir:
1. **Precificação de Produtos** - https://chatgpt.com/g/g-6990868786e4819180fd385f4e9e5d16-precificacao-produtos
2. **Criador de Anúncio** - https://chatgpt.com/g/g-69908c8d62788191bdf2d7cf34d118cf-criador-de-anuncio
3. **Responder Comentários** - https://chatgpt.com/g/g-69908ddcd5608191a88527d97d03db60-responder-comentarios
4. **Minerador** - https://chatgpt.com/g/g-699093b077c481919000940f9971d55b-minerador

### Alterações

**1. Criar `src/pages/GptLinks.tsx`**
- Página com cards visuais para cada GPT
- Cada card com icone, nome, descrição curta e botão que abre o link em nova aba
- Layout responsivo em grid

**2. Atualizar `src/components/Navbar.tsx`**
- Adicionar item "GPTs" com icone `BotMessageSquare` (do lucide-react) apontando para `/gpts`

**3. Atualizar `src/App.tsx`**
- Adicionar rota `/gpts` (protegida, requer login)
- Importar o componente `GptLinks`

### Detalhes Técnicos

- A página usará os componentes `Card`, `CardHeader`, `CardTitle`, `CardContent` e `Button` já existentes
- Links abrem em `target="_blank"` com `rel="noopener noreferrer"`
- Segue o mesmo padrão visual das outras páginas (dark theme, card-gradient, etc.)

