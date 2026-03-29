require('dotenv').config();
const { createClient } = require("@supabase/supabase-js");
const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const sb = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

async function main() {
  // テーブル候補を片っ端から試す
  const tables = ["users","profiles","members","team","staff","user_profiles","auth_users","employees","people"];
  for (const t of tables) {
    const { data, error } = await sb.from(t).select("*").limit(2);
    if (error) {
      console.log(`  ✗ ${t}: ${error.message.substring(0,60)}`);
    } else {
      console.log(`  ✓ ${t}: ${data.length}件 → ${JSON.stringify(data[0]||{}).substring(0,120)}`);
    }
  }
}
main();
