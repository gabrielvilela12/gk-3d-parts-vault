ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS started_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS expected_finish_at timestamp with time zone;

UPDATE public.orders
SET status = CASE
  WHEN is_printed THEN 'done'
  ELSE 'pending'
END
WHERE status IS NULL
   OR status NOT IN ('pending', 'printing', 'done');

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'orders_status_check'
  ) THEN
    ALTER TABLE public.orders
      ADD CONSTRAINT orders_status_check
      CHECK (status IN ('pending', 'printing', 'done'));
  END IF;
END
$$;

CREATE INDEX IF NOT EXISTS idx_orders_user_status
  ON public.orders(user_id, status);

CREATE INDEX IF NOT EXISTS idx_orders_expected_finish_at
  ON public.orders(expected_finish_at);
