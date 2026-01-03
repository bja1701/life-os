# LifeOS API Reference

This document provides detailed API reference for all LifeOS components, functions, and data structures.

## Table of Contents

- [Core Types](#core-types)
- [Scheduler API](#scheduler-api)
- [Calendar API](#calendar-api)
- [Database Schema](#database-schema)
- [CLI Commands](#cli-commands)

## Core Types

### Task

Represents a schedulable task with constraints and metadata.

```typescript
interface Task {
  id: string;                    // Unique identifier
  goalId?: string;              // Associated goal ID
  title: string;                // Task title
  durationMinutes: number;      // Total estimated duration
  deadline?: Date;              // Due date (optional)
  priority: 'High' | 'Medium' | 'Low';  // Priority level
  minChunkSize: number;         // Minimum chunk size in minutes
  maxChunkSize: number;         // Maximum chunk size in minutes
  contextTags: ContextTag[];    // Location/context requirements
  energyLevel: 'deep' | 'shallow' | 'normal';  // Energy requirements
  isAssignment: boolean;        // Academic assignment flag
  canSplit: boolean;           // Whether task can be split
}
```

### FixedEvent

Represents an existing calendar event that blocks scheduling.

```typescript
interface FixedEvent {
  id: string;           // Event identifier
  title: string;        // Event title
  start: Date;          // Start time
  end: Date;            // End time
  isAllDay?: boolean;   // All-day event flag
  source: 'google' | 'byu' | 'manual';  // Event source
}
```

### ScheduledBlock

Represents a scheduled time block created by the algorithm.

```typescript
interface ScheduledBlock {
  id: string;                      // Unique block ID
  taskId: string;                  // Associated task ID
  taskTitle: string;               // Task title
  start: Date;                     // Block start time
  end: Date;                       // Block end time
  durationMinutes: number;         // Block duration
  isVirtual: boolean;              // Virtual block (suggestion only)
  chunkIndex?: number;             // Chunk number (for split tasks)
  totalChunks?: number;            // Total chunks (for split tasks)
  energyLevel: 'deep' | 'shallow' | 'normal';  // Required energy
  contextTags: ContextTag[];       // Required context
}
```

### ContextTag

Location and context requirements for tasks.

```typescript
type ContextTag =
  | '#home'        // Must be done at home
  | '#anywhere'    // Can be done anywhere
  | '#deep-work'   // Requires focused environment
  | string;        // Custom tags
```

## Scheduler API

### generateSchedule()

Core scheduling algorithm that creates an optimal schedule.

```typescript
function generateSchedule(
  fixedEvents: FixedEvent[],
  tasks: Task[],
  options?: ScheduleOptions
): ScheduleResult
```

#### Parameters

- `fixedEvents`: Array of existing calendar events
- `tasks`: Array of tasks to schedule
- `options`: Optional scheduling configuration

#### ScheduleOptions

```typescript
interface ScheduleOptions {
  dayStartHour?: number;        // Start hour (default: 8)
  dayEndHour?: number;          // End hour (default: 22)
  familyTimeStartHour?: number; // Family time start (default: 17.5)
  planningHorizonDays?: number; // Days to plan ahead (default: 7)
}
```

#### Returns

```typescript
interface ScheduleResult {
  scheduledBlocks: ScheduledBlock[];  // Successfully scheduled blocks
  overloadedTasks: Task[];            // Tasks that couldn't fit
  warnings: ScheduleWarning[];        // Scheduling warnings
}
```

#### ScheduleWarning

```typescript
interface ScheduleWarning {
  type: 'anti_cramming_violated' | 'deadline_missed' | 'energy_mismatch';
  message: string;
  taskId?: string;
}
```

### Algorithm Rules

The scheduler implements these core rules:

1. **Family First**: No work after 5:30 PM weekdays, Sundays blocked
2. **Energy Awareness**: Deep work mornings, shallow work afternoons
3. **Task Splitting**: Large tasks split into optimal chunks
4. **Anti-Cramming**: Spread work across multiple days
5. **Context Matching**: Respect location requirements
6. **Priority Ordering**: High priority tasks scheduled first

## Calendar API

### getAllCalendarEvents()

Fetches events from all configured calendar sources.

```typescript
async function getAllCalendarEvents(
  startDate: Date,
  endDate: Date,
  options?: CalendarOptions
): Promise<FixedEvent[]>
```

#### Parameters

- `startDate`: Start of date range
- `endDate`: End of date range
- `options`: Calendar configuration

#### CalendarOptions

```typescript
interface CalendarOptions {
  googleCalendarId?: string;    // Google Calendar ID (default: 'primary')
  byuIcalUrl?: string;          // BYU iCal feed URL
}
```

### exportScheduleToGoogle()

Exports scheduled blocks to Google Calendar.

```typescript
async function exportScheduleToGoogle(
  blocks: ScheduledBlock[],
  dryRun?: boolean
): Promise<ExportResult>
```

#### Parameters

- `blocks`: Array of scheduled blocks to export
- `dryRun`: If true, preview without creating events

#### Returns

```typescript
interface ExportResult {
  success: boolean;
  createdEvents: number;
  errors: string[];
  eventIds: string[];
}
```

### clearLifeOSEvents()

Deletes previously created LifeOS events from calendar.

```typescript
async function clearLifeOSEvents(
  startDate: Date,
  endDate: Date
): Promise<ClearResult>
```

#### Returns

```typescript
interface ClearResult {
  deletedEvents: number;
  errors: string[];
}
```

## Database Schema

### Goals Table

```sql
CREATE TABLE goals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  target_date DATE,
  priority TEXT CHECK (priority IN ('High', 'Medium', 'Low')),
  status TEXT DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Tasks Table

```sql
CREATE TABLE tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  goal_id UUID REFERENCES goals(id),
  title TEXT NOT NULL,
  description TEXT,
  duration_minutes INTEGER NOT NULL CHECK (duration_minutes > 0),
  min_chunk_size INTEGER NOT NULL DEFAULT 30,
  max_chunk_size INTEGER NOT NULL DEFAULT 120,
  can_split BOOLEAN DEFAULT true,
  deadline TIMESTAMPTZ,
  priority TEXT CHECK (priority IN ('High', 'Medium', 'Low')),
  context_tags TEXT[] DEFAULT '{}',
  energy_level TEXT CHECK (energy_level IN ('deep', 'shallow', 'normal')),
  is_assignment BOOLEAN DEFAULT false,
  is_virtual BOOLEAN DEFAULT false,
  status TEXT DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Row Level Security

All tables have RLS enabled with user-scoped policies:

```sql
ALTER TABLE goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;

-- Users can only access their own data
CREATE POLICY "Users can access own goals" ON goals
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can access own tasks" ON tasks
  FOR ALL USING (auth.uid() = user_id);
```

## CLI Commands

### sync-today.ts

Main synchronization script that runs the full pipeline.

```bash
# Preview mode (dry run)
npx tsx scripts/sync-today.ts --dry-run

# Live sync
npx tsx scripts/sync-today.ts

# Clear old events first, then sync
npx tsx scripts/sync-today.ts --clear-first
```

#### Options

- `--dry-run`: Preview without creating calendar events
- `--clear-first`: Delete existing LifeOS events before syncing

#### Output

The script provides detailed logging:

```
🚀 LifeOS Daily Sync
📅 Date: 12/29/2025
⚙️  Mode: DRY RUN

📋 STEP 1: Fetching calendar events...
   ✅ Found 3 calendar events

📋 STEP 2: Fetching tasks from Supabase...
   ✅ Found 5 tasks

📋 STEP 3: Running scheduler algorithm...
   ✅ Generated 12 scheduled blocks

📋 STEP 4: Exporting to Google Calendar...
   ✅ Exported 12 events

📊 SYNC SUMMARY
   Calendar Events:    3
   Tasks Processed:    5
   Blocks Generated:   12
   Events Exported:    12
   Warnings:           0
   Errors:             0
```

### get-google-token.ts

OAuth2 token generation script.

```bash
npx tsx scripts/get-google-token.ts
```

Opens browser for OAuth flow, then saves refresh token to `.env.local`.

## Error Handling

### Common Error Types

#### Calendar Errors

```typescript
// Authentication failed
{ message: "Invalid credentials" }

// API quota exceeded
{ message: "Calendar API quota exceeded" }

// Permission denied
{ message: "Insufficient permissions" }
```

#### Scheduler Errors

```typescript
// No available time slots
{ type: "no_slots_available", taskId: "task-123" }

// Deadline constraint violated
{ type: "deadline_violated", taskId: "task-456" }
```

#### Database Errors

```typescript
// Connection failed
{ message: "Supabase connection failed" }

// RLS violation
{ message: "Row Level Security policy violation" }
```

## Performance Considerations

- **Calendar API**: Rate limited (1M requests/day)
- **Task Processing**: O(n log n) where n = number of tasks
- **Memory Usage**: Linear with number of events/tasks
- **Database Queries**: Indexed on user_id for fast filtering

## Testing

Run the test suite:

```bash
# All tests
npm test

# Specific test file
npm test scheduler.test.ts

# Watch mode
npm run test:watch
```

Test coverage includes:
- Algorithm correctness
- Edge cases (no slots, deadline violations)
- Calendar integration
- Error handling