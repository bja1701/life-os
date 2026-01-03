-- Add category column to tasks table
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS category TEXT DEFAULT 'Personal';
-- Index for faster filtering by category
CREATE INDEX IF NOT EXISTS idx_tasks_category ON tasks(category);
