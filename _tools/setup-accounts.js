const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://yzwrumeukjidsguixqxr.supabase.co';
const SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl6d3J1bWV1a2ppZHNndWl4cXhyIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NDA1NzIzMCwiZXhwIjoyMDg5NjMzMjMwfQ.rs2b7Lj_UouXITpnwtoRa3EsRdytQCpJozAjAnnZuwE';

const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
});

const PASSWORD = 'ppQpo2o2';

const MEMBERS = [
  { email: 'kota.tsumura@globalstride.jp', name: 'Kota Tsumura' },
  { email: 'yuki.nakagawa@globalstride.jp', name: 'Yuki Nakagawa' },
  { email: 'chikaki@globalstride.jp', name: 'Chikaki' },
  { email: 'yuta.ito@globalstride.jp', name: 'Yuta Ito' },
  { email: 'mark.matiros@globalstride.jp', name: 'Mark Matiros' },
  { email: 'sarah.azzouz@globalstride.jp', name: 'Sarah Azzouz' },
  { email: 'joseph.mackay@globalstride.jp', name: 'Joseph Mackay' },
];

async function main() {
  // 1. List existing auth users
  console.log('=== Existing Auth Users ===');
  const { data: { users }, error: listErr } = await admin.auth.admin.listUsers();
  if (listErr) { console.error('List error:', listErr); return; }

  const existingMap = {};
  users.forEach(u => {
    existingMap[u.email] = u;
    console.log(`  ${u.email} | id=${u.id} | confirmed=${!!u.email_confirmed_at}`);
  });

  console.log('\n=== Processing Members ===');

  for (const m of MEMBERS) {
    const existing = existingMap[m.email];

    if (existing) {
      // User exists - confirm email + update password
      console.log(`[EXISTS] ${m.email} (id=${existing.id})`);

      const { data, error } = await admin.auth.admin.updateUserById(existing.id, {
        email_confirm: true,
        password: PASSWORD,
      });
      if (error) {
        console.error(`  ERROR updating: ${error.message}`);
      } else {
        console.log(`  -> Email confirmed & password updated`);
      }

      // Ensure profile exists
      const { data: profile } = await admin.from('profiles').select('*').eq('id', existing.id).single();
      if (!profile) {
        const { error: pErr } = await admin.from('profiles').upsert({
          id: existing.id,
          display_name: m.name,
        });
        if (pErr) console.error(`  Profile error: ${pErr.message}`);
        else console.log(`  -> Profile created: ${m.name}`);
      } else {
        console.log(`  -> Profile exists: ${profile.display_name}`);
      }

    } else {
      // Create new user with confirmed email
      console.log(`[NEW] ${m.email}`);

      const { data, error } = await admin.auth.admin.createUser({
        email: m.email,
        password: PASSWORD,
        email_confirm: true,
        user_metadata: { display_name: m.name },
      });

      if (error) {
        console.error(`  ERROR creating: ${error.message}`);
        continue;
      }

      console.log(`  -> Created: id=${data.user.id}`);

      // Create profile
      const { error: pErr } = await admin.from('profiles').upsert({
        id: data.user.id,
        display_name: m.name,
      });
      if (pErr) console.error(`  Profile error: ${pErr.message}`);
      else console.log(`  -> Profile created: ${m.name}`);
    }
  }

  // Final check
  console.log('\n=== Final User List ===');
  const { data: { users: finalUsers } } = await admin.auth.admin.listUsers();
  const { data: profiles } = await admin.from('profiles').select('*');
  const profileMap = {};
  (profiles || []).forEach(p => { profileMap[p.id] = p.display_name; });

  finalUsers.forEach(u => {
    console.log(`  ${u.email} | ${profileMap[u.id] || '(no profile)'} | confirmed=${!!u.email_confirmed_at}`);
  });

  console.log('\nDone!');
}

main().catch(console.error);
