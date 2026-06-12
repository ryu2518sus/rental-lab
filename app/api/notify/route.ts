import { NextResponse } from 'next/server';
import { Resend } from 'resend';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { type, to, studentName, studentId, items, startDate, endDate, days, purpose } = body;

    // --- ターミナルでの状況確認ログ ---
    console.log("-----------------------------------------");
    console.log("🚀 通知リクエスト受信:", type);
    console.log("📡 Slack URL設定状況:", process.env.SLACK_WEBHOOK_URL ? "OK (取得済み)" : "❌ 設定されていません");
    
    // --- Slack用テキスト組み立て ---
    let slackText = "";
    if (type === 'REQUEST_TO_ADMIN') slackText = ` <!channel> \n📢 *【貸出申請】*\n👤 *申請者:* ${studentName} (${studentId})\n🗓 *期間:* ${startDate} ～ ${endDate}\n📝 *目的:* ${purpose || '未記入'}\n📦 *機材:* ${items?.join(', ')}`;
    else if (type === 'RETURN_REQUEST') slackText = ` <!channel> \n↩️ *【返却申請】*\n👤 *申請者:* ${studentName} (${studentId})\n📦 *機材:* ${items?.join(', ')}`;
    else if (type === 'EXTENSION_REQUEST') slackText = ` <!channel> \n⏳ *【延長申請】*\n👤 *申請者:* ${studentName} (${studentId})\n➕ *日数:* ${days}日間\n📦 *機材:* ${items?.join(', ')}`;
    else if (type === 'ACCOUNT_SIGNUP') slackText = ` <!channel> \n🆕 *【新規アカウント】*\n👤 *名前:* ${studentName}\n🆔 *ID:* ${studentId}\n⚠️ 管理画面から承認してください。`;

    // --- 【重要】Slack送信を先に、かつ独立して行う ---
    if (slackText && process.env.SLACK_WEBHOOK_URL) {
      try {
        const slackRes = await fetch(process.env.SLACK_WEBHOOK_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: slackText }),
        });
        if (slackRes.ok) console.log("✅ Slack通知の送信に成功しました！");
        else console.error("❌ Slack通知に失敗:", slackRes.status, await slackRes.text());
      } catch (e) {
        console.error("❌ Slack Fetchエラー:", e);
      }
    }

    // --- 【おまけ】Email送信（エラーが起きても無視する） ---
    const resendKey = process.env.RESEND_API_KEY;
    if (resendKey && to && !to.includes('あなたの')) {
      try {
        const resend = new Resend(resendKey);
        await resend.emails.send({
          from: 'LabManagement <onboarding@resend.dev>',
          to: [to],
          subject: '機材管理通知',
          html: `<p>${slackText.replace(/\n/g, '<br>')}</p>`,
        });
        console.log("✅ Email送信に成功");
      } catch (e: any) {
        console.warn("⚠️ Email送信スキップまたは失敗 (原因は宛先の文字不正):", e.message);
      }
    } else {
      console.log("⚠️ 宛先が不適切なためEmail送信をスキップしました");
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("🔥 通知API内部で重大なエラー:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}