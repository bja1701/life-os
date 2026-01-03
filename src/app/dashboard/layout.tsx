import { getSupabaseClient } from '@/lib/supabase-server';
import { redirect } from 'next/navigation';

export default async function DashboardLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const supabase = await getSupabaseClient();

    // Check if user is authenticated
    const { data: { user }, error } = await supabase.auth.getUser();

    if (error || !user) {
        redirect('/login');
    }

    return (
        <div className="min-h-screen bg-zinc-50">
            {children}
        </div>
    );
}
