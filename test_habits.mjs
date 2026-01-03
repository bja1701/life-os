
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

// Load env.local manually
const envPath = path.resolve(process.cwd(), '.env.local');
const envConfig = dotenv.parse(fs.readFileSync(envPath));

const url = envConfig.NEXT_PUBLIC_SUPABASE_URL;
const key = envConfig.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
    console.error("Missing Supabase URL or Service Role Key");
    process.exit(1);
}

const supabase = createClient(url, key);

async function testHabits() {
    console.log("--- TESTING HABIT ENGINE ---");

    // 1. Get Test User
    const { data: { users } } = await supabase.auth.admin.listUsers();
    if (!users || users.length === 0) throw new Error("No users found");
    const userId = users[0].id;
    console.log("User ID:", userId);

    // 2. Create Master Habit
    const habitTitle = `Test Habit ${Date.now()}`;
    console.log(`\n1. Creating Master Habit: "${habitTitle}"`);

    const { data: master, error: createError } = await supabase
        .from('tasks')
        .insert({
            user_id: userId,
            title: habitTitle,
            duration_minutes: 30,
            recurrence_pattern: 'daily',
            is_recurring: true,
            status: 'pending'
        })
        .select()
        .single();

    if (createError) {
        console.error("Create Failed:", createError);
        return;
    }
    console.log("   -> Created Master Habit ID:", master.id);

    // 3. Run "Ensure Daily Habits" Logic (Simulated)
    console.log("\n2. Running Daily Check (Cloning)...");

    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);

    // Check if child exists
    const { data: existing } = await supabase
        .from('tasks')
        .select('id')
        .eq('parent_habit_id', master.id)
        .gte('deadline', new Date().toISOString().split('T')[0]) // Simplified check
        .single();

    if (existing) {
        console.log("   -> Child already exists (Unexpected for new habit!)");
    } else {
        // Clone it
        const { data: child, error: cloneError } = await supabase
            .from('tasks')
            .insert({
                user_id: userId,
                title: master.title,
                duration_minutes: master.duration_minutes,
                parent_habit_id: master.id,
                is_recurring: false,
                status: 'pending',
                deadline: todayEnd.toISOString()
            })
            .select()
            .single();

        if (cloneError) console.error("   -> Clone Failed:", cloneError);
        else console.log("   -> SUCCESSS: Created Daily Instance ID:", child.id);
    }

    // 4. Verify in DB
    const { data: verify } = await supabase
        .from('tasks')
        .select('id, title, is_recurring, parent_habit_id')
        .eq('title', habitTitle);

    console.log("\n3. DB Verification (Should find 2 rows: Master & Child):");
    console.table(verify);
}

testHabits();
