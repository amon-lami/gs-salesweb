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
    const { text, file_base64, file_type, api_key, product_hints } = body;

    if (!api_key) {
      return new Response(JSON.stringify({ error: "APIキーが設定されていません" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (!text && !file_base64) {
      return new Response(JSON.stringify({ error: "テキストまたはファイルが必要です" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const systemPrompt = `あなたはGlobal Stride社（J-Beauty輸出商社）の発注書解析AIです。
顧客からの発注テキストやファイルを解析し、商品・数量の抽出に加え、値引き交渉・特記事項も検出してください。

## 解析ルール
1. 各行/各エントリから「商品名 or JANコード」と「数量」を抽出
2. JANコード(8桁 or 13桁)が見つかればそれを優先
3. 数量の表現は柔軟に解釈: "x10", "10pcs", "10個", "qty: 10", "10 cases" 等
4. 商品名が曖昧・略称の場合、product_hintsから最も近い商品を推定
5. 確信度が低い場合は warnings に日本語で理由を記載

## 特記事項の検出（重要）
以下のような商品注文以外の情報を必ず notes に抽出すること：
- 値引き・ディスカウント依頼（例: "10% off", "値引き希望", "discount", "特別価格"）
- 支払い条件（例: "NET30", "前払い", "T/T", "L/C"）
- 納期・配送要望（例: "急ぎ", "by April", "4月末まで", "air shipment"）
- 梱包指示（例: "パレット", "個別梱包", "ラベル貼り"）
- その他の交渉・依頼・コメント
notes は日本語で、スタッフが確認しやすい形で記載すること。

## 出力形式（必ずこのJSON形式で返す）
{
  "items": [
    { "jan": "4901234567890", "name_guess": "商品名", "quantity": 10, "confidence": "high" },
    { "jan": null, "name_guess": "検索キーワード", "quantity": 5, "confidence": "medium" }
  ],
  "warnings": ["3行目: 商品名が曖昧 - TSUBAKIシリーズは複数あり。Premium Moist Shampoo 490mlと推定"],
  "notes": ["値引き依頼: 全体10%オフを希望", "納期: 4月末までに発送希望", "支払条件: NET30を希望"],
  "summary": "5商品・合計50個の注文を検出。値引き交渉あり。"
}

## confidence レベル
- "high": JAN完全一致、または商品名が明確
- "medium": 商品名から推定（略称・スペルミス等）
- "low": 不確実、要確認

全ての出力メッセージは日本語で記載すること。`;

    const userContent: any[] = [];

    if (file_base64 && file_type) {
      if (file_type.startsWith("image/") || file_type === "application/pdf") {
        userContent.push({
          type: "image",
          source: { type: "base64", media_type: file_type, data: file_base64 }
        });
      }
    }

    let userText = "";
    if (text) {
      userText += `## 発注テキスト\n${text}\n\n`;
    }
    if (file_base64 && !file_type?.startsWith("image/") && file_type !== "application/pdf") {
      userText += `## ファイル内容\n${atob(file_base64)}\n\n`;
    }
    if (product_hints) {
      userText += `## 商品マスタ（参照用）\n${product_hints}\n\n`;
    }
    userText += "上記の発注内容を解析して、JSON形式で返してください。商品情報だけでなく、値引き交渉・支払条件・納期希望・その他の特記事項も必ず抽出してください。";
    userContent.push({ type: "text", text: userText });

    const resp = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": api_key,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 4096,
        system: systemPrompt,
        messages: [{ role: "user", content: userContent }],
      }),
    });

    const result = await resp.json();

    if (!resp.ok) {
      return new Response(JSON.stringify({ error: result.error?.message || "Claude APIエラー" }),
        { status: resp.status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const aiText = result.content?.[0]?.text || "";
    let parsed;
    try {
      const jsonMatch = aiText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        parsed = JSON.parse(jsonMatch[0]);
      } else {
        parsed = { items: [], warnings: ["AIからの応答を解析できませんでした"], notes: [], summary: aiText };
      }
    } catch {
      parsed = { items: [], warnings: ["JSON解析エラー"], notes: [], summary: aiText };
    }

    // Ensure notes array exists
    if (!parsed.notes) parsed.notes = [];

    return new Response(JSON.stringify({
      ...parsed,
      usage: result.usage,
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
