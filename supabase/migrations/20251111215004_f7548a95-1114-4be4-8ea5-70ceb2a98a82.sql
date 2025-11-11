-- Add priority and estimated_hours to tasks table
ALTER TABLE public.tasks
ADD COLUMN priority TEXT NOT NULL DEFAULT 'medium',
ADD COLUMN estimated_hours NUMERIC;

-- Add check constraint for priority values
ALTER TABLE public.tasks
ADD CONSTRAINT tasks_priority_check 
CHECK (priority IN ('low', 'medium', 'high'));