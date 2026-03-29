const { createClient } = require("@supabase/supabase-js");

const SUPA_URL = "https://yzwrumeukjidsguixqxr.supabase.co";
const SERVICE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl6d3J1bWV1a2ppZHNndWl4cXhyIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NDA1NzIzMCwiZXhwIjoyMDg5NjMzMjMwfQ.rs2b7Lj_UouXITpnwtoRa3EsRdytQCpJozAjAnnZuwE";
const sb = createClient(SUPA_URL, SERVICE_KEY);

// 国名 → 国番号マッピング
const COUNTRY_CODE = {
  'US':'+1','USA':'+1','United States':'+1','アメリカ':'+1',
  'CA':'+1','Canada':'+1','カナダ':'+1',
  'UK':'+44','United Kingdom':'+44','イギリス':'+44',
  'AU':'+61','Australia':'+61','オーストラリア':'+61',
  'JP':'+81','Japan':'+81','日本':'+81',
  'KR':'+82','Korea':'+82','韓国':'+82',
  'CN':'+86','China':'+86','中国':'+86',
  'TW':'+886','Taiwan':'+886','台湾':'+886',
  'SG':'+65','Singapore':'+65','シンガポール':'+65',
  'TH':'+66','Thailand':'+66','タイ':'+66',
  'VN':'+84','Vietnam':'+84','ベトナム':'+84',
  'MY':'+60','Malaysia':'+60','マレーシア':'+60',
  'PH':'+63','Philippines':'+63','フィリピン':'+63',
  'IN':'+91','India':'+91','インド':'+91',
  'SA':'+966','Saudi Arabia':'+966','サウジ':'+966',
  'DE':'+49','Germany':'+49','ドイツ':'+49',
  'FR':'+33','France':'+33','フランス':'+33',
  'IT':'+39','Italy':'+39','イタリア':'+39',
  'NL':'+31','Netherlands':'+31','オランダ':'+31',
  'ES':'+34','Spain':'+34','スペイン':'+34',
  'SE':'+46','Sweden':'+46','スウェーデン':'+46',
  'NP':'+977','Nepal':'+977','ネパール':'+977',
  'KG':'+996','Kyrgyzstan':'+996','キルギス':'+996',
  'BN':'+673','Brunei':'+673','ブルネイ':'+673',
  'SK':'+421','Slovakia':'+421','スロバキア':'+421',
  'RO':'+40','Romania':'+40','ルーマニア':'+40',
  'CH':'+41','Switzerland':'+41','スイス':'+41',
  'AE':'+971','United Arab Emirates':'+971','UAE':'+971','アラブ':'+971',
  'BR':'+55','Brazil':'+55','ブラジル':'+55',
  'MX':'+52','Mexico':'+52','メキシコ':'+52',
  'RU':'+7','Russia':'+7','ロシア':'+7',
  'NZ':'+64','New Zealand':'+64','ニュージーランド':'+64',
  'HK':'+852','Hong Kong':'+852','香港':'+852',
  'ID':'+62','Indonesia':'+62','インドネシア':'+62',
  'TR':'+90','Turkey':'+90','トルコ':'+90',
  'PK':'+92','Pakistan':'+92','パキスタン':'+92',
  'BD':'+880','Bangladesh':'+880','バングラデシュ':'+880',
  'LK':'+94','Sri Lanka':'+94','スリランカ':'+94',
  'IE':'+353','Ireland':'+353','アイルランド':'+353',
  'PT':'+351','Portugal':'+351','ポルトガル':'+351',
  'IL':'+972','Israel':'+972','イスラエル':'+972',
  'EG':'+20','Egypt':'+20','エジプト':'+20',
  'KE':'+254','Kenya':'+254','ケニア':'+254',
  'NG':'+234','Nigeria':'+234','ナイジェリア':'+234',
  'ZA':'+27','South Africa':'+27','南アフリカ':'+27',
};

function getCountryCode(country) {
  if (!country) return null;
  return COUNTRY_CODE[country] || COUNTRY_CODE[country.trim()] || null;
}

function normalizePhone(raw, countryCode) {
  if (!raw || raw === '-' || raw === '不明') return null;

  // 数字と+だけ残す
  let digits = raw.replace(/[^0-9+]/g, '');
  if (!digits || digits.replace(/\+/g, '').length < 5) return raw; // 短すぎるものはスキップ

  // 既に+始まりの場合はそのままフォーマット
  if (digits.startsWith('+')) {
    return formatWithDashes(digits);
  }

  // 00始まり（国際電話プレフィックス）
  if (digits.startsWith('00')) {
    digits = '+' + digits.slice(2);
    return formatWithDashes(digits);
  }

  // 日本の番号 (0始まり)
  if (digits.startsWith('0') && countryCode === '+81') {
    digits = '+81' + digits.slice(1);
    return formatWithDashes(digits);
  }

  // 0始まりで国番号がわかってる場合
  if (digits.startsWith('0') && countryCode) {
    digits = countryCode + digits.slice(1);
    return formatWithDashes(digits);
  }

  // 0始まりで国不明 → 日本と仮定
  if (digits.startsWith('0')) {
    digits = '+81' + digits.slice(1);
    return formatWithDashes(digits);
  }

  // 国番号なし、0なし → 国番号を付与
  if (countryCode) {
    digits = countryCode + digits;
    return formatWithDashes(digits);
  }

  return formatWithDashes('+' + digits);
}

function formatWithDashes(phone) {
  // +XX XXXX-XXXX 形式にフォーマット
  const match = phone.match(/^(\+\d{1,4})(\d+)$/);
  if (!match) return phone;

  const cc = match[1];
  let num = match[2];

  // 国番号ごとに適切なフォーマット
  if (cc === '+81') {
    // 日本: +81 90-1234-5678
    if (num.length === 10 && num.startsWith('9')) {
      return `${cc} ${num.slice(0,2)}-${num.slice(2,6)}-${num.slice(6)}`;
    }
    if (num.length === 10 && num.startsWith('3')) {
      return `${cc} ${num.slice(0,1)}-${num.slice(1,5)}-${num.slice(5)}`;
    }
    if (num.length === 9) {
      return `${cc} ${num.slice(0,1)}-${num.slice(1,5)}-${num.slice(5)}`;
    }
    return `${cc} ${num}`;
  }

  if (cc === '+1') {
    // 北米: +1 234-567-8901
    if (num.length === 10) {
      return `${cc} ${num.slice(0,3)}-${num.slice(3,6)}-${num.slice(6)}`;
    }
    return `${cc} ${num}`;
  }

  // その他: +XX で区切ってハイフンで4桁ずつ
  if (num.length > 6) {
    const parts = [];
    for (let i = 0; i < num.length; i += 4) {
      parts.push(num.slice(i, i + 4));
    }
    return `${cc} ${parts.join('-')}`;
  }

  return `${cc} ${num}`;
}

async function main() {
  // 取引先を取得（国情報）
  const { data: accounts } = await sb.from('sales_accounts').select('id, country');
  const acctCountry = {};
  (accounts || []).forEach(a => { acctCountry[a.id] = a.country; });

  // コンタクトを取得
  const { data: contacts } = await sb.from('sales_contacts').select('id, phone, whatsapp, account_id');

  let updated = 0;
  let skipped = 0;

  for (const c of (contacts || [])) {
    const country = acctCountry[c.account_id];
    const cc = getCountryCode(country);

    const newPhone = c.phone ? normalizePhone(c.phone, cc) : null;
    const newWhatsapp = c.whatsapp ? normalizePhone(c.whatsapp, cc) : null;

    const changes = {};
    if (newPhone !== c.phone && newPhone !== null) changes.phone = newPhone;
    if (newWhatsapp !== c.whatsapp && newWhatsapp !== null) changes.whatsapp = newWhatsapp;

    // "不明" は null に
    if (c.phone === '不明') changes.phone = null;
    if (c.whatsapp === '不明') changes.whatsapp = null;

    if (Object.keys(changes).length > 0) {
      const { error } = await sb.from('sales_contacts').update(changes).eq('id', c.id);
      if (error) {
        console.log(`✗ ${c.id}: ${error.message}`);
      } else {
        console.log(`✓ ${c.phone || '-'} → ${changes.phone || newPhone || '-'}${changes.whatsapp ? `  WA: ${c.whatsapp} → ${changes.whatsapp}` : ''}`);
        updated++;
      }
    } else {
      skipped++;
    }
  }

  console.log(`\n完了: ${updated}件更新, ${skipped}件スキップ`);
}

main().catch(console.error);
