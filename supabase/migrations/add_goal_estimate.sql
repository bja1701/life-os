-- Add estimated_total_minutes to goals for better progress tracking
ALTER TABLE goals ADD COLUMN IF NOT EXISTS estimated_total_minutes INTEGER;
