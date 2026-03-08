
CREATE TABLE public.image_generations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  product_name text NOT NULL,
  base_image_url text NOT NULL,
  colors text[] NOT NULL DEFAULT '{}',
  background_style text NOT NULL DEFAULT 'white',
  formats text[] NOT NULL DEFAULT '{square}',
  generated_images jsonb NOT NULL DEFAULT '[]',
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.image_generations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own generations" ON public.image_generations
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own generations" ON public.image_generations
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own generations" ON public.image_generations
  FOR DELETE TO authenticated USING (auth.uid() = user_id);
