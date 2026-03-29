require('dotenv').config();
const { createClient } = require("@supabase/supabase-js");
const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const sb = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

async function main() {
  // Test if owner_id column exists by trying to select it
  const { data, error } = await sb.from("sales_contacts").select("id,owner_id").limit(1);
  if (error && error.message.includes("owner_id")) {
    console.log("owner_id カラムが存在しません。Supabaseダッシュボードで以下のSQLを実行してください:");
    console.log("");
    console.log("ALTER TABLE sales_contacts ADD COLUMN owner_id uuid REFERENCES auth.users(id);");
    console.log("");
  } else {
    console.log("✅ owner_id カラムは既に存在します");
    if (data && data.length > 0) console.log("  サンプル:", data[0]);
  }
}
main().catch(e => { console.error(e); process.exit(1); });
