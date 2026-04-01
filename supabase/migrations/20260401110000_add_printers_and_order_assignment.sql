CREATE TABLE IF NOT EXISTS public.printers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL,
  description text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.printers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own printers" ON public.printers;
CREATE POLICY "Users can view own printers"
  ON public.printers FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own printers" ON public.printers;
CREATE POLICY "Users can insert own printers"
  ON public.printers FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own printers" ON public.printers;
CREATE POLICY "Users can update own printers"
  ON public.printers FOR UPDATE
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own printers" ON public.printers;
CREATE POLICY "Users can delete own printers"
  ON public.printers FOR DELETE
  USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_printers_user_id
  ON public.printers(user_id);

DROP TRIGGER IF EXISTS update_printers_updated_at ON public.printers;
CREATE TRIGGER update_printers_updated_at
  BEFORE UPDATE ON public.printers
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS printer_id uuid REFERENCES public.printers(id) ON DELETE SET NULL;

ALTER TABLE public.orders
  ALTER COLUMN position SET DEFAULT 0;

UPDATE public.orders
SET position = 0
WHERE position IS NULL;

WITH ranked_orders AS (
  SELECT
    id,
    row_number() OVER (
      PARTITION BY user_id, printer_id
      ORDER BY position ASC, created_at ASC, id ASC
    ) - 1 AS new_position
  FROM public.orders
)
UPDATE public.orders AS orders
SET position = ranked_orders.new_position
FROM ranked_orders
WHERE orders.id = ranked_orders.id;

CREATE INDEX IF NOT EXISTS idx_orders_user_printer_position
  ON public.orders(user_id, printer_id, position);
