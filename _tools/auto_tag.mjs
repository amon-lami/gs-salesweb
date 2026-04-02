const SUPABASE_URL = "https://yzwrumeukjidsguixqxr.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl6d3J1bWV1a2ppZHNndWl4cXhyIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NDA1NzIzMCwiZXhwIjoyMDg5NjMzMjMwfQ.rs2b7Lj_UouXITpnwtoRa3EsRdytQCpJozAjAnnZuwE";

const BRAND_TAGS = {
  "キュレル": ["スキンケア","敏感肌","セラミド"],
  "Curel": ["スキンケア","敏感肌","セラミド"],
  "ビオレ": ["スキンケア","洗顔","クレンジング"],
  "Biore": ["スキンケア","洗顔","クレンジング"],
  "ニベア": ["スキンケア","保湿","ボディケア"],
  "NIVEA": ["スキンケア","保湿","ボディケア"],
  "花王": ["スキンケア"],
  "Kao": ["スキンケア"],
  "SK-II": ["スキンケア","高級","美容液"],
  "SKII": ["スキンケア","高級","美容液"],
  "コーセー": ["スキンケア","コスメ"],
  "KOSE": ["スキンケア","コスメ"],
  "資生堂": ["スキンケア","コスメ","日本製"],
  "Shiseido": ["スキンケア","コスメ","日本製"],
  "カネボウ": ["スキンケア","コスメ"],
  "Kanebo": ["スキンケア","コスメ"],
  "DHC": ["スキンケア","サプリ"],
  "オルビス": ["スキンケア","オイルフリー"],
  "ORBIS": ["スキンケア","オイルフリー"],
  "ファンケル": ["スキンケア","無添加"],
  "FANCL": ["スキンケア","無添加"],
  "ポーラ": ["スキンケア","高級","エイジングケア"],
  "POLA": ["スキンケア","高級","エイジングケア"],
  "肌研": ["スキンケア","ヒアルロン酸","保湿"],
  "ハダラボ": ["スキンケア","ヒアルロン酸","保湿"],
  "Hada Labo": ["スキンケア","ヒアルロン酸","保湿"],
  "HADA LABO": ["スキンケア","ヒアルロン酸","保湿"],
  "ルルルン": ["スキンケア","フェイスマスク"],
  "LuLuLun": ["スキンケア","フェイスマスク"],
  "アネッサ": ["日焼け止め","スキンケア"],
  "ANESSA": ["日焼け止め","スキンケア"],
  "キャンメイク": ["メイク","プチプラ"],
  "CANMAKE": ["メイク","プチプラ"],
  "セザンヌ": ["メイク","プチプラ"],
  "CEZANNE": ["メイク","プチプラ"],
  "パンテーン": ["ヘアケア","シャンプー","コンディショナー"],
  "Pantene": ["ヘアケア","シャンプー","コンディショナー"],
  "ラックス": ["ヘアケア","シャンプー"],
  "LUX": ["ヘアケア","シャンプー"],
  "ダヴ": ["ヘアケア","ボディケア"],
  "Dove": ["ヘアケア","ボディケア"],
  "クナイプ": ["ボディケア","入浴剤","アロマ"],
  "KNEIPP": ["ボディケア","入浴剤","アロマ"],
  "伊藤園": ["飲料","緑茶","抹茶"],
  "辻利": ["抹茶","食品"],
  "メラノCC": ["スキンケア","ビタミンC","美白"],
  "アクアレーベル": ["スキンケア","保湿","エイジングケア"],
  "ドクターシーラボ": ["スキンケア","敏感肌"],
  "コラージュ": ["スキンケア","敏感肌"],
  "マキアージュ": ["メイク","スキンケア"],
  "ケイト": ["メイク"],
  "KATE": ["メイク"],
  "インテグレート": ["メイク"],
  "アジエンス": ["ヘアケア","シャンプー"],
  "ASIENCE": ["ヘアケア","シャンプー"],
  "バブ": ["ボディケア","入浴剤"],
  "バスロマン": ["ボディケア","入浴剤"],
  "BATHCLIN": ["ボディケア","入浴剤"],
};

const KEYWORD_RULES = [
  {re:/shampoo|シャンプー/i, tags:["シャンプー","ヘアケア"]},
  {re:/conditioner|コンディショナー|リンス/i, tags:["コンディショナー","ヘアケア"]},
  {re:/hair.*(mask|pack|treatment)|ヘアマスク|ヘアパック|トリートメント/i, tags:["ヘアトリートメント","ヘアケア"]},
  {re:/hair.*(oil|serum)|ヘアオイル|ヘアセラム/i, tags:["ヘアオイル","ヘアケア"]},
  {re:/hair.*(mist|spray|wax|gel)|ヘアミスト|ヘアスプレー/i, tags:["ヘアスタイリング","ヘアケア"]},
  {re:/\bwax\b|ワックス/i, tags:["ヘアスタイリング","ヘアケア"]},
  {re:/scalp|頭皮/i, tags:["スカルプケア","ヘアケア"]},
  {re:/face.*(wash|foam|cleanser)|洗顔/i, tags:["洗顔","スキンケア"]},
  {re:/cleansing|クレンジング/i, tags:["クレンジング","スキンケア"]},
  {re:/toner|lotion|化粧水/i, tags:["化粧水","スキンケア"]},
  {re:/moistur|emulsion|乳液/i, tags:["乳液","スキンケア"]},
  {re:/serum|essence|美容液/i, tags:["美容液","スキンケア"]},
  {re:/\bcream\b|クリーム/i, tags:["クリーム","スキンケア"]},
  {re:/\bmask\b|\bpack\b|フェイスマスク|シートマスク/i, tags:["フェイスマスク","スキンケア"]},
  {re:/sunscreen|sun.protect|sunblock|日焼け止め|UV.*クリーム|SPF/i, tags:["日焼け止め","スキンケア"]},
  {re:/whitening|brightening|美白/i, tags:["美白","スキンケア"]},
  {re:/aging|anti.age|エイジング|アンチエイジング/i, tags:["エイジングケア","スキンケア"]},
  {re:/hyaluronic|ヒアルロン/i, tags:["ヒアルロン酸","スキンケア","保湿"]},
  {re:/retinol|レチノール/i, tags:["レチノール","スキンケア","エイジングケア"]},
  {re:/collagen|コラーゲン/i, tags:["コラーゲン","スキンケア"]},
  {re:/vitamin.c|ビタミンC/i, tags:["ビタミンC","スキンケア","美白"]},
  {re:/ceramide|セラミド/i, tags:["セラミド","スキンケア","保湿"]},
  {re:/pore|毛穴/i, tags:["毛穴ケア","スキンケア"]},
  {re:/acne|pimple|ニキビ/i, tags:["ニキビケア","スキンケア"]},
  {re:/sensitive|敏感肌/i, tags:["敏感肌","スキンケア"]},
  {re:/dry.skin|乾燥肌/i, tags:["乾燥肌","スキンケア","保湿"]},
  {re:/moist|保湿/i, tags:["保湿","スキンケア"]},
  {re:/eye.*(cream|gel|serum|care)|アイクリーム|目元ケア/i, tags:["アイケア","スキンケア"]},
  {re:/lip.*(balm|cream|care)|リップバーム/i, tags:["リップケア","スキンケア"]},
  {re:/body.*(wash|soap)|ボディウォッシュ|ボディソープ/i, tags:["ボディソープ","ボディケア"]},
  {re:/body.*(lotion|milk|cream)|ボディローション|ボディミルク|ボディクリーム/i, tags:["ボディクリーム","ボディケア"]},
  {re:/bath.*(salt|powder|bomb|tablet|liquid)|入浴剤|バスソルト/i, tags:["入浴剤","ボディケア"]},
  {re:/hand.*(cream|lotion)|ハンドクリーム/i, tags:["ハンドケア","ボディケア"]},
  {re:/foot.*(cream|care)|フットクリーム|フットケア/i, tags:["フットケア","ボディケア"]},
  {re:/deodorant|消臭|制汗/i, tags:["デオドラント","ボディケア"]},
  {re:/foundation|ファンデーション/i, tags:["ファンデーション","メイク"]},
  {re:/bb.cream|BBクリーム/i, tags:["BBクリーム","メイク"]},
  {re:/concealer|コンシーラー/i, tags:["コンシーラー","メイク"]},
  {re:/loose.powder|face.powder|パウダー/i, tags:["フェイスパウダー","メイク"]},
  {re:/blush|cheek|チーク/i, tags:["チーク","メイク"]},
  {re:/eyeshadow|eye.shadow|アイシャドウ/i, tags:["アイシャドウ","メイク"]},
  {re:/eyeliner|eye.liner|アイライナー/i, tags:["アイライナー","メイク"]},
  {re:/mascara|マスカラ/i, tags:["マスカラ","メイク"]},
  {re:/eyebrow|eye.brow|アイブロウ|眉/i, tags:["アイブロウ","メイク"]},
  {re:/lipstick|lip.color|口紅/i, tags:["口紅","メイク"]},
  {re:/lip.gloss|リップグロス/i, tags:["リップグロス","メイク"]},
  {re:/nail|ネイル/i, tags:["ネイル","メイク"]},
  {re:/matcha|抹茶/i, tags:["抹茶","食品"]},
  {re:/green.tea|緑茶/i, tags:["緑茶","飲料"]},
  {re:/supplement|サプリ/i, tags:["サプリメント","健康"]},
  {re:/\bcotton\b|コットン/i, tags:["コットン","衛生用品"]},
  {re:/tissue|ティッシュ/i, tags:["ティッシュ","衛生用品"]},
  {re:/wipe|ウェットシート/i, tags:["ウェットシート","衛生用品"]},
  {re:/organic|オーガニック/i, tags:["オーガニック"]},
  {re:/natural|ナチュラル/i, tags:["ナチュラル"]},
  {re:/vegan|ヴィーガン/i, tags:["ヴィーガン"]},
  {re:/fragrance.free|無香料/i, tags:["無香料"]},
  {re:/alcohol.free|アルコールフリー/i, tags:["アルコールフリー"]},
  {re:/\bmen\b|メンズ/i, tags:["メンズ"]},
  {re:/kids|baby|キッズ|ベビー|赤ちゃん/i, tags:["ベビー・キッズ"]},
  {re:/\bset\b|セット/i, tags:["セット商品"]},
  {re:/mini|ミニ|travel|トラベル/i, tags:["ミニサイズ"]},
  {re:/limited|限定/i, tags:["限定品"]},
];

function assignTags(product) {
  const existing = product.tags || [];
  const newTags = new Set(existing);

  const nameEn = product.name_en || "";
  const nameJa = product.name_ja || "";
  const brand = product.brand || "";
  const subBrand = product.sub_brand || "";
  const combined = brand + " " + subBrand + " " + nameEn + " " + nameJa;

  for (const [b, tags] of Object.entries(BRAND_TAGS)) {
    if (combined.toLowerCase().includes(b.toLowerCase())) {
      tags.forEach(t => newTags.add(t));
    }
  }

  for (const rule of KEYWORD_RULES) {
    if (rule.re.test(nameEn) || rule.re.test(nameJa) || rule.re.test(brand) || rule.re.test(subBrand)) {
      rule.tags.forEach(t => newTags.add(t));
    }
  }

  if (newTags.size === 0) {
    if (product.business_type === "matcha") {
      newTags.add("抹茶");
      newTags.add("食品");
    } else {
      newTags.add("コスメ");
      newTags.add("日本製品");
    }
  }

  return [...newTags];
}

async function fetchAllProducts() {
  let all = [];
  let from = 0;
  const limit = 1000;
  while (true) {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/product_master?select=id,name_en,name_ja,brand,sub_brand,tags,business_type&limit=${limit}&offset=${from}`, {
      headers: {
        "apikey": SUPABASE_KEY,
        "Authorization": `Bearer ${SUPABASE_KEY}`,
      }
    });
    if (!res.ok) { console.error("Fetch error", res.status, await res.text()); break; }
    const data = await res.json();
    if (!Array.isArray(data) || data.length === 0) break;
    all = all.concat(data);
    if (data.length < limit) break;
    from += limit;
  }
  return all;
}

async function patchProduct(id, tags) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/product_master?id=eq.${id}`, {
    method: "PATCH",
    headers: {
      "apikey": SUPABASE_KEY,
      "Authorization": `Bearer ${SUPABASE_KEY}`,
      "Content-Type": "application/json",
      "Prefer": "return=minimal"
    },
    body: JSON.stringify({ tags })
  });
  return res.status;
}

async function main() {
  console.log("Fetching products...");
  const products = await fetchAllProducts();
  console.log(`Fetched ${products.length} products`);

  const updates = products.map(p => ({ id: p.id, tags: assignTags(p) }));

  const tagCounts = {};
  let untagged = 0;
  for (const u of updates) {
    if (u.tags.length === 0) untagged++;
    for (const t of u.tags) tagCounts[t] = (tagCounts[t] || 0) + 1;
  }
  console.log(`Untagged: ${untagged}`);
  const top = Object.entries(tagCounts).sort((a,b)=>b[1]-a[1]).slice(0,20);
  console.log("Top tags:", top.map(([t,c])=>`${t}:${c}`).join(", "));

  console.log("Applying tags to DB...");
  let ok = 0, fail = 0;
  for (let i = 0; i < updates.length; i++) {
    const { id, tags } = updates[i];
    const status = await patchProduct(id, tags);
    if (status === 204 || status === 200) {
      ok++;
    } else {
      fail++;
      console.warn(`FAIL id=${id} status=${status}`);
    }
    if ((i+1) % 200 === 0) console.log(`Progress: ${i+1}/${updates.length}`);
  }
  console.log(`Done: ${ok} ok, ${fail} failed`);
}

main().catch(console.error);
