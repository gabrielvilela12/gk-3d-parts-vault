
-- Table for user filaments (colors/types with prices)
CREATE TABLE public.filaments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  color TEXT,
  custo_kg NUMERIC NOT NULL DEFAULT 100,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.filaments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own filaments" ON public.filaments FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own filaments" ON public.filaments FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own filaments" ON public.filaments FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own filaments" ON public.filaments FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER update_filaments_updated_at
  BEFORE UPDATE ON public.filaments
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
