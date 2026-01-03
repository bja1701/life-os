'use server'

import { getSupabaseClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'

export async function signOut() {
    const supabase = await getSupabaseClient()
    await supabase.auth.signOut()
    redirect('/login')
}
