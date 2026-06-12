'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

export default function LabRentalSystem() {
  const router = useRouter()
  
  // --- 状態管理 ---
  const [activeTab, setActiveTab] = useState<'status' | 'apply-manage' | 'admin-approval' | 'admin-users' | 'profile'>('status');
  const [subTab, setSubTab] = useState<'loan' | 'return'>('loan');
  const [adminSubTab, setAdminSubTab] = useState<'loan' | 'return' | 'extension' | 'account'>('loan');
  
  const [items, setItems] = useState<any[]>([]); 
  const [loans, setLoans] = useState<any[]>([]); 
  const [allProfiles, setAllProfiles] = useState<any[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('すべて');
  
  const [userId, setUserId] = useState('');
  const [studentId, setStudentId] = useState(''); 
  const [studentName, setStudentName] = useState('');
  const [userEmail, setUserEmail] = useState('');
  const [purpose, setPurpose] = useState(''); 
  const [isAdmin, setIsAdmin] = useState(false);
  const [isApproved, setIsApproved] = useState(false);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [keepList, setKeepList] = useState<string[]>([]);
  const [selectedItemDetail, setSelectedItemDetail] = useState<any>(null);

  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [pwUpdating, setPwUpdating] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);

  // --- 変数定義 ---
  const categories = ['すべて', ...Array.from(new Set(items.map(item => item.category)))];
  const filteredStatus = items.filter(i => selectedCategory === 'すべて' || i.category === selectedCategory);
  const pendingLoans = loans.filter(l => l.loan_approved_at === null);
  const pendingReturns = loans.filter(l => l.return_requested_at !== null && l.returned_at === null);
  const pendingExtensions = loans.filter(l => l.extension_requested_at !== null);

  // --- 初期化 ---
  useEffect(() => {
    const initialize = async () => {
      try {
        setLoading(true);
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) { router.push('/login'); return; }

        setUserId(user.id);
        setUserEmail(user.email || '');

        const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).maybeSingle();
        if (profile) {
          setIsAdmin(profile.is_admin);
          setIsApproved(profile.is_approved);
          setStudentId(profile.student_id || '');
          setStudentName(profile.full_name || '');
          
          if (!profile.is_approved && !profile.is_admin && profile.student_id) {
            notify({ type: 'ACCOUNT_SIGNUP', studentName: profile.full_name, studentId: profile.student_id });
          }
        }
        await fetchData();
      } catch (e) { console.error(e); }
      finally { setLoading(false); }
    };
    initialize();
  }, [router]);

  useEffect(() => { if (activeTab === 'admin-users' && isAdmin) fetchProfiles(); }, [activeTab, isAdmin]);

  async function fetchData() {
 
    const { data: it } = await supabase.from('items').select('*').order('category');
    console.log("機材データの中身:", it);
    const { data: ln } = await supabase.from('loans').select('*, items(*)').is('returned_at', null);
    setItems(it || []); setLoans(ln || []);
    const pc = (ln || []).filter(l => l.loan_approved_at === null || l.return_requested_at !== null || l.extension_requested_at !== null).length;
    const ac = allProfiles.filter(p => !p.is_approved && !p.is_admin).length;
    setPendingCount(pc + ac);
  }

  async function fetchProfiles() {
    const { data } = await supabase.from('profiles').select('*').order('is_approved', { ascending: true });
    if (data) setAllProfiles(data);
  }

  // --- 通知API ---
  const notify = async (payload: any) => {
    try {
      await fetch('/api/notify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
    } catch (e) { console.error(e); }
  };

  // --- 申請アクション ---
  const handleLoanRequest = async () => {
    if (!startDate || !endDate || !purpose || keepList.length === 0) return alert("必要事項をすべて入力してください");
    const { error } = await supabase.from('loans').insert(keepList.map(id => ({ 
      item_id: id, student_id: studentId, student_name: studentName, start_date: startDate, end_date: endDate, purpose: purpose 
    })));
if (!error) {
      await supabase.from('items').update({ is_available: false }).in('id', keepList);

      // --- Slackに通知を飛ばす ---
      notify({ 
        type: 'REQUEST_TO_ADMIN', 
        studentName, 
        studentId, 
        startDate, 
        endDate, 
        purpose, 
        items: items.filter(i => keepList.includes(i.id)).map(i => i.name),
        // 管理者がメールを受け取りたい場合は自分のアドレスを書く（Resendの認証済みメアドのみ可能）
        to: '' 
      });
      setKeepList([]); setPurpose(''); fetchData(); setActiveTab('status');
    }
  };

  // --- 取消アクション ---
  const handleCancelLoan = async (loanId: string, itemId: string) => {
    if (!confirm("貸出申請を取り消しますか？")) return;
    await supabase.from('loans').delete().eq('id', loanId);
    await supabase.from('items').update({ is_available: true }).eq('id', itemId);
    fetchData();
  };

  const handleCancelReturn = async (loanId: string) => {
    if (!confirm("返却申請を取り下げますか？")) return;
    await supabase.from('loans').update({ return_requested_at: null }).eq('id', loanId);
    fetchData();
  };

  const handleCancelExtension = async (loanId: string) => {
    if (!confirm("延長申請を取り消しますか？")) return;
    await supabase.from('loans').update({ extension_requested_at: null, extension_days: null }).eq('id', loanId);
    fetchData();
  };

  // --- 返却・延長アクション（学生） ---
  const handleRequestReturn = async (loanId: string, itemName: string) => {
    if (!confirm("返却申請を出しますか？")) return;
    await supabase.from('loans').update({ return_requested_at: new Date() }).eq('id', loanId);
    notify({ type: 'RETURN_REQUEST', studentName, studentId, items: [itemName] });
    alert("申請完了"); fetchData();
  };

  const handleRequestExtension = async (loanId: string, itemName: string) => {
    const days = prompt("何日間、延長したいですか？", "7");
    if (!days || isNaN(Number(days))) return alert("正しい数字を入力してください");
    await supabase.from('loans').update({ extension_requested_at: new Date(), extension_days: Number(days) }).eq('id', loanId);
    notify({ type: 'EXTENSION_REQUEST', studentName, studentId, days, items: [itemName] });
    alert("延長申請送信済み"); fetchData();
  };

  // --- 管理者アクション：承認・拒否（ここを重点修正） ---
  const handleApproveLoan = async (loan: any) => {
    await supabase.from('loans').update({ loan_approved_at: new Date() }).eq('id', loan.id);
    notify({ type: 'APPROVAL_TO_STUDENT', to: `${loan.student_id.toLowerCase()}@i-u.ac.jp`, studentName: loan.student_name, items: [loan.items.name], startDate: loan.start_date, endDate: loan.end_date });
    alert("承認完了"); fetchData();
  };

  const handleRejectLoan = async (loanId: string, itemId: string, sId: string, sName: string) => {
    if (!confirm("申請を拒否しますか？")) return;
    await supabase.from('loans').delete().eq('id', loanId);
    await supabase.from('items').update({ is_available: true }).eq('id', itemId);
    notify({ type: 'REJECTION', to: `${sId.toLowerCase()}@i-u.ac.jp`, studentName: sName });
    alert("拒否しました"); fetchData();
  };

  const handleApproveReturn = async (loanId: string, itemId: string) => {
    await supabase.from('loans').update({ returned_at: new Date() }).eq('id', loanId);
    await supabase.from('items').update({ is_available: true }).eq('id', itemId);
    alert("承認しました"); fetchData();
  };

  const handleRejectReturn = async (loanId: string) => {
    if (!confirm("この返却を差し戻しますか？")) return;
    await supabase.from('loans').update({ return_requested_at: null }).eq('id', loanId);
    alert("拒否しました"); fetchData();
  };

  const handleApproveExtension = async (loan: any) => {
    const newDate = new Date(loan.end_date);
    newDate.setDate(newDate.getDate() + (loan.extension_days || 7));
    const dateStr = newDate.toISOString().split('T')[0];
    await supabase.from('loans').update({ end_date: dateStr, extension_requested_at: null, extension_days: null }).eq('id', loan.id);
    notify({ type: 'EXTENSION_APPROVAL', to: `${loan.student_id.toLowerCase()}@i-u.ac.jp`, studentName: loan.student_name, endDate: dateStr, items: [loan.items.name] });
    alert("延長承認完了"); fetchData();
  };

  const handleRejectExtension = async (loanId: string) => {
    if (!confirm("延長申請を拒否しますか？")) return;
    await supabase.from('loans').update({ extension_requested_at: null, extension_days: null }).eq('id', loanId);
    alert("拒否しました"); fetchData();
  };

  const handleApproveAccount = async (id: string, name: string) => {
    if (!confirm(`${name}さんのアカウントを許可しますか？`)) return;
    await supabase.from('profiles').update({ is_approved: true }).eq('id', id);
    alert("承認完了"); fetchProfiles();
  };

  // --- 設定系 ---
  const handleUpdateProfile = async () => {
    setUpdating(true);
    await supabase.auth.updateUser({ data: { full_name: studentName } });
    await supabase.from('profiles').update({ full_name: studentName }).eq('id', userId);
    alert("保存完了"); setUpdating(false);
  };

  const handleUpdatePassword = async () => {
    if (newPassword !== confirmPassword) return alert("確認パスワードが不一致です");
    setPwUpdating(true);
    const { error: authErr } = await supabase.auth.signInWithPassword({ email: userEmail, password: oldPassword });
    if (authErr) { alert("現在のパスワードが間違っています"); setPwUpdating(false); return; }
    await supabase.auth.updateUser({ password: newPassword });
    alert("完了"); setOldPassword(''); setNewPassword(''); setConfirmPassword(''); setPwUpdating(false);
  };

  if (loading && items.length === 0) return <div className="p-20 text-center font-black text-slate-300 animate-pulse tracking-widest uppercase">Connecting...</div>;

  if (!isApproved && !isAdmin) {
    return (
      <div className="min-h-screen bg-slate-100 flex flex-col items-center justify-center p-6 font-black uppercase text-center text-slate-800">
        <div className="bg-white p-10 rounded-3xl shadow-xl max-w-md space-y-6">
          <div className="w-16 h-16 bg-orange-100 text-orange-600 rounded-full flex items-center justify-center mx-auto text-3xl font-black italic">!</div>
          <h1 className="text-xl">アカウント承認待ち</h1>
          <p className="text-xs text-slate-400 font-bold leading-relaxed tracking-wider">管理者によるアカウント確認中です。<br/><span className="text-red-500 mt-2 block font-black underline italic">反映には数日かかる場合があります。</span></p>
          <button onClick={() => { supabase.auth.signOut(); router.push('/login'); }} className="w-full py-4 bg-slate-800 text-white rounded-2xl text-[10px] font-black uppercase transition-all active:scale-95 shadow-md">Logout</button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900 pb-20 text-xs md:text-sm font-black uppercase font-black tracking-tighter">
      <header className="bg-white border-b sticky top-0 z-30 shadow-sm px-4">
        <div className="max-w-6xl mx-auto py-4 flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-black italic tracking-tighter text-slate-800">LAB RENTAL</h1>
            <button onClick={() => { if(confirm("Logout?")) { supabase.auth.signOut(); router.push('/login'); } }} className="text-[10px] font-bold text-red-500 border border-red-200 px-2 py-0.5 rounded uppercase hover:bg-red-50 transition-all font-black">Logout</button>
            {isAdmin && <span className="bg-slate-800 text-white text-[9px] font-black px-2 py-0.5 rounded shadow-sm tracking-widest">Admin Area</span>}
          </div>
          <nav className="flex space-x-1 bg-slate-100 p-1 rounded-xl w-full md:w-auto overflow-x-auto font-black">
            <button onClick={() => setActiveTab('status')} className={`flex-1 md:flex-none px-5 py-2 rounded-lg font-bold transition-all ${activeTab === 'status' ? 'bg-white shadow-sm text-blue-600' : 'text-slate-500 hover:text-slate-700'}`}>状況</button>
            <button onClick={() => setActiveTab('apply-manage')} className={`flex-1 md:flex-none px-5 py-2 rounded-lg font-bold relative transition-all ${activeTab === 'apply-manage' ? 'bg-white shadow-sm text-blue-600' : 'text-slate-500 hover:text-slate-700'}`}>申請 {keepList.length > 0 && <span className="absolute -top-1 -right-1 bg-blue-500 text-white text-[8px] w-4 h-4 flex items-center justify-center rounded-full font-black animate-pulse shadow-sm">{keepList.length}</span>}</button>
            {isAdmin && (
              <>
                <button onClick={() => setActiveTab('admin-approval')} className={`flex-1 md:flex-none px-5 py-2 rounded-lg font-bold relative transition-all ${activeTab === 'admin-approval' ? 'bg-white shadow-sm text-blue-600' : 'text-slate-500 hover:text-slate-700'}`}>承認待ち {pendingCount > 0 && <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[9px] w-4 h-4 flex items-center justify-center rounded-full animate-bounce shadow-sm font-black">{pendingCount}</span>}</button>
                <button onClick={() => setActiveTab('admin-users')} className={`flex-1 md:flex-none px-5 py-2 rounded-lg font-bold ${activeTab === 'admin-users' ? 'bg-white shadow-sm text-blue-600' : 'text-slate-500 hover:text-slate-700'}`}>ユーザー</button>
              </>
            )}
            <button onClick={() => setActiveTab('profile')} className={`flex-1 md:flex-none px-5 py-2 rounded-lg font-bold ${activeTab === 'profile' ? 'bg-white shadow-sm text-blue-600' : 'text-slate-500 hover:text-slate-700'}`}>プロフ</button>
          </nav>
        </div>
      </header>

      <main className="max-w-6xl mx-auto p-4 pt-8 font-black">
        {/* 1. 状況 */}
        {activeTab === 'status' && (
          <div className="animate-in fade-in duration-700">
            <div className="flex gap-2 overflow-x-auto pb-4">
              {categories.map(cat => (<button key={cat} onClick={() => setSelectedCategory(cat)} className={`px-4 py-1.5 rounded-full text-[10px] font-black border flex-shrink-0 transition-all ${selectedCategory === cat ? 'bg-blue-600 text-white border-blue-600 shadow-md' : 'bg-white text-slate-400 font-black hover:border-slate-300'}`}>{cat}</button>))}
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 font-black">
              {filteredStatus.map(item => {
                const loan = loans.find(l => l.item_id === item.id);
                return (
                  <div key={item.id} onClick={() => setSelectedItemDetail(item)} className="bg-white rounded-2xl border hover:border-blue-300 transition-all cursor-pointer shadow-sm overflow-hidden flex flex-col group font-black">
                    <div className="aspect-square bg-slate-100 flex items-center justify-center overflow-hidden font-black font-black font-black font-black font-black font-black font-black font-black font-black">{item.image_url ? <img src={item.image_url} alt="" className="w-full h-full object-cover group-hover:scale-105 transition-transform" /> : <span className="text-slate-300 italic uppercase text-[10px] font-black">No Image</span>}</div>
                    <div className="p-4 flex-1 flex flex-col justify-between font-black font-black font-black">
                      <h3 className="font-bold text-slate-800 leading-tight line-clamp-2 font-black uppercase font-black font-black">{item.name}</h3>
                      {item.sub_description && (
                        <p className="text-[10px] text-slate-500 mt-1.5 line-clamp-3 font-medium leading-snug whitespace-pre-wrap">
                          {item.sub_description}
                        </p>
                      )}  
                      <div className="mt-3 flex items-center justify-between uppercase font-black font-black">
                         <span className={`text-[8px] font-black px-2 py-0.5 rounded font-black font-black ${loan?.return_requested_at ? 'bg-blue-50 text-blue-500' : loan?.extension_requested_at ? 'bg-orange-50 text-orange-500' : item.is_available ? 'bg-green-50 text-green-700' : 'bg-slate-50 text-slate-400'}`}>{loan?.return_requested_at ? '返却確認中' : loan?.extension_requested_at ? '延長中' : item.is_available ? '貸出可能' : '貸出中'}</span>
                        {loan && !item.is_available && isAdmin && <span className="text-[9px] text-slate-300 truncate max-w-[60px] font-black font-black font-black">{loan.student_name}</span>}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {activeTab === 'apply-manage' && (
          <div className="max-w-2xl mx-auto space-y-6 animate-in zoom-in-95 font-black font-black">
            <div className="flex bg-slate-200 p-1 rounded-2xl font-black font-black">
              <button onClick={() => setSubTab('loan')} className={`flex-1 py-3 rounded-xl text-xs transition-all font-black font-black ${subTab === 'loan' ? 'bg-white text-blue-600 shadow-sm font-black' : 'text-slate-500'}`}>貸出申請</button>
              <button onClick={() => setSubTab('return')} className={`flex-1 py-3 rounded-xl text-xs transition-all font-black font-black ${subTab === 'return' ? 'bg-white text-blue-600 shadow-sm font-black' : 'text-slate-500'}`}>借用状況/返却</button>
            </div>
            {subTab === 'loan' ? (
              <div className="bg-white p-6 md:p-8 rounded-3xl shadow-xl border border-blue-50 space-y-6">
                <div className="grid grid-cols-2 gap-4 bg-slate-50 p-4 rounded-2xl">
                  <div className="space-y-1 font-black"><label className="text-[10px] text-slate-400 uppercase tracking-widest ml-1 font-black">開始日</label><input type="date" className="w-full p-3 rounded-lg border-none bg-white font-bold" value={startDate} onChange={e => setStartDate(e.target.value)} /></div>
                  <div className="space-y-1 font-black"><label className="text-[10px] text-slate-400 uppercase tracking-widest ml-1 font-black">予定日</label><input type="date" className="w-full p-3 rounded-lg border-none bg-white font-bold" value={endDate} onChange={e => setEndDate(e.target.value)} /></div>
                </div>
                <div className="space-y-1 font-black"><label className="text-[10px] text-slate-400 uppercase tracking-widest ml-1 font-black font-black font-black font-black font-black">利用目的</label><textarea className="w-full p-4 bg-slate-50 border rounded-2xl outline-none font-bold min-h-[80px]" placeholder="卒業研究、〇〇イベントのデモなど" value={purpose} onChange={e => setPurpose(e.target.value)} /></div>
                <div className="space-y-2"><label className="text-[10px] text-slate-400 uppercase tracking-widest text-center block">機材選択</label>
                  <div className="grid grid-cols-1 gap-2 max-h-64 overflow-y-auto p-2 bg-slate-50 rounded-2xl border-2 font-black font-black">
                    {items.filter(i => i.is_available).map(item => (
                      <div key={item.id} onClick={() => setKeepList(prev => prev.includes(item.id) ? prev.filter(id => id !== item.id) : [...prev, item.id])} className={`flex items-center justify-between p-4 rounded-xl cursor-pointer border-2 transition-all font-black ${keepList.includes(item.id) ? 'border-blue-600 bg-blue-600 text-white shadow-md' : 'border-white bg-white hover:border-slate-100 font-black'}`}>
                        <div className="flex flex-col"><span className={`text-[8px] font-black uppercase ${keepList.includes(item.id) ? 'text-blue-100' : 'text-slate-300'}`}>{item.category}</span><span className="font-bold text-sm leading-none font-black">{item.name}</span></div>
                          {item.sub_description && (
                            <span className="text-[10px] text-slate-500 mt-0.5 font-medium line-clamp-1">
                              {item.sub_description}
                            </span>
                          )}
                        {keepList.includes(item.id) && <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7"></path></svg>}
                      </div>
                    ))}
                  </div>
                </div>
                <div className="space-y-2 text-center font-black">
                    <p className="text-red-500 text-[10px] italic font-black font-black font-black underline uppercase">※申請の反映には数日かかる場合があります。</p>
                    <button onClick={handleLoanRequest} disabled={keepList.length === 0 || !startDate || !endDate} className="w-full bg-blue-600 text-white py-5 rounded-2xl font-black text-lg shadow-lg active:scale-95 transition-all shadow-blue-100 font-black uppercase tracking-widest">申請確定</button>
                </div>
              </div>
            ) : (
              <div className="space-y-3 font-black">
                {/* 状況 */}
                {loans.filter(l => l.student_id === studentId).map(loan => (
                  <div key={loan.id} className={`bg-white p-5 rounded-2xl border flex flex-col gap-4 shadow-sm font-black font-black font-black ${loan.loan_approved_at === null ? 'border-orange-100 bg-orange-50 font-black' : ''}`}>
                    <div className="flex justify-between items-center font-black">
                      <div><h3 className="text-slate-800 font-black">{loan.items?.name}</h3><p className="text-[9px] text-slate-400 uppercase">{loan.loan_approved_at === null ? '貸出許可待ち' : `期限: ${loan.end_date}`}</p></div>
                      {loan.loan_approved_at === null ? (
                        <button onClick={() => handleCancelLoan(loan.id, loan.item_id)} className="bg-white text-orange-600 border border-orange-200 px-4 py-2 rounded-xl font-bold text-xs shadow-sm font-black font-black">取消</button>
                      ) : loan.return_requested_at ? (
                        <div className="text-right">
                          <span className="text-[10px] font-black text-blue-500 block animate-pulse">返却確認中</span>
                          <button onClick={() => handleCancelReturn(loan.id)} className="text-[9px] underline text-blue-400 font-black">取消</button>
                        </div>
                      ) : (
                        <button onClick={() => handleRequestReturn(loan.id, loan.items?.name)} className="bg-slate-800 text-white px-6 py-2 rounded-xl font-bold hover:bg-black font-black transition-all">返却申請</button>
                      )}
                    </div>
                    {/* 延長 */}
                    {loan.loan_approved_at !== null && !loan.return_requested_at && (
                      <div className="border-t pt-3 flex justify-end items-center gap-4 font-black">
                        {loan.extension_requested_at ? (
                          <div className="text-right font-black"><span className="text-[10px] text-orange-500 italic font-black">延長待ち ({loan.extension_days}日)</span><button onClick={() => handleCancelExtension(loan.id)} className="text-[9px] underline font-black ml-2 font-black">取消</button></div>
                        ) : (
                          <button onClick={() => handleRequestExtension(loan.id, loan.items?.name)} className="text-[10px] text-blue-600 border border-blue-100 px-3 py-1 rounded-lg hover:bg-blue-50 transition-all font-black font-black">延長を希望する</button>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* 3. 管理者承認管理 */}
        {activeTab === 'admin-approval' && isAdmin && (
          <div className="max-w-4xl mx-auto space-y-6 font-black animate-in slide-in-from-right-4">
             <div className="flex bg-slate-200 p-1 rounded-2xl">
              <button onClick={() => setAdminSubTab('loan')} className={`flex-1 py-3 rounded-xl text-xs transition-all ${adminSubTab === 'loan' ? 'bg-white text-blue-600 shadow-sm font-black' : 'text-slate-500'}`}>貸出</button>
              <button onClick={() => setAdminSubTab('return')} className={`flex-1 py-3 rounded-xl text-xs transition-all ${adminSubTab === 'return' ? 'bg-white text-blue-600 shadow-sm font-black' : 'text-slate-500'}`}>返却</button>
              <button onClick={() => setAdminSubTab('extension')} className={`flex-1 py-3 rounded-xl text-xs transition-all ${adminSubTab === 'extension' ? 'bg-white text-blue-600 shadow-sm font-black' : 'text-slate-500'}`}>延長</button>
              <button onClick={() => setAdminSubTab('account')} className={`flex-1 py-3 rounded-xl text-xs transition-all ${adminSubTab === 'account' ? 'bg-white text-blue-600 shadow-sm font-black' : 'text-slate-500'}`}>入会</button>
            </div>
            <div className="space-y-3 font-black">
              {adminSubTab === 'loan' ? pendingLoans.map(loan => (
                <div key={loan.id} className="bg-white p-6 rounded-3xl border border-blue-100 flex flex-col md:flex-row justify-between items-center gap-4 animate-in fade-in shadow-sm font-black">
                  <div className="flex-1"><h3 className="text-lg font-black">{loan.items?.name}</h3><p className="text-blue-500 text-xs font-black">{loan.start_date} ～ {loan.end_date}</p><p className="text-[10px] text-slate-400 mt-1 uppercase">{loan.student_name} (${loan.student_id})</p><p className="mt-3 p-3 bg-slate-50 rounded-xl text-xs whitespace-pre-wrap italic font-black font-black font-black font-black">{loan.purpose}</p></div>
                  <div className="flex gap-2 w-full md:w-auto font-black font-black font-black"><button onClick={() => handleRejectLoan(loan.id, loan.item_id, loan.student_id, loan.student_name)} className="flex-1 md:flex-none bg-red-50 text-red-500 px-8 py-3 rounded-xl font-bold uppercase transition-all font-black font-black font-black">拒否</button><button onClick={() => handleApproveLoan(loan)} className="flex-1 md:flex-none bg-blue-600 text-white px-10 py-3 rounded-xl font-black shadow-lg transition-all active:scale-95 font-black">承認</button></div>
                </div>
              )) : adminSubTab === 'return' ? pendingReturns.map(loan => (
                <div key={loan.id} className="bg-white p-6 rounded-3xl border flex flex-col md:flex-row justify-between items-center gap-4 animate-in fade-in font-black font-black">
                  <div className="flex-1 font-black"><h3 className="text-lg font-black font-black font-black">{loan.items?.name}</h3><p className="text-xs font-bold text-slate-500 font-black">{loan.student_name} さんが返却希望</p></div>
                  <div className="flex gap-2 font-black font-black font-black font-black"><button onClick={() => handleRejectReturn(loan.id)} className="bg-red-50 text-red-500 px-6 py-2 rounded-xl font-black uppercase font-black">拒否</button><button onClick={() => handleApproveReturn(loan.id, loan.item_id)} className="bg-green-600 text-white px-10 py-3 rounded-xl font-black shadow-lg transition-all active:scale-95">承認</button></div>
                </div>
              )) : adminSubTab === 'extension' ? pendingExtensions.map(loan => (
                <div key={loan.id} className="bg-white p-6 rounded-3xl border border-orange-100 flex flex-col md:flex-row justify-between items-center gap-4 font-black">
                  <div className="flex-1 font-black"><h3 className="text-lg font-black">{loan.items?.name}</h3><p className="text-orange-500 text-xs font-black font-black font-black font-black">{loan.student_name} さんが 延長 {loan.extension_days}日間 希望</p></div>
                  <div className="flex gap-2 font-black font-black font-black font-black"><button onClick={() => handleRejectExtension(loan.id)} className="bg-red-50 text-red-500 px-6 py-2 rounded-xl font-black font-black">拒否</button><button onClick={() => handleApproveExtension(loan)} className="bg-orange-500 text-white px-10 py-3 rounded-xl font-black shadow-lg transition-all active:scale-95 font-black font-black">承認</button></div>
                </div>
              )) : (
                /* 入会 */
                allProfiles.filter(p => !p.is_approved && !p.is_admin).map(p => (
                  <div key={p.id} className="bg-white p-6 rounded-3xl border border-blue-50 flex justify-between items-center font-black">
                    <div className="font-black font-black"><h3 className="text-lg font-black">{p.full_name}</h3><p className="text-xs text-slate-400 font-black">{p.student_id}</p></div>
                    <button onClick={() => handleApproveAccount(p.id, p.full_name)} className="bg-blue-600 text-white px-8 py-3 rounded-xl font-black font-black font-black transition-all">承認して入会</button>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* 4. ユーザー管理 */}
        {activeTab === 'admin-users' && isAdmin && (
          <div className="bg-white rounded-3xl border shadow-sm overflow-hidden font-black max-w-4xl mx-auto font-black font-black font-black font-black font-black">
            <table className="w-full text-left text-xs uppercase font-black"><thead className="bg-slate-50 border-b text-[9px] text-slate-400 font-black"><tr className="p-5 font-black"><th className="p-5">Name</th><th className="p-5">Access</th><th className="p-5"></th></tr></thead>
              <tbody className="divide-y font-black font-black font-black">
                {allProfiles.filter(u => u.is_approved || u.is_admin).map(u => (
                  <tr key={u.id} className="group hover:bg-slate-50 font-black">
                    <td className="p-5 font-black text-slate-700">{u.full_name || '---'}</td>
                    <td className="p-5 font-black font-black"><span className={`text-[9px] px-2 py-1 rounded font-black ${u.is_admin ? 'bg-slate-800 text-white font-black' : 'bg-slate-100 text-slate-400 font-black'}`}>{u.is_admin ? '管理者' : '学生'}</span></td>
                    <td className="p-5 text-right px-8 font-black"><button onClick={() => { if(confirm(`アカウント削除？`)) fetch('/api/admin/users', {method: 'DELETE', body: JSON.stringify({userId: u.id})}).then(fetchProfiles) }} disabled={u.id === userId} className="text-red-400 opacity-0 group-hover:opacity-100 transition-all font-black hover:text-red-600">削除</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* 5. プロフィール */}
        {activeTab === 'profile' && (
          <div className="max-w-xl mx-auto space-y-6 font-black font-black">
            <div className="bg-white p-8 rounded-3xl shadow-xl border font-black space-y-8">
              <h2 className="text-xl font-black text-center text-slate-800 border-b pb-4">Profile</h2>
              <div className="p-5 bg-slate-50 rounded-2xl space-y-4 font-black">
                <div className="flex justify-between font-black"><span className="text-[10px] text-slate-400 font-black">Student ID</span><span className="text-sm font-black text-slate-700 uppercase">{studentId}</span></div>
                <div className="flex justify-between font-black"><span className="text-[10px] text-slate-400 font-black">Email</span><span className="text-[10px] text-slate-500 font-black font-black">{userEmail}</span></div>
              </div>
              <div className="space-y-6">
                <div className="space-y-1 font-black"><label className="text-[10px] text-slate-400 ml-1 uppercase">Name</label><input className="w-full p-4 bg-slate-50 border-2 rounded-2xl outline-none font-bold font-black" value={studentName} onChange={(e) => setStudentName(e.target.value)} /></div>
                <button onClick={handleUpdateProfile} disabled={updating} className="w-full bg-blue-600 text-white py-4 rounded-2xl font-black uppercase transition-all shadow-md">{updating ? '保存中...' : '情報を保存する'}</button>
                <div className="pt-8 border-t space-y-4">
                  <label className="text-[10px] text-slate-400 font-black text-center block">パスワード更新</label>
                  <input type="password" placeholder="現在のパスワード" className="w-full p-4 bg-slate-50 border-2 border-slate-100 rounded-2xl outline-none font-bold" value={oldPassword} onChange={(e) => setOldPassword(e.target.value)} />
                  <input type="password" placeholder="新しいパスワード" className="w-full p-4 bg-slate-50 border-2 border-slate-100 rounded-2xl outline-none font-bold font-black" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
                  <input type="password" placeholder="再度入力" className="w-full p-4 bg-slate-50 border-2 border-slate-100 rounded-2xl outline-none font-bold font-black" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} />
                  <button onClick={handleUpdatePassword} disabled={pwUpdating || !newPassword} className="w-full bg-slate-800 text-white py-4 rounded-2xl font-black uppercase transition-all hover:bg-black font-black shadow-md">{pwUpdating ? '更新中...' : 'パスワードを更新する'}</button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 機材詳細モーダル */}
        {selectedItemDetail && (
          <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-2 md:p-6 backdrop-blur-md animate-in fade-in">
            <div className="bg-white w-full max-w-2xl rounded-[2.5rem] overflow-hidden shadow-2xl animate-in zoom-in-95 flex flex-col max-h-[95vh] font-black">
              
              {/* 1. 画像エリア：高さを少し抑えて(h-64〜72) テキスト用のスペースを確保 */}
              <div className="w-full h-64 md:h-72 bg-white relative flex-shrink-0 border-b border-slate-100">
                {selectedItemDetail.image_url ? (
                  <img 
                    src={selectedItemDetail.image_url} 
                    alt={selectedItemDetail.name} 
                    className="w-full h-full object-contain p-2" 
                  />
                ) : (
                  <div className="h-full flex items-center justify-center text-slate-200 italic uppercase text-[10px] font-black">
                    No Product Image
                  </div>
                )}
                
                {/* 閉じるボタン（少し小さくして目立たなくし、コンテンツを主役に） */}
                <button 
                  onClick={() => setSelectedItemDetail(null)} 
                  className="absolute top-4 right-4 bg-slate-100/50 hover:bg-slate-200 text-slate-800 rounded-full p-2.5 shadow-sm transition-all z-10 active:scale-90"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="4" d="M6 18L18 6M6 6l12 12"></path></svg>
                </button>
              </div>

              {/* 2. 名前 & カテゴリ：パディングを詰めて領域を節約 */}
              <div className="px-8 pt-6 pb-2 flex-shrink-0 font-black">
                <span className="text-[9px] font-black text-blue-600 uppercase tracking-widest bg-blue-50 px-2 py-0.5 rounded-md mb-2 inline-block">
                  {selectedItemDetail.category}
                </span>
                <h2 className="text-2xl md:text-3xl font-black tracking-tighter text-slate-800 leading-tight">
                  {selectedItemDetail.name}
                </h2>
              </div>

              {/* 3. 【説明文エリア：拡張】ここを広げ、余白を調整 */}
              <div className="px-8 py-2 overflow-y-auto flex-grow min-h-0">
                <div className="text-slate-600 leading-relaxed font-black whitespace-pre-wrap text-[15px] border-l-2 border-slate-100 pl-4 py-2 my-2">
                  {selectedItemDetail.description || '機材の詳細説明はありません。'}
                </div>
              </div>

              {/* 4. アクションボタン：縦幅をコンパクトに整理 */}
              <div className="px-8 py-6 border-t bg-slate-50/50 flex-shrink-0 font-black">
                <div className="flex flex-col sm:flex-row items-center justify-between gap-4 font-black font-black">
                  <div className="flex items-center gap-3 font-black">
                    <div className="flex flex-col font-black">
                      <span className="text-[9px] text-slate-400 font-black uppercase tracking-widest leading-none">STATUS</span>
                      <span className={`font-black text-sm uppercase ${selectedItemDetail.is_available ? 'text-green-600' : 'text-slate-400'}`}>
                        {selectedItemDetail.is_available ? 'AVAILABLE' : 'BORROWED'}
                      </span>
                    </div>
                  </div>
                  
                  <button 
                    disabled={!selectedItemDetail.is_available} 
                    onClick={() => { 
                      setKeepList(prev => prev.includes(selectedItemDetail.id) ? prev.filter(id => id !== selectedItemDetail.id) : [...prev, selectedItemDetail.id]); 
                      setSelectedItemDetail(null); 
                    }} 
                    className={`w-full sm:w-auto px-10 py-4 rounded-2xl font-black text-sm tracking-widest shadow-lg transition-all active:scale-95 ${
                      keepList.includes(selectedItemDetail.id) 
                        ? 'bg-red-50 text-red-500' 
                        : 'bg-blue-600 text-white hover:bg-blue-700'
                    } disabled:opacity-20 uppercase font-black`}
                  >
                    {keepList.includes(selectedItemDetail.id) ? 'リストから解除' : '選択リストに追加'}
                  </button>
                </div>
              </div>
              
            </div>
          </div>
        )}
      </main>
    </div>
  )
}