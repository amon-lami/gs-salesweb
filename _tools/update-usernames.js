require('dotenv').config();
const { createClient } = require("@supabase/supabase-js");
const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const sb = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

const NAME_MAP = {
  "alt@globalstride.jp": "Amon",
  "amon.lami@globalstride.jp": "Amon",
  "yuki.nakagawa@globalstride.jp": "Yuki",
  "kota.tsumura@globalstride.jp": "Tsumura",
  "chikaki@globalstride.jp": "Chikaki",
  "yuta.ito@globalstride.jp": "Yuta",
  "mark.matiros@globalstride.jp": "Mark",
  "sarah.azzouz@globalstride.jp": "Sarah",
  "joseph.mackay@globalstride.jp": "Joseph"
};

async function main() {
  // まず全profilesを確認
  const { data: profiles, error } = await sb.from("profiles").select("*");
  if (error) { console.error("取得エラー:", error.message); return; }
  console.log(`profiles: ${profiles.length}件\n`);
  profiles.forEach(p => console.log(`  ${p.email} → "${p.name}"`));

  // auth.usersも確認して、profilesに無いユーザーを特定
  const { data: { users: authUsers }, error: authErr } = await sb.auth.admin.listUsers();
  if (authErr) { console.error("auth取得エラー:", authErr.message); return; }
  console.log(`\nauth.users: ${authUsers.length}件`);
  
  const profileEmails = new Set(profiles.map(p => p.email));
  
  for (const au of authUsers) {
    const shortName = NAME_MAP[au.email] || au.email;
    console.log(`  ${au.email} (id: ${au.id}) → ${shortName} | profileあり: ${profileEmails.has(au.email)}`);
    
    // profilesに存在しなければ作成
    if (!profileEmails.has(au.email)) {
      const { error: insErr } = await sb.from("profiles").upsert({
        id: au.id,
        name: shortName,
        email: au.email
      });
      if (insErr) {
        console.error(`    作成失敗: ${insErr.message}`);
      } else {
        console.log(`    ✓ profile作成: ${shortName}`);
      }
    }
  }

  // 全profilesの名前を短縮名に更新
  console.log("\n=== 名前更新 ===");
  const { data: allProfiles } = await sb.from("profiles").select("*");
  for (const p of allProfiles) {
    const newName = NAME_MAP[p.email];
    if (!newName) { console.log(`  ? ${p.email} → マッピングなし`); continue; }
    if (p.name === newName) { console.log(`  ✓ ${p.email} → ${newName}（変更不要）`); continue; }
    
    const { error: upErr } = await sb.from("profiles").update({ name: newName }).eq("id", p.id);
    if (upErr) {
      console.error(`  ✗ ${p.email}: ${upErr.message}`);
    } else {
      console.log(`  ✓ ${p.email}: "${p.name}" → "${newName}"`);
    }
  }

  // 最終確認
  const { data: final } = await sb.from("profiles").select("id,name,email");
  console.log(`\n=== 最終結果 (${final.length}件) ===`);
  final.forEach(p => console.log(`  ${p.name} (${p.email})`));
  console.log("\n✅ 完了");
}

main().catch(e => { console.error(e); process.exit(1); });
