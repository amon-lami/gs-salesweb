const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, apikey, x-anthropic-key",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }
  try {
    const body = await req.json();
    const { image_base64, media_type, api_key, test, categories } = body;
    if (!api_key) {
      return new Response(JSON.stringify({ error: "api_key is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // テストモード: 画像なしでAPIキーの有効性だけ確認
    if (test) {
      const resp = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-api-key": api_key, "anthropic-version": "2023-06-01" },
        body: JSON.stringify({ model: "claude-sonnet-4-20250514", max_tokens: 10, messages: [{ role: "user", content: "Reply OK" }] }),
      });
      const result = await resp.json();
      if (!resp.ok) {
        return new Response(JSON.stringify({ error: result.error?.message || "API error" }),
          { status: resp.status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      return new Response(JSON.stringify({ ok: true }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // 通常モード: レシート/請求書OCR（画像 + PDF対応）
    if (!image_base64) {
      return new Response(JSON.stringify({ error: "image_base64 is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const mt = media_type || "image/jpeg";
    const isPdf = mt === "application/pdf";

    // カテゴリリスト
    const catList = Array.isArray(categories) && categories.length > 0
      ? categories.filter(c => c !== "その他").join(", ") + ", その他"
      : "BtoB, Amazon, Shopee, KG, 雑費, 会議費・交際費, 交通費, 送料・物流費, その他";

    const prompt = `このレシートまたは請求書から以下の情報をJSON形式で抽出してください。読み取れない項目はnullにしてください。
{
  "purchase_location": "店名または請求元の会社名",
  "product": "主な商品名またはサービス名（複数あればカンマ区切り）",
  "amount": 合計金額（数値のみ、税込）,
  "expense_date": "YYYY-MM-DD",
  "tax_category": "課税10%" or "課税8%（軽減）" or "非課税" or "不課税",
  "category": "${catList}" のうち最も適切なもの1つ
}
注意:
- BtoBは海外顧客向けの取引に使います。仕入先や国内の経費にはBtoBを選ばないでください。
- JSONのみ返してください。`;

    // PDF → document type, 画像 → image type
    const contentBlock = isPdf
      ? { type: "document", source: { type: "base64", media_type: "application/pdf", data: image_base64 } }
      : { type: "image", source: { type: "base64", media_type: mt, data: image_base64 } };

    const resp = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": api_key, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514", max_tokens: 500,
        messages: [{ role: "user", content: [
          contentBlock,
          { type: "text", text: prompt }
        ]}]
      }),
    });
    const result = await resp.json();
    if (!resp.ok) {
      return new Response(JSON.stringify({ error: result.error?.message || "API error" }),
        { status: resp.status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    return new Response(JSON.stringify(result),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});