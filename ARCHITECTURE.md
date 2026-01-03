# LifeOS Architecture

This document provides a deep dive into LifeOS's system architecture, design decisions, and implementation details.

## System Overview

LifeOS is a deterministic auto-scheduler that integrates with Google Calendar to create optimal daily schedules. The system follows a **Read → Think → Write** pipeline:

```
┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│   READ      │    │   THINK     │    │   WRITE     │
│             │    │             │    │             │
│ • Calendar  │───▶│ • Schedule  │───▶│ • Export    │
│ • Tasks     │    │ • Optimize  │    │ • Sync      │
│ • Rules     │    │ • Validate  │    │             │
└─────────────┘    └─────────────┘    └─────────────┘
```

## Core Components

### 1. Scheduler Engine (`src/lib/scheduler.ts`)

The heart of LifeOS, implementing a constraint-based optimization algorithm.

#### Algorithm Overview

```typescript
function generateSchedule(
  fixedEvents: FixedEvent[],
  tasks: Task[],
  options: ScheduleOptions
): ScheduleResult
```

#### Key Algorithms

##### Gap Finding Algorithm

Finds available time slots around fixed events:

```typescript
function findGapsInDay(
  fixedEvents: FixedEvent[],
  dayStart: Date,
  dayEnd: Date,
  familyTimeStart?: Date
): TimeGap[]
```

**Logic:**
1. Sort events by start time
2. Create gaps between events
3. Apply family time constraints
4. Filter out blocked periods (Sundays, after 5:30 PM)

##### Task Splitting Algorithm

Breaks large tasks into optimal chunks:

```typescript
function splitTaskIntoChunks(
  task: Task,
  availableSlots: TimeGap[]
): ScheduledBlock[]
```

**Rules:**
- Respect `minChunkSize` and `maxChunkSize`
- Prefer morning slots for deep work
- Spread across multiple days (anti-cramming)
- Consider energy level requirements

##### Slot Scoring Algorithm

Ranks time slots for task placement:

```typescript
function scoreSlotForTask(
  slot: TimeGap,
  task: Task,
  dayOfWeek: number
): number
```

**Scoring Factors:**
- **Time Preference**: Morning bonus for deep work
- **Day Distribution**: Penalty for cramming
- **Context Matching**: Bonus for matching location tags
- **Energy Alignment**: Morning/afternoon preferences

#### Constraint System

##### Hard Constraints (Must Satisfy)
- Fixed event conflicts
- Family time blocks (5:30-10 PM weekdays)
- Sunday blocking
- Task duration limits

##### Soft Constraints (Optimization Goals)
- Energy level alignment
- Anti-cramming distribution
- Context tag matching
- Priority ordering

### 2. Calendar Integration (`src/lib/calendars.ts`)

Handles all external calendar interactions.

#### Google Calendar API Integration

```typescript
// Read operations
async function getGoogleCalendarEvents(start: Date, end: Date): Promise<FixedEvent[]>

// Write operations
async function exportScheduleToGoogle(blocks: ScheduledBlock[]): Promise<ExportResult>
```

#### Safety Mechanisms

- **Primary Calendar Protection**: Never writes to 'primary' calendar
- **Dry Run Mode**: Preview changes without executing
- **Event Tagging**: All LifeOS events marked with special identifiers
- **Cleanup Functions**: Ability to remove all LifeOS-generated events

#### Multi-Source Integration

Supports multiple calendar sources:
- **Google Calendar**: Primary calendar + additional calendars
- **BYU Learning Suite**: iCal feed for class schedules
- **Manual Events**: Programmatically added events

### 3. Database Layer (`supabase/schema.sql`)

PostgreSQL schema with Row Level Security.

#### Schema Design

```sql
-- Goals: Long-term objectives
CREATE TABLE goals (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL,
  title TEXT NOT NULL,
  -- ... other fields
);

-- Tasks: Actionable items
CREATE TABLE tasks (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL,
  goal_id UUID REFERENCES goals(id),
  -- ... task fields
);
```

#### Data Relationships

```
User
├── Goals (1:many)
│   └── Tasks (1:many)
└── Calendar Events (via Google API)
```

#### Security Model

- **Row Level Security**: Users only see their own data
- **API Key Authentication**: Supabase anon key for client access
- **Server-Side Validation**: All operations validated on server

### 4. CLI Pipeline (`scripts/sync-today.ts`)

Orchestrates the full Read → Think → Write pipeline.

#### Pipeline Stages

1. **READ Phase**
   ```typescript
   // Fetch calendar events
   const fixedEvents = await getAllCalendarEvents(startDate, endDate);

   // Fetch tasks from database
   const tasks = await fetchTasksFromSupabase();
   ```

2. **THINK Phase**
   ```typescript
   // Run scheduling algorithm
   const result = generateSchedule(fixedEvents, tasks, options);
   ```

3. **WRITE Phase**
   ```typescript
   // Export to calendar
   const exportResult = await exportScheduleToGoogle(result.scheduledBlocks);
   ```

#### Error Handling

- **Graceful Degradation**: Continues with mock data if database unavailable
- **Partial Success**: Reports which operations succeeded/failed
- **Detailed Logging**: Comprehensive progress and error reporting

## Design Decisions

### Why Deterministic Scheduling?

**Problem**: Traditional schedulers give different results on each run, making planning unreliable.

**Solution**: Pure functions with consistent inputs → consistent outputs.

**Benefits**:
- Reproducible results
- Easier debugging
- Predictable behavior
- Cacheable computations

### Why Family-First Protocol?

**Problem**: Work-life balance often sacrificed for productivity.

**Solution**: Hard-coded rules that protect family time.

**Implementation**:
```typescript
const FAMILY_TIME_START = 17.5; // 5:30 PM
const SUNDAY_BLOCKED = true;
```

### Why Task Splitting?

**Problem**: Large tasks create scheduling conflicts.

**Solution**: Break tasks into smaller, schedulable chunks.

**Algorithm**:
1. Calculate optimal chunk sizes
2. Find available slots
3. Distribute across days
4. Maintain task relationships

### Why Energy-Aware Scheduling?

**Problem**: Not all work requires same energy levels.

**Solution**: Schedule deep work in high-energy periods.

**Energy Profiles**:
- **Deep**: Focused, creative work (mornings preferred)
- **Shallow**: Routine, low-focus tasks (afternoons OK)
- **Normal**: Flexible work (any time)

## Performance Characteristics

### Time Complexity

- **Gap Finding**: O(n log n) - sorting events
- **Task Scheduling**: O(t × s) - tasks × slots
- **Calendar API**: O(1) per request (Google limits apply)

### Space Complexity

- **Event Storage**: O(n) - linear with events
- **Task Storage**: O(t) - linear with tasks
- **Schedule Output**: O(b) - linear with blocks

### Scalability Limits

- **Max Tasks**: ~100 (algorithm becomes slow)
- **Max Events**: ~1000 per week (API limits)
- **Time Horizon**: 7-14 days (beyond this, too unpredictable)

## Testing Strategy

### Unit Tests (`scheduler.test.ts`)

```typescript
describe('generateSchedule', () => {
  it('should respect family time blocks', () => {
    // Test family time protection
  });

  it('should split large tasks appropriately', () => {
    // Test task splitting logic
  });

  it('should avoid Sunday scheduling', () => {
    // Test Sunday blocking
  });
});
```

### Integration Tests

- **Calendar API**: Mock Google API responses
- **Database**: Test with Supabase local development
- **CLI Pipeline**: End-to-end sync testing

### Test Data

Uses realistic scenarios:
- **Busy Student & Father**: Complex schedule with classes, family, work
- **Edge Cases**: No available slots, deadline violations, conflicting constraints

## Deployment Architecture

### Development Environment

```
Local Machine
├── Next.js Dev Server (localhost:3000)
├── Supabase Local (localhost:54321)
└── Google OAuth (redirect to localhost)
```

### Production Environment

```
Vercel
├── Next.js App
├── Supabase Cloud
└── Google Calendar API
```

### Environment Variables

```bash
# Database
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...

# Google API
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
GOOGLE_REFRESH_TOKEN=...

# Calendars
GOOGLE_CALENDAR_ID=primary
GOOGLE_CALENDAR_TARGET_ID=lifeos-schedule@group.calendar.google.com

# Optional
BYU_ICAL_URL=...
```

## Security Considerations

### API Security

- **OAuth2**: Secure token-based authentication
- **Refresh Tokens**: Long-lived credentials with rotation
- **Scope Limiting**: Minimal Google API permissions

### Data Security

- **Row Level Security**: User data isolation
- **HTTPS Only**: All API communications encrypted
- **Token Storage**: Environment variables, never in code

### Operational Security

- **Dry Run Mode**: Safe testing without side effects
- **Audit Logging**: Track all calendar modifications
- **Rollback Capability**: Delete LifeOS events if needed

## Future Enhancements

### Planned Features

- **Machine Learning**: Learn from scheduling success/failure
- **Collaborative Scheduling**: Coordinate with family members
- **Mobile App**: Native iOS/Android clients
- **Advanced Analytics**: Productivity insights and trends

### Technical Improvements

- **Algorithm Optimization**: Faster scheduling for large task sets
- **Caching Layer**: Reduce API calls for repeated computations
- **Real-time Sync**: Push notifications for schedule changes
- **Backup/Restore**: Schedule versioning and recovery

## Conclusion

LifeOS represents a novel approach to personal scheduling that combines deterministic algorithms with human-centered design. By prioritizing family time, respecting energy levels, and providing reproducible results, it offers a sustainable alternative to traditional productivity tools.