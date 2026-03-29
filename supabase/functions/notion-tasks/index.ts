const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, apikey",
};
const jsonH = { ...corsHeaders, "Content-Type": "application/json" };
const notionH = (token: string) => ({
  "Content-Type": "application/json",
  "Authorization": "Bearer " + token,
  "Notion-Version": "2022-06-28"
});

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }
  try {
    const body = await req.json();
    const { notion_token, database_id, action } = body;
    if (!notion_token) {
      return new Response(JSON.stringify({ error: "notion_token is required" }),
        { status: 400, headers: jsonH });
    }
    if (action === "add") {
      const { title, assignee } = body;
      if (!title || !database_id) {
        return new Response(JSON.stringify({ error: "title and database_id required" }),
          { status: 400, headers: jsonH });
      }
      const props: any = {
        "\u30bf\u30b9\u30af\u540d": { title: [{ text: { content: title } }] },
        "\u5b8c\u4e86": { checkbox: false }
      };
      if (assignee && assignee !== "None") {
        props["\u62c5\u5f53\u8005"] = { select: { name: assignee } };
      }
      const resp = await fetch("https://api.notion.com/v1/pages", {
        method: "POST",
        headers: notionH(notion_token),
        body: JSON.stringify({ parent: { database_id }, properties: props })
      });
      const result = await resp.json();
      if (!resp.ok) {
        return new Response(JSON.stringify({ error: result.message || "Notion API error" }),
          { status: resp.status, headers: jsonH });
      }
      return new Response(JSON.stringify({ ok: true, id: result.id }), { status: 200, headers: jsonH });
    }
    if (action === "toggle") {
      const { page_id, done } = body;
      if (!page_id) {
        return new Response(JSON.stringify({ error: "page_id required" }),
          { status: 400, headers: jsonH });
      }
      const resp = await fetch("https://api.notion.com/v1/pages/" + page_id, {
        method: "PATCH",
        headers: notionH(notion_token),
        body: JSON.stringify({ properties: { "\u5b8c\u4e86": { checkbox: !!done } } })
      });
      const result = await resp.json();
      if (!resp.ok) {
        return new Response(JSON.stringify({ error: result.message || "Notion API error" }),
          { status: resp.status, headers: jsonH });
      }
      return new Response(JSON.stringify({ ok: true }), { status: 200, headers: jsonH });
    }
    if (action === "update") {
      const { page_id, title } = body;
      if (!page_id || !title) {
        return new Response(JSON.stringify({ error: "page_id and title required" }),
          { status: 400, headers: jsonH });
      }
      const resp = await fetch("https://api.notion.com/v1/pages/" + page_id, {
        method: "PATCH",
        headers: notionH(notion_token),
        body: JSON.stringify({
          properties: { "\u30bf\u30b9\u30af\u540d": { title: [{ text: { content: title } }] } }
        })
      });
      const result = await resp.json();
      if (!resp.ok) {
        return new Response(JSON.stringify({ error: result.message || "Notion API error" }),
          { status: resp.status, headers: jsonH });
      }
      return new Response(JSON.stringify({ ok: true }), { status: 200, headers: jsonH });
    }
    if (!database_id) {
      return new Response(JSON.stringify({ error: "database_id is required" }),
        { status: 400, headers: jsonH });
    }
    const resp = await fetch("https://api.notion.com/v1/databases/" + database_id + "/query", {
      method: "POST",
      headers: notionH(notion_token),
      body: JSON.stringify({
        filter: { property: "\u5b8c\u4e86", checkbox: { equals: false } },
        sorts: [{ timestamp: "created_time", direction: "descending" }],
        page_size: 100
      })
    });
    if (!resp.ok) {
      const err = await resp.json();
      return new Response(JSON.stringify({ error: err.message || "Notion API error" }),
        { status: resp.status, headers: jsonH });
    }
    const data = await resp.json();
    const tasks = (data.results || []).map((p: any) => ({
      id: p.id,
      title: p.properties["\u30bf\u30b9\u30af\u540d"]?.title?.[0]?.plain_text || "",
      assignee: p.properties["\u62c5\u5f53\u8005"]?.select?.name || "None",
      status: p.properties["\u30b9\u30c6\u30fc\u30bf\u30b9"]?.status?.name || "\u672a\u7740\u624b",
      done: p.properties["\u5b8c\u4e86"]?.checkbox || false,
      created: p.created_time,
      url: p.url
    }));
    return new Response(JSON.stringify({ tasks }), { status: 200, headers: jsonH });
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }),
      { status: 500, headers: jsonH });
  }
});