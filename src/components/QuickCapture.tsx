import { useState, useRef, useEffect } from 'react';
import { quickAdd } from '@/app/actions/planner';
import { Send, X, Loader2 } from 'lucide-react';

interface QuickCaptureProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
}

export default function QuickCapture({ isOpen, onClose, onSuccess }: QuickCaptureProps) {
    const [title, setTitle] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);

    // Auto-focus when opened
    useEffect(() => {
        if (isOpen && inputRef.current) {
            setTimeout(() => inputRef.current?.focus(), 100);
        }
    }, [isOpen]);

    const handleSubmit = async (e?: React.FormEvent) => {
        if (e) e.preventDefault();
        if (!title.trim() || isSubmitting) return;

        setIsSubmitting(true);
        try {
            await quickAdd(title);
            setTitle(''); // Clear
            onSuccess();  // Refresh parent
            onClose();    // Close drawer
        } catch (err) {
            alert("Failed to capture task. Please try again.");
        } finally {
            setIsSubmitting(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-end sm:items-center sm:justify-center pointer-events-none">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/40 backdrop-blur-sm pointer-events-auto transition-opacity"
                onClick={onClose}
            />

            {/* Drawer */}
            <div className="w-full sm:max-w-md bg-white rounded-t-2xl sm:rounded-2xl p-4 shadow-2xl transform transition-transform duration-300 ease-out pointer-events-auto pb-8 sm:pb-4 animate-in slide-in-from-bottom-10">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-sm font-bold text-zinc-400 uppercase tracking-wider">Quick Capture</h3>
                    <button onClick={onClose} className="text-zinc-400 hover:text-zinc-600">
                        <X size={20} />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="flex gap-2">
                    <input
                        ref={inputRef}
                        type="text"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        placeholder="What's on your mind?"
                        className="flex-1 bg-zinc-50 border border-zinc-200 rounded-xl px-4 py-3 text-base outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent placeholder:text-zinc-400 text-zinc-900"
                        disabled={isSubmitting}
                    />
                    <button
                        type="submit"
                        disabled={!title.trim() || isSubmitting}
                        className="bg-indigo-600 text-white p-3 rounded-xl hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shrink-0"
                    >
                        {isSubmitting ? <Loader2 className="animate-spin" size={24} /> : <Send size={24} />}
                    </button>
                </form>
            </div>
        </div>
    );
}
