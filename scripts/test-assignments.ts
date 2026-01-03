
import {
  generateSchedule,
  Task,
  FixedEvent,
  ContextTag,
} from '../src/lib/scheduler';

// Helper to format date
const fmt = (d: Date) => d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

// ============================================
// MOCK DATA
// ============================================

// Mock "Fixed Events" (Classes, Meetings) for this week
function getMockFixedEvents(startDate: Date): FixedEvent[] {
  const events: FixedEvent[] = [];
  
  // Add some classes every day at 10:00 - 11:30
  for (let i = 0; i < 5; i++) {
    const day = new Date(startDate);
    day.setDate(day.getDate() + i);
    
    // Skip if Sunday (0) or Saturday (6)
    if (day.getDay() === 0 || day.getDay() === 6) continue;
    
    // Class 1: 10:00 - 11:30
    const start1 = new Date(day); start1.setHours(10, 0, 0, 0);
    const end1 = new Date(day); end1.setHours(11, 30, 0, 0);
    events.push({
      id: `class-${i}-1`,
      title: 'CS 324',
      start: start1,
      end: end1,
      location: 'Talmage Building',
      contextTags: ['#campus']
    });

    // Class 2: 13:00 - 14:00 (1 PM - 2 PM)
    const start2 = new Date(day); start2.setHours(13, 0, 0, 0);
    const end2 = new Date(day); end2.setHours(14, 0, 0, 0);
    events.push({
      id: `class-${i}-2`,
      title: 'EC EN 330',
      start: start2,
      end: end2,
      location: 'Clyde Building',
      contextTags: ['#campus']
    });
  }
  
  return events;
}

// Mock Tasks - Simulating "Adding Assignments"
function getMockTasks(startDate: Date): Task[] {
  const tomorrow = new Date(startDate);
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(23, 59, 0, 0);
  
  const endOfWeek = new Date(startDate);
  endOfWeek.setDate(endOfWeek.getDate() + 4);
  endOfWeek.setHours(23, 59, 0, 0);

  return [
    // 1. URGENT Assignment (Due tomorrow! Should prioritize)
    {
      id: 'task-urgent',
      title: 'Urgent Lab Report',
      durationMinutes: 120,
      deadline: tomorrow,
      priority: 'High',
      minChunkSize: 60,
      maxChunkSize: 120,
      contextTags: ['#home', '#deep-work'],
      energyLevel: 'deep', // Needs morning slot?
      isAssignment: true,
      canSplit: true,
    },
    // 2. Big Project (Due end of week)
    {
      id: 'task-project',
      title: 'Hardware Design Project',
      durationMinutes: 300, // 5 hours
      deadline: endOfWeek,
      priority: 'High',
      minChunkSize: 60,
      maxChunkSize: 120,
      contextTags: ['#home', '#deep-work'],
      energyLevel: 'deep',
      isAssignment: true,
      canSplit: true,
    },
    // 3. Small Shallow Task
    {
      id: 'task-email',
      title: 'Email Professor',
      durationMinutes: 30,
      deadline: endOfWeek,
      priority: 'Medium',
      minChunkSize: 15,
      maxChunkSize: 30,
      contextTags: ['#anywhere'],
      energyLevel: 'shallow',
      isAssignment: false, // Not an assignment
      canSplit: false,
    },
  ];
}

async function runTest() {
  console.log('\n======================================');
  console.log('🧪 TEST: Adding Assignments for this Week');
  console.log('======================================');

  const now = new Date();
  
  // 1. Setup Mock Data
  const fixedEvents = getMockFixedEvents(now);
  const tasks = getMockTasks(now);
  
  console.log(`\n📅 Date: ${now.toLocaleDateString()}`);
  console.log(`📚 Tasks to Schedule: ${tasks.length}`);
  tasks.forEach(t => console.log(`   - ${t.title} (${t.durationMinutes}m) [Due: ${t.deadline?.toLocaleDateString()}]`));
  
  console.log(`🗓️  Fixed Events (Classes): ${fixedEvents.length}`);

  // 2. Run Scheduler
  console.log('\n🔄 Running Scheduler...');
  const result = generateSchedule(fixedEvents, tasks, {
    planningHorizonDays: 7,
    dayStartHour: 8,
    dayEndHour: 22,
    familyTimeStartHour: 17.5 // 5:30 PM
  });

  // 3. Analyze Output
  console.log(`\n✅ Generated ${result.scheduledBlocks.length} blocks`);
  
  // Group by day for readability
  const blocksByDay: Record<string, typeof result.scheduledBlocks> = {};
  result.scheduledBlocks.forEach(b => {
    const dayKey = b.start.toLocaleDateString();
    if (!blocksByDay[dayKey]) blocksByDay[dayKey] = [];
    blocksByDay[dayKey].push(b);
  });
  
  Object.keys(blocksByDay).forEach(day => {
    console.log(`\n📅 ${day}`);
    blocksByDay[day].forEach(b => {
      console.log(`   • ${fmt(b.start)} - ${fmt(b.end)} : ${b.taskTitle} (${b.durationMinutes}m)`);
      
      // Check for Family Time Violation
      if (b.start.getHours() >= 17 && b.start.getMinutes() >= 30) {
        console.log(`     ⚠️ WARNING: Scheduled during Family Time!`);
      }
    });
  });

  // 4. Check Warnings
  if (result.warnings.length > 0) {
    console.log('\n⚠️  Warnings:');
    result.warnings.forEach(w => console.log(`   - [${w.type}] ${w.message}`));
  }
  
  // 5. Check Backlog
  if (result.overloadedTasks.length > 0) {
    console.log('\n❌ Backlog (Could not fit):');
    result.overloadedTasks.forEach(t => console.log(`   - ${t.title}`));
  }

  console.log('\nDone.');
}

runTest().catch(console.error);
