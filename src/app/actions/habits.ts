'use server';

import { getAuthenticatedUser, getSupabaseClient } from '@/lib/supabase-server';

/**
 * Creates a "Master Habit" - a template task that repeats.
 */
// 1. Update createHabit
export async function createHabit(habit: {
    title: string;
    duration: number;
    frequency: 'daily' | 'weekdays' | 'weekly' | 'monthly' | 'custom';
    recurrence_days?: number[]; // 0=Sun, 6=Sat
    priority_tier: 'critical' | 'core' | 'backlog';
    category: string;
}) {
    const supabase = await getSupabaseClient();
    const { user } = await getAuthenticatedUser();

    console.log("--> Creating Master Habit:", habit.title, habit.frequency);

    const { data, error } = await supabase
        .from('tasks')
        .insert({
            user_id: user.id,
            title: habit.title,
            duration_minutes: habit.duration,
            recurrence_pattern: habit.frequency,
            recurrence_days: habit.recurrence_days || [],
            is_recurring: true, // This marks it as a Master Habit
            status: 'pending',
            is_virtual: false,
            priority_tier: habit.priority_tier,
            category: habit.category
        })
        .select()
        .single();

    if (error) {
        console.error("Create Habit Error:", error);
        throw new Error(error.message);
    }

    return data;
}

// ... deleteHabit ...
export async function deleteHabit(habitId: string) {
    const supabase = await getSupabaseClient();
    await getAuthenticatedUser(); // Verify auth

    // 1. Delete all child instances (recurrence items)
    await supabase.from('tasks').delete().eq('parent_habit_id', habitId);

    // 2. Delete the Master Habit
    const { error } = await supabase.from('tasks').delete().eq('id', habitId);

    if (error) throw new Error("Failed to delete habit");
}

// ... getHabits ...
export async function getHabits() {
    const supabase = await getSupabaseClient();
    const { user } = await getAuthenticatedUser();

    // Explicitly select recurrence_days
    const { data, error } = await supabase
        .from('tasks')
        .select('*, recurrence_days')
        .eq('user_id', user.id)
        .eq('is_recurring', true)
        .order('created_at', { ascending: false });

    if (error) {
        console.error("Get Habits Error:", error);
        return [];
    }
    return data;
}

// ... ensureDailyHabits ...
export async function ensureDailyHabits(date: Date = new Date()) {
    const supabase = await getSupabaseClient();
    const { user } = await getAuthenticatedUser();
    const habits = await getHabits();
    if (!habits || habits.length === 0) return 0;

    const startOfDay = new Date(date); startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(date); endOfDay.setHours(23, 59, 59, 999);

    const dayOfWeek = date.getDay(); // 0=Sun ... 6=Sat
    const dayOfMonth = date.getDate(); // 1-31

    let createdCount = 0;

    for (const habit of habits) {
        // --- LOGIC CHECKS ---
        let shouldSpawn = false;

        switch (habit.recurrence_pattern) {
            case 'daily':
                shouldSpawn = true;
                break;
            case 'weekdays':
                // Mon(1) - Fri(5)
                shouldSpawn = dayOfWeek >= 1 && dayOfWeek <= 5;
                break;
            case 'weekly':
                // Check if today matches one of the selected recurrence days
                // If no days specified, assume creation day (fallback, but UI should prevent this)
                if (habit.recurrence_days && habit.recurrence_days.length > 0) {
                    shouldSpawn = habit.recurrence_days.includes(dayOfWeek);
                } else {
                    // Fallback: spawn on the day it was created? For now, nothing.
                    shouldSpawn = false;
                }
                break;
            case 'custom':
                if (habit.recurrence_days && habit.recurrence_days.length > 0) {
                    shouldSpawn = habit.recurrence_days.includes(dayOfWeek);
                }
                break;
            case 'monthly':
                // Spawn on the same day of month as creation.
                // Or maybe we store 'recurrence_days' as the day of month for monthly?
                // Let's assume for now 'recurrence_days' is ONLY for week days.
                // For monthly, we can check habit.created_at day of month.
                const createdDate = new Date(habit.created_at);
                shouldSpawn = dayOfMonth === createdDate.getDate();
                break;
            default:
                shouldSpawn = false;
        }

        if (!shouldSpawn) continue;

        // 3. Check if instance already exists
        // 3. Check if instance already exists (Robust Check)
        const { data: existingList } = await supabase
            .from('tasks')
            .select('id')
            .eq('parent_habit_id', habit.id)
            .gte('deadline', startOfDay.toISOString())
            .lte('deadline', endOfDay.toISOString())
            .limit(1);

        if (!existingList || existingList.length === 0) {
            const { error } = await supabase
                .from('tasks')
                .insert({
                    user_id: user.id,
                    title: habit.title,
                    duration_minutes: habit.duration_minutes,
                    parent_habit_id: habit.id,
                    is_recurring: false,
                    recurrence_pattern: null,
                    status: 'pending',
                    priority_tier: habit.priority_tier || 'core',
                    category: habit.category,
                    // energy_level removed
                    is_virtual: false,
                    deadline: endOfDay.toISOString()
                });
            if (!error) createdCount++;
        }
    }
    if (createdCount > 0) {
        console.log(`--> Sprouted ${createdCount} habit instances.`);
    }

    return createdCount;
}

/**
 * Update Habit Priority
 */
export async function updateHabitPriority(habitId: string, priority: 'critical' | 'core' | 'backlog') {
    const supabase = await getSupabaseClient();
    await getAuthenticatedUser(); // Verify Auth

    // 1. Update the Master Habit
    const { error: habitError } = await supabase
        .from('tasks')
        .update({ priority_tier: priority })
        .eq('id', habitId);

    if (habitError) {
        console.error("Update Habit Priority Error:", habitError);
        throw new Error("Failed to update habit priority");
    }

    // 2. Cascade to all PENDING instances (child tasks) of this habit
    const { error: instanceError } = await supabase
        .from('tasks')
        .update({ priority_tier: priority })
        .eq('parent_habit_id', habitId)
        .eq('status', 'pending');

    if (instanceError) {
        console.error("Cascade Habit Priority Error:", instanceError);
        console.warn("Failed to update habit instances");
    }
}
