/**
 * Life OS Scheduler
 * 
 * Deterministic Auto-Scheduler implementing:
 * - Greedy Heuristic for gap finding
 * - Variable Task Splitting (Chunking)
 * - "Family First" Protocol
 * - Anti-Fragmentation & Overload Protection
 */

// ============================================
// TYPE DEFINITIONS
// ============================================

export type PriorityTier = 'critical' | 'core' | 'backlog';
export type TaskStatus = 'pending' | 'scheduled' | 'in_progress' | 'completed' | 'skipped' | 'backlog';

export type ContextTag = '#campus' | '#home' | '#anywhere' | string;

export interface FixedEvent {
  id: string;
  title: string;
  start: Date;
  end: Date;
  location?: string;
  contextTags?: ContextTag[];
}

export interface Task {
  id: string;
  goalId?: string;
  goals?: { category: string }; // Populated via join
  title: string;
  durationMinutes: number;
  deadline?: Date;
  priority_tier?: PriorityTier; // Main priority field now
  category?: string;
  isAssignment: boolean;
  canSplit: boolean;
  dependsOn?: string[];
  parentHabitId?: string;
  status?: TaskStatus;
  scheduledStart?: Date; // NEW: Manual Pinning
}

export interface ScheduledBlock {
  id: string;
  taskId: string;
  taskTitle: string;
  start: Date;
  end: Date;
  durationMinutes: number;
  priority_tier?: PriorityTier;
  isVirtual: boolean;
  chunkIndex?: number;
  totalChunks?: number;
  isCompleted?: boolean; // NEW: Flag for UI
}

export interface TimeSlot {
  start: Date;
  end: Date;
  durationMinutes: number;
}

export interface ScheduleResult {
  scheduledBlocks: ScheduledBlock[];
  overloadedTasks: Task[];
  warnings: ScheduleWarning[];
}

export interface ScheduleWarning {
  type: 'family_time_compromised' | 'overloaded' | 'deadline_at_risk' | 'anti_cramming_violated';
  message: string;
  taskId?: string;
}

export interface SchedulerConfig {
  dayStartHour: number;      // Default: 8
  dayEndHour: number;        // Default: 22
  familyTimeStartHour: number; // Default: 17.5
  bufferMinutes: number;     // Default: 15
  deepWorkStartHour: number; // Default: 8
  deepWorkEndHour: number;   // Default: 12
  shallowWorkStartHour: number; // Default: 13
  shallowWorkEndHour: number;   // Default: 15
  planningHorizonDays: number;  // Default: 7
  maxTasksPerGoalPerDay: number; // New Feature: Maximum tasks for a single goal per day
}

const DEFAULT_CONFIG: SchedulerConfig = {
  dayStartHour: 8,
  dayEndHour: 22,
  familyTimeStartHour: 17.5,
  bufferMinutes: 15,
  deepWorkStartHour: 8,
  deepWorkEndHour: 12,
  shallowWorkStartHour: 13,
  shallowWorkEndHour: 15,
  planningHorizonDays: 7,
  maxTasksPerGoalPerDay: 3, // Default Limit
};

// ============================================
// UTILITY FUNCTIONS
// ============================================

function isSunday(date: Date): boolean { return date.getDay() === 0; }
function isFriday(date: Date): boolean { return date.getDay() === 5; }
function getDecimalHour(date: Date): number { return date.getHours() + date.getMinutes() / 60; }
function setTimeOnDate(date: Date, hours: number, minutes: number = 0): Date {
  const result = new Date(date);
  result.setHours(hours, minutes, 0, 0);
  return result;
}
function startOfDay(date: Date): Date {
  const result = new Date(date);
  result.setHours(0, 0, 0, 0);
  return result;
}
function addMinutes(date: Date, minutes: number): Date { return new Date(date.getTime() + minutes * 60 * 1000); }
function diffInMinutes(start: Date, end: Date): number { return Math.floor((end.getTime() - start.getTime()) / (60 * 1000)); }
function daysUntilDeadline(deadline: Date, from: Date = new Date()): number {
  const diffMs = deadline.getTime() - from.getTime();
  return Math.ceil(diffMs / (24 * 60 * 60 * 1000));
}
function isDeadlineUrgent(deadline: Date, from: Date = new Date()): boolean {
  const diffMs = deadline.getTime() - from.getTime();
  return diffMs > 0 && diffMs <= 24 * 60 * 60 * 1000;
}
function generateId(): string { return `block_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`; }

// ============================================
// TASK SPLITTING LOGIC
// ============================================

interface TaskChunk {
  durationMinutes: number;
  preferredDay: Date;
  chunkIndex: number;
  totalChunks: number;
}

function splitTaskIntoChunks(task: Task, scheduleStartDate: Date): TaskChunk[] {
  const { durationMinutes, canSplit, deadline } = task;

  // Use Constants instead of DB fields
  const MIN_CHUNK_SIZE = 30;
  const MAX_CHUNK_SIZE = 120;
  const EFFECTIVE_MIN_CHUNK = 60; // Simplified assumption for big tasks

  // If task doesn't need splitting
  if (durationMinutes <= 120 || !canSplit) {
    // FIX: Recurring Habits pinned to deadline
    let preferred = scheduleStartDate;
    if (task.parentHabitId && deadline) {
      preferred = startOfDay(deadline);
    }
    return [{
      durationMinutes,
      preferredDay: preferred,
      chunkIndex: 0,
      totalChunks: 1,
    }];
  }

  const chunks: TaskChunk[] = [];
  let remainingDuration = durationMinutes;
  const idealChunkSize = Math.min(MAX_CHUNK_SIZE, Math.max(EFFECTIVE_MIN_CHUNK, 90));
  const numChunks = Math.ceil(durationMinutes / idealChunkSize);

  const deadlineDate = deadline || addMinutes(scheduleStartDate, 7 * 24 * 60);
  const daysAvailable = Math.max(1, daysUntilDeadline(deadlineDate, scheduleStartDate));
  const maxDueDateDuration = Math.floor(durationMinutes * 0.5);
  const chunksPerDay = Math.ceil(numChunks / daysAvailable);

  let currentDay = new Date(scheduleStartDate);
  if (task.parentHabitId && deadline) {
    currentDay = startOfDay(deadline);
  }

  // FIX: Start search on valid day for Habits
  if (task.parentHabitId && deadline) {
    currentDay = startOfDay(deadline);
  }
  let dueDateDuration = 0;

  for (let i = 0; i < numChunks; i++) {
    const chunkDuration = Math.min(remainingDuration, idealChunkSize);
    const isDueDate = deadline && startOfDay(currentDay).getTime() === startOfDay(deadline).getTime();

    if (isDueDate && dueDateDuration + chunkDuration > maxDueDateDuration) {
      if (chunks.length > 0) currentDay = addMinutes(currentDay, -24 * 60);
    }

    chunks.push({
      durationMinutes: chunkDuration,
      preferredDay: new Date(currentDay),
      chunkIndex: i,
      totalChunks: numChunks,
    });

    if (isDueDate) dueDateDuration += chunkDuration;
    remainingDuration -= chunkDuration;
    if ((i + 1) % chunksPerDay === 0) {
      currentDay = addMinutes(currentDay, 24 * 60);
      if (deadline && currentDay > deadline) currentDay = new Date(deadline);
    }
  }
  return chunks;
}

// ============================================
// GAP FINDING
// ============================================

function findGapsInDay(
  date: Date,
  fixedEvents: FixedEvent[],
  existingBlocks: ScheduledBlock[],
  config: SchedulerConfig
): TimeSlot[] {
  const dayStart = startOfDay(date);
  const gaps: TimeSlot[] = [];

  if (isSunday(date)) return [];

  let workdayStart = setTimeOnDate(date, config.dayStartHour);
  let workdayEnd = setTimeOnDate(date, config.dayEndHour);
  if (isFriday(date)) workdayEnd = setTimeOnDate(date, 17);

  const busyPeriods: Array<{ start: Date; end: Date }> = [];

  // Add fixed events
  for (const event of fixedEvents) {
    if (startOfDay(event.start).getTime() === dayStart.getTime()) {
      busyPeriods.push({ start: event.start, end: event.end });
    }
  }
  // Add scheduled blocks
  for (const block of existingBlocks) {
    if (startOfDay(block.start).getTime() === dayStart.getTime()) {
      busyPeriods.push({ start: block.start, end: block.end });
    }
  }

  busyPeriods.sort((a, b) => a.start.getTime() - b.start.getTime());

  let currentTime = workdayStart;
  for (let i = 0; i < busyPeriods.length; i++) {
    const busy = busyPeriods[i];
    if (currentTime < busy.start) {
      const gapDuration = diffInMinutes(currentTime, busy.start);
      if (gapDuration > 0) {
        gaps.push({ start: new Date(currentTime), end: new Date(busy.start), durationMinutes: gapDuration });
      }
    }
    currentTime = new Date(busy.end);
    // Removed context buffer logic
  }

  if (currentTime < workdayEnd) {
    const gapDuration = diffInMinutes(currentTime, workdayEnd);
    if (gapDuration > 0) {
      gaps.push({ start: new Date(currentTime), end: new Date(workdayEnd), durationMinutes: gapDuration });
    }
  }
  return gaps;
}

function isInFamilyTime(slot: TimeSlot, config: SchedulerConfig): boolean {
  return getDecimalHour(slot.start) >= config.familyTimeStartHour;
}
function isDeepWorkSlot(slot: TimeSlot, config: SchedulerConfig): boolean {
  const slotHour = getDecimalHour(slot.start);
  return slotHour >= config.deepWorkStartHour && slotHour < config.deepWorkEndHour;
}

function scoreSlotForTask(
  slot: TimeSlot,
  task: Task,
  config: SchedulerConfig
): number {
  let score = 100;

  // Category Logic: Goal Category > Task Category
  const category = task.goals?.category || task.category || 'Personal';

  // Example: Boost "Deep Work" time for certain categories (e.g. Work/Business)
  // Replaces legacy energyLevel logic with Category-based heuristics
  const isWorkCategory = ['Business', 'Work', 'Career'].includes(category);

  if (isWorkCategory) {
    if (isDeepWorkSlot(slot, config)) score += 50;
  }

  // Priority bonus
  if (task.priority_tier === 'critical') score += 40;
  if (task.priority_tier === 'core') score += 15;

  if (slot.durationMinutes >= task.durationMinutes) score += 25;

  return score;
}

function calculateTaskScore(task: Task): number {
  let score = 0;
  const tierScores = { critical: 3000, core: 1000, backlog: 0 };
  score += tierScores[task.priority_tier || 'core'];

  if (task.deadline) {
    const daysLeft = daysUntilDeadline(task.deadline);
    if (daysLeft <= 0) score += 500;
    else if (daysLeft <= 3) score += 300;
    else if (daysLeft <= 7) score += 100;
    score -= daysLeft;
  } else {
    score -= 100;
  }
  score -= task.durationMinutes / 10;
  return score;
}

export function generateSchedule(
  fixedEvents: FixedEvent[],
  tasks: Task[],
  config: Partial<SchedulerConfig> = {}
): ScheduleResult {
  const fullConfig = { ...DEFAULT_CONFIG, ...config };
  const scheduledBlocks: ScheduledBlock[] = [];
  const overloadedTasks: Task[] = [];
  const warnings: ScheduleWarning[] = [];

  const now = new Date();
  const planningEndDate = addMinutes(now, fullConfig.planningHorizonDays * 24 * 60);

  // 1. Separate Pinned vs Floating
  const pinnedTasks = tasks.filter(t => t.scheduledStart);
  const floatingTasks = tasks.filter(t => !t.scheduledStart);

  const sortedTasks = [...floatingTasks].sort((a, b) => calculateTaskScore(b) - calculateTaskScore(a));
  const scheduledTaskIds = new Set<string>();

  // Track tasks per goal per day: DateString -> GoalId -> Count
  const tasksPerGoalPerDay = new Map<string, Map<string, number>>();

  // 2. Schedule Pinned Tasks First
  for (const task of pinnedTasks) {
    if (!task.scheduledStart) continue;
    const start = new Date(task.scheduledStart);
    const end = addMinutes(start, task.durationMinutes);

    // Basic validation: Don't schedule in the past if too old? (Optional, skipping for now to respect user intent)

    scheduledBlocks.push({
      id: generateId(),
      taskId: task.id,
      taskTitle: task.title,
      start: start,
      end: end,
      durationMinutes: task.durationMinutes,
      priority_tier: task.priority_tier,
      isVirtual: false,
      isCompleted: task.status === 'completed',
      // Pinned tasks don't get chunked by default logic here, assumed atomic for now or user picked start of first chunk
    });
    scheduledTaskIds.add(task.id);
  }

  // 3. Schedule Floating Tasks
  for (const task of sortedTasks) {
    if (task.dependsOn && task.dependsOn.length > 0) {
      if (task.dependsOn.some(depId => !scheduledTaskIds.has(depId))) continue;
    }

    const chunks = splitTaskIntoChunks(task, now);
    let allChunksScheduled = true;

    for (const chunk of chunks) {
      let scheduled = false;
      let searchDate = new Date(chunk.preferredDay);
      const searchEndDate = task.deadline || planningEndDate;

      while (searchDate <= searchEndDate && !scheduled) {
        if (isSunday(searchDate)) { searchDate = addMinutes(searchDate, 24 * 60); continue; }

        // Start of Day for key
        const dayKey = startOfDay(searchDate).toISOString();
        const goalId = task.goalId;

        // CHECK: Goal Velocity Limit
        let currentGoalCount = 0;
        if (goalId) {
          if (!tasksPerGoalPerDay.has(dayKey)) tasksPerGoalPerDay.set(dayKey, new Map());
          currentGoalCount = tasksPerGoalPerDay.get(dayKey)!.get(goalId) || 0;

          if (currentGoalCount >= fullConfig.maxTasksPerGoalPerDay) {
            // Limit reached for this goal on this day. Move to next day.
            searchDate = addMinutes(searchDate, 24 * 60);
            continue;
          }
        }

        const gaps = findGapsInDay(searchDate, fixedEvents, scheduledBlocks, fullConfig);
        const eligibleGaps = gaps.filter(g => g.durationMinutes >= 30); // Hardcoded min 30

        const regularSlots = eligibleGaps.filter(g => !isInFamilyTime(g, fullConfig));
        const familyTimeSlots = eligibleGaps.filter(g => isInFamilyTime(g, fullConfig));

        const scoredSlots = regularSlots
          .map(slot => ({ slot, score: scoreSlotForTask(slot, task, fullConfig) }))
          .sort((a, b) => b.score - a.score);

        for (const { slot } of scoredSlots) {
          if (slot.durationMinutes >= chunk.durationMinutes) {
            scheduledBlocks.push({
              id: generateId(),
              taskId: task.id,
              taskTitle: task.title,
              start: new Date(slot.start),
              end: addMinutes(slot.start, chunk.durationMinutes),
              durationMinutes: chunk.durationMinutes,
              priority_tier: task.priority_tier,
              isVirtual: daysUntilDeadline(searchDate, now) > fullConfig.planningHorizonDays,
              chunkIndex: chunk.chunkIndex,
              totalChunks: chunk.totalChunks,
              isCompleted: task.status === 'completed', // NEW: Map Status
            });
            scheduled = true;

            // UPDATE: Goal Velocity Tracker
            if (goalId) {
              tasksPerGoalPerDay.get(dayKey)!.set(goalId, currentGoalCount + 1);
            }
            break;
          }
        }

        // Family Time Fallback (unchanged logic, just re-copying context)
        if (!scheduled && familyTimeSlots.length > 0) {
          const canUseFamilyTime = task.isAssignment && task.deadline && isDeadlineUrgent(task.deadline, searchDate) && regularSlots.length === 0;
          if (canUseFamilyTime) {
            for (const slot of familyTimeSlots) {
              if (slot.durationMinutes >= chunk.durationMinutes) {
                scheduledBlocks.push({
                  id: generateId(),
                  taskId: task.id,
                  taskTitle: task.title,
                  start: new Date(slot.start),
                  end: addMinutes(slot.start, chunk.durationMinutes),
                  durationMinutes: chunk.durationMinutes,
                  priority_tier: task.priority_tier,
                  isVirtual: false,
                  chunkIndex: chunk.chunkIndex,
                  totalChunks: chunk.totalChunks,
                  isCompleted: task.status === 'completed', // NEW: Map Status
                });
                scheduled = true;
                warnings.push({ type: 'family_time_compromised', message: `Task "${task.title}" scheduled during Family Time`, taskId: task.id });

                // UPDATE: Goal Velocity Tracker
                if (goalId) {
                  if (!tasksPerGoalPerDay.has(dayKey)) tasksPerGoalPerDay.set(dayKey, new Map()); // Re-check just in case
                  const count = tasksPerGoalPerDay.get(dayKey)!.get(goalId) || 0;
                  tasksPerGoalPerDay.get(dayKey)!.set(goalId, count + 1);
                }
                break;
              }
            }
          }
        }
        if (!scheduled) searchDate = addMinutes(searchDate, 24 * 60);
      }
      if (!scheduled) allChunksScheduled = false;
    }

    if (allChunksScheduled) {
      scheduledTaskIds.add(task.id);
    } else {
      overloadedTasks.push(task);
      warnings.push({ type: 'overloaded', message: `Task "${task.title}" could not be fully scheduled`, taskId: task.id });
    }
  }

  // Anti-Cramming warnings... (unchanged)
  for (const task of sortedTasks) {
    if (task.deadline && task.canSplit) {
      const taskBlocks = scheduledBlocks.filter(b => b.taskId === task.id);
      const dueDateBlocks = taskBlocks.filter(b => startOfDay(b.start).getTime() === startOfDay(task.deadline!).getTime());
      const total = taskBlocks.reduce((s, b) => s + b.durationMinutes, 0);
      const due = dueDateBlocks.reduce((s, b) => s + b.durationMinutes, 0);
      if (total > 0 && due / total > 0.5) {
        warnings.push({ type: 'anti_cramming_violated', message: `Task "${task.title}" >50% on due date`, taskId: task.id });
      }
    }
  }

  scheduledBlocks.sort((a, b) => a.start.getTime() - b.start.getTime());
  return { scheduledBlocks, overloadedTasks, warnings };
}

// ... Exports for utils ...
export function getBlocksForDay(blocks: ScheduledBlock[], date: Date): ScheduledBlock[] { return blocks.filter(b => startOfDay(b.start).getTime() === startOfDay(date).getTime()); }
export function getTotalScheduledMinutes(blocks: ScheduledBlock[], date: Date): number { return getBlocksForDay(blocks, date).reduce((sum, b) => sum + b.durationMinutes, 0); }
export function isTaskScheduled(blocks: ScheduledBlock[], taskId: string): boolean { return blocks.some(b => b.taskId === taskId); }
export function getRemainingDuration(blocks: ScheduledBlock[], task: Task): number {
  const scheduled = blocks.filter(b => b.taskId === task.id).reduce((sum, b) => sum + b.durationMinutes, 0);
  return Math.max(0, task.durationMinutes - scheduled);
}
export function convertToHardBookings(blocks: ScheduledBlock[], withinDays: number = 7): ScheduledBlock[] {
  const cutoff = addMinutes(new Date(), withinDays * 24 * 60);
  return blocks.map(block => (block.isVirtual && block.start <= cutoff) ? { ...block, isVirtual: false } : block);
}
