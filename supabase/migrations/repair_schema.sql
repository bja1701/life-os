-- Comprehensive Schema Repair
-- Run this to ensure all necessary columns exist for the Life OS features.

-- 1. Priority Tier (Critical, Core, Backlog)
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS priority_tier TEXT DEFAULT 'core';
-- Add constraint if it doesn't exist (drop first to be safe or use anonymous block, but simple way is just add column)
-- We can't easily "ADD CONSTRAINT IF NOT EXISTS" in standard SQL without a block, so we'll skip the constraint for now to avoid errors, 
-- or use a safe way:
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'check_priority_tier') THEN 
        ALTER TABLE tasks ADD CONSTRAINT check_priority_tier CHECK (priority_tier IN ('critical', 'core', 'backlog'));
    END IF; 
END $$;

-- 2. Category (Personal, Work, etc.)
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS category TEXT DEFAULT 'Personal';
CREATE INDEX IF NOT EXISTS idx_tasks_category ON tasks(category);

-- 3. Habit Recurrence Extras
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS recurrence_days INTEGER[]; -- For custom/weekly days [0,1,5]
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS parent_habit_id UUID REFERENCES tasks(id);
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS is_recurring BOOLEAN DEFAULT FALSE;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS recurrence_pattern TEXT;

-- Update Recurrence Check Constraint to support new types
ALTER TABLE tasks DROP CONSTRAINT IF EXISTS tasks_recurrence_pattern_check;
ALTER TABLE tasks ADD CONSTRAINT tasks_recurrence_pattern_check 
CHECK (recurrence_pattern IN ('daily', 'weekdays', 'weekly', 'monthly', 'custom'));

-- 4. Energy Level
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS energy_level TEXT DEFAULT 'normal';
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'check_energy_level') THEN 
        ALTER TABLE tasks ADD CONSTRAINT check_energy_level CHECK (energy_level IN ('deep', 'shallow', 'normal'));
    END IF; 
END $$;
