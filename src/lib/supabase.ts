import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Database types based on our schema
export interface DbGoal {
  id: string;
  user_id: string;
  category: 'Spiritual' | 'Business' | 'Family' | 'Health' | 'Education' | 'Personal';
  title: string;
  description?: string;
  deadline?: string;
  priority_tier: 'critical' | 'core' | 'backlog'; // New Tier
  created_at: string;
  updated_at: string;
}

export interface DbTask {
  id: string;
  user_id: string;
  goal_id?: string;
  title: string;
  description?: string;
  duration_minutes: number;
  // min_chunk_size removed
  // max_chunk_size removed
  can_split: boolean;
  deadline?: string;
  // priority removed
  priority_tier: 'critical' | 'core' | 'backlog';
  category?: string;
  // context_tags removed
  // energy_level removed
  is_assignment: boolean;
  is_virtual: boolean;
  scheduled_start?: string; // Legacy field (maybe rename to match DB?)
  scheduled_end?: string;
  scheduled_start_time?: string; // NEW: Manual Scheduling
  status: 'pending' | 'scheduled' | 'in_progress' | 'completed' | 'skipped' | 'backlog';
  parent_habit_id?: string;
  created_at: string;
  updated_at: string;
}
