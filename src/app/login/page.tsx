'use client';

import { createBrowserClient } from '@supabase/ssr'
import { useState } from 'react';
import { Loader2 } from 'lucide-react';

export default function LoginPage() {
    const [isLoading, setIsLoading] = useState(false);

    const handleLogin = async () => {
        setIsLoading(true);
        const supabase = createBrowserClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
        );

        // Redirect to callback
        await supabase.auth.signInWithOAuth({
            provider: 'google',
            options: {
                redirectTo: `${window.location.origin}/auth/callback`,
                scopes: 'https://www.googleapis.com/auth/calendar',
                queryParams: {
                    access_type: 'offline',
                    prompt: 'consent',
                },
            },
        });
    };

    return (
        <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center p-4">
            {/* Background Gradient Effect */}
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-zinc-800/50 via-black to-black -z-10 pointer-events-none" />

            <div className="w-full max-w-md space-y-8 animate-in fade-in zoom-in duration-500">

                {/* Header */}
                <div className="text-center space-y-2">
                    <h1 className="text-4xl font-bold tracking-tight bg-gradient-to-r from-white to-zinc-400 bg-clip-text text-transparent">
                        Life OS
                    </h1>
                    <p className="text-zinc-400 text-sm">
                        Focus on what matters. Automate the rest.
                    </p>
                </div>

                {/* Login Card */}
                <div className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-8 backdrop-blur-xl shadow-2xl">
                    <button
                        onClick={handleLogin}
                        disabled={isLoading}
                        className="w-full group relative flex items-center justify-center gap-3 bg-white text-black hover:bg-zinc-200 transition-all duration-300 py-3 px-4 rounded-xl font-semibold shadow-lg shadow-white/5 active:scale-95 disabled:opacity-70 disabled:pointer-events-none"
                    >
                        {isLoading ? (
                            <Loader2 className="w-5 h-5 animate-spin text-zinc-600" />
                        ) : (
                            <svg className="w-5 h-5" viewBox="0 0 24 24">
                                <path
                                    fill="currentColor"
                                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                                />
                                <path
                                    fill="currentColor"
                                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                                />
                                <path
                                    fill="currentColor"
                                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                                />
                                <path
                                    fill="currentColor"
                                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                                />
                            </svg>
                        )}
                        <span>
                            {isLoading ? 'Connecting...' : 'Sign in with Google'}
                        </span>
                    </button>

                    <div className="mt-6 text-center text-xs text-zinc-500">
                        By continuing, you agree to our Terms of Service and Privacy Policy.
                    </div>
                </div>

                {/* Footer */}
                <div className="text-center text-xs text-zinc-600">
                    &copy; {new Date().getFullYear()} Life OS. Secure & Private.
                </div>
            </div>
        </div>
    );
}
