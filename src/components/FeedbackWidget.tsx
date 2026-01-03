'use client';

import { useState } from 'react';
import { MessageSquare, X, Send, Loader2 } from 'lucide-react';
import { submitFeedback } from '@/app/actions/feedback';
import { usePathname } from 'next/navigation';

export default function FeedbackWidget() {
    const [isOpen, setIsOpen] = useState(false);
    const [message, setMessage] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isSuccess, setIsSuccess] = useState(false);
    const pathname = usePathname();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!message.trim()) return;

        setIsSubmitting(true);
        try {
            await submitFeedback(message, pathname);
            setIsSuccess(true);
            setMessage('');
            setTimeout(() => {
                setIsOpen(false);
                setIsSuccess(false);
            }, 2000);
        } catch (error) {
            console.error(error);
            alert("Something went wrong. Please try again.");
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="fixed bottom-6 left-6 md:left-auto md:right-6 z-50">
            {/* Popover Form */}
            {isOpen && (
                <div className="absolute bottom-16 left-0 md:left-auto md:right-0 w-72 bg-white rounded-2xl shadow-2xl border border-zinc-200 p-4 mb-2 animate-in slide-in-from-bottom-5 zoom-in-95 origin-bottom-left md:origin-bottom-right">
                    <div className="flex justify-between items-center mb-3">
                        <h3 className="font-bold text-sm text-zinc-800">Feedback</h3>
                        <button
                            onClick={() => setIsOpen(false)}
                            className="text-zinc-400 hover:text-zinc-600 transition-colors"
                        >
                            <X size={16} />
                        </button>
                    </div>

                    {isSuccess ? (
                        <div className="py-8 text-center text-green-600 flex flex-col items-center gap-2 animate-in fade-in">
                            <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                                <Send size={20} />
                            </div>
                            <span className="font-medium text-sm">Thanks for your help!</span>
                        </div>
                    ) : (
                        <form onSubmit={handleSubmit}>
                            <textarea
                                className="w-full bg-zinc-50 border border-zinc-200 rounded-xl p-3 text-sm focus:ring-2 focus:ring-indigo-500 outline-none resize-none mb-3 text-zinc-800 placeholder:text-zinc-400"
                                rows={4}
                                placeholder="Report a bug or share an idea..."
                                value={message}
                                onChange={(e) => setMessage(e.target.value)}
                                disabled={isSubmitting}
                                autoFocus
                            />
                            <button
                                type="submit"
                                disabled={isSubmitting || !message.trim()}
                                className="w-full bg-zinc-900 text-white rounded-xl py-2 text-sm font-medium hover:bg-black transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                            >
                                {isSubmitting ? <Loader2 size={16} className="animate-spin" /> : 'Send Feedback'}
                            </button>
                        </form>
                    )}
                </div>
            )}

            {/* FAB Trigger */}
            <button
                onClick={() => setIsOpen(!isOpen)}
                className={`w-12 h-12 rounded-full shadow-xl flex items-center justify-center transition-all duration-300 hover:scale-105 active:scale-95 ${isOpen ? 'bg-zinc-200 text-zinc-600 rotate-90' : 'bg-white text-zinc-900 hover:bg-zinc-50 border border-zinc-100'
                    }`}
                aria-label="Send Feedback"
            >
                {isOpen ? <X size={20} /> : <MessageSquare size={20} />}
            </button>
        </div>
    );
}
