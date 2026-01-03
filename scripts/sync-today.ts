/**
 * LifeOS Daily Sync Script
 * 
 * Full pipeline execution:
 * 1. READ - Fetch events from Google Calendar
 * 2. READ - Fetch tasks from Supabase
 * 3. THINK - Run generateSchedule algorithm
 * 4. WRITE - Export scheduled blocks to Google Calendar
 * 
 * Usage:
 *   npx ts-node scripts/sync-today.ts [--dry-run] [--clear-first]
 * 
 * Options:
 *   --dry-run     Preview without creating events
 *   --clear-first Delete existing LifeOS events before syncing
 */

import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { createClient } from '@supabase/supabase-js';
import {
  getAllCalendarEvents,
  exportScheduleToGoogle,
  clearLifeOSEvents,
} from '../src/lib/calendars';
import {
  generateSchedule,
  Task,
  FixedEvent,
  ContextTag,
} from '../src/lib/scheduler';

// ============================================
// CONFIGURATION
// ============================================

const PLANNING_DAYS = 7; // How many days ahead to plan

// ============================================
// SUPABASE CLIENT
// ============================================

function getSupabaseClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    throw new Error('Supabase credentials not configured');
  }

  return createClient(url, key);
}

// ============================================
// DATABASE TYPES
// ============================================

interface DbTask {
  id: string;
  user_id: string;
  goal_id?: string;
  title: string;
  description?: string;
  duration_minutes: number;
  min_chunk_size: number;
  max_chunk_size: number;
  can_split: boolean;
  deadline?: string;
  priority: 'High' | 'Medium' | 'Low';
  context_tags: string[];
  energy_level: 'deep' | 'shallow' | 'normal';
  is_assignment: boolean;
  is_virtual: boolean;
  status: string;
}

function dbTaskToSchedulerTask(dbTask: DbTask): Task {
  const tierMap: Record<'High' | 'Medium' | 'Low', 'critical' | 'core' | 'backlog'> = {
    'High': 'critical',
    'Medium': 'core',
    'Low': 'backlog'
  };

  return {
    id: dbTask.id,
    goalId: dbTask.goal_id,
    title: dbTask.title,
    durationMinutes: dbTask.duration_minutes,
    deadline: dbTask.deadline ? new Date(dbTask.deadline) : undefined,
    priority_tier: tierMap[dbTask.priority] || 'core',
    canSplit: dbTask.can_split,
    isAssignment: dbTask.is_assignment,
  };
}

// ============================================
// MOCK TASKS (For testing without Supabase data)
// ============================================

function getMockTasks(): Task[] {
  const now = new Date();
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(23, 59, 0, 0);

  return [
    {
      id: 'mock-task-1',
      title: 'Deep Coding Project',
      durationMinutes: 180,
      deadline: tomorrow,
      priority_tier: 'critical',
      isAssignment: true,
      canSplit: true,
    },
    {
      id: 'mock-task-2',
      title: 'Review Lecture Notes',
      durationMinutes: 45,
      deadline: tomorrow,
      priority_tier: 'core',
      isAssignment: false,
      canSplit: false,
    },
  ];
}

// ============================================
// MAIN SYNC FUNCTION
// ============================================

async function syncToday(options: { dryRun: boolean; clearFirst: boolean }) {
  console.log('\n' + '='.repeat(60));
  console.log('🚀 LifeOS Daily Sync');
  console.log('='.repeat(60));
  console.log(`📅 Date: ${new Date().toLocaleDateString()}`);
  console.log(`⚙️  Mode: ${options.dryRun ? 'DRY RUN' : 'LIVE'}`);
  console.log('='.repeat(60));

  // Date range
  const startDate = new Date();
  startDate.setHours(0, 0, 0, 0);
  const endDate = new Date(startDate);
  endDate.setDate(endDate.getDate() + PLANNING_DAYS);

  // ----------------------------------------
  // STEP 1: Clear existing events (optional)
  // ----------------------------------------
  if (options.clearFirst && !options.dryRun) {
    console.log('\n📋 STEP 0: Clearing existing LifeOS events...');
    const clearResult = await clearLifeOSEvents(startDate, endDate);
    if (clearResult.errors.length > 0) {
      console.warn('   ⚠️  Some events could not be deleted');
    }
  }

  // ----------------------------------------
  // STEP 2: Fetch calendar events (READ)
  // ----------------------------------------
  console.log('\n📋 STEP 1: Fetching calendar events...');

  let fixedEvents: FixedEvent[] = [];
  try {
    fixedEvents = await getAllCalendarEvents(startDate, endDate, {
      googleCalendarId: process.env.GOOGLE_CALENDAR_ID || 'primary',
      byuIcalUrl: process.env.BYU_ICAL_URL,
    });
    console.log(`   ✅ Found ${fixedEvents.length} calendar events`);

    if (fixedEvents.length > 0) {
      console.log('   Events:');
      fixedEvents.slice(0, 5).forEach(event => {
        console.log(`      • ${event.start.toLocaleDateString()} ${event.start.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - ${event.title}`);
      });
      if (fixedEvents.length > 5) {
        console.log(`      ... and ${fixedEvents.length - 5} more`);
      }
    }
  } catch (error) {
    console.error('   ❌ Failed to fetch calendar events:', error);
    console.log('   Continuing with empty event list...');
  }

  // ----------------------------------------
  // STEP 3: Fetch tasks from Supabase (READ)
  // ----------------------------------------
  console.log('\n📋 STEP 2: Fetching tasks from Supabase...');

  let tasks: Task[] = [];
  try {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from('tasks')
      .select('*')
      .in('status', ['pending', 'scheduled'])
      .order('deadline', { ascending: true });

    if (error) throw error;

    if (data && data.length > 0) {
      tasks = data.map(dbTaskToSchedulerTask);
      console.log(`   ✅ Found ${tasks.length} tasks`);

      tasks.forEach(task => {
        const deadline = task.deadline
          ? task.deadline.toLocaleDateString()
          : 'No deadline';
        console.log(`      • [${task.priority_tier}] ${task.title} (${task.durationMinutes} mins) - ${deadline}`);
      });
    } else {
      console.log('   ⚠️  No tasks found in database, using mock tasks for demo');
      tasks = getMockTasks();
      tasks.forEach(task => {
        console.log(`      • [MOCK] ${task.title} (${task.durationMinutes} mins)`);
      });
    }
  } catch (error) {
    console.error('   ❌ Failed to fetch tasks:', error);
    console.log('   Using mock tasks for demo...');
    tasks = getMockTasks();
  }

  if (tasks.length === 0) {
    console.log('\n⚠️  No tasks to schedule. Exiting.');
    return;
  }

  // ----------------------------------------
  // STEP 4: Generate schedule (THINK)
  // ----------------------------------------
  console.log('\n📋 STEP 3: Running scheduler algorithm...');

  const result = generateSchedule(fixedEvents, tasks, {
    dayStartHour: 8,
    dayEndHour: 22,
    familyTimeStartHour: 17.5,
    planningHorizonDays: PLANNING_DAYS,
  });

  console.log(`   ✅ Generated ${result.scheduledBlocks.length} scheduled blocks`);

  if (result.scheduledBlocks.length > 0) {
    console.log('   Schedule:');
    result.scheduledBlocks.forEach(block => {
      const date = block.start.toLocaleDateString();
      const time = block.start.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      const chunk = block.totalChunks && block.totalChunks > 1
        ? ` [${(block.chunkIndex ?? 0) + 1}/${block.totalChunks}]`
        : '';
      const virtual = block.isVirtual ? ' (Virtual)' : '';
      console.log(`      • ${date} ${time} - ${block.taskTitle}${chunk} (${block.durationMinutes} mins)${virtual}`);
    });
  }

  if (result.warnings.length > 0) {
    console.log('\n   ⚠️  Warnings:');
    result.warnings.forEach(warning => {
      console.log(`      • [${warning.type}] ${warning.message}`);
    });
  }

  if (result.overloadedTasks.length > 0) {
    console.log('\n   📋 Backlog (couldn\'t fit):');
    result.overloadedTasks.forEach(task => {
      console.log(`      • ${task.title} (${task.durationMinutes} mins)`);
    });
  }

  // ----------------------------------------
  // STEP 5: Export to Google Calendar (WRITE)
  // ----------------------------------------
  console.log('\n📋 STEP 4: Exporting to Google Calendar...');

  const exportResult = await exportScheduleToGoogle(result.scheduledBlocks, options.dryRun);

  // ----------------------------------------
  // SUMMARY
  // ----------------------------------------
  console.log('\n' + '='.repeat(60));
  console.log('📊 SYNC SUMMARY');
  console.log('='.repeat(60));
  console.log(`   Calendar Events:    ${fixedEvents.length}`);
  console.log(`   Tasks Processed:    ${tasks.length}`);
  console.log(`   Blocks Generated:   ${result.scheduledBlocks.length}`);
  console.log(`   Events Exported:    ${exportResult.createdEvents}`);
  console.log(`   Warnings:           ${result.warnings.length}`);
  console.log(`   Errors:             ${exportResult.errors.length}`);
  console.log('='.repeat(60));

  if (exportResult.success) {
    console.log('✅ Sync completed successfully!');
  } else {
    console.log('⚠️  Sync completed with errors');
  }

  console.log('\n');
}

// ============================================
// CLI ENTRY POINT
// ============================================

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const clearFirst = args.includes('--clear-first');

syncToday({ dryRun, clearFirst }).catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
