'use server';

import { GoogleGenerativeAI } from '@google/generative-ai';
import { getAuthenticatedUser, getSupabaseClient } from '@/lib/supabase-server';

// ... (Subtask Interfaces) ...
export interface PlannerSubtask {
    title: string;
    duration_minutes: number;
    priority: 'High' | 'Medium' | 'Low';
    priority_tier: 'critical' | 'core' | 'backlog';
}

export interface GoalWithProgress {
    id: string;
    title: string;
    category: string;
    deadline: string | null;
    totalTasks: number;
    completedTasks: number;
    progress: number;
    priority_tier?: 'critical' | 'core' | 'backlog';
}

function getGeminiModel() {
    const apiKey = process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY;
    if (!apiKey) {
        throw new Error('Gemini API key not found in environment variables');
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    return genAI.getGenerativeModel({
        model: 'gemini-2.5-flash',
        generationConfig: {
            responseMimeType: 'application/json'
        }
    });
}

/**
 * Generate actionable subtasks from a high-level goal using Gemini
 */
export async function generateSubtasks(goal: string, deadline?: string): Promise<{ tasks: PlannerSubtask[]; estimated_total_minutes: number }> {
    // ... (Gemini Logic Unchanged) ...
    const model = getGeminiModel();

    let deadlineContext = "";
    if (deadline) {
        const days = Math.ceil((new Date(deadline).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
        deadlineContext = `The deadline is ${deadline} (${days} days from now). Plan accordingly.`;
    }

    const prompt = `
        You are an expert Agile Project Planner.
        Decompose the User's Goal into atomic, schedulable tasks.
        
        ${deadlineContext}
        Goal: "${goal}"

        Output JSON Format:
        {
            "tasks": [{ "title": "Task", "duration_minutes": 45, "priority": "High", "priority_tier": "core" }],
            "estimated_total_minutes": 1000
        }
        Return ONLY valid JSON.
    `;

    try {
        const result = await model.generateContent(prompt);
        const response = await result.response;
        const text = response.text();
        const jsonStr = text.replace(/```json/g, '').replace(/```/g, '').trim();
        const data = JSON.parse(jsonStr);

        return {
            tasks: data.tasks || [],
            estimated_total_minutes: data.estimated_total_minutes || 0
        };
    } catch (error) {
        console.error('Gemini Planning Error:', error);
        throw new Error('Failed to generate subtasks');
    }
}

/**
 * Save tasks to Supabase
 */
export async function saveTasks(tasks: PlannerSubtask[], goalId?: string) {
    const supabase = await getSupabaseClient();
    const { user } = await getAuthenticatedUser();

    const mappedTasks = tasks.map(t => ({
        user_id: user.id,
        goal_id: goalId || null,
        title: t.title,
        duration_minutes: t.duration_minutes,
        priority_tier: t.priority_tier || 'core',
        status: 'pending',
        is_virtual: true,
        can_split: t.duration_minutes > 60
    }));

    const { data, error } = await supabase
        .from('tasks')
        .insert(mappedTasks)
        .select();

    if (error) {
        console.error('Supabase Save Error:', error);
        throw new Error(`Failed to save tasks: ${error.message}`);
    }

    return data;
}

/**
 * Create a new Goal
 */
export async function createGoal(goal: {
    title: string;
    category: string;
    description?: string;
    deadline?: Date;
    priority_tier?: 'critical' | 'core' | 'backlog';
    estimated_total_minutes?: number;
}) {
    const supabase = await getSupabaseClient();
    const { user } = await getAuthenticatedUser();

    const { data, error } = await supabase
        .from('goals')
        .insert({
            user_id: user.id,
            title: goal.title,
            category: goal.category,
            priority_tier: goal.priority_tier || 'core',
            description: goal.description,
            deadline: goal.deadline ? goal.deadline.toISOString() : new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(),
            estimated_total_minutes: goal.estimated_total_minutes || null
        })
        .select()
        .single();

    if (error) {
        console.error('Create Goal Error:', error);
        throw new Error(`Failed to create goal: ${error.message}`);
    }

    return data;
}

/**
 * Fetch all active goals with efficiency progress stats
 */
export async function getGoals(): Promise<GoalWithProgress[]> {
    const supabase = await getSupabaseClient();
    const { user } = await getAuthenticatedUser();

    const { data, error } = await supabase
        .from('goals')
        .select(`
            id, title, category, deadline, priority_tier, estimated_total_minutes,
            tasks (status, duration_minutes)
        `)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

    if (error) {
        console.error('Get Goals Error:', error);
        return [];
    }

    // Transform and calculate progress in-memory
    return data.map((g: any) => {
        const totalEstimate = g.estimated_total_minutes || 0;
        const assignedMinutes = g.tasks ? g.tasks.reduce((sum: number, t: any) => sum + (t.duration_minutes || 0), 0) : 0;
        const completedMinutes = g.tasks ? g.tasks.filter((t: any) => t.status === 'completed').reduce((sum: number, t: any) => sum + (t.duration_minutes || 0), 0) : 0;
        const totalScope = totalEstimate > 0 ? totalEstimate : assignedMinutes;
        const progress = totalScope === 0 ? 0 : Math.min(100, Math.round((completedMinutes / totalScope) * 100));

        return {
            id: g.id,
            title: g.title,
            category: g.category,
            deadline: g.deadline,
            totalTasks: g.tasks ? g.tasks.length : 0,
            completedTasks: g.tasks ? g.tasks.filter((t: any) => t.status === 'completed').length : 0,
            progress,
            priority_tier: g.priority_tier
        };
    });
}

/**
 * Get context for Weekly Review AI
 */
export async function getWeeklyReviewContext(): Promise<string> {
    const goals = await getGoals();
    if (goals.length === 0) return "No active goals found.";

    let summary = "CURRENT GOALS STATUS:\n";
    for (const g of goals) {
        summary += `- [${g.category}] ${g.title}: ${g.progress}% complete. Due: ${g.deadline || 'N/A'}\n`;
    }
    return summary;
}

/**
 * Generate a Weekly Plan based on all active goals
 */
export async function generateWeeklyTasks() {
    console.log("--> Starting generateWeeklyTasks...");
    const goals = await getGoals();
    const activeGoals = goals.filter(g => g.progress < 100);

    if (activeGoals.length === 0) {
        throw new Error("No active goals found. Create a goal first!");
    }

    const model = getGeminiModel();
    const goalsContext = activeGoals.map(g =>
        `- Goal: "${g.title}" (${g.category}). Progress: ${g.progress}%. Deadline: ${g.deadline || 'None'}`
    ).join("\n");

    const prompt = `
        You are an expert Agile Project Manager. Review these User Goals.
        Create 10-15 atomic tasks for THIS WEEK to move these goals forward.
        Constraints: Max 90 mins per task.
        User's Goals:
        ${goalsContext}
        
        Output JSON: [{ "goal_title": "Goal Name", "title": "Task", "duration_minutes": 60, "priority_tier": "core" }]
    `;

    try {
        const result = await model.generateContent(prompt);
        const text = result.response.text();
        const jsonStr = text.replace(/```json/g, '').replace(/```/g, '').trim();
        const generatedTasks = JSON.parse(jsonStr);

        if (!Array.isArray(generatedTasks)) throw new Error("Invalid AI response");

        const goalMap = new Map(activeGoals.map(g => [g.title, g.id]));

        const supabase = await getSupabaseClient();
        const { user } = await getAuthenticatedUser();

        // End of Week Calculation
        const now = new Date();
        const daysUntilSunday = 7 - now.getDay();
        const endOfWeek = new Date(now);
        endOfWeek.setDate(now.getDate() + daysUntilSunday);
        endOfWeek.setHours(23, 59, 59, 999);

        const dbRows = generatedTasks.map((t: any) => ({
            user_id: user.id,
            goal_id: goalMap.get(t.goal_title) || null,
            title: t.title,
            duration_minutes: t.duration_minutes,
            priority_tier: t.priority_tier || 'core',
            status: 'pending',
            is_virtual: false,
            can_split: t.duration_minutes > 60,
            deadline: endOfWeek.toISOString()
        }));

        const { data, error } = await supabase.from('tasks').insert(dbRows).select();

        if (error) throw error;
        return data;

    } catch (error: any) {
        console.error("Weekly Planning Error:", error);
        throw new Error("Failed to generate weekly plan.");
    }
}

/**
 * Fetch all tasks for the current user (Secure RLS)
 */
export async function getTasks() {
    const supabase = await getSupabaseClient();
    const { user } = await getAuthenticatedUser();

    console.log("--> getTasks: Fetching tasks for user:", user.id);

    const { data, error } = await supabase
        .from('tasks')
        .select('*')
        .eq('user_id', user.id)
        .in('status', ['pending', 'scheduled', 'completed'])
        .eq('is_recurring', false)
        .order('deadline', { ascending: true });

    if (error) {
        console.error("--> getTasks Error:", error);
        throw new Error(`Failed to fetch tasks: ${error.message}`);
    }

    return data || [];
}

/**
 * Update Task Status
 */
export async function updateTaskStatus(taskId: string, status: 'completed' | 'pending') {
    const supabase = await getSupabaseClient();
    await getAuthenticatedUser(); // Verify Auth

    const { error } = await supabase
        .from('tasks')
        .update({ status: status })
        .eq('id', taskId);

    if (error) {
        console.error("Update Task Status Error:", error);
        throw new Error("Failed to update task status");
    }
}

/**
 * Get Overdue Tasks
 */
export async function getOverdueTasks() {
    const supabase = await getSupabaseClient();
    const { user } = await getAuthenticatedUser();
    const now = new Date().toISOString();

    const { data, error } = await supabase
        .from('tasks')
        .select('*')
        .eq('user_id', user.id)
        .neq('status', 'completed')
        .lt('deadline', now);

    if (error) {
        console.error("Get Overdue Tasks Error:", error);
        throw new Error("Failed to fetch overdue tasks");
    }

    return data || [];
}

/**
 * Reschedule tasks
 */
export async function rescheduleTasks(taskIds: string[], newDate: Date, isFixedTime: boolean = false) {
    const supabase = await getSupabaseClient();
    await getAuthenticatedUser();

    const dateObj = new Date(newDate);
    const endOfDay = new Date(dateObj);
    endOfDay.setHours(23, 59, 59, 999);

    const updates: any = {
        deadline: endOfDay.toISOString(),
        status: 'pending',
        scheduled_start_time: isFixedTime ? dateObj.toISOString() : null
    };

    const { error } = await supabase
        .from('tasks')
        .update(updates)
        .in('id', taskIds);

    if (error) {
        console.error("Reschedule Tasks Error:", error);
        throw new Error("Failed to reschedule tasks");
    }
}

/**
 * Update Goal Priority
 */
export async function updateGoalPriority(goalId: string, priority: 'critical' | 'core' | 'backlog') {
    const supabase = await getSupabaseClient();
    await getAuthenticatedUser();

    // 1. Update the Goal
    const { error: goalError } = await supabase
        .from('goals')
        .update({ priority_tier: priority })
        .eq('id', goalId);

    if (goalError) throw new Error("Failed to update goal priority");

    // 2. Cascade to linked tasks
    const { error: taskError } = await supabase
        .from('tasks')
        .update({ priority_tier: priority })
        .eq('goal_id', goalId)
        .eq('status', 'pending');

    if (taskError) console.warn("Failed to update linked tasks");
}

/**
 * Delete a Goal
 */
export async function deleteGoal(goalId: string) {
    const supabase = await getSupabaseClient();
    await getAuthenticatedUser();

    const { error } = await supabase
        .from('goals')
        .delete()
        .eq('id', goalId);

    if (error) throw new Error("Failed to delete goal");
}

// ============================================
// QUICK CAPTURE (Mobile)
// ============================================

export async function quickAdd(title: string) {
    const supabase = await getSupabaseClient();
    const { user } = await getAuthenticatedUser();

    if (!title.trim()) throw new Error("Title is required");

    const { data, error } = await supabase
        .from('tasks')
        .insert({
            user_id: user.id,
            title: title.trim(),
            duration_minutes: 15,
            priority_tier: 'backlog',
            status: 'pending',
            is_valid: true,
            can_split: false,
            is_assignment: false,
            is_virtual: false
        })
        .select()
        .single();

    if (error) {
        console.error("Quick Add Error:", error);
        throw new Error("Failed to capture task");
    }

    return data;
}
