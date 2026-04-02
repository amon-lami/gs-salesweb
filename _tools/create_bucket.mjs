const SERVICE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl6d3J1bWV1a2ppZHNndWl4cXhyIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NDA1NzIzMCwiZXhwIjoyMDg5NjMzMjMwfQ.rs2b7Lj_UouXITpnwtoRa3EsRdytQCpJozAjAnnZuwE";
const BASE = "https://yzwrumeukjidsguixqxr.supabase.co";

// List existing buckets
const list = await fetch(`${BASE}/storage/v1/bucket`, {
  headers: { "Authorization": `Bearer ${SERVICE_KEY}`, "apikey": SERVICE_KEY }
});
const buckets = await list.json();
console.log("Existing buckets:", buckets.map(b => b.name));

const exists = buckets.some(b => b.name === "product-images");
if (exists) {
  console.log("product-images bucket already exists");
} else {
  const res = await fetch(`${BASE}/storage/v1/bucket`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${SERVICE_KEY}`,
      "apikey": SERVICE_KEY,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ id: "product-images", name: "product-images", public: true })
  });
  const data = await res.json();
  console.log("Create result:", JSON.stringify(data));
}
