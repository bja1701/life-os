
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

// Load env.local manually since we are outside Next.js
const envPath = path.resolve(process.cwd(), '.env.local');
const envConfig = dotenv.parse(fs.readFileSync(envPath));

const url = envConfig.NEXT_PUBLIC_SUPABASE_URL;
const key = envConfig.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
    console.error("Missing Supabase URL or Service Role Key in .env.local");
    process.exit(1);
}

const supabase = createClient(url, key);

async function check() {
    console.log("--- DEBUGGER ---");

    // 1. List Users
    const { data: { users }, error: authError } = await supabase.auth.admin.listUsers();
    console.log(`Users found: ${users?.length}`);
    users?.forEach(u => console.log(` - ID: ${u.id} | Email: ${u.email}`));

    if (!users || users.length === 0) {
        console.log("No users found! This explains why goals aren't linking.");
        return;
    }

    const userId = users[0].id; // We assume logic uses the first user
    console.log(`\nChecking data for User: ${userId}`);

    // 2. Check Goals
    const { data: goals, error: goalsError } = await supabase
        .from('goals')
        .select('*')
        .eq('user_id', userId);

    console.log(`Goals found: ${goals?.length}`);
    goals?.forEach(g => console.log(` - Goal: "${g.title}" (ID: ${g.id})`));

    // 3. Check Tasks
    const { data: tasks, error: tasksError } = await supabase
        .from('tasks')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(10);

    console.log(`\nRecent Tasks (Last 10):`);
    tasks?.forEach(t => console.log(` - [${t.status}] "${t.title}" (Start: ${t.deadline || 'None'}, Virtual: ${t.is_virtual})`));
}

check();
