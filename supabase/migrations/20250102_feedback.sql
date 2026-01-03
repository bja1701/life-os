-- Create Feedback Table
create table if not exists public.feedback (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users not null,
  message text not null,
  page_url text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable RLS
alter table public.feedback enable row level security;

-- Policies
create policy "Users can insert own feedback" 
  on public.feedback 
  for insert 
  with check (auth.uid() = user_id);

-- Optional: Allow users to view their own feedback? 
-- The prompt only specified INSERT, but viewing is helpful for debugging or history if we build that later.
-- For now, sticking to the requirement: "Enable RLS: Allow authenticated users to INSERT their own feedback."
