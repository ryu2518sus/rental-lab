'use client'
import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

export default function LoginPage() {
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [inviteCode, setInviteCode] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  // ★ここを新しい正しい招待コードに書き換えてください
  const INVITE_CODE = 'Katagirilabrental'; 

  // 通知用関数
  const notifySignup = async (sName: string, sId: string) => {
    await fetch('/api/notify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'ACCOUNT_SIGNUP', studentName: sName, studentId: sId })
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email || !password) return alert("入力が不足しています")
    
    setLoading(true)
    if (mode === 'login') {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) alert("ログイン失敗: " + error.message)
      else router.push('/')
    } else {
      if (!name || inviteCode !== INVITE_CODE) {
        alert("名前、または招待コードが正しくありません");
        setLoading(false); return;
      }
      
      const { data, error } = await supabase.auth.signUp({ 
        email, 
        password, 
        options: { data: { full_name: name } }
      })

      if (error) {
        alert("登録失敗: " + error.message)
      } else if (data.user) {
        // --- 【ここがポイント！】アカウント作成成功時に即通知 ---
        const studentIdFromEmail = email.split('@')[0].toUpperCase();
        await notifySignup(name, studentIdFromEmail);
        
        alert('アカウント申請を送信しました！管理者が承認するまでログインしてお待ちください。')
        setMode('login')
      }
    }
    setLoading(false)
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-slate-100 p-4 font-bold">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden border">
        <div className="flex bg-slate-100 p-1 m-6 rounded-2xl">
          <button onClick={() => setMode('login')} className={`flex-1 py-3 rounded-xl text-xs font-black transition-all ${mode === 'login' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-400'}`}>ログイン</button>
          <button onClick={() => setMode('signup')} className={`flex-1 py-3 rounded-xl text-xs font-black transition-all ${mode === 'signup' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-400'}`}>新規登録</button>
        </div>
        <form onSubmit={handleSubmit} className="px-8 pb-8 space-y-4">
          <h1 className="text-2xl font-black text-center text-slate-800 uppercase tracking-tighter italic">LAB LOGIN</h1>
          {mode === 'signup' && (
            <div className="space-y-4 animate-in fade-in slide-in-from-top-2">
              <div className="space-y-1">
                <label className="text-[10px] text-slate-400 ml-1">氏名</label>
                <input className="w-full p-4 bg-slate-50 border-2 rounded-2xl outline-none font-bold focus:border-blue-500 transition-all" placeholder="研究 太郎" value={name} onChange={e => setName(e.target.value)} />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] text-blue-400 ml-1 uppercase tracking-widest">招待コード</label>
                <input className="w-full p-4 bg-blue-50 border-2 border-blue-100 rounded-2xl outline-none font-bold" placeholder="招待コードを入力" value={inviteCode} onChange={e => setInviteCode(e.target.value)} />
              </div>
            </div>
          )}
          <div className="space-y-1">
            <label className="text-[10px] text-slate-400 ml-1">大学メールアドレス</label>
            <input className="w-full p-4 bg-slate-50 border-2 rounded-2xl outline-none font-bold focus:border-blue-500" type="email" placeholder="00im0000@i-u.ac.jp" value={email} onChange={e => setEmail(e.target.value)} />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] text-slate-400 ml-1">パスワード</label>
            <input className="w-full p-4 bg-slate-50 border-2 rounded-2xl outline-none font-bold focus:border-blue-500" type="password" placeholder="6文字以上" value={password} onChange={e => setPassword(e.target.value)} />
          </div>
          <button type="submit" disabled={loading} className="w-full py-5 bg-blue-600 text-white rounded-2xl font-black shadow-lg hover:bg-blue-700 disabled:bg-slate-200 transition-all active:scale-95 shadow-blue-100">
            {loading ? '処理中...' : mode === 'login' ? 'LOGIN' : 'APPLY FOR ACCESS'}
          </button>
        </form>
        <p className="text-center pb-6 text-[9px] text-slate-300 font-bold uppercase tracking-widest">招待コードによる許可制システム</p>
      </div>
    </div>
  )
}