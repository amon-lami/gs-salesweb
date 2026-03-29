import { useState, useEffect } from "react";
import { SupabaseClient } from "@supabase/supabase-js";
import { Deal, Account, AppUser } from "@/types/database";
import { useToast } from "@/components/shared/ToastProvider";
import { T, STAGES, fmtDealAmt } from "@/lib/constants";

interface Props {
  deals: Deal[];
  accounts: Account[];
  client: SupabaseClient;
  user: AppUser;
  allUsers: AppUser[];
  onOpenDeal?: (deal: Deal) => void;
}

export function WeeklyReportPage({
  deals,
  accounts,
  client,
  user,
  allUsers: _allUsers,
  onOpenDeal,
}: Props) {
  const toast = useToast();
  const [pendingDeals, setPendingDeals] = useState<any[]>([]);
  const [reportTexts, setReportTexts] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState<Record<string, boolean>>({});
  const [loaded, setLoaded] = useState(false);

  const getWeekStart = (): string => {
    const now = new Date();
    const day = now.getDay();
    const diff = now.getDate() - day + (day === 0 ? -6 : 1);
    const monday = new Date(now.setDate(diff));
    monday.setHours(0, 0, 0, 0);
    return monday.toISOString();
  };

  useEffect(() => {
    (async () => {
      const weekStart = getWeekStart();
      const myDeals = deals.filter(
        (d) =>
          d.owner_id === user.id && d.stage !== "closed" && d.stage !== "lost"
      );
      const { data: reports } = await client
        .from("sales_activities")
        .select("deal_id")
        .eq("type", "weekly_report")
        .eq("user_id", user.id)
        .gte("created_at", weekStart);
      const reportedDealIds = new Set(
        (reports || []).map((r: any) => r.deal_id)
      );
      setPendingDeals(myDeals.filter((d) => !reportedDealIds.has(d.id)));
      setLoaded(true);
    })();
  }, [deals, user.id]);

  const submitReport = async (dealId: string) => {
    const text = reportTexts[dealId]?.trim();
    if (!text) return;
    setSubmitting((s) => ({ ...s, [dealId]: true }));
    try {
      const deal = deals.find((d) => d.id === dealId);
      await client.from("sales_activities").insert({
        deal_id: dealId,
        account_id: deal?.account_id,
        user_id: user.id,
        type: "weekly_report",
        subject: "週次レポートを提出しました",
        content: text,
      });
      if (deal?.chat_room_id) {
        const chatMsg = `📋 週次レポート\n${text}`;
        await client.from("chat_messages").insert({
          room_id: deal.chat_room_id,
          user_id: user.id,
          content: chatMsg,
          type: "text",
        });
      }
      setPendingDeals((prev) => prev.filter((d) => d.id !== dealId));
      setReportTexts((prev) => {
        const n = { ...prev };
        delete n[dealId];
        return n;
      });
      toast("週次レポートを提出しました");
    } catch (e: any) {
      toast("送信エラー: " + e.message, "error");
    }
    setSubmitting((s) => ({ ...s, [dealId]: false }));
  };

  if (!loaded)
    return (
      <div
        style={{
          flex: 1,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <span style={{ fontSize: 11, color: T.muted }}>読み込み中...</span>
      </div>
    );

  return (
    <div style={{ flex: 1, overflowY: "auto", padding: "16px 20px" }}>
      <div
        style={{
          fontSize: 14,
          fontWeight: 700,
          color: T.primary,
          marginBottom: 4,
        }}
      >
        週次レポート
      </div>
      <div style={{ fontSize: 11, color: T.muted, marginBottom: 16 }}>
        担当商談の週次報告を入力してください（{pendingDeals.length}件未提出）
      </div>
      {pendingDeals.length === 0 && (
        <div
          style={{
            textAlign: "center",
            padding: "40px 0",
            color: "#ccc",
            fontSize: 12,
          }}
        >
          全レポート提出済み
        </div>
      )}
      {pendingDeals.map((d: any) => {
        const acct = accounts.find((a) => a.id === d.account_id);
        return (
          <div
            key={d.id}
            style={{
              background: T.card,
              border: `1px solid ${T.border}`,
              borderRadius: 8,
              padding: "14px 16px",
              marginBottom: 10,
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: 8,
              }}
            >
              <div>
                <div
                  style={{
                    fontSize: 12,
                    fontWeight: 700,
                    color: T.accent,
                    cursor: "pointer",
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (onOpenDeal) onOpenDeal(d);
                  }}
                >
                  {d.name}
                </div>
                <div style={{ fontSize: 10, color: T.muted }}>
                  {acct?.name || "-"} ·{" "}
                  {STAGES.find((s) => s.id === d.stage)?.ja} ·{" "}
                  {fmtDealAmt(d.amount)}
                </div>
              </div>
            </div>
            <textarea
              value={reportTexts[d.id] || ""}
              onChange={(e) =>
                setReportTexts((prev) => ({
                  ...prev,
                  [d.id]: e.target.value,
                }))
              }
              placeholder="今週の進捗・課題・来週の予定..."
              style={{
                width: "100%",
                minHeight: 70,
                padding: "8px",
                border: `1px solid ${T.border}`,
                borderRadius: 5,
                fontSize: 11.5,
                outline: "none",
                fontFamily: "inherit",
                lineHeight: 1.5,
                resize: "vertical",
                marginBottom: 8,
                boxSizing: "border-box",
              }}
            />
            <div style={{ display: "flex", justifyContent: "flex-end" }}>
              <button
                onClick={() => submitReport(d.id)}
                disabled={
                  submitting[d.id] || !reportTexts[d.id]?.trim()
                }
                style={{
                  padding: "5px 14px",
                  borderRadius: 5,
                  border: "none",
                  fontSize: 11,
                  fontWeight: 600,
                  cursor: "pointer",
                  background: T.primary,
                  color: "#fff",
                  fontFamily: "inherit",
                  opacity:
                    submitting[d.id] || !reportTexts[d.id]?.trim()
                      ? 0.4
                      : 1,
                }}
              >
                {submitting[d.id] ? "送信中..." : "提出"}
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
