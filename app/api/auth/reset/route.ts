import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

// 管理者権限でのDBアクセス（ユーザー削除等に利用したのと同じ設定）
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: Request) {
  try {
    const { studentId, fullName, newPassword } = await req.json();

    // 1. profilesテーブルから ID と 名前が一致するユーザーを探す
    const { data: profile, error: findError } = await supabaseAdmin
      .from('profiles')
      .select('id, student_id, full_name')
      .eq('student_id', studentId)
      .eq('full_name', fullName)
      .single();

    if (findError || !profile) {
      return NextResponse.json({ error: '一致するユーザーが見つかりません。学籍番号または名前を確認してください。' }, { status: 404 });
    }

    // 2. ユーザーを特定できたので、管理者権限でパスワードを強制変更
    const { error: resetError } = await supabaseAdmin.auth.admin.updateUserById(
      profile.id,
      { password: newPassword }
    );

    if (resetError) {
      throw resetError;
    }

    // 3. セキュリティ監査のため、管理者のSlackに「パスワードが変更された」通知を送る
    if (process.env.SLACK_WEBHOOK_URL) {
      const slackMsg = `🔐 *【パスワード強制リセット実行】*\n👤 ユーザー: ${fullName} (${studentId})\n⚠️ 本人による操作か確認してください。`;
      await fetch(process.env.SLACK_WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: slackMsg }),
      });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}