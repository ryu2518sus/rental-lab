'use client'
import { useState } from 'react'

export default function ResetPasswordPage() {
  const [studentId, setStudentId] = useState('')
  const [fullName, setFullName] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [isAgreed, setIsAgreed] = useState(false) // チェックボックスの状態
  const [loading, setLoading] = useState(false)

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!isAgreed) return alert("注意事項を確認し、チェックを入れてください")
    if (newPassword !== confirmPassword) return alert("新しいパスワードが一致しません")
    if (newPassword.length < 6) return alert("パスワードは6文字以上にしてください")

    setLoading(true)
    try {
      const res = await fetch('/api/auth/reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ studentId, fullName, newPassword })
      });
      const data = await res.json();

      if (res.ok) {
        alert("パスワードを再設定しました。このタブを閉じてログインしてください。");
        window.close();
      } else {
        alert("リセット失敗: " + (data.error || "学籍番号または氏名が一致しません。"));
      }
    } catch (err) {
      alert("通信エラーが発生しました");
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col items-center justify-center p-4 font-black">
      <div className="bg-white p-8 md:p-10 rounded-[2.5rem] shadow-2xl w-full max-w-md space-y-8 border-4 border-blue-600 animate-in zoom-in-95">
        <div className="text-center space-y-2">
          <div className="w-16 h-16 bg-blue-600 text-white rounded-2xl flex items-center justify-center mx-auto text-3xl italic shadow-lg shadow-blue-200">!</div>
          <h1 className="text-2xl font-black text-slate-800 tracking-tighter">PASSWORD RESET</h1>
          <p className="text-[10px] text-slate-400 uppercase tracking-widest font-black">学籍番号と氏名を入力してください</p>
        </div>

        <form onSubmit={handleReset} className="space-y-4">
          <div className="space-y-1">
            <label className="text-[10px] text-slate-500 ml-1">学生ID</label>
            <input required className="w-full p-4 bg-slate-50 border-2 rounded-2xl outline-none focus:border-blue-500 font-bold transition-all" 
                   placeholder="24IM0000" value={studentId} onChange={e => setStudentId(e.target.value.toUpperCase())} />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] text-slate-500 ml-1">登録名（フルネーム）</label>
            <input required className="w-full p-4 bg-slate-50 border-2 rounded-2xl outline-none focus:border-blue-500 font-bold transition-all" 
                   placeholder="研究 太郎" value={fullName} onChange={e => setFullName(e.target.value)} />
          </div>

          <div className="bg-blue-50 p-5 rounded-2xl border-2 border-blue-100 space-y-4 font-black">
             <div className="space-y-1">
                <label className="text-[10px] text-blue-600 ml-1">新しいパスワード</label>
                <input required type="password" placeholder="6文字以上" className="w-full p-3 rounded-xl border-none font-bold" 
                       value={newPassword} onChange={e => setNewPassword(e.target.value)} />
             </div>
             <div className="space-y-1">
                <label className="text-[10px] text-blue-600 ml-1">新しいパスワード（確認）</label>
                <input required type="password" placeholder="もう一度入力" className="w-full p-3 rounded-xl border-none font-bold" 
                       value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} />
             </div>
          </div>

          {/* --- 注意事項チェックボックス --- */}
          <label className="flex items-start gap-3 p-4 bg-red-50 border-2 border-red-100 rounded-2xl cursor-pointer hover:bg-red-100 transition-colors group">
            <input 
              type="checkbox" 
              checked={isAgreed} 
              onChange={e => setIsAgreed(e.target.checked)} 
              className="mt-1 w-5 h-5 rounded-md accent-red-600 cursor-pointer"
            />
            <div className="flex-1 text-red-600 text-xs leading-relaxed font-black">
              【重要】パスワードを忘れた場合は、リセットする前に<span className="underline decoration-2">必ず片桐先生に直接または連絡ツールで一報入れました。</span>
            </div>
          </label>

          <button 
            type="submit" 
            disabled={loading || !isAgreed} 
            className={`w-full py-5 rounded-3xl font-black text-lg shadow-lg transition-all active:scale-95 uppercase tracking-widest ${
              isAgreed ? 'bg-slate-800 text-white hover:bg-black' : 'bg-slate-200 text-slate-400 cursor-not-allowed'
            }`}
          >
            {loading ? 'RESETTING...' : 'RESET PASSWORD'}
          </button>
        </form>
      </div>
    </div>
  )
}