'use client';

import { useState, useEffect } from 'react';
import { getWeeklyAnalytics, WeeklyAnalytics } from '@/app/actions/analytics';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { Activity, Target, CheckCircle, ArrowRight } from 'lucide-react';

interface WeeklyReviewProps {
    onClose: () => void;
}

export default function WeeklyReview({ onClose }: WeeklyReviewProps) {
    const [data, setData] = useState<WeeklyAnalytics | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function load() {
            try {
                const result = await getWeeklyAnalytics();
                setData(result);
            } catch (e) {
                console.error(e);
            } finally {
                setLoading(false);
            }
        }
        load();
    }, []);

    if (loading) {
        return (
            <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[70] flex items-center justify-center p-4 text-white">
                <div className="animate-pulse">Calculing Performance...</div>
            </div>
        );
    }

    if (!data) return null;

    const { metrics, breakdown } = data;

    // Determine color for Velocity Score
    const velocityColor = metrics.velocityScore >= 0.8 ? 'text-green-600' : metrics.velocityScore >= 0.5 ? 'text-amber-600' : 'text-rose-600';

    return (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[70] flex items-center justify-center p-4 animate-in fade-in duration-200" onClick={onClose}>
            <div
                className="bg-white w-full max-w-4xl rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
                onClick={e => e.stopPropagation()}
            >
                {/* Header */}
                <div className="px-8 py-6 border-b border-zinc-100 flex justify-between items-center bg-zinc-50/50">
                    <div>
                        <h2 className="text-xl font-bold text-zinc-900">Weekly System Review</h2>
                        <p className="text-xs text-zinc-500 font-medium mt-1 uppercase tracking-wide">
                            {data.startDate} — {data.endDate}
                        </p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-zinc-100 rounded-full text-zinc-400 hover:text-zinc-600 transition-colors">
                        ✕
                    </button>
                </div>

                <div className="p-8 overflow-y-auto custom-scrollbar flex-1 space-y-8">

                    {/* 1. Scoreboard */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

                        {/* Metric 1: Velocity */}
                        <div className="p-6 rounded-2xl bg-zinc-50 border border-zinc-100 flex flex-col items-center text-center">
                            <div className="mb-3 p-3 bg-white rounded-full shadow-sm text-indigo-600 border border-zinc-100">
                                <Activity size={24} />
                            </div>
                            <div className="text-sm font-bold text-zinc-400 uppercase tracking-wider mb-1">Velocity Score</div>
                            <div className={`text-3xl font-black ${velocityColor}`}>
                                {(metrics.velocityScore * 100).toFixed(0)}
                                <span className="text-sm font-medium text-zinc-400 ml-1">/ 100</span>
                            </div>
                            <p className="text-xs text-zinc-500 mt-2 max-w-[200px]">
                                You complete {Math.round(metrics.velocityScore * 100)}% of the work you schedule.
                            </p>
                        </div>

                        {/* Metric 2: Deep Work */}
                        <div className="p-6 rounded-2xl bg-zinc-50 border border-zinc-100 flex flex-col items-center text-center">
                            <div className="mb-3 p-3 bg-white rounded-full shadow-sm text-rose-500 border border-zinc-100">
                                <Target size={24} />
                            </div>
                            <div className="text-sm font-bold text-zinc-400 uppercase tracking-wider mb-1">Deep Work Ratio</div>
                            <div className="text-3xl font-black text-zinc-800">
                                {(metrics.deepWorkRatio * 100).toFixed(0)}%
                            </div>
                            <p className="text-xs text-zinc-500 mt-2 max-w-[200px]">
                                Time spent on <span className="text-rose-600 font-semibold">Critical</span> tasks vs total.
                            </p>
                        </div>

                        {/* Metric 3: Completion */}
                        <div className="p-6 rounded-2xl bg-zinc-50 border border-zinc-100 flex flex-col items-center text-center">
                            <div className="mb-3 p-3 bg-white rounded-full shadow-sm text-emerald-500 border border-zinc-100">
                                <CheckCircle size={24} />
                            </div>
                            <div className="text-sm font-bold text-zinc-400 uppercase tracking-wider mb-1">Task Completion</div>
                            <div className="text-3xl font-black text-zinc-800">
                                {(metrics.completionRate * 100).toFixed(0)}%
                            </div>
                            <p className="text-xs text-zinc-500 mt-2 max-w-[200px]">
                                Percentage of individual tasks fully checked off.
                            </p>
                        </div>

                    </div>

                    {/* 2. The Truth Chart (Bar Graph) */}
                    <div className="h-80 w-full bg-white rounded-2xl border border-zinc-100 p-6 shadow-sm">
                        <h3 className="text-sm font-bold text-zinc-400 uppercase tracking-widest mb-6 block">Planned vs Actual (Hours)</h3>
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={breakdown} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                                <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#71717a' }} dy={10} />
                                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#71717a' }} />
                                <Tooltip
                                    cursor={{ fill: '#f4f4f5' }}
                                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                />
                                <Legend iconType="circle" wrapperStyle={{ paddingTop: '20px' }} />
                                <Bar dataKey="plannedHours" name="Planned" fill="#e4e4e7" radius={[4, 4, 0, 0]} barSize={30} />
                                <Bar dataKey="actualHours" name="Actual" fill="#4f46e5" radius={[4, 4, 0, 0]} barSize={30} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>

                    {/* 3. Cleanup Action */}
                    <div className="flex items-center justify-between p-6 bg-indigo-50/50 border border-indigo-100 rounded-2xl">
                        <div>
                            <h4 className="font-bold text-indigo-900">Ready for next week?</h4>
                            <p className="text-sm text-indigo-700/80 mt-1">
                                Archive this week's data and reset your velocity tracking.
                            </p>
                        </div>
                        <button className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-semibold shadow-sm shadow-indigo-200 transition-all flex items-center gap-2 active:scale-95">
                            <span>Start New Week</span>
                            <ArrowRight size={16} />
                        </button>
                    </div>

                </div>
            </div>
        </div>
    );
}
