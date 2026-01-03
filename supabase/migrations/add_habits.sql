-- Migration: Add Habit Support to Tasks Table
-- Run this in the Supabase SQL Editor

-- 1. Add recursion support
ALTER TABLE tasks 
ADD COLUMN IF NOT EXISTS is_recurring BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS recurrence_pattern TEXT CHECK (recurrence_pattern IN ('daily', 'weekly', 'weekdays')),
ADD COLUMN IF NOT EXISTS parent_habit_id UUID REFERENCES tasks(id);

-- 2. Index for performance (finding master habits and child tasks)
CREATE INDEX IF NOT EXISTS idx_tasks_parent_habit ON tasks(parent_habit_id);
CREATE INDEX IF NOT EXISTS idx_tasks_is_recurring ON tasks(is_recurring);
