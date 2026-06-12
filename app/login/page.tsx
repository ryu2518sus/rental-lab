'use client'
import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

export default function LoginPage() {
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [inviteCode, setInviteCode] = useState('') // 招待コード用の状態
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  const INVITE_CODE = 'Katagirilablental'; // 指定された招待コード

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email || !password) return alert("メールアドレスとパスワードを入力してください")
    
    setLoading(true)
    if (mode === 'login') {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) alert("ログイン失敗: " + error.message)
      else router.push('/')
    } else {
      // --- 新規登録時のバリデーション ---
      if (!name) {
        alert("名前を入力してください")
        setLoading(false)
        return
      }
      if (inviteCode !== INVITE_CODE) {
        alert("招待コードが正しくありません。研究室の管理者に確認してください。")
        setLoading(false)
        return
      }
      if (password.length < 6) {
        alert("パスワードは6文字以上にしてください")
        setLoading(false)
        return
      }

      const { data, error } = await supabase.auth.signUp({ 
        email, 
        password,
        options: {
          data: { full_name: name }
        }
      })
      if (error) alert("登録失敗: " + error.message)
      else if (data.user) {
        alert('アカウントを作成しました！そのままログインしてください。')
        setMode('login')
      }
    }
    setLoading(false)
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-slate-100 p-4 font-bold">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden border border-white">
        
        {/* モード切り替えタブ */}
        <div className="flex bg-slate-100 p-1 m-6 rounded-2xl">
          <button 
            onClick={() => setMode('login')}
            className={`flex-1 py-3 rounded-xl text-sm font-black transition-all ${mode === 'login' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-400'}`}
          >
            ログイン
          </button>
          <button 
            onClick={() => setMode('signup')}
            className={`flex-1 py-3 rounded-xl text-sm font-black transition-all ${mode === 'signup' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-400'}`}
          >
            新規登録
          </button>
        </div>

        <div className="px-8 pb-8 space-y-6">
          <div className="text-center">
            <h1 className="text-3xl font-black text-slate-800 tracking-tighter uppercase">
              {mode === 'login' ? 'Welcome Back' : 'Join Lab'}
            </h1>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-2 leading-relaxed">
              {mode === 'login' ? '研究室システムにログイン' : '招待コードを入力してアカウント作成'}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* 新規登録時のみ表示される項目 */}
            {mode === 'signup' && (
              <div className="space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase ml-1">氏名</label>
                  <input 
                    required
                    className="w-full p-4 bg-slate-50 border-2 border-slate-50 rounded-2xl outline-none focus:border-blue-500 transition-all"
                    placeholder="研究 太郎" 
                    value={name} 
                    onChange={(e) => setName(e.target.value)} 
                  />
                </div>
                <div className="space-y-1 text-blue-600">
                  <label className="text-[10px] font-black text-blue-400 uppercase ml-1 tracking-widest">招待コード</label>
                  <input 
                    required
                    className="w-full p-4 bg-blue-50 border-2 border-blue-100 rounded-2xl outline-none focus:border-blue-500 transition-all placeholder-blue-200"
                    placeholder="招待コードを入力" 
                    value={inviteCode} 
                    onChange={(e) => setInviteCode(e.target.value)} 
                  />
                </div>
              </div>
            )}

            <div className="space-y-1">
              <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Email</label>
              <input 
                type="email" required
                className="w-full p-4 bg-slate-50 border-2 border-slate-50 rounded-2xl outline-none focus:border-blue-500 transition-all font-bold"
                placeholder="00im0000@i-u.ac.jp" 
                value={email} onChange={(e) => setEmail(e.target.value)} 
              />
            </div>
            
            <div className="space-y-1">
              <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Password</label>
              <input 
                type="password" required
                className="w-full p-4 bg-slate-50 border-2 border-slate-50 rounded-2xl outline-none focus:border-blue-500 transition-all font-bold"
                placeholder="6文字以上のパスワード" 
                value={password} onChange={(e) => setPassword(e.target.value)} 
              />
            </div>

            <button 
              type="submit"
              disabled={loading}
              className={`w-full py-5 rounded-2xl font-black text-lg shadow-lg transition-all active:scale-95 mt-4 ${
                loading ? 'bg-slate-200 text-slate-400' : 'bg-blue-600 text-white hover:bg-blue-700 shadow-blue-100'
              }`}
            >
              {loading ? '処理中...' : mode === 'login' ? 'LOGIN' : 'CREATE ACCOUNT'}
            </button>
          </form>

          <p className="text-center text-[10px] font-bold text-slate-300 uppercase tracking-widest leading-relaxed">
            © 2024 Lab Rental System<br/>招待コードが必要です
          </p>
        </div>
      </div>
    </div>
  )
}