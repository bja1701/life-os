import { useState, useMemo } from 'react';
import { Task } from '@/lib/scheduler';
import { Plus, Check, Clock, Calendar, LogOut } from 'lucide-react';
import { signOut } from '@/app/actions/auth';
import QuickCapture from './QuickCapture';

interface MobileDashboardProps {
    tasks: Task[];
    onComplete: (taskId: string) => void;
    onRefresh: () => void; // To reload data
}

export default function MobileDashboard({ tasks, onComplete, onRefresh }: MobileDashboardProps) {
    const [showCapture, setShowCapture] = useState(false);

    // LOGIC: Find Active Task & Up Next
    const { activeTask, upNext } = useMemo(() => {
        const now = new Date();
        const incompleteTasks = tasks.filter(t => t.status !== 'completed');

        // 1. Sort by Priority & Schedule
        const sorted = [...incompleteTasks].sort((a, b) => {
            // Critical first
            if (a.priority_tier === 'critical' && b.priority_tier !== 'critical') return -1;
            if (b.priority_tier === 'critical' && a.priority_tier !== 'critical') return 1;

            // Then by scheduled time (if exists)
            const timeA = a.scheduledStart ? new Date(a.scheduledStart).getTime() : Infinity;
            const timeB = b.scheduledStart ? new Date(b.scheduledStart).getTime() : Infinity;
            return timeA - timeB;
        });

        // 2. Determine functionality Active Task
        // Logic: If there is a scheduled task for *now* (or past due today), it wins.
        // Otherwise, top of the sorted list.
        const active = sorted.length > 0 ? sorted[0] : null;
        const next = sorted.slice(1, 4); // Take next 3

        return { activeTask: active, upNext: next };
    }, [tasks]);

    return (
        <div className="flex flex-col h-full bg-zinc-50 relative overflow-hidden">
            {/* Header */}
            <header className="px-6 pt-12 pb-6 flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold text-zinc-900 tracking-tight">Focus Mode</h1>
                    <p className="text-zinc-500 font-medium">Let's get things done.</p>
                </div>
                <button
                    onClick={() => signOut()}
                    className="p-2 text-zinc-400 hover:text-zinc-600 active:scale-95 transition-all"
                    title="Sign Out"
                >
                    <LogOut size={20} />
                </button>
            </header>

            {/* Main Content Area */}
            <main className="flex-1 px-6 pb-24 overflow-y-auto custom-scrollbar">

                {/* ACTIVE TASK CARD */}
                {activeTask ? (
                    <div className="bg-white rounded-3xl p-6 shadow-xl shadow-indigo-100/50 border border-indigo-50/50 relative overflow-hidden group">
                        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-indigo-500 to-purple-500"></div>

                        <div className="flex justify-between items-start mb-6">
                            <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${activeTask.priority_tier === 'critical' ? 'bg-rose-100 text-rose-600' : 'bg-indigo-50 text-indigo-600'
                                }`}>
                                {activeTask.priority_tier || 'Core'}
                            </span>
                            <span className="text-zinc-400 text-xs font-mono flex items-center gap-1">
                                <Clock size={12} /> {activeTask.durationMinutes}m
                            </span>
                        </div>

                        <h2 className="text-2xl font-bold text-zinc-800 leading-tight mb-8">
                            {activeTask.title}
                        </h2>

                        <button
                            onClick={() => onComplete(activeTask.id)}
                            className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 active:scale-[0.98] transition-all rounded-2xl text-white font-bold text-lg shadow-lg shadow-indigo-200 flex items-center justify-center gap-3"
                        >
                            <Check className="w-6 h-6" />
                            Mark Complete
                        </button>
                    </div>
                ) : (
                    <div className="bg-white rounded-3xl p-10 text-center shadow-sm border border-zinc-100">
                        <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-4">
                            <Check size={32} />
                        </div>
                        <h3 className="text-xl font-bold text-zinc-800">All Caught Up!</h3>
                        <p className="text-zinc-500 mt-2">Enjoy your freedom.</p>
                    </div>
                )}

                {/* UP NEXT */}
                {upNext.length > 0 && (
                    <div className="mt-8">
                        <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-widest mb-4 pl-1">Up Next</h3>
                        <div className="space-y-3">
                            {upNext.map(task => (
                                <div key={task.id} className="bg-white p-4 rounded-xl border border-zinc-100 flex justify-between items-center shadow-sm">
                                    <div className="flex items-center gap-3 overflow-hidden">
                                        <div className={`w-2 h-2 rounded-full shrink-0 ${task.priority_tier === 'critical' ? 'bg-rose-400' : 'bg-indigo-400'}`} />
                                        <span className="text-zinc-700 font-medium truncate">{task.title}</span>
                                    </div>
                                    <span className="text-[10px] text-zinc-400 font-mono shrink-0">{task.durationMinutes}m</span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

            </main>

            {/* FAB - Floating Action Button */}
            <div className="absolute bottom-6 right-6">
                <button
                    onClick={() => setShowCapture(true)}
                    className="w-14 h-14 bg-black text-white rounded-full shadow-2xl flex items-center justify-center hover:scale-105 active:scale-95 transition-transform"
                >
                    <Plus size={28} />
                </button>
            </div>

            {/* Quick Capture Drawer */}
            <QuickCapture
                isOpen={showCapture}
                onClose={() => setShowCapture(false)}
                onSuccess={onRefresh}
            />
        </div>
    );
}
