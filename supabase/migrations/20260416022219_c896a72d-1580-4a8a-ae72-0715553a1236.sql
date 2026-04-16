ALTER TABLE public.printers ADD COLUMN position integer NOT NULL DEFAULT 0;

-- Set initial positions based on creation order
WITH ranked AS (
  SELECT id, ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY created_at) - 1 AS pos
  FROM public.printers
)
UPDATE public.printers SET position = ranked.pos FROM ranked WHERE printers.id = ranked.id;