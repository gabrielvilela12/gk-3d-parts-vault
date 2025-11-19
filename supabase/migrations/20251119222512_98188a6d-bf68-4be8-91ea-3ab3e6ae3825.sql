-- Add peso_g and tempo_impressao_min columns to piece_price_variations table
ALTER TABLE public.piece_price_variations 
ADD COLUMN peso_g numeric,
ADD COLUMN tempo_impressao_min integer;