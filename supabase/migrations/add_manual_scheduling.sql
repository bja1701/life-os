-- Add scheduled_start_time to tasks table
ALTER TABLE public.tasks
ADD COLUMN scheduled_start_time TIMESTAMPTZ NULL;

-- Comment on column
COMMENT ON COLUMN public.tasks.scheduled_start_time IS 'User-defined fixed start time for the task. If set, the scheduler should prioritize this slot.';
