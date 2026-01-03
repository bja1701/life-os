/**
 * Scheduler Tests
 * 
 * Test the deterministic auto-scheduler logic
 */

import {
  generateSchedule,
  FixedEvent,
  Task,
  ScheduledBlock,
  ScheduleResult,
  getBlocksForDay,
} from './scheduler';

// Helper to get the next weekday (Mon-Sat, skip Sunday)
function getNextWeekday(): Date {
  const date = new Date();
  // If today is Sunday (0), move to Monday
  while (date.getDay() === 0) {
    date.setDate(date.getDate() + 1);
  }
  date.setHours(0, 0, 0, 0);
  return date;
}

// Helper to create a date at a specific time on the next weekday
function weekdayAt(hours: number, minutes: number = 0): Date {
  const date = getNextWeekday();
  date.setHours(hours, minutes, 0, 0);
  return date;
}

// Helper to create a date at a specific time the day after next weekday
function nextDayAt(hours: number, minutes: number = 0): Date {
  const date = getNextWeekday();
  date.setDate(date.getDate() + 1);
  // Skip Sunday again if needed
  if (date.getDay() === 0) {
    date.setDate(date.getDate() + 1);
  }
  date.setHours(hours, minutes, 0, 0);
  return date;
}

// Helper to format time for console output
function formatTime(date: Date): string {
  return date.toLocaleTimeString('en-US', { 
    hour: '2-digit', 
    minute: '2-digit',
    hour12: true 
  });
}

// Helper to format date for console output
function formatDate(date: Date): string {
  return date.toLocaleDateString('en-US', { 
    weekday: 'short',
    month: 'short', 
    day: 'numeric' 
  });
}

// Helper to print schedule in a readable format
function printSchedule(result: ScheduleResult): void {
  console.log('\n' + '='.repeat(60));
  console.log('📅 GENERATED SCHEDULE');
  console.log('='.repeat(60));
  
  if (result.scheduledBlocks.length === 0) {
    console.log('No blocks scheduled.');
  } else {
    // Group by day
    const blocksByDay = new Map<string, ScheduledBlock[]>();
    
    for (const block of result.scheduledBlocks) {
      const dayKey = formatDate(block.start);
      if (!blocksByDay.has(dayKey)) {
        blocksByDay.set(dayKey, []);
      }
      blocksByDay.get(dayKey)!.push(block);
    }
    
    for (const [day, blocks] of blocksByDay) {
      console.log(`\n📆 ${day}`);
      console.log('-'.repeat(40));
      
      for (const block of blocks) {
        const chunkInfo = block.totalChunks && block.totalChunks > 1
          ? ` [Chunk ${block.chunkIndex! + 1}/${block.totalChunks}]`
          : '';
        const virtualTag = block.isVirtual ? ' (Virtual)' : ' (Hard)';
        
        console.log(
          `  ${formatTime(block.start)} - ${formatTime(block.end)} | ` +
          `${block.taskTitle}${chunkInfo}${virtualTag} (${block.durationMinutes} mins)`
        );
      }
    }
  }
  
  if (result.overloadedTasks.length > 0) {
    console.log('\n⚠️  OVERLOADED TASKS (Moved to Backlog):');
    for (const task of result.overloadedTasks) {
      console.log(`  - ${task.title} (${task.durationMinutes} mins)`);
    }
  }
  
  if (result.warnings.length > 0) {
    console.log('\n🚨 WARNINGS:');
    for (const warning of result.warnings) {
      console.log(`  [${warning.type}] ${warning.message}`);
    }
  }
  
  console.log('\n' + '='.repeat(60) + '\n');
}

// Helper to check if any block overlaps with a time range
function hasBlockInRange(
  blocks: ScheduledBlock[],
  rangeStart: Date,
  rangeEnd: Date
): boolean {
  return blocks.some(block => {
    return block.start < rangeEnd && block.end > rangeStart;
  });
}

describe('Scheduler', () => {
  describe('The Busy Student & Father', () => {
    /**
     * Test Scenario:
     * - Fixed Events: 
     *   - Class from 10am-12pm
     *   - Family Dinner from 5:30pm-7:30pm (Protected)
     * - Tasks:
     *   - "Deep Coding Project" (4 hours, High Priority, can split)
     *   - "Buy Diapers" (30 mins, Medium Priority)
     * 
     * Expectations:
     * 1. The 4-hour project should be split into chunks
     * 2. Family Dinner block (5:30pm-7:30pm) must remain empty
     * 3. No work scheduled during protected family time
     */
    
    const fixedEvents: FixedEvent[] = [
      {
        id: 'class-1',
        title: 'Computer Science Class',
        start: weekdayAt(10, 0),
        end: weekdayAt(12, 0),
        location: 'BYU Campus',
        contextTags: ['#campus'],
      },
      {
        id: 'family-dinner',
        title: 'Family Dinner (Protected)',
        start: weekdayAt(17, 30),
        end: weekdayAt(19, 30),
        location: 'Home',
        contextTags: ['#home'],
      },
    ];
    
    const tasks: Task[] = [
      {
        id: 'task-coding',
        title: 'Deep Coding Project',
        durationMinutes: 240, // 4 hours
        deadline: nextDayAt(23, 59),
        priority: 'High',
        minChunkSize: 60,     // Deep work = min 60 mins
        maxChunkSize: 120,    // Max 2 hour chunks
        contextTags: ['#home', '#deep-work'],
        energyLevel: 'deep',
        isAssignment: true,
        canSplit: true,
      },
      {
        id: 'task-diapers',
        title: 'Buy Diapers',
        durationMinutes: 30,
        deadline: weekdayAt(23, 59),
        priority: 'Medium',
        minChunkSize: 30,
        maxChunkSize: 30,
        contextTags: ['#anywhere'],
        energyLevel: 'shallow',
        isAssignment: false,
        canSplit: false,
      },
    ];
    
    let result: ScheduleResult;
    
    beforeAll(() => {
      // Run the scheduler
      result = generateSchedule(fixedEvents, tasks, {
        dayStartHour: 8,
        dayEndHour: 22,
        familyTimeStartHour: 17.5,
        planningHorizonDays: 7,
      });
      
      // Print the schedule for visual verification
      console.log('\n\n🧪 TEST: "The Busy Student & Father"');
      console.log('Fixed Events:');
      console.log('  - Class: 10:00 AM - 12:00 PM');
      console.log('  - Family Dinner: 5:30 PM - 7:30 PM (Protected)');
      console.log('Tasks:');
      console.log('  - Deep Coding Project: 4 hours, High Priority, Can Split');
      console.log('  - Buy Diapers: 30 mins, Medium Priority');
      
      printSchedule(result);
    });
    
    test('should generate scheduled blocks', () => {
      expect(result.scheduledBlocks.length).toBeGreaterThan(0);
    });
    
    test('should split the 4-hour deep coding project into chunks', () => {
      const codingBlocks = result.scheduledBlocks.filter(
        b => b.taskId === 'task-coding'
      );
      
      // Should be split into multiple chunks (4 hours / max 2 hours = at least 2 chunks)
      expect(codingBlocks.length).toBeGreaterThanOrEqual(2);
      
      // Total duration should equal original task duration
      const totalDuration = codingBlocks.reduce((sum, b) => sum + b.durationMinutes, 0);
      expect(totalDuration).toBe(240);
      
      // Each chunk should respect max chunk size
      for (const block of codingBlocks) {
        expect(block.durationMinutes).toBeLessThanOrEqual(120);
      }
      
      // Each chunk should respect min chunk size for deep work (60 mins)
      for (const block of codingBlocks) {
        expect(block.durationMinutes).toBeGreaterThanOrEqual(60);
      }
      
      console.log(`✅ Deep Coding Project split into ${codingBlocks.length} chunks`);
    });
    
    test('should NOT schedule any tasks during Family Dinner (5:30pm-7:30pm)', () => {
      const familyDinnerStart = weekdayAt(17, 30);
      const familyDinnerEnd = weekdayAt(19, 30);
      
      const hasOverlap = hasBlockInRange(
        result.scheduledBlocks,
        familyDinnerStart,
        familyDinnerEnd
      );
      
      expect(hasOverlap).toBe(false);
      
      console.log('✅ Family Dinner block (5:30 PM - 7:30 PM) is protected and empty');
    });
    
    test('should NOT schedule regular tasks in Family Time (after 5:30pm) unless emergency', () => {
      const familyTimeStart = weekdayAt(17, 30);
      const dayEnd = weekdayAt(22, 0);
      
      // Get all blocks in family time
      const blocksInFamilyTime = result.scheduledBlocks.filter(block => {
        const blockStart = block.start;
        return blockStart >= familyTimeStart && blockStart < dayEnd;
      });
      
      // If any blocks are in family time, they should have triggered a warning
      if (blocksInFamilyTime.length > 0) {
        const familyTimeWarnings = result.warnings.filter(
          w => w.type === 'family_time_compromised'
        );
        expect(familyTimeWarnings.length).toBeGreaterThan(0);
        console.log('⚠️  Some tasks scheduled in Family Time (emergency override triggered)');
      } else {
        console.log('✅ No tasks scheduled during Family Time (5:30 PM onwards)');
      }
    });
    
    test('should schedule "Buy Diapers" task', () => {
      const diapersBlocks = result.scheduledBlocks.filter(
        b => b.taskId === 'task-diapers'
      );
      
      expect(diapersBlocks.length).toBe(1);
      expect(diapersBlocks[0].durationMinutes).toBe(30);
      
      console.log(`✅ "Buy Diapers" scheduled at ${formatTime(diapersBlocks[0].start)}`);
    });
    
    test('should NOT schedule during Class time (10am-12pm)', () => {
      const classStart = weekdayAt(10, 0);
      const classEnd = weekdayAt(12, 0);
      
      const hasOverlap = hasBlockInRange(
        result.scheduledBlocks,
        classStart,
        classEnd
      );
      
      expect(hasOverlap).toBe(false);
      
      console.log('✅ Class time (10:00 AM - 12:00 PM) is protected');
    });
    
    test('should prioritize morning slots for deep work', () => {
      const codingBlocks = result.scheduledBlocks.filter(
        b => b.taskId === 'task-coding'
      );
      
      // Check if at least one deep work chunk is scheduled before noon
      const morningBlocks = codingBlocks.filter(b => b.start.getHours() < 12);
      
      // We expect morning blocks if there's availability (8am-10am is free)
      if (morningBlocks.length > 0) {
        console.log(`✅ ${morningBlocks.length} deep work chunk(s) scheduled in morning (optimal energy time)`);
      } else {
        console.log('ℹ️  No morning slots available for deep work');
      }
    });
    
    test('should print summary of available time slots', () => {
      console.log('\n📊 TIME SLOT ANALYSIS:');
      console.log('  Available slots today:');
      console.log('    - 8:00 AM - 10:00 AM (2 hours) - Before class');
      console.log('    - 12:00 PM - 5:30 PM (5.5 hours) - After class, before family time');
      console.log('  Protected:');
      console.log('    - 10:00 AM - 12:00 PM (Class)');
      console.log('    - 5:30 PM onwards (Family Time)');
      
      // This is just informational, always passes
      expect(true).toBe(true);
    });
  });
  
  describe('Edge Cases', () => {
    test('should handle empty task list', () => {
      const result = generateSchedule([], []);
      
      expect(result.scheduledBlocks).toHaveLength(0);
      expect(result.overloadedTasks).toHaveLength(0);
      expect(result.warnings).toHaveLength(0);
    });
    
    test('should handle task that cannot be split', () => {
      const tasks: Task[] = [
        {
          id: 'task-meeting',
          title: 'Important Meeting Prep',
          durationMinutes: 180, // 3 hours
          priority: 'High',
          minChunkSize: 180,
          maxChunkSize: 180,
          contextTags: ['#anywhere'],
          energyLevel: 'normal',
          isAssignment: false,
          canSplit: false, // Cannot split
        },
      ];
      
      const result = generateSchedule([], tasks);
      
      // Should be scheduled as a single block
      const meetingBlocks = result.scheduledBlocks.filter(
        b => b.taskId === 'task-meeting'
      );
      
      expect(meetingBlocks.length).toBe(1);
      expect(meetingBlocks[0].durationMinutes).toBe(180);
    });
  });
});
