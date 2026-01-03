-- Clean up duplicate habit instances
-- Keeps the newest instance for each (parent_habit_id, deadline_day)

WITH duplicates AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY parent_habit_id, date(deadline)
      ORDER BY created_at DESC
    ) as row_num
  FROM tasks
  WHERE parent_habit_id IS NOT NULL
)
DELETE FROM tasks
WHERE id IN (
  SELECT id
  FROM duplicates
  WHERE row_num > 1
);
