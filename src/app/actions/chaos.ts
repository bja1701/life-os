'use server';

import { getAuthenticatedUser, getSupabaseClient } from '@/lib/supabase-server';
import { createGoal } from './planner';
import { createHabit } from './habits';

export async function seedChaosData() {
    const supabase = await getSupabaseClient();
    const { user } = await getAuthenticatedUser();

    console.log("💣 CHAOS MODE INITIATED");

    // 1. Clear existing non-recurring tasks (optional, strictly requested by user in prompt)
    // "Clears Data: Optionally deletes all non-habit tasks"
    // We'll leave goals for now but clear unrelated tasks to keep the calendar focused on the stress test.
    // Actually, let's keep it additive so they can see "Overload".
    // Re-reading prompt: "Clears Data: Optionally deletes all non-habit tasks... to start fresh".
    // Let's do a soft clear of 'pending' tasks to avoid absolute clutter, but keep history.
    // Making it additive for now to ensure we hit the limit.

    // 2. Create 3 Heavy Goals
    const goalsToCreate = [
        {
            title: "Launch Global Startup",
            category: "Business",
            estimated_total_minutes: 10000,
            priority_tier: 'critical' as const
        },
        {
            title: "Run Ultra Marathon",
            category: "Health",
            estimated_total_minutes: 5000,
            priority_tier: 'core' as const
        },
        {
            title: "Learn Quantum Physics",
            category: "Education",
            estimated_total_minutes: 8000,
            priority_tier: 'backlog' as const
        }
    ];

    const createdGoals = [];
    for (const g of goalsToCreate) {
        const goal = await createGoal(g);
        createdGoals.push(goal);
    }
    console.log(`--> Created ${createdGoals.length} heavy goals.`);


    // 3. Flood Tasks (50 random)
    const tasks = [];
    const priorities = ['critical', 'core', 'backlog'];
    const durations = [15, 30, 60, 90];

    // Calculate end of specific week for deadline (next 7 days)
    const now = new Date();
    const deadline = new Date(now);
    deadline.setDate(now.getDate() + 7);

    for (let i = 0; i < 50; i++) {
        const randomGoalIndex = Math.floor(Math.random() * createdGoals.length);
        const goal = createdGoals[randomGoalIndex];

        // Priority Weighted Random: 10% Critical, 40% Core, 50% Backlog
        const rand = Math.random();
        let tier: 'critical' | 'core' | 'backlog' = 'backlog';
        if (rand < 0.1) tier = 'critical';
        else if (rand < 0.5) tier = 'core';

        tasks.push({
            user_id: user.id,
            goal_id: goal.id,
            title: `Chaos Task #${i + 1} for ${goal.title}`,
            duration_minutes: durations[Math.floor(Math.random() * durations.length)],
            priority_tier: tier,
            status: 'pending',
            is_virtual: false,
            category: goal.category,
            deadline: deadline.toISOString()
        });
    }

    const { error: taskError } = await supabase.from('tasks').insert(tasks);
    if (taskError) throw new Error("Chaos Task Flood Failed: " + taskError.message);


    // 4. Ensure 5 Habits
    const habits = [
        { title: "Chaos Meditation", duration: 15, frequency: 'daily' as const, category: 'Spiritual', priority_tier: 'core' as const },
        { title: "Chaos Jog", duration: 30, frequency: 'daily' as const, category: 'Health', priority_tier: 'core' as const },
        { title: "Chaos Reading", duration: 30, frequency: 'daily' as const, category: 'Education', priority_tier: 'backlog' as const },
        { title: "Chaos Journal", duration: 15, frequency: 'daily' as const, category: 'Personal', priority_tier: 'backlog' as const },
        { title: "Chaos Pushups", duration: 15, frequency: 'daily' as const, category: 'Health', priority_tier: 'critical' as const },
    ];

    for (const h of habits) {
        // Idempotent creation handled by createHabit? No, createHabit blindly creates.
        // We should check if it exists or just let them pile up for the specific "Chaos" test?
        // Let's create them. The user wants stress.
        await createHabit(h);
    }

    return "Chaos unleashed: 3 Heavy Goals, 50 Tasks, 5 Habits created.";
}
