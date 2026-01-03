/**
 * Calendar Integration Library
 * 
 * Provides functions to fetch events from:
 * - Google Calendar API (via Service Account OR OAuth2)
 * - BYU Learning Suite iCal feeds
 * 
 * Maps external events to our FixedEvent interface for the scheduler.
 */

import { google } from 'googleapis';
import * as ical from 'node-ical';
import { FixedEvent, ContextTag, ScheduledBlock } from './scheduler';

// ============================================
// GOOGLE CALENDAR INTEGRATION
// ============================================

/**
 * Get Google Calendar auth client for READ operations
 * Supports both Service Account and OAuth2 (Client ID/Secret) authentication
 */
function getGoogleAuthClient(accessToken?: string) {
  try {
    // Method 0: User OAuth Token (Multi-Tenancy)
    if (accessToken) {
      const oauth2Client = new google.auth.OAuth2();
      oauth2Client.setCredentials({ access_token: accessToken });
      return oauth2Client;
    }

    // Method 1: Service Account (for server-to-server)
    const serviceAccountJson = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
    if (serviceAccountJson && !serviceAccountJson.includes('your-project')) {
      const credentials = JSON.parse(serviceAccountJson);
      return new google.auth.GoogleAuth({
        credentials,
        scopes: ['https://www.googleapis.com/auth/calendar.readonly'],
      });
    }

    // Method 2: OAuth2 (Client ID/Secret with Refresh Token)
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    const refreshToken = process.env.GOOGLE_REFRESH_TOKEN;

    if (clientId && clientSecret && refreshToken) {
      const oauth2Client = new google.auth.OAuth2(
        clientId,
        clientSecret,
        'http://localhost:3000/api/auth/callback/google' // Redirect URI
      );

      oauth2Client.setCredentials({
        refresh_token: refreshToken,
      });

      return oauth2Client;
    }

    console.warn('Google Calendar: No valid credentials found');
    return null;
  } catch (error) {
    console.error('Error initializing Google Auth:', error);
    return null;
  }
}

/**
 * Get Google Calendar auth client for WRITE operations
 * Uses OAuth2 with calendar write scope
 */
function getGoogleWriteAuthClient(accessToken?: string) {
  try {
    // Method 0: User OAuth Token
    if (accessToken) {
      const oauth2Client = new google.auth.OAuth2();
      oauth2Client.setCredentials({ access_token: accessToken });
      return oauth2Client;
    }

    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    const refreshToken = process.env.GOOGLE_REFRESH_TOKEN;

    if (!clientId || !clientSecret || !refreshToken) {
      throw new Error('Missing Google OAuth2 credentials for write operations');
    }

    const oauth2Client = new google.auth.OAuth2(
      clientId,
      clientSecret,
      'http://localhost:3000/api/auth/callback/google'
    );

    oauth2Client.setCredentials({
      refresh_token: refreshToken,
    });

    return oauth2Client;
  } catch (error) {
    console.error('Error initializing Google Write Auth:', error);
    throw error;
  }
}

/**
 * Infer context tags from event title and location
 */
function inferContextTags(title: string, location?: string): ContextTag[] {
  const tags: ContextTag[] = [];
  const titleLower = title.toLowerCase();
  const locationLower = location?.toLowerCase() || '';

  // Campus detection
  if (
    locationLower.includes('byu') ||
    locationLower.includes('campus') ||
    locationLower.includes('talmage') ||
    locationLower.includes('marb') ||
    locationLower.includes('jfsb') ||
    locationLower.includes('eb') ||
    titleLower.includes('cs ') ||
    titleLower.includes('class') ||
    titleLower.includes('lecture')
  ) {
    tags.push('#campus');
  }

  // Home detection
  if (
    locationLower.includes('home') ||
    titleLower.includes('family') ||
    titleLower.includes('dinner')
  ) {
    tags.push('#home');
  }

  // If no specific location detected, mark as anywhere
  if (tags.length === 0) {
    tags.push('#anywhere');
  }

  return tags;
}

/**
 * Fetch events from Google Calendar
 * 
 * @param start - Start of the date range
 * @param end - End of the date range
 * @param calendarId - Calendar ID (defaults to 'primary')
 * @returns Array of FixedEvent objects
 */
export async function getGoogleCalendarEvents(
  start: Date,
  end: Date,
  calendarId: string = 'primary',
  accessToken?: string
): Promise<FixedEvent[]> {
  try {
    const auth = getGoogleAuthClient(accessToken);

    if (!auth) {
      console.warn('Google Calendar: Auth not available, returning empty array');
      return [];
    }

    const calendar = google.calendar({ version: 'v3', auth });

    const response = await calendar.events.list({
      calendarId,
      timeMin: start.toISOString(),
      timeMax: end.toISOString(),
      singleEvents: true,
      orderBy: 'startTime',
    });

    const events = response.data.items || [];

    // Fix missing export in scheduler.ts (done via view_file check if needed, but assuming here calls.ts needs fix) 
    // Actually I need to fix calendars.ts import. 
    // For now, let's fix the null checks.

    return events
      .filter((event) => event.start?.dateTime && event.end?.dateTime)
      .map((event): FixedEvent => ({
        id: event.id || `gcal-${Date.now()}-${Math.random()}`,
        title: event.summary || 'Untitled Event',
        start: new Date(event.start!.dateTime!),
        end: new Date(event.end!.dateTime!),
        location: event.location || undefined, // Fix null -> undefined
        contextTags: inferContextTags(event.summary || '', event.location || undefined), // Fix null -> undefined
      }));
  } catch (error) {
    console.error('Error fetching Google Calendar events:', error);
    return [];
  }
}

// ============================================
// BYU ICAL FEED INTEGRATION
// ============================================

/**
 * Fetch and parse events from a BYU Learning Suite iCal feed
 * 
 * @param icalUrl - URL of the iCal feed
 * @param start - Start of the date range (optional filter)
 * @param end - End of the date range (optional filter)
 * @returns Array of FixedEvent objects
 */
export async function getByuClasses(
  icalUrl: string,
  start?: Date,
  end?: Date
): Promise<FixedEvent[]> {
  try {
    if (!icalUrl) {
      console.warn('BYU iCal: No URL provided, returning empty array');
      return [];
    }

    // Fetch and parse the iCal feed
    const events = await ical.async.fromURL(icalUrl);

    const fixedEvents: FixedEvent[] = [];

    for (const key in events) {
      const event = events[key];

      // Only process VEVENT types
      if (event.type !== 'VEVENT') continue;

      const eventStart = event.start ? new Date(event.start) : null;
      const eventEnd = event.end ? new Date(event.end) : null;

      if (!eventStart || !eventEnd) continue;

      // Filter by date range if provided
      if (start && eventStart < start) continue;
      if (end && eventEnd > end) continue;

      // Determine if this is a class or assignment
      const title = event.summary || 'Untitled';
      const isClass = !title.toLowerCase().includes('due') &&
        !title.toLowerCase().includes('assignment') &&
        !title.toLowerCase().includes('quiz') &&
        !title.toLowerCase().includes('exam');

      // Only include class sessions as fixed events
      // (Assignments should go through the enrichment pipeline)
      if (isClass) {
        fixedEvents.push({
          id: event.uid || `byu-${Date.now()}-${Math.random()}`,
          title,
          start: eventStart,
          end: eventEnd,
          location: event.location?.toString(),
          contextTags: ['#campus'],
        });
      }
    }

    return fixedEvents;
  } catch (error) {
    console.error('Error fetching BYU iCal feed:', error);
    return [];
  }
}

// ============================================
// COMBINED CALENDAR FETCHER
// ============================================

export interface CalendarConfig {
  googleCalendarId?: string;
  byuIcalUrl?: string;
  accessToken?: string; // NEW: User OAuth Token
}

/**
 * Fetch all calendar events from configured sources
 * 
 * @param start - Start of the date range
 * @param end - End of the date range
 * @param config - Calendar configuration
 * @returns Combined array of FixedEvent objects, sorted by start time
 */
export async function getAllCalendarEvents(
  start: Date,
  end: Date,
  config: CalendarConfig = {}
): Promise<FixedEvent[]> {
  const allEvents: FixedEvent[] = [];

  // Fetch from Google Calendar
  try {
    const googleEvents = await getGoogleCalendarEvents(
      start,
      end,
      config.googleCalendarId || 'primary',
      config.accessToken // Pass it through
    );
    allEvents.push(...googleEvents);
  } catch (error) {
    console.error('Failed to fetch Google Calendar events:', error);
  }

  // Fetch from BYU iCal
  if (config.byuIcalUrl) {
    try {
      const byuEvents = await getByuClasses(config.byuIcalUrl, start, end);
      allEvents.push(...byuEvents);
    } catch (error) {
      console.error('Failed to fetch BYU iCal events:', error);
    }
  }

  // Sort by start time
  allEvents.sort((a, b) => a.start.getTime() - b.start.getTime());

  // Remove duplicates (events with same title and overlapping times)
  const deduped = allEvents.filter((event, index, arr) => {
    for (let i = 0; i < index; i++) {
      const other = arr[i];
      if (
        event.title === other.title &&
        Math.abs(event.start.getTime() - other.start.getTime()) < 5 * 60 * 1000 // Within 5 mins
      ) {
        return false;
      }
    }
    return true;
  });

  return deduped;
}

// ============================================
// EXPORT TO GOOGLE CALENDAR (WRITE)
// ============================================

export interface ExportResult {
  success: boolean;
  createdEvents: number;
  errors: string[];
  eventIds: string[];
}

/**
 * Export scheduled blocks to Google Calendar
 * 
 * SAFETY: Will NOT write to primary calendar to prevent cluttering during testing.
 * Set GOOGLE_CALENDAR_TARGET_ID to a secondary calendar ID.
 * 
 * @param blocks - Array of ScheduledBlock to export
 * @param dryRun - If true, only validate without creating events
 * @returns ExportResult with created event count and any errors
 */
export async function exportScheduleToGoogle(
  blocks: ScheduledBlock[],
  dryRun: boolean = false
): Promise<ExportResult> {
  const result: ExportResult = {
    success: false,
    createdEvents: 0,
    errors: [],
    eventIds: [],
  };

  try {
    // Get target calendar ID
    const targetCalendarId = process.env.GOOGLE_CALENDAR_TARGET_ID;

    // In dry-run mode, we can skip if no target calendar is set
    if (!targetCalendarId) {
      if (dryRun) {
        console.log('   ℹ️  DRY RUN: Would export to Google Calendar (GOOGLE_CALENDAR_TARGET_ID not set)');
        console.log(`   ℹ️  DRY RUN: ${blocks.filter(b => !b.isVirtual).length} events would be created`);
        return {
          success: true,
          createdEvents: blocks.filter(b => !b.isVirtual).length,
          errors: [],
          eventIds: [],
        };
      }
      throw new Error(
        'GOOGLE_CALENDAR_TARGET_ID not set. ' +
        'Please create a secondary calendar and set its ID in .env.local'
      );
    }

    // SAFETY CHECK: Prevent writing to primary calendar
    const primaryIndicators = ['primary', '@gmail.com', '@googlemail.com'];
    const isPrimary = primaryIndicators.some(
      indicator => targetCalendarId.toLowerCase().includes(indicator)
    );

    if (isPrimary) {
      throw new Error(
        '🛑 SAFETY STOP: Cannot write to primary calendar!\n' +
        'Create a secondary calendar in Google Calendar and use its ID.\n' +
        'Find the calendar ID in: Google Calendar > Settings > [Your Calendar] > Integrate calendar'
      );
    }

    const auth = getGoogleWriteAuthClient();
    const calendar = google.calendar({ version: 'v3', auth });

    // Filter to only non-virtual blocks (hard bookings)
    const hardBlocks = blocks.filter(block => !block.isVirtual);

    if (hardBlocks.length === 0) {
      console.log('No hard-booked blocks to export (all are virtual/soft plans)');
      result.success = true;
      return result;
    }

    console.log(`\n📤 Exporting ${hardBlocks.length} blocks to Google Calendar...`);
    console.log(`   Target Calendar: ${targetCalendarId}`);

    if (dryRun) {
      console.log('   Mode: DRY RUN (no events will be created)\n');
    }

    for (const block of hardBlocks) {
      try {
        const event = {
          summary: block.taskTitle,
          description: `Generated by LifeOS\n\nTask ID: ${block.taskId}\nDuration: ${block.durationMinutes} mins${block.totalChunks && block.totalChunks > 1
            ? `\nChunk ${(block.chunkIndex ?? 0) + 1} of ${block.totalChunks}`
            : ''
            }`,
          start: {
            dateTime: block.start.toISOString(),
            timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          },
          end: {
            dateTime: block.end.toISOString(),
            timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          },
          colorId: '9', // Blueberry - distinguishes LifeOS tasks
        };

        if (dryRun) {
          console.log(`   [DRY RUN] Would create: ${block.taskTitle} @ ${block.start.toLocaleString()}`);
          result.createdEvents++;
        } else {
          const response = await calendar.events.insert({
            calendarId: targetCalendarId,
            requestBody: event,
          });

          if (response.data.id) {
            result.eventIds.push(response.data.id);
            result.createdEvents++;
            console.log(`   ✅ Created: ${block.taskTitle} @ ${block.start.toLocaleTimeString()}`);
          }
        }
      } catch (error) {
        const errorMsg = `Failed to create event for "${block.taskTitle}": ${error}`;
        result.errors.push(errorMsg);
        console.error(`   ❌ ${errorMsg}`);
      }
    }

    result.success = result.errors.length === 0;
    console.log(`\n📊 Export complete: ${result.createdEvents}/${hardBlocks.length} events created`);

    if (result.errors.length > 0) {
      console.log(`   ⚠️  ${result.errors.length} errors occurred`);
    }

    return result;
  } catch (error) {
    result.errors.push(String(error));
    console.error('Export failed:', error);
    return result;
  }
}

/**
 * Delete LifeOS-generated events from the target calendar
 * Useful for cleaning up before a fresh sync
 * 
 * @param startDate - Start of date range to clean
 * @param endDate - End of date range to clean
 */
export async function clearLifeOSEvents(
  startDate: Date,
  endDate: Date
): Promise<{ deleted: number; errors: string[] }> {
  const result = { deleted: 0, errors: [] as string[] };

  try {
    const targetCalendarId = process.env.GOOGLE_CALENDAR_TARGET_ID;

    if (!targetCalendarId) {
      throw new Error('GOOGLE_CALENDAR_TARGET_ID not set');
    }

    const auth = getGoogleWriteAuthClient();
    const calendar = google.calendar({ version: 'v3', auth });

    // Fetch events in range
    const response = await calendar.events.list({
      calendarId: targetCalendarId,
      timeMin: startDate.toISOString(),
      timeMax: endDate.toISOString(),
      singleEvents: true,
      q: 'Generated by LifeOS', // Search for our events
    });

    const events = response.data.items || [];
    console.log(`\n🗑️  Found ${events.length} LifeOS events to delete...`);

    for (const event of events) {
      if (event.id && event.description?.includes('Generated by LifeOS')) {
        try {
          await calendar.events.delete({
            calendarId: targetCalendarId,
            eventId: event.id,
          });
          result.deleted++;
          console.log(`   ✅ Deleted: ${event.summary}`);
        } catch (error) {
          result.errors.push(`Failed to delete ${event.summary}: ${error}`);
        }
      }
    }

    console.log(`\n📊 Cleanup complete: ${result.deleted} events deleted`);
    return result;
  } catch (error) {
    result.errors.push(String(error));
    console.error('Cleanup failed:', error);
    return result;
  }
}

