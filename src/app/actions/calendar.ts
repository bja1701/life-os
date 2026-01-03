'use server';

import { getAllCalendarEvents, CalendarConfig } from '@/lib/calendars';
import { FixedEvent } from '@/lib/scheduler';
import { getAuthenticatedUser, getSupabaseClient } from '@/lib/supabase-server';

/**
 * Server action to fetch calendar events
 * This runs on the server and has access to environment variables
 */
export async function fetchCalendarEvents(
  startDate: string,
  endDate: string
): Promise<FixedEvent[]> {
  const start = new Date(startDate);
  const end = new Date(endDate);

  // 1. Get User Session for Token
  const supabase = await getSupabaseClient();
  const { data: { session } } = await supabase.auth.getSession();

  const providerToken = session?.provider_token;

  // Note: If no provider_token (e.g. Email login), this will fall back to Env Vars if defined (legacy/admin mode)
  // or return empty if refactored logic in lib/calendars requires it.

  const config: CalendarConfig = {
    googleCalendarId: 'primary', // Dynamic? For now primary is good for per-user.
    byuIcalUrl: process.env.BYU_ICAL_URL,
    accessToken: providerToken || undefined,
  };

  try {
    const events = await getAllCalendarEvents(start, end, config);

    // Serialize dates for client transport
    return events.map(event => ({
      ...event,
      start: new Date(event.start),
      end: new Date(event.end),
    }));
  } catch (error) {
    console.error('Error in fetchCalendarEvents:', error);
    return [];
  }
}
