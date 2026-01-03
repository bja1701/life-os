-- 1. Migrate Priorities
-- Move old 'priority' values to 'priority_tier' if tier is default/null
UPDATE tasks SET priority_tier = 'critical' WHERE priority = 'High'; -- High -> Critical
UPDATE tasks SET priority_tier = 'core' WHERE priority = 'Medium'; -- Medium -> Core
UPDATE tasks SET priority_tier = 'backlog' WHERE priority = 'Low'; -- Low -> Backlog

-- 2. Drop Columns
ALTER TABLE tasks DROP COLUMN IF EXISTS priority;
ALTER TABLE tasks DROP COLUMN IF EXISTS energy_level;
ALTER TABLE tasks DROP COLUMN IF EXISTS context_tags;
ALTER TABLE tasks DROP COLUMN IF EXISTS min_chunk_size;
ALTER TABLE tasks DROP COLUMN IF EXISTS max_chunk_size;
