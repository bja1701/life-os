'use server';

import { getAuthenticatedUser, getSupabaseClient } from '@/lib/supabase-server';

export interface WeeklyAnalytics {
    startDate: string;
    endDate: string;
    metrics: {
        velocityScore: number; // 0.0 - 1.0
        deepWorkRatio: number; // 0.0 - 1.0
        completionRate: number; // 0.0 - 1.0
    };
    breakdown: {
        day: string;
        plannedHours: number;
        actualHours: number;
    }[];
}

export async function getWeeklyAnalytics(referenceDate: Date = new Date()): Promise<WeeklyAnalytics> {
    const supabase = await getSupabaseClient();
    const { user } = await getAuthenticatedUser();

    // 1. Calculate Start/End of Week (Sunday - Saturday)
    const start = new Date(referenceDate);
    start.setDate(start.getDate() - start.getDay()); // Sunday
    start.setHours(0, 0, 0, 0);

    const end = new Date(start);
    end.setDate(end.getDate() + 6); // Saturday
    end.setHours(23, 59, 59, 999);

    // 2. Fetch Tasks (Broad fetch, filter in memory)
    // We want anything that overlaps this week:
    // - Deadline is in week
    // - Scheduled Start is in week
    // - OR newly completed without dates (if we tracked that, but we don't yet - rely on deadline)
    const { data: tasks, error } = await supabase
        .from('tasks')
        .select('*')
        .eq('user_id', user.id)
        .eq('is_recurring', false); // Exclude templates

    if (error) {
        console.error("Analytics Error:", error);
        throw new Error('Failed to fetch analytics');
    }

    // Filter strictly in range
    const weekTasks = (tasks || []).filter(t => {
        // Fallback: If no date, use update time if completed? 
        // For now, rely on scheduled_start OR deadline.
        // If neither, skip?
        const dateStr = t.scheduled_start_time || t.deadline;
        if (!dateStr) return false;

        const d = new Date(dateStr);
        return d >= start && d <= end;
    });

    // 3. Compute Metrics
    let totalScheduledDuration = 0;
    let totalCompletedDuration = 0;
    let deepWorkDuration = 0;
    let completedCount = 0;

    // Breakdown Map (0-6)
    const dailyStats = Array(7).fill(0).map(() => ({ planned: 0, actual: 0 }));

    weekTasks.forEach(t => {
        const dur = t.duration_minutes || 30; // Default 30 min
        const isCompleted = t.status === 'completed';
        const isCritical = t.priority_tier === 'critical';

        // Aggregate
        totalScheduledDuration += dur;
        if (isCompleted) {
            totalCompletedDuration += dur;
            completedCount++;
        }
        if (isCritical) deepWorkDuration += dur;

        // Daily Breakdown
        const tDate = new Date(t.scheduled_start_time || t.deadline);
        const dayIndex = tDate.getDay(); // 0-6
        if (dailyStats[dayIndex]) {
            dailyStats[dayIndex].planned += (dur / 60);
            if (isCompleted) {
                dailyStats[dayIndex].actual += (dur / 60);
            }
        }
    });

    const totalCount = weekTasks.length;

    return {
        startDate: start.toLocaleDateString(),
        endDate: end.toLocaleDateString(),
        metrics: {
            velocityScore: totalScheduledDuration > 0 ? parseFloat((totalCompletedDuration / totalScheduledDuration).toFixed(2)) : 0,
            deepWorkRatio: totalScheduledDuration > 0 ? parseFloat((deepWorkDuration / totalScheduledDuration).toFixed(2)) : 0,
            completionRate: totalCount > 0 ? parseFloat((completedCount / totalCount).toFixed(2)) : 0
        },
        breakdown: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day, idx) => ({
            day,
            plannedHours: parseFloat(dailyStats[idx].planned.toFixed(1)),
            actualHours: parseFloat(dailyStats[idx].actual.toFixed(1))
        }))
    };
}
