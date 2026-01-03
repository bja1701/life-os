-- Fix: Add priority_tier to goals table
ALTER TABLE goals ADD COLUMN IF NOT EXISTS priority_tier TEXT DEFAULT 'core';

DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'check_goals_priority_tier') THEN 
        ALTER TABLE goals ADD CONSTRAINT check_goals_priority_tier CHECK (priority_tier IN ('critical', 'core', 'backlog'));
    END IF; 
END $$;
