'use client';

import { useEffect, useState } from 'react';
// ... (previous imports)
import { getGoals, GoalWithProgress, updateGoalPriority, deleteGoal } from '@/app/actions/planner'; // Updated import

// ... (props)

interface GoalListProps {
    onRefreshRequest?: number; // Simple counter to trigger refetch
}

export default function GoalList({ onRefreshRequest }: GoalListProps) {
    const [goals, setGoals] = useState<GoalWithProgress[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadGoals();
    }, [onRefreshRequest]);

    async function loadGoals() {
        setLoading(true);
        try {
            const data = await getGoals();
            setGoals(data);
        } catch (error) {
            console.error('Failed to load goals', error);
        } finally {
            setLoading(false);
        }
    }

    async function handlePriorityToggle(goal: GoalWithProgress) {
        const nextMap: Record<string, 'critical' | 'core' | 'backlog'> = {
            'critical': 'core',
            'core': 'backlog',
            'backlog': 'critical'
        };
        const current = goal.priority_tier || 'core';
        const next = nextMap[current];

        // Optimistic Update
        setGoals(prev => prev.map(g => g.id === goal.id ? { ...g, priority_tier: next } : g));

        try {
            await updateGoalPriority(goal.id, next);
        } catch (e: any) {
            alert(`Failed to update priorty: ${e.message}`);
            // Revert
            loadGoals();
        }
    }

    async function handleDelete(goal: GoalWithProgress) {
        if (!confirm(`Delete "${goal.title}" and all its tasks?`)) return;

        // Optimistic remove
        setGoals(prev => prev.filter(g => g.id !== goal.id));

        try {
            await deleteGoal(goal.id);
        } catch (e: any) {
            alert(`Failed to delete goal: ${e.message}`);
            loadGoals(); // Revert
        }
    }

    if (loading && goals.length === 0) {
        return <div className="text-gray-500 text-sm animate-pulse">Loading goals...</div>;
    }

    if (goals.length === 0) {
        return (
            <div className="bg-white rounded-xl border border-zinc-200 p-8 text-center shadow-sm">
                <div className="text-4xl mb-3 grayscale opacity-80">🌱</div>
                <h3 className="text-base font-semibold text-zinc-900">Start your first goal</h3>
                <p className="text-zinc-500 text-sm mt-1 mb-4 max-w-xs mx-auto">
                    Define what matters most. Track progress, auto-schedule tasks, and build momentum.
                </p>
            </div>
        );
    }

    return (
        <div className="space-y-3 pb-8">
            {goals.map((goal) => (
                <div key={goal.id} className="bg-white rounded-xl border border-zinc-200 shadow-sm p-4 hover:shadow-md hover:border-zinc-300 transition-all group relative">
                    <button
                        onClick={(e) => { e.stopPropagation(); handleDelete(goal); }}
                        className="absolute top-2 right-2 text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity p-1"
                        title="Delete Goal"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                            <path fillRule="evenodd" d="M8.75 1A2.75 2.75 0 006 3.75v.443c-.795.077-1.584.176-2.365.298a.75.75 0 10.23 1.482l.149-.022.841 10.518A2.75 2.75 0 007.596 19h4.807a2.75 2.75 0 002.742-2.53l.841-10.52.149.023a.75.75 0 00.23-1.482A41.03 41.03 0 0014 4.193V3.75A2.75 2.75 0 0011.25 1h-2.5zM10 4c.84 0 1.673.025 2.5.075V3.75c0-.69-.56-1.25-1.25-1.25h-2.5c-.69 0-1.25.56-1.25 1.25v.325C8.327 4.025 9.16 4 10 4zM8.58 7.72a.75.75 0 00-1.5.06l.3 7.5a.75.75 0 101.5-.06l-.3-7.5zm4.34.06a.75.75 0 10-1.5-.06l-.3 7.5a.75.75 0 101.5.06l.3-7.5z" clipRule="evenodd" />
                        </svg>
                    </button>

                    <div className="flex justify-between items-start mb-2 pr-6">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] uppercase font-bold tracking-wider border
                 ${getCategoryColor(goal.category)}`}>
                            {goal.category}
                        </span>

                        <button
                            onClick={() => handlePriorityToggle(goal)}
                            className="mr-2 focus:outline-none hover:scale-110 transition-transform"
                            title="Click to toggle Priority"
                        >
                            {goal.priority_tier === 'critical' ? '🔥' :
                                goal.priority_tier === 'backlog' ? '☕' : '⭐'}
                        </button>

                        {goal.deadline && (
                            <span className="text-[10px] font-medium text-zinc-400 bg-zinc-50 px-2 py-0.5 rounded-md">
                                {new Date(goal.deadline).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                            </span>
                        )}
                    </div>

                    <h3 className="text-zinc-900 font-semibold text-sm mb-3 line-clamp-2">
                        {goal.title}
                    </h3>

                    <div className="space-y-1.5">
                        <div className="flex justify-between text-[10px] font-medium text-zinc-500">
                            <span className="uppercase tracking-wider">Progress</span>
                            <span className="text-zinc-900">{goal.progress}%</span>
                        </div>
                        <div className="w-full bg-zinc-100 rounded-full h-1.5 overflow-hidden">
                            <div
                                className={`h-1.5 rounded-full transition-all duration-500 ${goal.progress > 80 ? 'bg-emerald-500' : 'bg-blue-600'
                                    }`}
                                style={{ width: `${goal.progress}%` }}
                            ></div>
                        </div>
                        <div className="text-[10px] text-zinc-400 text-right">
                            {goal.completedTasks} / {goal.totalTasks} Done
                        </div>
                    </div>
                </div>
            ))}
        </div>
    );
}

function getCategoryColor(category: string) {
    switch (category) {
        case 'Spiritual': return 'bg-purple-50 text-purple-700 border-purple-100';
        case 'Business': return 'bg-blue-50 text-blue-700 border-blue-100';
        case 'Family': return 'bg-emerald-50 text-emerald-700 border-emerald-100';
        case 'Health': return 'bg-rose-50 text-rose-700 border-rose-100';
        case 'Education': return 'bg-amber-50 text-amber-700 border-amber-100';
        default: return 'bg-zinc-50 text-zinc-600 border-zinc-200';
    }
}
