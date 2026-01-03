'use client';

import { useState, useEffect, useMemo } from 'react';
import { supabase, DbTask } from '@/lib/supabase';
import { getGoals, generateWeeklyTasks, getTasks, updateTaskStatus, getOverdueTasks, rescheduleTasks } from '@/app/actions/planner';
import { ensureDailyHabits } from '@/app/actions/habits';
import {
  generateSchedule,
  FixedEvent,
  Task,
  ScheduledBlock,
  ScheduleResult,
} from '@/lib/scheduler';
import { fetchCalendarEvents } from '@/app/actions/calendar';
import GoalInput from '@/components/GoalInput';
import GoalList from '@/components/GoalList';
import HabitManager from '@/components/HabitManager';
import {
  DndContext,
  DragEndEvent,
  DragStartEvent,
  DragOverlay,
  useSensor,
  useSensors,
  MouseSensor,
  TouchSensor
} from '@dnd-kit/core';
import { DraggableTaskBlock } from '@/components/DraggableTaskBlock';
import WeeklyReview from '@/components/WeeklyReview';
import MobileDashboard from '@/components/MobileDashboard';
import { LogOut } from 'lucide-react';
import { signOut } from '@/app/actions/auth';

// ============================================
// HELPER FUNCTIONS
// ============================================

function getNextWeekday(): Date {
  const date = new Date();
  while (date.getDay() === 0) {
    date.setDate(date.getDate() + 1);
  }
  date.setHours(0, 0, 0, 0);
  return date;
}

function weekdayAt(hours: number, minutes: number = 0): Date {
  const date = getNextWeekday();
  date.setHours(hours, minutes, 0, 0);
  return date;
}

function nextDayAt(hours: number, minutes: number = 0): Date {
  const date = getNextWeekday();
  date.setDate(date.getDate() + 1);
  if (date.getDay() === 0) date.setDate(date.getDate() + 1);
  date.setHours(hours, minutes, 0, 0);
  return date;
}

// ============================================
// FALLBACK MOCK DATA (Used when APIs fail)
// ============================================

const FALLBACK_CALENDAR_EVENTS: FixedEvent[] = [
  {
    id: 'gcal-1',
    title: 'CS 240 - Data Structures',
    start: weekdayAt(10, 0),
    end: weekdayAt(11, 30),
    location: 'BYU Campus',
  },
  {
    id: 'gcal-2',
    title: 'Lunch Break',
    start: weekdayAt(12, 0),
    end: weekdayAt(13, 0),
    location: 'BYU Campus',
  },
  {
    id: 'gcal-3',
    title: 'CS 312 - Algorithm Design',
    start: weekdayAt(14, 0),
    end: weekdayAt(15, 30),
    location: 'BYU Campus',
  },
  {
    id: 'gcal-4',
    title: 'Family Dinner (Protected)',
    start: weekdayAt(17, 30),
    end: weekdayAt(19, 30),
    location: 'Home',
  },
];

const MOCK_TASKS: Task[] = [
  {
    id: 'task-1',
    title: 'Deep Coding Project',
    durationMinutes: 180,
    deadline: nextDayAt(23, 59),
    priority_tier: 'critical',
    isAssignment: true,
    canSplit: true,
  },
  {
    id: 'task-2',
    title: 'Review Lecture Notes',
    durationMinutes: 45,
    deadline: weekdayAt(23, 59),
    priority_tier: 'core',
    isAssignment: false,
    canSplit: false,
  },
  {
    id: 'task-3',
    title: 'Email Professor',
    durationMinutes: 15,
    deadline: weekdayAt(17, 0),
    priority_tier: 'backlog',
    isAssignment: false,
    canSplit: false,
  },
  {
    id: 'task-4',
    title: 'Algorithm Homework',
    durationMinutes: 120,
    deadline: nextDayAt(14, 0),
    priority_tier: 'critical',
    isAssignment: true,
    canSplit: true,
  },
];

// ============================================
// SLOT FINDER UTILS
// ============================================

function getAvailableSlots(
  durationMinutes: number,
  occupiedRanges: { start: number; end: number }[],
  currentDate: Date
): string[] {
  const slots: string[] = [];

  // Start checking from next 15-min interval
  let startLimit = currentDate.getHours() * 60 + currentDate.getMinutes();
  startLimit = Math.ceil(startLimit / 15) * 15;

  const endOfDay = 22 * 60; // 10 PM Hard cap

  // Check every 30 minutes
  for (let time = startLimit; time < endOfDay; time += 30) {
    const slotStart = time;
    const slotEnd = time + durationMinutes;

    // Check overlap
    const hasOverlap = occupiedRanges.some(range => {
      // Range: [start, end)
      return (slotStart < range.end && slotEnd > range.start);
    });

    if (!hasOverlap) {
      // Format HH:MM
      const h = Math.floor(time / 60);
      const m = time % 60;
      const ampm = h >= 12 ? 'PM' : 'AM';
      const displayH = h % 12 || 12;
      const displayM = m.toString().padStart(2, '0');
      slots.push(`${h.toString().padStart(2, '0')}:${displayM}|${displayH}:${displayM} ${ampm}`); // "14:00|2:00 PM"
    }
  }
  return slots;
}

function isSameDay(d1: Date, d2: Date): boolean {
  return d1.getFullYear() === d2.getFullYear() &&
    d1.getMonth() === d2.getMonth() &&
    d1.getDate() === d2.getDate();
}

// ============================================
// CONVERT DB TASK TO SCHEDULER TASK
// ============================================

// ============================================
// CONVERT DB TASK TO SCHEDULER TASK
// ============================================

function dbTaskToSchedulerTask(dbTask: DbTask): Task {
  return {
    id: dbTask.id,
    goalId: dbTask.goal_id,
    title: dbTask.title,
    durationMinutes: dbTask.duration_minutes,
    deadline: dbTask.deadline ? new Date(dbTask.deadline) : undefined,
    priority_tier: dbTask.priority_tier,
    category: dbTask.category,
    isAssignment: dbTask.is_assignment,
    canSplit: dbTask.can_split,
    parentHabitId: dbTask.parent_habit_id,
    status: dbTask.status as any,
    scheduledStart: dbTask.scheduled_start_time ? new Date(dbTask.scheduled_start_time) : undefined, // NEW: Manual Pinning
  };
}

// ============================================
// CALENDAR COMPONENT
// ============================================

interface CalendarHourProps {
  hour: number;
  fixedEvents: FixedEvent[];
  scheduledBlocks: ScheduledBlock[];
}

function formatHour(hour: number): string {
  const ampm = hour >= 12 ? 'PM' : 'AM';
  const displayHour = hour % 12 || 12;
  return `${displayHour} ${ampm}`;
}

function getEventStyle(
  event: { start: Date; end: Date },
  hourStart: Date
): { top: string; height: string } | null {
  const hourEnd = new Date(hourStart);
  hourEnd.setHours(hourEnd.getHours() + 1);

  if (event.start >= hourEnd || event.end <= hourStart) {
    return null;
  }

  const startOffset = Math.max(0, (event.start.getTime() - hourStart.getTime()) / (60 * 60 * 1000));
  const endOffset = Math.min(1, (event.end.getTime() - hourStart.getTime()) / (60 * 60 * 1000));

  return {
    top: `${startOffset * 100}%`,
    height: `${(endOffset - startOffset) * 100}%`,
  };
}

// ============================================
// MAIN DASHBOARD PAGE
// ============================================

export default function DashboardPage() {
  const [showGoalInput, setShowGoalInput] = useState(false);
  const [goalRefreshTrigger, setGoalRefreshTrigger] = useState(0);
  const [isGeneratingWeekly, setIsGeneratingWeekly] = useState(false);
  const [sidebarTab, setSidebarTab] = useState<'today' | 'unscheduled' | 'upcoming'>('today');
  const [showWeeklyReview, setShowWeeklyReview] = useState(false);

  // Execution State
  const [overdueTasks, setOverdueTasks] = useState<any[]>([]);
  const [showRolloverDialog, setShowRolloverDialog] = useState(false);
  const [hasCheckedRollover, setHasCheckedRollover] = useState(false); // NEW: Prevent repeated popups
  const [selectedTask, setSelectedTask] = useState<ScheduledBlock | Task | null>(null);
  const [manualTime, setManualTime] = useState(''); // NEW: Selected time for scheduling

  // Reset inputs when task changes
  useEffect(() => { setManualTime(''); }, [selectedTask]);

  // Constants
  const today = new Date();
  const formattedDate = today.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric'
  });

  const handleGenerateWeekly = async () => {
    setIsGeneratingWeekly(true);
    try {
      await generateWeeklyTasks();
      setGoalRefreshTrigger(prev => prev + 1);
    } catch (e: any) {
      alert(`Failed to generate weekly plan: ${e.message}`);
      console.error(e);
    } finally {
      setIsGeneratingWeekly(false);
    }
  };



  const handleCompleteTask = async (taskId: string) => {
    // Find current status
    const task = tasks.find(t => t.id === taskId);
    const newStatus = task?.status === 'completed' ? 'pending' : 'completed';

    // Optimistic Update
    setTasks(prev => prev.map(t =>
      t.id === taskId ? { ...t, status: newStatus } : t
    ));

    try {
      await updateTaskStatus(taskId, newStatus);
      // Wait a bit then refresh to sync
      // setTimeout(() => setGoalRefreshTrigger(prev => prev + 1), 500); // FIXED: Removed to prevent scroll jump

      // Auto-Close Modal if open for this task
      if (selectedTask) {
        const selectedId = 'taskId' in selectedTask ? selectedTask.taskId : selectedTask.id;
        if (selectedId === taskId) {
          setSelectedTask(null);
        }
      }

    } catch (e: any) {
      alert("Failed to update status: " + e.message);
      // Revert
      setTasks(prev => prev.map(t =>
        t.id === taskId ? { ...t, status: task?.status } : t
      ));
    }
  };

  const handleRescheduleOverdue = async () => {
    try {
      if (overdueTasks.length === 0) return;
      await rescheduleTasks(overdueTasks.map(t => t.id), new Date());
      setShowRolloverDialog(false);
      setGoalRefreshTrigger(prev => prev + 1);
    } catch (e: any) {
      alert(`Failed to reschedule: ${e.message}`);
    }
  };

  // ============================================
  // DRAG AND DROP LOGIC
  // ============================================
  const [activeDragId, setActiveDragId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 10 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 5 } })
  );

  const handleDragEnd = async (event: DragEndEvent) => {
    setActiveDragId(null);
    const { active, delta } = event;
    const task = active.data.current?.task as ScheduledBlock;

    if (!task || !delta.y) return;

    // Calculate time change
    // 80px = 1 hour (60 mins)
    // 1px = 0.75 mins
    const minutesMoved = (delta.y / 80) * 60;
    const roundedMinutes = Math.round(minutesMoved / 15) * 15; // Snap to 15m

    if (roundedMinutes === 0) return;

    const oldStart = new Date(task.start);
    const newStart = new Date(oldStart);
    newStart.setMinutes(oldStart.getMinutes() + roundedMinutes);

    // Boundary Check (5 AM - 11 PM)
    const dayStart = new Date(newStart); dayStart.setHours(5, 0, 0, 0);
    const dayEnd = new Date(newStart); dayEnd.setHours(23, 0, 0, 0); // Allow up to 11 PM start? Task deadline logic handles pushing

    // Check if new start is before 5AM
    if (newStart < dayStart) {
      // Snap to 5 AM or reject? Rejection feels safer for now
      alert("Cannot schedule before 5:00 AM");
      return;
    }

    const newEnd = new Date(newStart);
    newEnd.setMinutes(newStart.getMinutes() + task.durationMinutes);

    // Collision Check with Fixed Events
    const hasCollision = calendarEvents.some(event => {
      // Only check same day events
      if (!isSameDay(new Date(event.start), newStart)) return false;

      const eventStart = new Date(event.start);
      const eventEnd = new Date(event.end);

      // Overlap logic: (StartA < EndB) && (EndA > StartB)
      return newStart < eventEnd && newEnd > eventStart;
    });

    if (hasCollision) {
      alert("Cannot schedule overlapping a fixed event.");
      return;
    }

    // Optimistic Update
    // We update the 'tasks' state mapped into 'scheduleResult'
    // Ideally we update the specific task's 'scheduledStart' or 'deadline' if strictly pinning
    // For manual DnD, we assume "Pinning" to specific time
    try {
      setTasks(prev => prev.map(t =>
        t.id === task.taskId ? { ...t, scheduledStart: newStart } : t
      ));

      // Server Action
      await rescheduleTasks([task.taskId], newStart, true); // true = pinned
      setGoalRefreshTrigger(p => p + 1); // Triggers re-fetch/re-calc
    } catch (e: any) {
      alert("Scheduling failed: " + e.message);
      // Revert (handled by next fetch usually)
    }
  };

  const [tasks, setTasks] = useState<Task[]>([]);
  const [calendarEvents, setCalendarEvents] = useState<FixedEvent[]>([]);
  const [loading, setLoading] = useState(true);

  // Fetch Data Effect
  useEffect(() => {
    async function fetchData() {
      // setLoading(true); // REMOVED to prevent full page flash
      try {
        await ensureDailyHabits(new Date());
      } catch (err) { console.error("Failed to ensure daily habits:", err); }

      try {
        const now = new Date();
        const startOfDayDate = new Date(now);
        startOfDayDate.setHours(0, 0, 0, 0);

        const todayStr = startOfDayDate.toISOString();
        const nextWeek = new Date(now);
        nextWeek.setDate(nextWeek.getDate() + 7);

        try {
          const events = await fetchCalendarEvents(todayStr, nextWeek.toISOString());

          if (events) {
            setCalendarEvents(events.map(e => ({ ...e, start: new Date(e.start), end: new Date(e.end) })));
          } else {
            setCalendarEvents([]);
          }
        } catch (err) {
          console.error('Error fetching calendar events:', err);
          setCalendarEvents([]);
        }

        try {
          const data = await getTasks();
          if (data) {
            setTasks(data.map(dbTaskToSchedulerTask));
          } else {
            setTasks([]);
          }
        } catch (err) {
          console.error('Error fetching tasks:', err);
          setTasks([]);
        } finally {
          setLoading(false);
        }
      } catch (err) {
        // Catch for the main try block of fetchData, if any
        console.error("Error in fetchData main block:", err);
        setLoading(false); // Ensure loading is false even if an early error occurs
      }
    }
    fetchData();
  }, [goalRefreshTrigger]);

  // Check for Overdue Tasks (Once per session)
  useEffect(() => {
    async function checkOverdue() {
      if (hasCheckedRollover) return; // Skip if already checked

      try {
        const overdue = await getOverdueTasks();
        if (overdue && overdue.length > 0) {
          setOverdueTasks(overdue);
          setShowRolloverDialog(true);
        }
        setHasCheckedRollover(true); // Mark as checked
      } catch (err) { console.error("Overdue check failed", err); }
    }
    checkOverdue();
  }, [goalRefreshTrigger, hasCheckedRollover]);

  // Schedule Generation
  const scheduleResult: ScheduleResult = useMemo(() => {
    if (tasks.length === 0) return { scheduledBlocks: [], overloadedTasks: [], warnings: [] };
    return generateSchedule(calendarEvents, tasks, {
      dayStartHour: 8, dayEndHour: 22, familyTimeStartHour: 17.5, planningHorizonDays: 7,
    });
  }, [tasks, calendarEvents]);

  // Filters
  const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
  const todayBlocks = scheduleResult.scheduledBlocks.filter(b => new Date(b.start) >= todayStart && new Date(b.start) < nextDayAt(0));
  const todayEvents = calendarEvents.filter(e => new Date(e.start) >= todayStart && new Date(e.start) < nextDayAt(0));
  const hours = Array.from({ length: 18 }, (_, i) => i + 5);

  if (loading) {
    return <div className="h-screen flex items-center justify-center bg-zinc-50 text-zinc-400 text-sm animate-pulse">Initializing Life OS...</div>;
  }

  return (
    <>
      {/* MOBILE VIEW */}
      <div className="md:hidden h-screen w-full">
        <MobileDashboard
          tasks={tasks}
          onComplete={handleCompleteTask}
          onRefresh={() => setGoalRefreshTrigger(p => p + 1)}
        />
      </div>

      {/* DESKTOP VIEW */}
      <div className="hidden md:flex h-screen bg-zinc-50 flex-col overflow-hidden text-zinc-900 font-sans selection:bg-indigo-100">

        {/* Navbar / Header */}
        <header className="h-14 border-b border-zinc-200 bg-white flex items-center justify-between px-6 shrink-0 relative z-20">
          <div className="flex items-center gap-4">
            <div className="w-8 h-8 bg-black rounded-lg flex items-center justify-center text-white font-bold text-xs shadow-sm">LO</div>
            <div>
              <h1 className="text-sm font-semibold tracking-tight text-zinc-900 leading-none">Life OS Dashboard</h1>
              <p className="text-[10px] text-zinc-500 font-medium uppercase tracking-wide mt-0.5">{formattedDate}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={handleGenerateWeekly}
              disabled={isGeneratingWeekly}
              className="text-[11px] font-medium bg-indigo-50 text-indigo-700 hover:bg-indigo-100 px-3 py-1.5 rounded-full transition-colors flex items-center gap-1.5"
            >
              {isGeneratingWeekly ? 'Running AI...' : '✨ Generate Schedule'}
            </button>
            <button
              onClick={() => setShowWeeklyReview(true)}
              className="text-[11px] font-medium text-zinc-600 hover:text-zinc-900 px-3 py-1.5 rounded-full hover:bg-zinc-100 transition-colors"
            >
              📊 Review
            </button>
            <button
              onClick={() => signOut()}
              className="text-[11px] font-medium text-zinc-600 hover:text-zinc-900 px-3 py-1.5 rounded-full hover:bg-zinc-100 transition-colors flex items-center gap-1.5"
            >
              <LogOut size={12} /> Sign Out
            </button>
          </div>
        </header>

        {/* Main Flex Layout (Bento Grid V2) */}
        < main className="flex-1 overflow-hidden p-4 md:p-6 max-w-[1920px] w-full mx-auto flex gap-6" >

          {/* LEFT SIDEBAR (1/3 Width) - Vertically Scrollable Container */}
          < div className="w-full lg:w-1/3 flex flex-col gap-6 overflow-y-auto pr-2 custom-scrollbar pb-20" >

            {/* 1. Habits Widget */}
            < div className="shrink-0" >
              <HabitManager onHabitAdded={() => setGoalRefreshTrigger(p => p + 1)} />
            </div >

            {/* 2. Goal Input (Conditional) */}
            < div className="shrink-0" >
              <button
                onClick={() => setShowGoalInput(!showGoalInput)}
                className="w-full flex items-center justify-between p-4 bg-white rounded-xl shadow-sm border border-zinc-200 hover:border-zinc-300 transition-colors group"
              >
                <span className="font-semibold text-zinc-700">🎯 New Goal</span>
                <span className="bg-zinc-100 text-zinc-500 px-2 py-1 rounded text-xs font-bold group-hover:bg-zinc-200 transition-colors">
                  {showGoalInput ? 'CLOSE' : 'OPEN'}
                </span>
              </button>
              {
                showGoalInput && (
                  <div className="mt-4 animate-in slide-in-from-top-2">
                    <GoalInput onGoalAdded={() => setGoalRefreshTrigger(p => p + 1)} />
                  </div>
                )
              }
            </div >

            {/* 3. Goal List (Flows naturally) */}
            < div className="flex flex-col gap-3" >
              <div className="flex items-center justify-between px-1">
                <h2 className="text-sm font-bold text-zinc-500 uppercase tracking-widest">Your Goals</h2>
              </div>
              <GoalList onRefreshRequest={goalRefreshTrigger} />
            </div >

          </div >

          {/* RIGHT CONTENT (2/3 Width) - Fixed Calendar Container */}
          < div className="hidden lg:flex w-2/3 bg-white rounded-3xl shadow-sm border border-zinc-200 flex-col overflow-hidden h-full relative" >

            {/* Schedule Header */}
            < div className="px-6 py-4 border-b border-zinc-100 flex justify-between items-center bg-zinc-50/50 shrink-0" >
              <div className="flex items-center gap-6">
                <h2 className="text-lg font-bold text-zinc-900 tracking-tight">Today's Schedule</h2>
                <div className="flex items-center gap-4 text-xs font-medium text-zinc-500">
                  <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-full bg-rose-500 shadow-sm"></div>Critical</div>
                  <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-full bg-indigo-500 shadow-sm"></div>Core</div>
                  <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-full border border-zinc-300 bg-zinc-100"></div>Backlog</div>
                </div>
              </div>

              {/* Warnings Badge */}
              {
                scheduleResult.warnings.length > 0 && (
                  <div className="text-xs font-medium text-amber-700 bg-amber-50 px-3 py-1.5 rounded-full border border-amber-100 flex items-center gap-1.5">
                    <span>⚠️</span>
                    {scheduleResult.warnings.length} Issues
                  </div>
                )
              }
            </div >

            {/* Split Schedule View: Calendar vs Task Lists */}
            < div className="flex-1 flex overflow-hidden" >

              {/* Calendar (Main) */}
              < DndContext
                sensors={sensors}
                onDragStart={(e: DragStartEvent) => setActiveDragId(e.active.id as string)
                }
                onDragEnd={handleDragEnd}
              >
                <div className="flex-1 overflow-y-auto custom-scrollbar relative border-r border-zinc-100 bg-white">
                  <div className="relative min-w-[500px] mt-6" style={{ height: '1440px' }}> {/* 18 hours * 80px */}

                    {/* 1. Background Grid Lines */}
                    {hours.map((hour) => (
                      <div
                        key={`grid-${hour}`}
                        className="absolute w-full border-t border-zinc-100 flex"
                        style={{ top: `${(hour - 5) * 80}px`, height: '80px' }}
                      >
                        {/* Time Label */}
                        <div className="w-16 text-right pr-4 text-xs font-semibold text-zinc-400 -mt-2.5 bg-white select-none sticky left-0 z-20">
                          {formatHour(hour)}
                        </div>
                        {/* Horizontal Guideline (optional, lighter) */}
                        <div className="flex-1 border-t border-zinc-50/50"></div>
                      </div>
                    ))}

                    {/* 2. Fixed Events (Grey Blocks) */}
                    {todayEvents.map((event) => {
                      const startMinutes = (event.start.getHours() - 5) * 60 + event.start.getMinutes();
                      const durationMinutes = (event.end.getTime() - event.start.getTime()) / (1000 * 60);

                      if (startMinutes < 0) return null;

                      const top = (startMinutes / 60) * 80;
                      const height = (durationMinutes / 60) * 80;

                      return (
                        <div
                          key={`fixed-${event.id}`}
                          className="absolute left-20 right-1/2 mr-2 bg-zinc-100 border-l-4 border-zinc-400 rounded px-2 py-1.5 text-xs overflow-hidden z-10 shadow-sm hover:z-30 hover:shadow-md transition-all group border-2 border-white"
                          style={{ top: `${top}px`, height: `${height}px` }}
                        >
                          {/* Hide details if excessively small */}
                          <div className={`font-semibold text-zinc-700 truncate group-hover:whitespace-normal ${height < 30 ? 'leading-none' : ''}`}>{event.title}</div>
                          {height >= 40 && (
                            <div className="text-[10px] text-zinc-500 truncate flex items-center gap-1 ">
                              <span>📍 {event.location || 'N/A'}</span>
                              <span>• {formatHour(event.start.getHours())}</span>
                            </div>
                          )}
                        </div>
                      );
                    })}

                    {/* 3. Scheduled Tasks (Draggable) */}
                    {todayBlocks.map((block) => {
                      const blockStart = new Date(block.start);
                      const startMinutes = (blockStart.getHours() - 5) * 60 + blockStart.getMinutes();
                      const top = (startMinutes / 60) * 80;
                      const height = (block.durationMinutes / 60) * 80;

                      if (startMinutes < 0) return null;

                      return (
                        <DraggableTaskBlock
                          key={block.id}
                          block={block}
                          top={top}
                          height={height}
                          onClick={setSelectedTask}
                          onComplete={handleCompleteTask}
                        />
                      );
                    })}

                    {/* Drag Overlay (Ghost) */}
                    <DragOverlay>
                      {activeDragId ? (() => {
                        const block = todayBlocks.find(b => b.id === activeDragId);
                        if (!block) return null;
                        const height = (block.durationMinutes / 60) * 80;
                        return (
                          <div
                            className="bg-indigo-600 text-white rounded px-2 py-1.5 shadow-xl opacity-90 border-l-4 border-indigo-800 text-xs font-semibold overflow-hidden flex flex-col justify-between"
                            style={{ height: `${height}px`, width: '100%' }}
                          >
                            <div className="flex justify-between">
                              <span>{block.taskTitle}</span>
                              <span>⏱️</span>
                            </div>
                            <span className="text-[10px] opacity-80 font-mono">
                              {block.durationMinutes}m (Moving...)
                            </span>
                          </div>
                        );
                      })() : null}
                    </DragOverlay>

                  </div>
                </div>
              </DndContext >

              {/* Sidebar (Daily Backlog / Stats) */}
              < div className="w-80 bg-zinc-50/50 flex flex-col border-l border-zinc-100 shrink-0" >

                <div className="p-5 border-b border-zinc-100">
                  <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-widest mb-4">Daily Snapshot</h3>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center text-sm">
                      <div className="flex justify-between items-center text-sm">
                        <span className="text-zinc-600">Focus Hours</span>
                        <span className="font-semibold text-zinc-900">-</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* TABS */}
                <div className="flex border-b border-zinc-200">
                  <button
                    onClick={() => setSidebarTab('today')}
                    className={`flex-1 py-3 text-[10px] font-bold uppercase tracking-widest ${sidebarTab === 'today' ? 'border-b-2 border-zinc-900 text-zinc-900' : 'text-zinc-400 hover:text-zinc-600'}`}
                  >
                    Today
                  </button>
                  <button
                    onClick={() => setSidebarTab('unscheduled')}
                    className={`flex-1 py-3 text-[10px] font-bold uppercase tracking-widest ${sidebarTab === 'unscheduled' ? 'border-b-2 border-red-500 text-red-600' : 'text-zinc-400 hover:text-zinc-600'}`}
                  >
                    Backlog {scheduleResult.overloadedTasks.length > 0 && `(${scheduleResult.overloadedTasks.length})`}
                  </button>
                  <button
                    onClick={() => setSidebarTab('upcoming')}
                    className={`flex-1 py-3 text-[10px] font-bold uppercase tracking-widest ${sidebarTab === 'upcoming' ? 'border-b-2 border-zinc-900 text-zinc-900' : 'text-zinc-400 hover:text-zinc-600'}`}
                  >
                    Upcoming
                  </button>
                </div>

                {/* TAB CONTENT AREAS */}

                {/* 1. TODAY TAB */}
                {
                  sidebarTab === 'today' && (
                    <div className="flex-1 overflow-y-auto p-5 custom-scrollbar flex flex-col space-y-2">
                      {todayBlocks.filter(b => !b.isCompleted).length === 0 ? (
                        <p className="text-xs text-zinc-500 italic text-center mt-10">No tasks remaining for today!</p>
                      ) : (
                        todayBlocks.filter(b => !b.isCompleted).sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime()).map(block => (
                          <div
                            key={block.id}
                            onClick={() => setSelectedTask(block)}
                            className={`p-3 rounded-xl border bg-white shadow-sm cursor-pointer transition-all hover:border-zinc-300 group
                          ${block.isCompleted ? 'opacity-50 grayscale border-zinc-100' : 'border-zinc-200'}
                          ${block.priority_tier === 'critical' && !block.isCompleted ? 'border-l-4 border-l-rose-500' : ''}
                          ${block.priority_tier === 'core' && !block.isCompleted ? 'border-l-4 border-l-indigo-500' : ''}
                        `}
                          >
                            <div className="flex justify-between items-start mb-1">
                              <span className={`text-sm font-medium leading-tight ${block.isCompleted ? 'line-through text-zinc-400' : 'text-zinc-800'}`}>
                                {block.taskTitle}
                              </span>
                              <span className="text-[10px] font-mono text-zinc-400 shrink-0 ml-2">
                                {new Date(block.start).getHours()}:00
                              </span>
                            </div>
                            <div className="flex justify-between items-center text-[10px] text-zinc-500">
                              <span>{block.durationMinutes}m</span>
                              {/* Quick Complete Action */}
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleCompleteTask(block.taskId);
                                }}
                                className={`px-2 py-0.5 rounded border transition-colors ${block.isCompleted ? 'bg-zinc-100 text-zinc-400 border-zinc-200' : 'bg-indigo-50 text-indigo-600 border-indigo-100 hover:bg-indigo-100'}`}
                              >
                                {block.isCompleted ? 'DONE' : 'CHECK'}
                              </button>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  )
                }

                {/* 2. UNSCHEDULED TAB */}
                {
                  sidebarTab === 'unscheduled' && (
                    <div className="flex-1 overflow-y-auto p-5 custom-scrollbar flex flex-col space-y-3">
                      {scheduleResult.overloadedTasks.filter(t => t.status !== 'completed').map(task => (
                        <div
                          key={task.id}
                          onClick={() => setSelectedTask(task)} /* Now clickable */
                          className="bg-white border border-zinc-200 p-3 rounded-xl shadow-sm hover:border-zinc-300 transition-all cursor-pointer group"
                        >
                          <div className="text-sm font-medium text-zinc-800 line-clamp-2 mb-2 group-hover:text-indigo-600 transition-colors">
                            {task.title}
                          </div>
                          <div className="flex justify-between items-center text-xs text-zinc-400">
                            <span>{task.durationMinutes} min</span>
                            <div className="flex items-center gap-2">
                              <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${task.priority_tier === 'critical' ? 'bg-rose-50 text-rose-600' : 'bg-zinc-100 text-zinc-500'}`}>
                                {task.priority_tier || 'core'}
                              </span>
                              {/* Backlog Item Check Button */}
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleCompleteTask(task.id);
                                }}
                                className="px-2 py-0.5 rounded border border-zinc-200 bg-zinc-50 text-zinc-400 hover:bg-zinc-100 text-[10px]"
                              >
                                CHECK
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                      {scheduleResult.overloadedTasks.length === 0 && (
                        <p className="text-xs text-zinc-400 text-center mt-10">All tasks scheduled!</p>
                      )}
                    </div>
                  )
                }

                {/* 3. UPCOMING TAB */}
                {
                  sidebarTab === 'upcoming' && (
                    <div className="flex-1 overflow-y-auto p-5 custom-scrollbar flex flex-col">
                      {/* UPCOMING CONTENT */}
                      <div className="space-y-6">
                        {[1, 2, 3].map(dayOffset => {
                          const d = new Date();
                          d.setDate(d.getDate() + dayOffset);
                          d.setHours(0, 0, 0, 0);
                          const dayTasks = scheduleResult.scheduledBlocks.filter(b => {
                            const bDate = new Date(b.start);
                            bDate.setHours(0, 0, 0, 0);
                            return bDate.getTime() === d.getTime();
                          });

                          if (dayTasks.length === 0) return null;

                          return (
                            <div key={d.toISOString()}>
                              <h4 className="text-xs font-bold text-zinc-900 mb-2 border-b border-zinc-100 pb-1">
                                {d.toLocaleDateString('en-US', { weekday: 'long' })}
                              </h4>
                              <div className="space-y-2">
                                {dayTasks.map(block => (
                                  <div
                                    key={block.id}
                                    className={`p-2 rounded border border-zinc-100 bg-white shadow-xs cursor-pointer hover:border-zinc-300 ${block.isCompleted ? 'opacity-50 line-through' : ''}`}
                                    onClick={() => setSelectedTask(block)}
                                  >
                                    <div className="text-xs font-medium text-zinc-700 truncate">{block.taskTitle}</div>
                                    <div className="text-[10px] text-zinc-400 flex justify-between mt-1">
                                      <span>{block.start.getHours()}:00</span>
                                      <span>{block.durationMinutes}m</span>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )
                        })}
                        <div className="text-center pt-4 pb-8">
                          <p className="text-[10px] text-zinc-400">Showing next 3 days</p>
                        </div>
                      </div>
                    </div>
                  )
                }

              </div >
            </div >
          </div >

        </main >

        {/* OVERLAY: Task Detail Dialog */}
        {
          selectedTask && (
            <div className="fixed inset-0 bg-black/20 z-50 flex items-center justify-center p-4 backdrop-blur-sm" onClick={() => setSelectedTask(null)}>
              <div className="bg-white rounded-xl shadow-xl w-full max-w-sm overflow-hidden" onClick={e => e.stopPropagation()}>
                <div className="p-4 border-b border-zinc-100 flex justify-between items-center bg-zinc-50/50">
                  <h3 className="font-bold text-zinc-900">Task Details</h3>
                  <button onClick={() => setSelectedTask(null)} className="text-zinc-400 hover:text-zinc-600">✕</button>
                </div>
                <div className="p-6">
                  <div className="mb-6">
                    <h2 className="text-lg font-bold text-zinc-800 leading-tight mb-2">
                      {'taskTitle' in selectedTask ? selectedTask.taskTitle : selectedTask.title}
                    </h2>
                    <div className="flex gap-2 text-xs text-zinc-500">
                      <span className="bg-zinc-100 px-2 py-0.5 rounded font-mono">{selectedTask.durationMinutes} min</span>
                      <span className={`px-2 py-0.5 rounded font-bold uppercase ${selectedTask.priority_tier === 'critical' ? 'bg-rose-100 text-rose-700' : 'bg-indigo-50 text-indigo-700'}`}>
                        {selectedTask.priority_tier || 'core'}
                      </span>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="space-y-3">
                    {/* Complete Button */}
                    <button
                      onClick={() => {
                        const id = 'taskId' in selectedTask ? selectedTask.taskId : selectedTask.id;
                        handleCompleteTask(id);
                      }}
                      className={`w-full py-3 text-white rounded-lg font-semibold shadow-sm transition-all flex items-center justify-center gap-2 active:scale-[0.98]
                    ${'isCompleted' in selectedTask && selectedTask.isCompleted
                          ? 'bg-zinc-500 hover:bg-zinc-600'
                          : 'bg-indigo-600 hover:bg-indigo-700'}`}
                    >
                      <span>
                        {'isCompleted' in selectedTask && selectedTask.isCompleted
                          ? '↩️ Mark Incomplete'
                          : '✅ Mark Complete'}
                      </span>
                    </button>

                    {/* Move to Today (Smart Dropdown) */}
                    {(!('start' in selectedTask)) && (() => {

                      // Calculate Available Slots
                      const now = new Date();
                      const duration = selectedTask.durationMinutes;

                      // Occupied Ranges (Minutes from midnight)
                      // ONLY events from external calendar (Fixed events)
                      const occupied = [
                        ...calendarEvents.filter(e => isSameDay(new Date(e.start), now)).map(e => ({
                          start: new Date(e.start).getHours() * 60 + new Date(e.start).getMinutes(),
                          end: new Date(e.end).getHours() * 60 + new Date(e.end).getMinutes()
                        }))
                      ];

                      const slots = getAvailableSlots(duration, occupied, now);

                      return (
                        <div className="flex gap-2">
                          {/* Smart Select */}
                          <select
                            value={manualTime}
                            onChange={(e) => setManualTime(e.target.value)}
                            className="px-3 py-3 border border-zinc-200 rounded-lg text-sm bg-zinc-50 focus:outline-indigo-500 w-40"
                          >
                            <option value="">Select Time...</option>
                            {slots.length === 0 ? (
                              <option disabled>No slots available</option>
                            ) : (
                              slots.map(s => {
                                const [val, label] = s.split('|');
                                return <option key={val} value={val}>{label}</option>
                              })
                            )}
                          </select>

                          {/* Schedule Button */}
                          <button
                            disabled={!manualTime}
                            onClick={async () => {
                              try {
                                const id = ('taskId' in selectedTask ? selectedTask.taskId : selectedTask.id) as string;

                                const scheduleDate = new Date();
                                if (manualTime) {
                                  const [h, m] = manualTime.split(':').map(Number);
                                  scheduleDate.setHours(h, m, 0, 0);
                                }

                                await rescheduleTasks([id], scheduleDate, !!manualTime);
                                setSelectedTask(null);
                                setGoalRefreshTrigger(p => p + 1);
                              } catch (e: any) {
                                alert("Failed to schedule: " + e.message);
                              }
                            }}
                            className={`flex-1 py-3 border rounded-lg font-semibold shadow-sm transition-all flex items-center justify-center gap-2 active:scale-[0.98]
                        ${manualTime
                                ? 'bg-indigo-600 text-white border-indigo-600 hover:bg-indigo-700'
                                : 'bg-zinc-100 text-zinc-400 border-zinc-200 cursor-not-allowed'}`}
                          >
                            <span>{manualTime ? 'Confirm' : 'Pick Time'}</span>
                          </button>
                        </div>
                      )
                    })()}
                  </div>
                </div>
              </div>
            </div>
          )
        }

        {/* OVERLAY: Morning Rollover Dialog */}
        {
          showRolloverDialog && (
            <div className="fixed inset-0 bg-black/30 z-[60] flex items-center justify-center p-4 backdrop-blur-sm">
              <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
                <div className="p-6 text-center">
                  <div className="w-12 h-12 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center mx-auto mb-4 text-2xl">
                    ☀️
                  </div>
                  <h2 className="text-xl font-bold text-zinc-900 mb-2">Morning Planning</h2>
                  <p className="text-zinc-600 mb-6">
                    You have <span className="font-bold text-zinc-900">{overdueTasks.length}</span> unfinished tasks from yesterday.
                    Would you like to move them to today?
                  </p>

                  <div className="flex gap-3">
                    <button
                      onClick={() => setShowRolloverDialog(false)}
                      className="flex-1 py-2.5 text-zinc-600 font-medium hover:bg-zinc-50 rounded-xl transition-colors"
                    >
                      Ignore
                    </button>
                    <button
                      onClick={handleRescheduleOverdue}
                      className="flex-1 py-2.5 bg-black text-white font-bold rounded-xl hover:bg-zinc-800 transition-transform active:scale-[0.98]"
                    >
                      Move into Today
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )
        }

        {/* OVERLAY: Weekly Review */}
        {
          showWeeklyReview && (
            <WeeklyReview onClose={() => setShowWeeklyReview(false)} />
          )
        }
      </div >
    </>
  );
}
