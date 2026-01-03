'use server';

import { getAuthenticatedUser, getSupabaseClient } from '@/lib/supabase-server';

export async function submitFeedback(message: string, url: string) {
    if (!message || message.trim().length === 0) {
        throw new Error("Message cannot be empty");
    }

    const { user } = await getAuthenticatedUser();
    const supabase = await getSupabaseClient();

    const { error } = await supabase.from('feedback').insert({
        user_id: user.id,
        message: message.trim(),
        page_url: url
    });

    if (error) {
        console.error("Feedback Submission Error:", error);
        throw new Error("Failed to submit feedback");
    }

    return { success: true };
}
