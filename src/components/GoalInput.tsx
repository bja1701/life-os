
'use client';

import { useState } from 'react';
import { generateSubtasks, saveTasks, createGoal, PlannerSubtask } from '@/app/actions/planner';

// Strict categories as per schema
const CATEGORIES = ['Spiritual', 'Business', 'Family', 'Health', 'Education', 'Personal'];

export default function GoalInput({ onGoalAdded }: { onGoalAdded?: () => void }) {
    const [goal, setGoal] = useState('');
    const [category, setCategory] = useState('Personal');
    const [priorityTier, setPriorityTier] = useState<'critical' | 'core' | 'backlog'>('core');
    const [targetDate, setTargetDate] = useState(''); // YYYY-MM-DD
    const [isLoading, setIsLoading] = useState(false);
    const [subtasks, setSubtasks] = useState<PlannerSubtask[]>([]);
    const [estimatedTotalMinutes, setEstimatedTotalMinutes] = useState<number>(0); // New State

    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleGenerate = async () => {
        if (!goal.trim()) return;

        setIsLoading(true);
        setError(null);
        setSubtasks([]);
        setEstimatedTotalMinutes(0);

        try {
            const { tasks, estimated_total_minutes } = await generateSubtasks(goal, targetDate);
            setSubtasks(tasks);
            setEstimatedTotalMinutes(estimated_total_minutes);
        } catch (err) {
            setError('Failed to generate plan. Please try again.');
            console.error(err);
        } finally {
            setIsLoading(false);
        }
    };

    const handleSave = async () => {
        if (subtasks.length === 0) return;

        setIsSaving(true);
        try {
            // 1. Create the Goal Record first
            const newGoal = await createGoal({
                title: goal,
                category: category,
                priority_tier: priorityTier,
                description: `Created via AI Planner: ${subtasks.length} tasks generated. Total Estimate: ${estimatedTotalMinutes} mins.`,
                deadline: targetDate ? new Date(targetDate) : undefined,
                estimated_total_minutes: estimatedTotalMinutes > 0 ? estimatedTotalMinutes : undefined
            });

            if (!newGoal) throw new Error('Failed to create goal record');

            // 2. Save Tasks linked to this Goal
            await saveTasks(subtasks, newGoal.id);

            // 3. Reset and Notify
            setGoal('');
            setSubtasks([]);
            setCategory('Personal');
            setPriorityTier('core');
            setTargetDate('');
            setEstimatedTotalMinutes(0);
            if (onGoalAdded) onGoalAdded();

        } catch (err) {
            setError('Failed to save goal and tasks.');
            console.error(err);
        } finally {
            setIsSaving(false);
        }
    };

    // Allow editing of subtasks before saving
    const updateSubtask = (index: number, field: keyof PlannerSubtask, value: any) => {
        const newTasks = [...subtasks];
        newTasks[index] = { ...newTasks[index], [field]: value };
        setSubtasks(newTasks);
    };

    const removeSubtask = (index: number) => {
        const newTasks = [...subtasks];
        newTasks.splice(index, 1);
        setSubtasks(newTasks);
    };

    return (
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6 mb-8 text-gray-900">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">🎯 New Goal Planner</h2>

            {/* Input Section */}
            <div className="flex flex-col gap-3 mb-6">

                {/* Row 1: Category & Priority */}
                <div className="flex flex-wrap gap-3">
                    <select
                        value={category}
                        onChange={(e) => setCategory(e.target.value)}
                        className="rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 p-2 border bg-gray-50 text-gray-900 text-sm flex-1 min-w-[120px]"
                    >
                        {CATEGORIES.map(c => (
                            <option key={c} value={c}>{c}</option>
                        ))}
                    </select>

                    {/* Priority Tier Selector */}
                    <div className="flex bg-gray-100 p-1 rounded-md shrink-0">
                        {[
                            { id: 'critical', label: 'Critical', icon: '🔥' },
                            { id: 'core', label: 'Core', icon: '⭐' },
                            { id: 'backlog', label: 'Backlog', icon: '☕' }
                        ].map(tier => (
                            <button
                                key={tier.id}
                                onClick={() => setPriorityTier(tier.id as any)}
                                className={`px-2 py-1 text-xs font-medium rounded transition-all flex items-center gap-1 ${priorityTier === tier.id
                                    ? 'bg-white shadow-sm text-gray-900'
                                    : 'text-gray-500 hover:text-gray-700'
                                    }`}
                                title={`Set Goal Priority: ${tier.label}`}
                            >
                                <span>{tier.icon}</span>
                                <span className="hidden sm:inline">{tier.label}</span>
                            </button>
                        ))}
                    </div>
                </div>

                {/* Row 2: Date & Input */}
                <div className="flex gap-3">
                    <input
                        type="date"
                        value={targetDate}
                        onChange={(e) => setTargetDate(e.target.value)}
                        className="rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 p-2 border bg-gray-50 text-gray-900 text-sm w-auto"
                        title="Target Deadline"
                    />

                    <input
                        type="text"
                        value={goal}
                        onChange={(e) => setGoal(e.target.value)}
                        placeholder="What is your main goal?"
                        className="flex-1 rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 p-2 border text-gray-900 placeholder-gray-500 min-w-[200px]"
                        onKeyDown={(e) => e.key === 'Enter' && handleGenerate()}
                    />
                </div>

                <div className="flex justify-end">
                    <button
                        onClick={handleGenerate}
                        disabled={isLoading || !goal.trim()}
                        className={`px-4 py-2 rounded-md font-medium text-white flex items-center gap-2 ${isLoading || !goal.trim() ? 'bg-blue-300 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'
                            }`}
                    >
                        {isLoading ? (
                            <>
                                <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                </svg>
                                Thinking...
                            </>
                        ) : (
                            <>
                                ✨ Magic Breakdown
                            </>
                        )}
                    </button>
                </div>
            </div>

            {error && (
                <div className="bg-red-50 text-red-600 p-3 rounded-md mb-4 text-sm">
                    {error}
                </div>
            )}

            {/* Results Section */}
            {subtasks.length > 0 && (
                <div className="border rounded-md border-gray-200 overflow-hidden">
                    <div className="bg-gray-50 px-4 py-2 border-b border-gray-200 flex justify-between items-center text-gray-900">
                        <h3 className="font-medium text-gray-700">Proposed Plan for "{goal}"</h3>
                        <div className="flex items-center gap-2">
                            <span className="text-xs text-gray-500 font-medium uppercase tracking-wider">{priorityTier}</span>
                            <span className="text-xs text-check-500 bg-gray-100 px-2 py-1 rounded">{category}</span>
                        </div>
                    </div>

                    <div className="divide-y divide-gray-200 max-h-[400px] overflow-y-auto">
                        {subtasks.map((task, idx) => (
                            <div key={idx} className="p-4 flex gap-4 items-start bg-white text-gray-900">
                                <div className="flex-1 grid grid-cols-1 md:grid-cols-12 gap-4">

                                    {/* Title */}
                                    <div className="md:col-span-5">
                                        <label className="block text-xs text-gray-500 mb-1">Task Title</label>
                                        <input
                                            type="text"
                                            value={task.title}
                                            onChange={(e) => updateSubtask(idx, 'title', e.target.value)}
                                            className="w-full text-sm border-gray-300 rounded p-1 border text-gray-900"
                                        />
                                    </div>

                                    {/* Duration */}
                                    <div className="md:col-span-2">
                                        <label className="block text-xs text-gray-500 mb-1">Mins</label>
                                        <input
                                            type="number"
                                            value={task.duration_minutes}
                                            onChange={(e) => updateSubtask(idx, 'duration_minutes', parseInt(e.target.value) || 0)}
                                            className="w-full text-sm border-gray-300 rounded p-1 border text-gray-900"
                                        />
                                    </div>

                                    {/* Priority Tier (New) */}
                                    <div className="md:col-span-2">
                                        <label className="block text-xs text-gray-500 mb-1">Impact Tier</label>
                                        <select
                                            value={task.priority_tier || 'core'}
                                            onChange={(e) => updateSubtask(idx, 'priority_tier', e.target.value)}
                                            className="w-full text-sm border-gray-300 rounded p-1 border bg-white text-gray-900"
                                        >
                                            <option value="critical">Critical 🔥</option>
                                            <option value="core">Core ⭐</option>
                                            <option value="backlog">Backlog ☕</option>
                                        </select>
                                    </div>

                                    {/* Actions */}
                                    <div className="md:col-span-1 flex items-end justify-center pb-1">
                                        <button
                                            onClick={() => removeSubtask(idx)}
                                            className="text-gray-400 hover:text-red-500 transition-colors"
                                            title="Remove task"
                                        >
                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                                <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                                            </svg>
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>

                    <div className="bg-gray-50 px-4 py-3 border-t border-gray-200 flex justify-end gap-3 text-gray-900">
                        <button
                            onClick={() => setSubtasks([])}
                            className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleSave}
                            disabled={isSaving}
                            className={`px-4 py-2 rounded-md font-medium text-white text-sm ${isSaving ? 'bg-green-400 cursor-not-allowed' : 'bg-green-600 hover:bg-green-700'
                                }`}
                        >
                            {isSaving ? 'Saving...' : 'Confirm & Save Tasks'}
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
