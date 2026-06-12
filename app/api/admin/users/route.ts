import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

// service_roleキーを使用して、管理者権限で実行
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET() {
  const { data: { users }, error } = await supabaseAdmin.auth.admin.listUsers()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ users })
}

export async function DELETE(req: Request) {
  try {
    const { userId } = await req.json()
    const { error } = await supabaseAdmin.auth.admin.deleteUser(userId)
    if (error) throw error
    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}