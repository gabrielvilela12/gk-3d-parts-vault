-- Adicionar coluna de categoria na tabela pieces
ALTER TABLE public.pieces 
ADD COLUMN IF NOT EXISTS category text;

-- Criar índice para melhor performance nas buscas por categoria
CREATE INDEX IF NOT EXISTS idx_pieces_category ON public.pieces(category);

-- Comentário explicativo
COMMENT ON COLUMN public.pieces.category IS 'Categoria da peça para organização (ex: Decoração, Utilidades, Ferramentas, Brinquedos, etc.)';
