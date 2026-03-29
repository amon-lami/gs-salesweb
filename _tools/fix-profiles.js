const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://yzwrumeukjidsguixqxr.supabase.co';
const SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl6d3J1bWV1a2ppZHNndWl4cXhyIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NDA1NzIzMCwiZXhwIjoyMDg5NjMzMjMwfQ.rs2b7Lj_UouXITpnwtoRa3EsRdytQCpJozAjAnnZuwE';

const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
});

async function main() {
  // 1. First check profiles table structure
  console.log('=== Checking profiles table structure ===');
  const { data: sample, error: sErr } = await admin.from('profiles').select('*').limit(1);
  if (sErr) {
    console.error('Error reading profiles:', sErr.message);
    return;
  }
  if (sample && sample.length > 0) {
    console.log('Columns:', Object.keys(sample[0]));
    console.log('Sample:', sample[0]);
  } else {
    console.log('No existing profiles found. Columns unknown.');
  }

  // 2. List all auth users
  const { data: { users } } = await admin.auth.admin.listUsers();
  console.log('\n=== Auth Users ===');
  users.forEach(u => console.log(`  ${u.email} | id=${u.id}`));

  // 3. Check all existing profiles
  const { data: allProfiles } = await admin.from('profiles').select('*');
  console.log('\n=== Existing Profiles ===');
  (allProfiles || []).forEach(p => console.log('  ', JSON.stringify(p)));

  // 4. Upsert profiles with all possible column names
  const MEMBERS = [
    { email: 'amon.lami@globalstride.jp', name: 'Amon Lamichhane' },
    { email: 'kota.tsumura@globalstride.jp', name: 'Kota Tsumura' },
    { email: 'yuki.nakagawa@globalstride.jp', name: 'Yuki Nakagawa' },
    { email: 'chikaki@globalstride.jp', name: 'Chikaki' },
    { email: 'yuta.ito@globalstride.jp', name: 'Yuta Ito' },
    { email: 'mark.matiros@globalstride.jp', name: 'Mark Matiros' },
    { email: 'sarah.azzouz@globalstride.jp', name: 'Sarah Azzouz' },
    { email: 'joseph.mackay@globalstride.jp', name: 'Joseph Mackay' },
  ];

  console.log('\n=== Upserting Profiles ===');
  for (const m of MEMBERS) {
    const user = users.find(u => u.email === m.email);
    if (!user) { console.log(`  SKIP: ${m.email} (no auth user)`); continue; }

    // Try upsert with both possible column names
    const { error: e1 } = await admin.from('profiles').upsert({
      id: user.id,
      name: m.name,
      email: m.email,
      display_name: m.name,
    }, { onConflict: 'id' });

    if (e1) {
      console.error(`  ERROR ${m.email}: ${e1.message}`);
      // Try without display_name
      const { error: e2 } = await admin.from('profiles').upsert({
        id: user.id,
        name: m.name,
        email: m.email,
      }, { onConflict: 'id' });
      if (e2) {
        console.error(`  RETRY ERROR: ${e2.message}`);
        // Try minimal
        const { error: e3 } = await admin.from('profiles').upsert({
          id: user.id,
          name: m.name,
        }, { onConflict: 'id' });
        if (e3) console.error(`  MINIMAL ERROR: ${e3.message}`);
        else console.log(`  OK (minimal): ${m.email} -> ${m.name}`);
      } else {
        console.log(`  OK (name+email): ${m.email} -> ${m.name}`);
      }
    } else {
      console.log(`  OK: ${m.email} -> ${m.name}`);
    }
  }

  // 5. Final check
  console.log('\n=== Final Profiles ===');
  const { data: finalProfiles } = await admin.from('profiles').select('*');
  (finalProfiles || []).forEach(p => console.log('  ', JSON.stringify(p)));

  console.log('\nDone!');
}

main().catch(console.error);
