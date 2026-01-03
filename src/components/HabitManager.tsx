'use client';

import { useState, useEffect } from 'react';
import { createHabit, getHabits, deleteHabit, updateHabitPriority } from '@/app/actions/habits';

// ... imports
interface Habit {
    id: string;
    title: string;
    duration_minutes: number;
    recurrence_pattern: string;
    recurrence_days?: number[];
    priority_tier?: 'critical' | 'core' | 'backlog';
    category?: string;
}

export default function HabitManager({ onHabitAdded }: { onHabitAdded?: () => void }) {
    const [habits, setHabits] = useState<Habit[]>([]);
    const [title, setTitle] = useState('');
    const [duration, setDuration] = useState(30);
    const [frequency, setFrequency] = useState<'daily' | 'weekdays' | 'weekly' | 'monthly' | 'custom'>('daily');
    const [selectedDays, setSelectedDays] = useState<number[]>([]); // 0=Sun
    const [priorityTier, setPriorityTier] = useState<'critical' | 'core' | 'backlog'>('core');
    const [category, setCategory] = useState('Personal');
    const [loading, setLoading] = useState(false);

    // Load habits on mount
    useEffect(() => {
        fetchHabits();
    }, []);

    async function fetchHabits() {
        const data = await getHabits();
        setHabits(data || []);
    }

    function toggleDay(dayInfo: number) {
        setSelectedDays(prev =>
            prev.includes(dayInfo)
                ? prev.filter(d => d !== dayInfo)
                : [...prev, dayInfo].sort()
        );
    }

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        if (!title.trim()) return;

        // Validation for Custom/Weekly
        if ((frequency === 'custom' || frequency === 'weekly') && selectedDays.length === 0) {
            // Default to today if nothing selected? Or alert?
            // Let's alert for now.
            alert('Please select at least one day for this habit.');
            return;
        }

        setLoading(true);
        try {
            await createHabit({
                title,
                duration,
                frequency,
                recurrence_days: selectedDays,
                priority_tier: priorityTier,
                category
            });
            setTitle('');
            // Reset defaults
            setFrequency('daily');
            setSelectedDays([]);
            fetchHabits();
            if (onHabitAdded) onHabitAdded();
        } catch (err: any) {
            alert(`Failed to save habit: ${err.message}`);
        } finally {
            setLoading(false);
        }
    }

    async function handleDelete(id: string) {
        if (!confirm('Stop this habit? (Past history will remain)')) return;
        await deleteHabit(id);
        fetchHabits();
    }

    async function handlePriorityToggle(habit: Habit) {
        const nextMap: Record<string, 'critical' | 'core' | 'backlog'> = {
            'critical': 'core',
            'core': 'backlog',
            'backlog': 'critical'
        };
        const current = habit.priority_tier || 'core';
        const next = nextMap[current];

        // Optimistic Update
        setHabits(prev => prev.map(h => h.id === habit.id ? { ...h, priority_tier: next } : h));

        try {
            await updateHabitPriority(habit.id, next);
        } catch (e: any) {
            alert(`Failed to update priority: ${e.message}`);
            // Revert on failure
            fetchHabits();
        }
    }

    const DAYS = [
        { id: 0, label: 'S' },
        { id: 1, label: 'M' },
        { id: 2, label: 'T' },
        { id: 3, label: 'W' },
        { id: 4, label: 'T' },
        { id: 5, label: 'F' },
        { id: 6, label: 'S' },
    ];

    return (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 flex flex-col">
            <h2 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
                <span>🔄</span> Habits
            </h2>

            {/* List of Habits - Natural Height, No Scroll */}
            <div className="mb-6 space-y-2">
                {habits.length === 0 ? (
                    <p className="text-gray-400 text-sm italic">No habits defined yet.</p>
                ) : (
                    habits.map(habit => (
                        <div key={habit.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg group">
                            <div>
                                <div className="font-medium text-gray-900 flex items-center gap-2">
                                    <button
                                        onClick={() => handlePriorityToggle(habit)}
                                        className="hover:scale-110 transition-transform cursor-pointer focus:outline-none"
                                        title="Click to change Priority"
                                    >
                                        {habit.priority_tier === 'critical' ? '🔥' :
                                            habit.priority_tier === 'core' ? '⭐' : '☕'}
                                    </button>
                                    {habit.title}
                                </div>
                                <div className="text-xs text-gray-600 font-medium uppercase tracking-wide">
                                    {habit.category || 'Personal'} • {habit.recurrence_pattern} • {habit.duration_minutes}m
                                </div>
                            </div>
                            <button
                                onClick={() => handleDelete(habit.id)}
                                className="text-gray-400 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                                ✕
                            </button>
                        </div>
                    ))
                )}
            </div>

            {/* Add New Habit Form */}
            <form onSubmit={handleSubmit} className="border-t border-gray-100 pt-4 mt-auto">
                <div className="text-xs font-bold text-gray-700 mb-3 uppercase tracking-wider">New Habit</div>
                <div className="space-y-3">
                    <input
                        type="text"
                        placeholder="e.g. Morning Jog"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 placeholder-gray-500 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                        required
                    />

                    <div className="flex gap-2">
                        <div className="relative flex-1">
                            <input
                                type="number"
                                min="1"
                                value={duration || ''}
                                onChange={(e) => {
                                    const val = parseInt(e.target.value);
                                    setDuration(isNaN(val) ? 0 : val);
                                }}
                                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                            />
                            <span className="absolute right-3 top-2 text-xs text-gray-500 font-medium pointer-events-none">min</span>
                        </div>
                    </div>

                    {/* Frequency Selection */}
                    <div className="grid grid-cols-3 sm:grid-cols-5 gap-1">
                        {[
                            { id: 'daily', label: 'Daily' },
                            { id: 'weekdays', label: 'Wkdays' },
                            { id: 'weekly', label: 'Weekly' },
                            { id: 'monthly', label: 'Mnthly' },
                            { id: 'custom', label: 'Custom' }
                        ].map(opt => (
                            <button
                                key={opt.id}
                                type="button"
                                onClick={() => setFrequency(opt.id as any)}
                                className={`py-1.5 text-[10px] font-bold uppercase tracking-wider rounded border ${frequency === opt.id
                                    ? 'bg-indigo-50 border-indigo-200 text-indigo-700'
                                    : 'bg-white border-gray-200 text-gray-500 hover:bg-gray-50'
                                    }`}
                            >
                                {opt.label}
                            </button>
                        ))}
                    </div>

                    {/* Day Selection (Visible for Custom or Weekly) */}
                    {(frequency === 'custom' || frequency === 'weekly') && (
                        <div className="flex justify-between gap-1 p-2 bg-gray-50 rounded-lg border border-gray-100">
                            {DAYS.map(day => (
                                <button
                                    key={day.id}
                                    type="button"
                                    onClick={() => toggleDay(day.id)}
                                    className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all ${selectedDays.includes(day.id)
                                        ? 'bg-indigo-600 text-white shadow-sm scale-110'
                                        : 'bg-white text-gray-400 border border-gray-200 hover:border-gray-300'
                                        }`}
                                >
                                    {day.label}
                                </button>
                            ))}
                        </div>
                    )}

                    {frequency === 'weekly' && selectedDays.length === 0 && (
                        <div className="text-[10px] text-amber-600 text-center animate-pulse">Select the day of the week</div>
                    )}

                    {/* Priority Tier Segmented Control - Fixed Grid Layout */}
                    <div className="grid grid-cols-3 gap-1 p-1 bg-gray-100 rounded-lg mb-4 relative z-10">
                        {[
                            { id: 'critical', label: 'Critical', icon: '🔥', color: 'text-red-600' },
                            { id: 'core', label: 'Core', icon: '⭐', color: 'text-blue-600' },
                            { id: 'backlog', label: 'Backlog', icon: '☕', color: 'text-gray-500' }
                        ].map(tier => (
                            <button
                                key={tier.id}
                                type="button"
                                onClick={() => setPriorityTier(tier.id as any)}
                                className={`flex items-center justify-center gap-1 py-1.5 text-xs font-medium rounded-md transition-all ${priorityTier === tier.id
                                    ? 'bg-white shadow-sm text-gray-900'
                                    : 'text-gray-500 hover:text-gray-700'
                                    }`}
                            >
                                <span className={tier.color}>{tier.icon}</span>
                                {tier.label}
                            </button>
                        ))}
                    </div>

                    {/* Category Dropdown */}
                    <select
                        value={category}
                        onChange={(e) => setCategory(e.target.value)}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white"
                    >
                        <option value="Personal">Personal</option>
                        <option value="Spiritual">Spiritual</option>
                        <option value="Business">Business</option>
                        <option value="Family">Family</option>
                        <option value="Health">Health</option>
                        <option value="Education">Education</option>
                    </select>

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-2 rounded-lg text-sm transition-colors disabled:opacity-50"
                    >
                        {loading ? 'Adding...' : 'Start Habit'}
                    </button>
                </div>
            </form>
        </div>
    );
}
