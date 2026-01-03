# LifeOS Usage Guide

This guide explains how to effectively use LifeOS for daily scheduling and productivity management.

## Daily Workflow

### Morning Planning (Recommended: 6:00-7:00 AM)

1. **Review Calendar**
   ```bash
   # Check today's events
   npx tsx scripts/sync-today.ts --dry-run
   ```

2. **Add New Tasks**
   - Use Supabase dashboard or API to add tasks
   - Include realistic time estimates
   - Set appropriate deadlines and priorities

3. **Run Scheduler**
   ```bash
   # Generate and sync schedule
   npx tsx scripts/sync-today.ts
   ```

4. **Review Results**
   - Check Google Calendar for scheduled blocks
   - Review any warnings or conflicts

### Evening Review (Recommended: 9:00-10:00 PM)

1. **Track Completion**
   - Mark completed tasks in database
   - Note any schedule deviations

2. **Adjust for Tomorrow**
   - Add new tasks discovered during the day
   - Update time estimates based on actual completion

## Task Management

### Creating Effective Tasks

#### Task Structure

```typescript
{
  title: "Complete Math Homework",
  durationMinutes: 180,        // Realistic estimate
  deadline: "2025-12-31",      // Specific due date
  priority: "High",            // High/Medium/Low
  minChunkSize: 45,            // Minimum focused block
  maxChunkSize: 90,            // Maximum before fatigue
  contextTags: ["#home"],      // Location requirements
  energyLevel: "deep",         // Energy requirements
  canSplit: true               // Allow splitting
}
```

#### Time Estimation Tips

- **Pad Estimates**: Add 25-50% buffer for unexpected issues
- **Break Down Large Tasks**: 180 minutes is better than 8 hours
- **Consider Context Switching**: Add 15 minutes between different types of work

#### Priority Guidelines

- **High**: Must complete today/tomorrow, critical path items
- **Medium**: Important but flexible timing
- **Low**: Nice-to-have, low urgency

### Context Tags

| Tag | Meaning | Example Usage |
|-----|---------|---------------|
| `#home` | Requires home environment | Coding projects, focused work |
| `#anywhere` | Can be done anywhere | Email, planning, calls |
| `#deep-work` | Needs focused environment | Research, writing, complex problems |

### Energy Levels

| Level | Description | Best Time | Example Tasks |
|-------|-------------|-----------|---------------|
| `deep` | High focus, creative work | Mornings (8-11 AM) | Coding, writing, problem-solving |
| `shallow` | Routine, low-focus work | Afternoons (1-5 PM) | Email, meetings, administrative |
| `normal` | Flexible work | Any time | Planning, light research |

## Understanding Schedule Output

### Scheduled Blocks

LifeOS creates time blocks in your Google Calendar:

```
📅 Monday, December 30
├── 8:00 AM - 9:30 AM: Complete Math Homework [1/2] (90 mins)
├── 9:45 AM - 11:15 AM: Complete Math Homework [2/2] (90 mins)
├── 1:00 PM - 2:00 PM: Review Lecture Notes (60 mins)
└── 3:00 PM - 4:00 PM: Team Meeting (60 mins)
```

#### Block Types

- **Hard Blocks**: Actually scheduled in calendar (default)
- **Virtual Blocks**: Suggestions only (when `isVirtual: true`)

#### Task Splitting Indicators

- `[1/2]`: First chunk of a split task
- `[2/2]`: Final chunk of a split task
- No indicator: Task completed in single block

### Warnings and Alerts

#### Common Warnings

```
⚠️ [anti_cramming_violated] Task "Research Paper" has >50% of work scheduled on due date
```

**Meaning**: Too much work crammed on deadline day. Consider:
- Breaking task into smaller chunks
- Starting work earlier
- Adjusting time estimates

```
⚠️ [deadline_missed] Task "Submit Assignment" could not be scheduled before deadline
```

**Meaning**: Not enough available time before deadline. Consider:
- Reducing scope of task
- Negotiating deadline extension
- Finding additional time slots

```
⚠️ [energy_mismatch] Deep work scheduled in low-energy afternoon slot
```

**Meaning**: Energy requirements don't match time slot. Consider:
- Rescheduling to morning
- Changing task energy level
- Adjusting daily energy patterns

## Calendar Management

### LifeOS Calendar Structure

LifeOS uses a **secondary calendar** to avoid cluttering your primary calendar:

```
📅 Your Primary Calendar
├── Personal events
├── Work meetings
└── Family activities

📅 LifeOS Schedule (Secondary)
├── Scheduled work blocks
├── Task chunks
└── Study sessions
```

### Event Properties

All LifeOS events include:
- **Color**: Blueberry (#9) - distinctive blue color
- **Title**: Task title with chunk indicators
- **Description**: Task details and metadata
- **Transparency**: Busy (blocks time)

### Manual Overrides

You can manually adjust LifeOS events:
- **Move**: Drag to different time slots
- **Resize**: Adjust duration
- **Delete**: Remove if no longer needed

**Note**: Manual changes won't be overwritten on next sync, but new scheduling will work around them.

## Advanced Usage

### Custom Scheduling Rules

Modify `src/lib/scheduler.ts` to customize rules:

```typescript
// Custom family time
const FAMILY_TIME_START = 18; // 6:00 PM instead of 5:30 PM

// Custom work hours
const WORK_START = 7; // 7:00 AM instead of 8:00 AM
const WORK_END = 23;   // 11:00 PM instead of 10:00 PM
```

### Bulk Task Import

Create multiple tasks programmatically:

```typescript
const tasks = [
  { title: "Task 1", durationMinutes: 60, priority: "High" },
  { title: "Task 2", durationMinutes: 90, priority: "Medium" },
  // ...
];

await supabase.from('tasks').insert(tasks);
```

### Schedule Analysis

Review scheduling patterns:

```bash
# Check recent sync logs
grep "SYNC SUMMARY" logs/lifeos.log

# Analyze task completion rates
# (Implement custom analytics queries)
```

## Troubleshooting

### Common Issues

#### "No tasks scheduled"

**Symptoms**: Sync completes but no events created

**Causes & Solutions**:
- No tasks in database → Add tasks via Supabase
- All tasks completed → Check task status
- Scheduling conflicts → Review calendar for blocked time
- Deadline too soon → Move deadlines or reduce scope

#### "Tasks scheduled at wrong times"

**Symptoms**: Tasks in suboptimal time slots

**Solutions**:
- Check energy level settings
- Adjust context tags
- Review family time constraints
- Modify work hour preferences

#### "Calendar sync fails"

**Symptoms**: Export step fails

**Causes**:
- Invalid `GOOGLE_CALENDAR_TARGET_ID`
- Expired refresh token
- API quota exceeded

**Solutions**:
- Verify calendar ID in Google Calendar settings
- Re-run `npx tsx scripts/get-google-token.ts`
- Check Google Cloud Console for quota usage

### Performance Optimization

#### For Large Task Lists (>50 tasks)

- **Batch Processing**: Schedule in smaller groups
- **Priority Focus**: Only schedule High priority tasks first
- **Time Boxing**: Limit planning horizon to 3-5 days

#### For Complex Calendars (>100 events/week)

- **Calendar Filtering**: Only include relevant calendars
- **Event Categories**: Use different calendars for different types
- **Sync Frequency**: Reduce to every other day

## Integration Examples

### With Todoist/Other Task Managers

```typescript
// Export LifeOS schedule to Todoist
// (Implement custom integration)
```

### With Notion/Obsidian

```typescript
// Sync tasks from Notion database
// (Create custom API endpoint)
```

### With Fitness Trackers

```typescript
// Schedule around workout times
// (Add fitness calendar integration)
```

## Best Practices

### Weekly Rituals

1. **Sunday Planning**: Review upcoming week, add major tasks
2. **Mid-Week Check**: Adjust for changed priorities
3. **Friday Review**: Celebrate wins, plan next week

### Task Hygiene

1. **Daily Cleanup**: Mark completed tasks, archive old ones
2. **Time Calibration**: Adjust estimates based on actual completion
3. **Priority Review**: Reassess task priorities weekly

### Calendar Maintenance

1. **Regular Audits**: Review and clean old events
2. **Calendar Organization**: Use separate calendars for different purposes
3. **Backup**: Export important events periodically

## Success Metrics

Track these indicators of effective scheduling:

- **Completion Rate**: Tasks completed vs scheduled
- **Time Adherence**: Actual vs scheduled times
- **Warning Frequency**: Number of scheduling conflicts
- **Energy Alignment**: Deep work in optimal time slots

## Getting Help

- **Documentation**: Check [API.md](API.md) for technical details
- **Logs**: Review sync output for error messages
- **Debug Mode**: Use `--dry-run` to test changes safely
- **Community**: Open issues on GitHub for bugs/features

Remember: LifeOS works best when you give it good data. The more accurate your task estimates and constraints, the better your schedules will be.