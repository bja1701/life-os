-- Ensure goal deletion also deletes associated tasks
ALTER TABLE tasks
DROP CONSTRAINT IF EXISTS tasks_goal_id_fkey;

ALTER TABLE tasks
ADD CONSTRAINT tasks_goal_id_fkey
FOREIGN KEY (goal_id)
REFERENCES goals(id)
ON DELETE CASCADE;
