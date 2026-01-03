-- Remove the old restrictive constraint
ALTER TABLE tasks DROP CONSTRAINT IF EXISTS tasks_recurrence_pattern_check;

-- Add updated constraint with new types
ALTER TABLE tasks ADD CONSTRAINT tasks_recurrence_pattern_check 
CHECK (recurrence_pattern IN ('daily', 'weekdays', 'weekly', 'monthly', 'custom'));

-- Add column to store specific days (0=Sun, 6=Sat) for Custom/Weekly patterns
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS recurrence_days INTEGER[];
