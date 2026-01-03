-- Add priority_tier to tasks
ALTER TABLE tasks 
ADD COLUMN IF NOT EXISTS priority_tier TEXT DEFAULT 'core' CHECK (priority_tier IN ('critical', 'core', 'backlog'));

-- Add category to tasks (for alignment with goals/Life Rules)
ALTER TABLE tasks 
ADD COLUMN IF NOT EXISTS category TEXT;

-- Add priority_tier to goals
ALTER TABLE goals
ADD COLUMN IF NOT EXISTS priority_tier TEXT DEFAULT 'core' CHECK (priority_tier IN ('critical', 'core', 'backlog'));

-- Create an index for faster filtering by tier
CREATE INDEX IF NOT EXISTS idx_tasks_priority_tier ON tasks(priority_tier);
