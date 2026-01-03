# LifeOS Quick Reference

## 🚀 Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Setup environment
cp .env.example .env.local
# Edit .env.local with your credentials

# 3. Get Google token
npx tsx scripts/get-google-token.ts

# 4. Test pipeline
npx tsx scripts/sync-today.ts --dry-run

# 5. Live sync
npx tsx scripts/sync-today.ts
```

## 📋 Core Commands

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server |
| `npm test` | Run test suite |
| `npx tsx scripts/sync-today.ts --dry-run` | Preview schedule |
| `npx tsx scripts/sync-today.ts` | Live sync to calendar |
| `npx tsx scripts/sync-today.ts --clear-first` | Clear old events, then sync |

## 🔧 Environment Variables

### Required
```bash
GOOGLE_CLIENT_ID=your-client-id
GOOGLE_CLIENT_SECRET=your-client-secret
GOOGLE_REFRESH_TOKEN=your-refresh-token
GOOGLE_CALENDAR_TARGET_ID=lifeos-schedule@group.calendar.google.com
```

### Optional
```bash
NEXT_PUBLIC_SUPABASE_URL=your-supabase-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-key
GOOGLE_CALENDAR_ID=primary
BYU_ICAL_URL=https://learningsuite.byu.edu/ical/...
```

## 📊 Life Rules

### Scheduling Constraints
- **Work Hours**: 8:00 AM - 10:00 PM
- **Family Time**: 5:30 PM - 10:00 PM (weekdays)
- **Sunday Blocking**: No work scheduled on Sundays
- **Energy Alignment**: Deep work in mornings, shallow in afternoons

### Task Rules
- **Anti-Cramming**: No >50% of work on due date
- **Task Splitting**: Large tasks broken into 30-120 min chunks
- **Priority Order**: High → Medium → Low
- **Context Respect**: Honor location requirements (#home, #anywhere)

## 🏗️ System Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Google Calendar │───│   LifeOS Core    │───│   Supabase DB    │
│   + BYU iCal     │    │   Scheduler      │    │   Goals/Tasks    │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         ▼                       ▼                       ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Fixed Events    │    │  Scheduled       │    │   Dashboard      │
│   (READ)         │    │  Blocks (WRITE)  │    │   UI             │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

## 📝 Task Creation Guide

### Essential Fields
```typescript
{
  title: "Complete Project Report",
  durationMinutes: 240,        // Total time needed
  deadline: new Date("2025-12-31"),
  priority: "High",
  energyLevel: "deep",
  contextTags: ["#home"],
  canSplit: true
}
```

### Time Estimation Tips
- **Add Buffer**: Estimate × 1.25-1.5 for unknowns
- **Break Large Tasks**: 180 min chunks max
- **Consider Switching**: +15 min between different work types

## 🎯 Understanding Output

### Schedule Format
```
📅 Monday, December 30
├── 8:00 AM - 9:30 AM: Complete Math Homework [1/2] (90 mins)
├── 9:45 AM - 11:15 AM: Complete Math Homework [2/2] (90 mins)
└── 1:00 PM - 2:00 PM: Review Lecture Notes (60 mins)
```

### Warning Types
- **anti_cramming_violated**: Too much work on due date
- **deadline_missed**: Couldn't fit before deadline
- **energy_mismatch**: Wrong time for energy level

## 🔍 Troubleshooting

### Common Issues

| Problem | Symptom | Solution |
|---------|---------|----------|
| No events created | Sync succeeds but calendar empty | Check `GOOGLE_CALENDAR_TARGET_ID` |
| Auth errors | "Invalid credentials" | Re-run token script |
| Tasks not scheduled | "0 blocks generated" | Add tasks to database |
| Wrong calendar | Events in primary calendar | Use secondary calendar ID |

### Debug Steps
1. Run with `--dry-run` to see what would happen
2. Check environment variables
3. Verify Google Calendar permissions
4. Review task data in Supabase

## 📈 Performance Tuning

### For Speed
- Limit planning horizon to 3-5 days
- Schedule high-priority tasks first
- Use fewer calendar sources

### For Quality
- Accurate time estimates
- Realistic deadlines
- Proper energy level assignment
- Detailed context tags

## 🔄 Daily Workflow

### Morning (6:00-7:00 AM)
```bash
# Review today's schedule
npx tsx scripts/sync-today.ts --dry-run

# Add any new tasks
# (via Supabase dashboard)

# Generate final schedule
npx tsx scripts/sync-today.ts
```

### Evening (9:00-10:00 PM)
```bash
# Mark completed tasks
# Review what worked/didn't work
# Add tomorrow's tasks
```

## 📚 Key Files

| File | Purpose |
|------|---------|
| `src/lib/scheduler.ts` | Core scheduling algorithm |
| `src/lib/calendars.ts` | Google Calendar integration |
| `scripts/sync-today.ts` | CLI pipeline script |
| `src/app/dashboard/page.tsx` | Web dashboard |
| `supabase/schema.sql` | Database schema |
| `.env.local` | Environment configuration |

## 🎨 Customization

### Modify Scheduling Rules
Edit `src/lib/scheduler.ts`:
```typescript
const FAMILY_TIME_START = 18; // Change from 5:30 PM to 6:00 PM
const WORK_DAY_END = 23;      // Extend to 11:00 PM
```

### Add Custom Context Tags
```typescript
type ContextTag = '#home' | '#anywhere' | '#office' | '#quiet';
```

### Change Energy Preferences
```typescript
const DEEP_WORK_HOURS = [6, 7, 8, 9, 10, 11]; // Custom morning hours
```

## 🚀 Advanced Features

### Virtual Blocks
Tasks can be scheduled as suggestions only:
```typescript
isVirtual: true  // Won't create calendar events
```

### Custom Calendars
Read from multiple calendars:
```typescript
googleCalendarId: "work@company.com"
```

### Batch Operations
Schedule multiple days at once:
```typescript
planningHorizonDays: 14  // 2 weeks ahead
```

## 📞 Support

- **Setup Issues**: See [SETUP.md](SETUP.md)
- **API Details**: See [API.md](API.md)
- **Architecture**: See [ARCHITECTURE.md](ARCHITECTURE.md)
- **Usage Tips**: See [USAGE.md](USAGE.md)

## 🎯 Success Checklist

- [ ] Google Calendar integration working
- [ ] Secondary calendar created and configured
- [ ] Tasks added with realistic estimates
- [ ] Schedule generates without errors
- [ ] Calendar shows scheduled blocks
- [ ] No frequent warnings
- [ ] Tasks completed as scheduled

**Remember**: LifeOS is most effective with good input data. Spend time on accurate task creation and you'll get better schedules.