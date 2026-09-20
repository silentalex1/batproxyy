import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

interface Feedback {
  id: number;
  title?: string;
  content: string;
  user_identifier: string | null;
  submitted_at: string;
  status: string;
  genre?: string;
}

interface CodeJob {
  id: string;
  ts: number;
  user?: string;
  provider: string;
  prompt: string;
  status: 'pending' | 'running' | 'done' | 'error';
  target?: string;
  reply?: string;
}

interface UserAccount {
  id: number;
  username: string;
  invite_code: string;
  created_at: string;
  payLater?: boolean;
  payLaterSince?: string;
  removeAt?: string;
  rank?: string;
}

const codeAgo = (ts: number) => {
  const s = Math.max(0, Math.floor((Date.now() - ts) / 1000));
  if (s < 60) return 'just now';
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return new Date(ts).toLocaleDateString([], { month: 'short', day: 'numeric' });
};

export default function AdminPanel() {
  const navigate = useNavigate();
  const [isAuthed, setIsAuthed] = useState<boolean | null>(null);
  const [loggedIn, setLoggedIn] = useState(false);
  const [tab, setTab] = useState<'feedbacks' | 'fnadfeedback' | 'accounts' | 'status' | 'paylater' | 'commands' | 'ranks' | 'loginprobs' | 'coderequest' | 'datainfo'>('feedbacks');
  const [problems, setProblems] = useState<{ votes: Array<{ user: string; working: boolean; ts: number }>; reports: Array<{ user: string; error: string; ts: number }>; resets: Array<{ user: string; ts: number }> }>({ votes: [], reports: [], resets: [] });
  const [statusOverrides, setStatusOverrides] = useState<Record<string, string>>({});
  const SERVICES = ['Website API', 'Search Proxy', 'Wisp Transport', 'AI Service', 'Games Service', 'Database'];
  const [feedbacks, setFeedbacks] = useState<Feedback[]>([]);
  const [users, setUsers] = useState<UserAccount[]>([]);
  const [userSearch, setUserSearch] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newUsername, setNewUsername] = useState('');
  const [newCode, setNewCode] = useState('');
  const [createError, setCreateError] = useState('');
  const [revokeTarget, setRevokeTarget] = useState<UserAccount | null>(null);
  const [revokeCode, setRevokeCode] = useState('');
  const [revokeError, setRevokeError] = useState('');
  const [dueTarget, setDueTarget] = useState<UserAccount | null>(null);
  const [dueDate, setDueDate] = useState('');
  const [dueCode, setDueCode] = useState('');
  const [dueError, setDueError] = useState('');
  const [tempTarget, setTempTarget] = useState<UserAccount | null>(null);
  const [tempDays, setTempDays] = useState('');
  const [tempError, setTempError] = useState('');
  const [cmdInput, setCmdInput] = useState('');
  const [cmdLog, setCmdLog] = useState<string[]>(['Type "show quick-access codes" or "<code> to <username>"']);
  const [codeProvider, setCodeProvider] = useState<'claude' | 'copilot'>('claude');
  const [codePrompt, setCodePrompt] = useState('');
  const [codeOut, setCodeOut] = useState('');
  const [codeBusy, setCodeBusy] = useState(false);
  const [codeStage, setCodeStage] = useState('');
  const [codeError, setCodeError] = useState('');
  const [codePc, setCodePc] = useState(false);
  const [codeHost, setCodeHost] = useState('');
  const [codeJobs, setCodeJobs] = useState<CodeJob[]>([]);
  const [codeOpen, setCodeOpen] = useState('');

  const getToken = () => localStorage.getItem('batprox-token') || '';

  const [responses, setResponses] = useState<Record<string, { up: number; down: number }>>({});
  const [resolved, setResolved] = useState<number[]>([]);
  const [exporting, setExporting] = useState('');
  const [exportMsg, setExportMsg] = useState('');

  const runExport = async (kind: 'chat' | 'dms' | 'ai' | 'drops', label: string) => {
    setExporting(kind);
    setExportMsg('');
    try {
      const response = await fetch(`/api/admin/export/${kind}`, { headers: { 'Authorization': `Bearer ${getToken()}` } });
      if (!response.ok) { setExportMsg(`${label} failed (${response.status})`); setExporting(''); return; }
      const text = await response.text();
      let count = 0;
      try { count = JSON.parse(text).count || 0; } catch {}
      const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
      const a = document.createElement('a');
      a.href = url;
      a.download = `batprox-${kind}-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      setExportMsg(`${label} downloaded — ${count} records`);
      setTimeout(() => setExportMsg(''), 5000);
    } catch { setExportMsg(`${label} failed — network error`); }
    setExporting('');
  };
  const [replyTarget, setReplyTarget] = useState<Feedback | null>(null);
  const [replyText, setReplyText] = useState('');
  const [replyBusy, setReplyBusy] = useState(false);
  const [replyError, setReplyError] = useState('');

  const loadFeedbacks = async (silent?: boolean) => {
    try {
      const response = await fetch('/api/admin/feedbacks', { headers: { 'Authorization': `Bearer ${getToken()}` } });
      const data = await response.json();
      if (response.ok) setFeedbacks(data.feedbacks || []);
      else if (!silent) setError(data.error || 'Failed to load feedbacks');
      const rr = await fetch('/api/feedback-responses');
      if (rr.ok) { const dd = await rr.json(); setResponses(dd.responses || {}); }
    } catch { if (!silent) setError('Network error while loading feedbacks'); }
  };

  const loadUsers = async () => {
    try {
      const response = await fetch('/api/admin/users', { headers: { 'Authorization': `Bearer ${getToken()}` } });
      const data = await response.json();
      if (response.ok) setUsers(data.users || []);
      else setError(data.error || 'Failed to load users');
    } catch { setError('Network error while loading users'); }
  };

  useEffect(() => {
    const token = getToken();
    setLoggedIn(!!token);
    const check = async () => {
      if (!token) { setIsAuthed(false); return; }
      try {
        const response = await fetch('/api/auth/me', { headers: { 'Authorization': `Bearer ${token}` } });
        if (!response.ok) { setIsAuthed(false); return; }
        const data = await response.json();
        setIsAuthed(!!data.isAdmin);
      } catch { setIsAuthed(false); }
    };
    check();
  }, []);

  const loadStatusOverrides = async () => {
    try {
      const response = await fetch('/api/status-overrides', { cache: 'no-store' });
      const data = await response.json();
      const map: Record<string, string> = {};
      (data.overrides || []).forEach((o: { name: string; color: string }) => { map[o.name] = o.color; });
      setStatusOverrides(map);
    } catch {}
  };

  const saveStatus = async (name: string, color: string) => {
    setError('');
    try {
      const response = await fetch('/api/admin/status', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${getToken()}` }, body: JSON.stringify({ name, color }) });
      const data = await response.json();
      if (response.ok) {
        setStatusOverrides(prev => { const next = { ...prev }; if (color === 'auto') delete next[name]; else next[name] = color; return next; });
        try { localStorage.setItem('bp-status-bump', String(Date.now())); const ch = new BroadcastChannel('batprox-status'); ch.postMessage({ type: 'status-updated', name, color }); ch.close(); } catch {}
        setMessage(`Status for ${name} set to ${color}`); setTimeout(() => setMessage(''), 2000);
      } else setError(data.error || 'Failed to save status');
    } catch { setError('Network error while saving status'); }
  };

  useEffect(() => {
    if (isAuthed && (tab === 'feedbacks' || tab === 'fnadfeedback')) loadFeedbacks();
    if (isAuthed && (tab === 'accounts' || tab === 'paylater' || tab === 'commands' || tab === 'ranks')) loadUsers();
    if (isAuthed && tab === 'status') loadStatusOverrides();
  }, [isAuthed, tab]);

  useEffect(() => {
    if (!isAuthed || (tab !== 'feedbacks' && tab !== 'fnadfeedback')) return;
    const id = setInterval(() => loadFeedbacks(true), 5000);
    return () => clearInterval(id);
  }, [isAuthed, tab]);

  const loadProblems = async () => {
    try {
      const response = await fetch('/api/admin/login-problems', { headers: { 'Authorization': `Bearer ${getToken()}` } });
      const data = await response.json();
      if (response.ok) setProblems({ votes: data.votes || [], reports: data.reports || [], resets: data.resets || [] });
    } catch {}
  };

  useEffect(() => {
    if (!isAuthed || tab !== 'loginprobs') return;
    loadProblems();
    const id = setInterval(loadProblems, 8000);
    return () => clearInterval(id);
  }, [isAuthed, tab]);

  useEffect(() => {
    let channel: BroadcastChannel | null = null;
    try { channel = new BroadcastChannel('batprox-status'); channel.onmessage = () => loadStatusOverrides(); } catch {}
    const onStorage = (e: StorageEvent) => { if (e.key === 'bp-status-bump') loadStatusOverrides(); };
    window.addEventListener('storage', onStorage);
    return () => { window.removeEventListener('storage', onStorage); channel?.close(); };
  }, []);

  const handleDecline = async (suggestionId: number) => {
    setError('');
    try {
      const response = await fetch('/api/admin/decline-feedback', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${getToken()}` }, body: JSON.stringify({ suggestionId }) });
      if (response.ok) { setResolved(prev => prev.includes(suggestionId) ? prev : [...prev, suggestionId]); setFeedbacks(prev => prev.filter(f => f.id !== suggestionId)); setMessage('Feedback declined'); setTimeout(() => setMessage(''), 2000); loadFeedbacks(true); }
      else { const errData = await response.json(); setError(errData.error || 'Failed to decline suggestion'); }
    } catch { setError('Network error while declining suggestion'); }
  };

  const openReply = (feedback: Feedback) => {
    setReplyTarget(feedback);
    setReplyText('');
    setReplyError('');
  };

  const sendReply = async () => {
    const target = replyTarget;
    const body = replyText.trim();
    if (!target) return;
    if (!body) { setReplyError('Write a reply first.'); return; }
    setReplyBusy(true);
    setReplyError('');
    try {
      const response = await fetch('/api/admin/reply-feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${getToken()}` },
        body: JSON.stringify({ suggestionId: target.id, reply: body })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) { setReplyError(data.error || 'Failed to send reply'); setReplyBusy(false); return; }
      setResolved(prev => prev.includes(target.id) ? prev : [...prev, target.id]);
      setFeedbacks(prev => prev.filter(f => f.id !== target.id));
      setReplyTarget(null);
      setReplyText('');
      setMessage(`Replied to ${target.user_identifier || 'user'} and approved`);
      setTimeout(() => setMessage(''), 2600);
      loadFeedbacks(true);
    } catch { setReplyError('Network error while sending reply'); }
    setReplyBusy(false);
  };

  const handleApprove = async (suggestionId: number) => {
    setError('');
    try {
      const response = await fetch('/api/admin/approve-feedback', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${getToken()}` }, body: JSON.stringify({ suggestionId }) });
      if (response.ok) { setResolved(prev => prev.includes(suggestionId) ? prev : [...prev, suggestionId]); setFeedbacks(prev => prev.filter(f => f.id !== suggestionId)); setMessage('Feedback approved'); setTimeout(() => setMessage(''), 2000); loadFeedbacks(true); }
      else { const errData = await response.json(); setError(errData.error || 'Failed to approve suggestion'); }
    } catch { setError('Network error while approving suggestion'); }
  };

  const handleCreateAccount = async (e: React.FormEvent) => {
    e.preventDefault(); setCreateError('');
    try {
      const response = await fetch('/api/admin/create-user', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${getToken()}` }, body: JSON.stringify({ username: newUsername, inviteCode: newCode }) });
      const data = await response.json();
      if (response.ok) { setShowCreateModal(false); setNewUsername(''); setNewCode(''); setMessage('Account created'); setTimeout(() => setMessage(''), 2000); loadUsers(); }
      else setCreateError(data.error || 'Failed to create account');
    } catch { setCreateError('Network error while creating account'); }
  };

  const handleRemoveUser = async (username: string) => {
    setError('');
    try {
      const response = await fetch('/api/admin/remove-user', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${getToken()}` }, body: JSON.stringify({ username }) });
      let data: { error?: string; message?: string } = {};
      try { data = await response.json(); } catch { data = { error: `Request failed (${response.status}). Slow down and try again.` }; }
      if (response.ok) { setUsers(prev => prev.filter(u => u.username !== username)); setMessage(`Account "${username}" removed`); setTimeout(() => setMessage(''), 2000); }
      else setError(data.error || 'Failed to remove account');
    } catch { setError('Network error while removing account'); }
  };

  const handleRevokeKey = async (e: React.FormEvent) => {
    e.preventDefault(); if (!revokeTarget) return; setRevokeError('');
    try {
      const response = await fetch('/api/admin/revoke-key', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${getToken()}` }, body: JSON.stringify({ username: revokeTarget.username, newCode: revokeCode }) });
      const data = await response.json();
      if (response.ok) { setMessage(`Access key revoked for "${revokeTarget.username}"`); setRevokeTarget(null); setRevokeCode(''); setTimeout(() => setMessage(''), 2000); loadUsers(); }
      else setRevokeError(data.error || 'Failed to revoke access key');
    } catch { setRevokeError('Network error while revoking access key'); }
  };

  const togglePayLater = async (user: UserAccount) => {
    setError('');
    try {
      const response = await fetch('/api/admin/pay-later', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${getToken()}` }, body: JSON.stringify({ username: user.username, payLater: !user.payLater }) });
      const data = await response.json();
      if (response.ok) { setUsers(prev => prev.map(u => u.username === user.username ? { ...u, payLater: !u.payLater, payLaterSince: !u.payLater ? new Date().toISOString() : undefined } : u)); setMessage(data.message || (!user.payLater ? 'Marked as pay-later (due in 7 days)' : 'Marked as paid')); setTimeout(() => setMessage(''), 2000); }
      else setError(data.error || 'Failed to update pay-later');
    } catch { setError('Network error while updating pay-later'); }
  };

  const handleBlacklist = async (user: UserAccount) => {
    if (!confirm(`Blacklist ${user.username}? This will ban their IP and redirect to banned.stealthybat.org`)) return;
    setError('');
    try {
      const response = await fetch('/api/admin/blacklist', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${getToken()}` }, body: JSON.stringify({ username: user.username }) });
      const data = await response.json();
      if (response.ok) { setMessage(`Blacklisted ${user.username} (IP ${data.ip || ''})`); setTimeout(() => setMessage(''), 2500); }
      else setError(data.error || 'Failed to blacklist');
    } catch { setError('Network error while blacklisting'); }
  };

  const handleDueRemove = async (e: React.FormEvent) => {
    e.preventDefault(); if (!dueTarget) return; setDueError('');
    if (!dueDate || !dueCode) { setDueError('Date and code required'); return; }
    try {
      const response = await fetch('/api/admin/remove-due', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${getToken()}` }, body: JSON.stringify({ username: dueTarget.username, removeAt: dueDate, inviteCode: dueCode }) });
      const data = await response.json();
      if (response.ok) { setMessage(`Remove scheduled for ${dueTarget.username} at ${dueDate}`); setDueTarget(null); setDueDate(''); setDueCode(''); setTimeout(() => setMessage(''), 2000); }
      else setDueError(data.error || 'Failed to schedule');
    } catch { setDueError('Network error'); }
  };

  const handleTempRemove = async (e: React.FormEvent) => {
    e.preventDefault(); if (!tempTarget) return; setTempError('');
    const days = parseInt(tempDays, 10);
    if (!days || days < 1) { setTempError('Enter valid number of days'); return; }
    try {
      const response = await fetch('/api/admin/temp-remove', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${getToken()}` }, body: JSON.stringify({ username: tempTarget.username, days }) });
      const data = await response.json();
      if (response.ok) { setMessage(`${tempTarget.username} temp removed for ${days} days`); setTempTarget(null); setTempDays(''); setTimeout(() => setMessage(''), 2000); }
      else setTempError(data.error || 'Failed');
    } catch { setTempError('Network error'); }
  };

  const runCommand = async () => {
    const raw = cmdInput.trim();
    if (!raw) return;
    setCmdLog(prev => [...prev, `> ${raw}`]);
    setCmdInput('');
    const lower = raw.toLowerCase();
    if (lower === 'show quick-access codes') {
      const lines = users.map(u => `${u.username}: ${u.invite_code}`).join('\n');
      setCmdLog(prev => [...prev, lines || 'No users']);
      return;
    }
    if (lower === 'show commands' || lower === 'show all' || lower === 'help' || lower === 'commands') {
      const lines = ['Available commands:', '  show quick-access codes - list all users and codes', '  show users - list all usernames', '  reset feedbacks - clear all feedback suggestions', '  show commands - list this help', '  <code> to <username> - remove account (e.g. sigmaboi$$ to jacobieog)'].join('\n');
      setCmdLog(prev => [...prev, lines]);
      return;
    }
    if (lower === 'reset feedbacks') {
      try {
        const response = await fetch('/api/admin/reset-feedbacks', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${getToken()}` } });
        if (response.ok) { setFeedbacks([]); setCmdLog(prev => [...prev, 'All feedbacks have been reset.']); }
        else { const d = await response.json(); setCmdLog(prev => [...prev, d.error || 'Failed']); }
      } catch { setCmdLog(prev => [...prev, 'Network error']); }
      return;
    }
    if (lower === 'show users') {
      try {
        const response = await fetch('/api/users');
        const d = await response.json();
        const list = (d.users || []).map((u: any) => u.username).filter(Boolean);
        setCmdLog(prev => [...prev, ...(list.length ? list : ['No users']), `total users: ${list.length}`]);
      } catch { setCmdLog(prev => [...prev, 'Network error']); }
      return;
    }
    const m = raw.match(/^(.+?)\s+to\s+(.+)$/i);
    if (m) {
      const code = m[1].trim(), username = m[2].trim();
      try {
        const user = users.find(u => u.username === username);
        if (!user || user.invite_code !== code) { setCmdLog(prev => [...prev, 'Invalid code or username']); return; }
        const response = await fetch('/api/admin/remove-user', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${getToken()}` }, body: JSON.stringify({ username }) });
        if (response.ok) { setUsers(prev => prev.filter(u => u.username !== username)); setCmdLog(prev => [...prev, `${username} has been removed.`]); }
        else { const d = await response.json(); setCmdLog(prev => [...prev, d.error || 'Failed']); }
      } catch { setCmdLog(prev => [...prev, 'Network error']); }
      return;
    }
    setCmdLog(prev => [...prev, 'Unknown command - type "show commands"']);
  };

  const loadCodeJobs = async () => {
    try {
      const response = await fetch('/api/admin/code-request', { cache: 'no-store', headers: { 'Authorization': `Bearer ${getToken()}` } });
      const data = await response.json();
      if (data.success) { setCodeJobs(data.jobs || []); setCodePc(!!data.pc); setCodeHost(data.pcHost || ''); }
    } catch {}
  };

  const pollCodeJob = async (id: string) => {
    for (let i = 0; i < 180; i++) {
      await new Promise(r => setTimeout(r, 4000));
      try {
        const response = await fetch(`/api/admin/code-request?id=${encodeURIComponent(id)}`, { cache: 'no-store', headers: { 'Authorization': `Bearer ${getToken()}` } });
        const data = await response.json();
        const job: CodeJob | undefined = data.job;
        if (!job) continue;
        setCodePc(!!data.pc);
        if (job.status === 'running') setCodeStage('Your PC picked it up and is working on it...');
        if (job.status === 'done') { setCodeOut(job.reply || 'Done.'); setCodeBusy(false); setCodeStage(''); loadCodeJobs(); return; }
        if (job.status === 'error') { setCodeError(job.reply || 'The request failed.'); setCodeBusy(false); setCodeStage(''); loadCodeJobs(); return; }
      } catch {}
    }
    setCodeError('Timed out waiting for an answer.');
    setCodeBusy(false);
    setCodeStage('');
  };

  const sendCodeRequest = async () => {
    const prompt = codePrompt.trim();
    if (!prompt || codeBusy) return;
    setCodeBusy(true);
    setCodeError('');
    setCodeOut('');
    setCodeStage('Sending to your PC...');
    try {
      const response = await fetch('/api/admin/code-request', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${getToken()}` }, body: JSON.stringify({ provider: codeProvider, prompt }) });
      const data = await response.json();
      if (!data.success) {
        setCodeError(data.error || 'Request failed.');
        if (data.offline) setCodePc(false);
        setCodeBusy(false);
        setCodeStage('');
        loadCodeJobs();
        return;
      }
      setCodePrompt('');
      setCodeOpen(data.id);
      loadCodeJobs();
      setCodeStage('Waiting for your PC to pick it up...');
      pollCodeJob(data.id);
    } catch {
      setCodeError('Network error while sending the request.');
      setCodeBusy(false);
      setCodeStage('');
    }
  };

  useEffect(() => {
    if (!isAuthed || tab !== 'coderequest') return;
    loadCodeJobs();
    const id = setInterval(loadCodeJobs, 5000);
    return () => clearInterval(id);
  }, [isAuthed, tab]);

  const handleSetRank = async (username: string, rank: string) => {
    try {
      const response = await fetch('/api/admin/set-rank', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${getToken()}` }, body: JSON.stringify({ username, rank }) });
      const data = await response.json();
      if (response.ok) { setUsers(prev => prev.map(u => u.username === username ? { ...u, rank: data.rank } : u)); setMessage(`${username} is now ${data.rank}`); setTimeout(() => setMessage(''), 2000); }
      else setError(data.error || 'Failed to set rank');
    } catch { setError('Network error'); }
  };

  const logout = () => { localStorage.removeItem('batprox-token'); localStorage.removeItem('batprox-user'); navigate('/'); };

  const background = (
    <div className="fixed inset-0 pointer-events-none z-0">
      <div className="absolute inset-0 bg-repeat opacity-60" style={{ backgroundImage: `radial-gradient(1px 1px at 20px 30px, #fff, rgba(0,0,0,0)), radial-gradient(1.5px 1.5px at 40px 70px, #fff, rgba(0,0,0,0)), radial-gradient(1px 1px at 90px 40px, #fff, rgba(0,0,0,0)), radial-gradient(2px 2px at 160px 120px, #ddd, rgba(0,0,0,0)), radial-gradient(1.5px 1.5px at 230px 190px, #fff, rgba(0,0,0,0)), radial-gradient(1px 1px at 300px 80px, #fff, rgba(0,0,0,0))`, backgroundSize: '350px 350px' }} />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-purple-600/20 rounded-full blur-[120px] pointer-events-none" />
    </div>
  );

  if (isAuthed === null) {
    return (
      <div className="relative min-h-screen w-full bg-black text-white flex items-center justify-center">
        {background}
        <div className="w-10 h-10 border-4 border-purple-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!isAuthed) {
    return (
      <div className="relative min-h-screen w-full bg-black overflow-hidden font-sans text-white">
        {background}
        <main className="relative z-10 flex items-center justify-center min-h-screen px-4">
          <div className="bg-black/60 border border-white/10 rounded-2xl p-8 max-w-md w-full backdrop-blur-md shadow-2xl text-center">
            <div className="w-14 h-14 rounded-2xl bg-red-600/15 border border-red-500/30 flex items-center justify-center mx-auto mb-5">
              <svg className="w-7 h-7 text-red-400" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </div>
            <h1 className="text-xl font-bold text-white mb-2">Admin access required</h1>
            <p className="text-gray-400 text-sm mb-6">This account does not have admin privileges. Log in with an admin account to continue.</p>
            <div className="flex gap-3 justify-center">
              <button onClick={() => navigate(loggedIn ? '/dashboard' : '/')} className="px-6 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-white transition-all text-sm font-medium">{loggedIn ? 'Dashboard' : 'Login page'}</button>
              <button onClick={logout} className="px-6 py-2.5 rounded-xl bg-purple-600/20 hover:bg-purple-600/40 text-purple-300 border border-purple-500/30 transition-all text-sm font-medium">Switch account</button>
            </div>
          </div>
        </main>
      </div>
    );
  }

  const FNAD_GENRE = '6th Nights game';
  const isFnad = (f: Feedback) => f.genre === FNAD_GENRE || f.genre === 'Five Nights game';
  const live = (f: Feedback) => f.status === 'pending' && !resolved.includes(f.id);
  const pendingFeedbacks = feedbacks.filter(f => live(f) && !isFnad(f));
  const fnadFeedbacks = feedbacks.filter(f => live(f) && isFnad(f));
  const filteredUsers = users.filter(u => u.username.toLowerCase().includes(userSearch.toLowerCase()));

  return (
    <div className="relative min-h-screen w-full bg-black overflow-hidden font-sans text-white">
      {background}
      <main className="relative z-10 flex min-h-screen">
        <div className="w-60 shrink-0 bg-black/50 border-r border-white/10 backdrop-blur-md p-4 flex flex-col">
          <div className="flex items-center gap-2.5 mb-8 px-1">
            <div className="w-8 h-8 rounded-lg bg-purple-600/20 border border-purple-500/30 flex items-center justify-center">
              <svg className="w-4 h-4 text-purple-300" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
            </div>
            <div>
              <h2 className="text-sm font-bold text-white leading-tight">Admin Panel</h2>
              <p className="text-[10px] text-white/30">nightbat control</p>
            </div>
          </div>
          <nav className="space-y-1">
            <button onClick={() => setTab('feedbacks')} className={`w-full px-3.5 py-2.5 rounded-lg text-left text-[13px] font-medium transition-colors flex items-center gap-2.5 ${tab === 'feedbacks' ? 'bg-white/[0.07] text-white' : 'text-white/45 hover:text-white/85 hover:bg-white/[0.03]'}`}>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" /></svg>
              Feedback Suggestions
              {pendingFeedbacks.length > 0 && <span className="ml-auto text-[10px] bg-purple-600/40 text-purple-200 px-1.5 py-0.5 rounded-full">{pendingFeedbacks.length}</span>}
            </button>
            <button onClick={() => setTab('fnadfeedback')} className={`w-full px-3.5 py-2.5 rounded-lg text-left text-[13px] font-medium transition-colors flex items-center gap-2.5 ${tab === 'fnadfeedback' ? 'bg-white/[0.07] text-white' : 'text-white/45 hover:text-white/85 hover:bg-white/[0.03]'}`}>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M15 10h.01M9 10h.01M7 16h10a4 4 0 004-4V9a4 4 0 00-4-4H7a4 4 0 00-4 4v3a4 4 0 004 4zm-2 5l2-5m12 5l-2-5" /></svg>
              6th nights game, suggestions
              {fnadFeedbacks.length > 0 && <span className="ml-auto text-[10px] bg-amber-600/40 text-amber-200 px-1.5 py-0.5 rounded-full">{fnadFeedbacks.length}</span>}
            </button>
            <button onClick={() => setTab('accounts')} className={`w-full px-3.5 py-2.5 rounded-lg text-left text-[13px] font-medium transition-colors flex items-center gap-2.5 ${tab === 'accounts' ? 'bg-white/[0.07] text-white' : 'text-white/45 hover:text-white/85 hover:bg-white/[0.03]'}`}>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a4 4 0 00-3-3.87M9 20H4v-2a4 4 0 013-3.87m6-1.13a4 4 0 10-4-4 4 4 0 004 4zm6-4a3 3 0 11-3-3" /></svg>
              Create user accounts
            </button>
            <button onClick={() => setTab('status')} className={`w-full px-3.5 py-2.5 rounded-lg text-left text-[13px] font-medium transition-colors flex items-center gap-2.5 ${tab === 'status' ? 'bg-white/[0.07] text-white' : 'text-white/45 hover:text-white/85 hover:bg-white/[0.03]'}`}>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
              Status change
            </button>
            <button onClick={() => setTab('paylater')} className={`w-full px-3.5 py-2.5 rounded-lg text-left text-[13px] font-medium transition-colors flex items-center gap-2.5 ${tab === 'paylater' ? 'bg-white/[0.07] text-white' : 'text-white/45 hover:text-white/85 hover:bg-white/[0.03]'}`}>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 1.343-3 3s1.343 3 3 3 3-1.343 3-3-1.343-3-3-3zm0 0V6m0 8v2m-7-4a7 7 0 1114 0 7 7 0 01-14 0z" /></svg>
              Pay-later reminder
            </button>
            <button onClick={() => setTab('commands')} className={`w-full px-3.5 py-2.5 rounded-lg text-left text-[13px] font-medium transition-colors flex items-center gap-2.5 ${tab === 'commands' ? 'bg-white/[0.07] text-white' : 'text-white/45 hover:text-white/85 hover:bg-white/[0.03]'}`}>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              Command panel
            </button>
            <button onClick={() => setTab('ranks')} className={`w-full px-3.5 py-2.5 rounded-lg text-left text-[13px] font-medium transition-colors flex items-center gap-2.5 ${tab === 'ranks' ? 'bg-white/[0.07] text-white' : 'text-white/45 hover:text-white/85 hover:bg-white/[0.03]'}`}>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>
              User ranks
            </button>
            <button onClick={() => setTab('coderequest')} className={`w-full px-3.5 py-2.5 rounded-lg text-left text-[13px] font-medium transition-colors flex items-center gap-2.5 ${tab === 'coderequest' ? 'bg-white/[0.07] text-white' : 'text-white/45 hover:text-white/85 hover:bg-white/[0.03]'}`}>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M17.25 6.75L21 10.5l-3.75 3.75M6.75 17.25L3 13.5l3.75-3.75M14.25 4.5l-4.5 15" /></svg>
              Code request
            </button>
            <button onClick={() => setTab('loginprobs')} className={`w-full px-3.5 py-2.5 rounded-lg text-left text-[13px] font-medium transition-colors flex items-center gap-2.5 ${tab === 'loginprobs' ? 'bg-white/[0.07] text-white' : 'text-white/45 hover:text-white/85 hover:bg-white/[0.03]'}`}>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" /></svg>
              Login problems
              {(problems.reports.length + problems.resets.length) > 0 && <span className="ml-auto text-[10px] bg-orange-600/40 text-orange-200 px-1.5 py-0.5 rounded-full">{problems.reports.length + problems.resets.length}</span>}
            </button>
            <button onClick={() => setTab('datainfo')} className={`w-full px-3.5 py-2.5 rounded-lg text-left text-[13px] font-medium transition-colors flex items-center gap-2.5 ${tab === 'datainfo' ? 'bg-white/[0.07] text-white' : 'text-white/45 hover:text-white/85 hover:bg-white/[0.03]'}`}>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M20.25 6.375c0 2.278-3.694 4.125-8.25 4.125S3.75 8.653 3.75 6.375m16.5 0c0-2.278-3.694-4.125-8.25-4.125S3.75 4.097 3.75 6.375m16.5 0v11.25c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125V6.375m16.5 0v3.75m-16.5-3.75v3.75m16.5 0v3.75C20.25 16.153 16.556 18 12 18s-8.25-1.847-8.25-4.125v-3.75" /></svg>
              Data information
            </button>
          </nav>
          <div className="mt-auto space-y-1">
            <button onClick={() => navigate('/dashboard')} className="w-full px-3.5 py-2.5 rounded-lg text-left text-[13px] font-medium text-white/60 hover:text-white hover:bg-white/[0.04] transition-colors">Back to Dashboard</button>
            <button onClick={logout} className="w-full px-3.5 py-2.5 rounded-lg text-left text-[13px] font-medium text-red-400/80 hover:text-red-300 hover:bg-red-600/10 transition-colors">Logout</button>
          </div>
        </div>
        <div className="flex-1 p-8 overflow-y-auto">
          <div className="max-w-4xl mx-auto">
            {message && <div className="mb-5 text-xs text-green-400 bg-green-500/10 border border-green-500/20 px-3 py-1.5 rounded-full inline-flex items-center gap-1.5"><svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>{message}</div>}
            {error && <div className="mb-5 text-xs text-red-400 bg-red-500/10 border border-red-500/20 px-3 py-1.5 rounded-full inline-block">{error}</div>}
            {tab === 'feedbacks' && (
              <div>
                <h2 className="text-lg font-bold text-white mb-5">Users Feedback Suggestions</h2>
                <div className="grid lg:grid-cols-[1fr_240px] gap-4 items-start">
                  <div className="space-y-2.5">
                    {pendingFeedbacks.length === 0 ? (
                      <div className="bg-black/40 border border-white/10 rounded-xl p-10 text-center">
                        <p className="text-gray-400 text-sm">No pending feedback suggestions.</p>
                        <p className="text-gray-600 text-xs mt-1">New suggestions will appear here for approval.</p>
                      </div>
                    ) : (
                      pendingFeedbacks.map((feedback) => (
                        <div key={feedback.id} className="bg-black/40 border border-white/10 rounded-xl p-4 backdrop-blur-md hover:border-white/20 transition-colors">
                          <div className="flex justify-between items-start gap-3">
                            <div className="min-w-0">
                              <p className="text-[11px] text-gray-500 mb-1">feedback from <span className="text-purple-300 font-medium">{feedback.user_identifier || 'unknown'}</span><span className="text-gray-600"> · {new Date(feedback.submitted_at).toLocaleString()}</span><span className={`ml-2 text-[10px] px-2 py-0.5 rounded-full border align-middle ${feedback.genre === 'Website bug' ? 'text-red-300 border-red-500/25 bg-red-500/10' : 'text-blue-300 border-blue-500/25 bg-blue-500/10'}`}>{feedback.genre || 'Feedback suggestions'}</span></p>
                              {feedback.title && <p className="text-[13px] text-white font-semibold mb-0.5 break-words">{feedback.title}</p>}
                              <p className="text-gray-200 text-[13px] break-words whitespace-pre-wrap">{feedback.content}</p>
                            </div>
                            <div className="flex gap-1.5 shrink-0">
                              <button onClick={() => openReply(feedback)} className="text-[11px] px-3 py-1.5 rounded-lg bg-amber-600/15 hover:bg-amber-600/35 text-amber-300 border border-amber-500/25 transition-all font-medium">Reply to suggestion</button>
                              <button onClick={() => handleDecline(feedback.id)} className="text-[11px] px-3 py-1.5 rounded-lg bg-red-600/15 hover:bg-red-600/35 text-red-300 border border-red-500/25 transition-all font-medium">Decline</button>
                              <button onClick={() => handleApprove(feedback.id)} className="text-[11px] px-3 py-1.5 rounded-lg bg-green-600/20 hover:bg-green-600/40 text-green-300 border border-green-500/30 transition-all font-medium">Approve</button>
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                  <div className="bg-black/40 border border-white/10 rounded-xl p-4 backdrop-blur-md lg:sticky lg:top-0">
                    <p className="text-xs font-bold text-white mb-1">users appreciations</p>
                    <p className="text-[10px] text-white/30 mb-3">did i fix your issue votes</p>
                    <div className="space-y-2 max-h-96 overflow-y-auto">
                      {Object.keys(responses).length === 0 && <p className="text-[11px] text-white/30">No votes yet.</p>}
                      {Object.keys(responses).map(k => (
                        <div key={k} className="px-3 py-2 rounded-lg bg-white/[0.04] border border-white/[0.08]">
                          <p className="text-[11px] text-white/70 font-semibold">#{k}</p>
                          <p className="text-[11px] text-white/50">▲ {(responses[k] as any).up || 0} yes · ▼ {(responses[k] as any).down || 0} no</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}
            {tab === 'fnadfeedback' && (
              <div>
                <h2 className="text-lg font-bold text-white mb-1">6th nights game, suggestions</h2>
                <p className="text-xs text-white/35 mb-5">Feedback sent from inside 6 Nights at Detention.</p>
                <div className="space-y-2.5">
                  {fnadFeedbacks.length === 0 ? (
                    <div className="bg-black/40 border border-white/10 rounded-xl p-10 text-center">
                      <p className="text-gray-400 text-sm">No game suggestions yet.</p>
                      <p className="text-gray-600 text-xs mt-1">Feedback sent from the game lands here.</p>
                    </div>
                  ) : (
                    fnadFeedbacks.map((feedback) => (
                      <div key={feedback.id} className="bg-black/40 border border-white/10 rounded-xl p-4 backdrop-blur-md hover:border-white/20 transition-colors">
                        <div className="flex justify-between items-start gap-3">
                          <div className="min-w-0">
                            <p className="text-[11px] text-gray-500 mb-1">feedback from <span className="text-amber-300 font-medium">{feedback.user_identifier || 'unknown'}</span><span className="text-gray-600"> · {new Date(feedback.submitted_at).toLocaleString()}</span><span className="ml-2 text-[10px] px-2 py-0.5 rounded-full border align-middle text-amber-300 border-amber-500/25 bg-amber-500/10">{feedback.genre || FNAD_GENRE}</span></p>
                            {feedback.title && <p className="text-[13px] text-white font-semibold mb-0.5 break-words">{feedback.title}</p>}
                            <p className="text-gray-200 text-[13px] break-words whitespace-pre-wrap">{feedback.content}</p>
                          </div>
                          <div className="flex gap-1.5 shrink-0">
                            <button onClick={() => openReply(feedback)} className="text-[11px] px-3 py-1.5 rounded-lg bg-amber-600/15 hover:bg-amber-600/35 text-amber-300 border border-amber-500/25 transition-all font-medium">Reply to suggestion</button>
                              <button onClick={() => handleDecline(feedback.id)} className="text-[11px] px-3 py-1.5 rounded-lg bg-red-600/15 hover:bg-red-600/35 text-red-300 border border-red-500/25 transition-all font-medium">Decline</button>
                            <button onClick={() => handleApprove(feedback.id)} className="text-[11px] px-3 py-1.5 rounded-lg bg-green-600/20 hover:bg-green-600/40 text-green-300 border border-green-500/30 transition-all font-medium">Approve</button>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
            {tab === 'accounts' && (
              <div>
                <div className="flex items-center justify-between mb-5">
                  <h2 className="text-lg font-bold text-white">Create user accounts</h2>
                  <button onClick={() => { setShowCreateModal(true); setCreateError(''); }} className="text-xs px-4 py-2 rounded-lg bg-purple-600 hover:bg-purple-500 text-white font-medium transition-all flex items-center gap-1.5"><span className="text-base leading-none">+</span> create account</button>
                </div>
                <div className="bg-black/40 border border-white/10 rounded-xl p-5 backdrop-blur-md">
                  <p className="text-white font-semibold text-sm mb-3">validated users</p>
                  <div className="relative mb-4">
                    <svg className="w-4 h-4 text-gray-500 absolute left-3.5 top-1/2 -translate-y-1/2" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                    <input type="text" value={userSearch} onChange={(e) => setUserSearch(e.target.value)} placeholder="Search for users..." className="w-full pl-10 pr-4 py-2.5 rounded-lg bg-white/5 border border-white/10 text-white placeholder-gray-500 text-sm focus:outline-none focus:border-purple-500/50 transition-all" />
                  </div>
                  {filteredUsers.length === 0 ? <p className="text-gray-500 text-sm text-center py-6">No users found.</p> : (
                    <div className="space-y-2">
                      {filteredUsers.map((user) => (
                        <div key={user.id} className="flex items-center justify-between gap-4 bg-white/[0.03] hover:bg-white/[0.06] border border-white/5 rounded-lg px-4 py-3 transition-colors">
                          <div className="min-w-0">
                            <p className="text-sm text-white font-medium truncate">{user.username}</p>
                            <p className="text-[11px] text-gray-500">code: <span className="text-gray-400">{user.invite_code}</span> · added {new Date(user.created_at).toLocaleDateString()}</p>
                          </div>
                          <div className="flex gap-2 shrink-0 flex-wrap justify-end">
                            <button onClick={() => { setRevokeTarget(user); setRevokeCode(''); setRevokeError(''); }} className="text-xs px-3 py-1.5 rounded-lg bg-yellow-600/15 hover:bg-yellow-600/35 text-yellow-300 border border-yellow-500/25 transition-all">revoke access key</button>
                            <button onClick={() => { setDueTarget(user); setDueDate(''); setDueCode(''); setDueError(''); }} className="text-xs px-3 py-1.5 rounded-lg bg-orange-600/15 hover:bg-orange-600/30 text-orange-300 border border-orange-500/25 transition-all">remove due timer</button>
                            <button onClick={() => { setTempTarget(user); setTempDays(''); setTempError(''); }} className="text-xs px-3 py-1.5 rounded-lg bg-purple-600/15 hover:bg-purple-600/30 text-purple-300 border border-purple-500/25 transition-all">temp remove account</button>
                            <button onClick={() => handleBlacklist(user)} className="text-xs px-3 py-1.5 rounded-lg bg-red-900/30 hover:bg-red-800/50 text-red-200 border border-red-700/50 transition-all">blacklist account</button>
                            <button onClick={() => handleRemoveUser(user.username)} className="text-xs px-3 py-1.5 rounded-lg bg-red-600/15 hover:bg-red-600/35 text-red-300 border border-red-500/25 transition-all">remove account</button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
            {tab === 'ranks' && (
              <div>
                <h2 className="text-lg font-bold text-white mb-1">User ranks</h2>
                <p className="text-gray-500 text-sm mb-5">Validated users. Make someone staff to give them the moderator rank and staff panel access.</p>
                <div className="bg-black/40 border border-white/10 rounded-xl p-5 backdrop-blur-md">
                  {users.length === 0 ? <p className="text-gray-500 text-sm text-center py-6">No users found.</p> : (
                    <div className="space-y-2">
                      {users.map((user) => (
                        <div key={user.id} className="flex items-center justify-between gap-4 bg-white/[0.03] hover:bg-white/[0.06] border border-white/5 rounded-lg px-4 py-3 transition-colors">
                          <div className="min-w-0 flex items-center gap-3">
                            <p className="text-sm text-white font-medium truncate">{user.username}</p>
                            {user.rank === 'moderator' ? (
                              <span className="text-[10px] font-bold tracking-widest px-2 py-0.5 rounded-full bg-blue-500/15 text-blue-300 border border-blue-500/30">MODERATOR</span>
                            ) : (
                              <span className="text-[10px] font-bold tracking-widest px-2 py-0.5 rounded-full bg-white/5 text-white/40 border border-white/10">VISITOR</span>
                            )}
                          </div>
                          <div className="shrink-0">
                            {user.rank === 'moderator' ? (
                              <button onClick={() => handleSetRank(user.username, 'user')} className="text-xs px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-white/60 border border-white/10 transition-all">remove staff</button>
                            ) : (
                              <button onClick={() => handleSetRank(user.username, 'moderator')} className="text-xs px-3 py-1.5 rounded-lg bg-blue-600/20 hover:bg-blue-600/45 text-blue-200 border border-blue-500/30 transition-all font-medium">put as mod/staff</button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
            {tab === 'datainfo' && (
              <div>
                <h2 className="text-lg font-bold text-white mb-1">Data information</h2>
                <p className="text-xs text-white/35 mb-5">Download a copy of what the site has stored. Files come down as JSON.</p>
                <div className="bg-black/40 border border-white/10 rounded-xl p-5 backdrop-blur-md max-w-2xl">
                  <p className="text-sm font-semibold text-white mb-1">Export Data's:</p>
                  <p className="text-[11px] text-white/35 mb-4">These files contain private messages and personal data. Keep them somewhere safe.</p>
                  <div className="space-y-2.5">
                    <button onClick={() => runExport('chat', 'Chat data')} disabled={!!exporting} className="w-full flex items-center justify-between gap-3 px-4 py-3 rounded-xl bg-white/[0.04] border border-white/10 hover:border-purple-500/40 hover:bg-white/[0.07] disabled:opacity-50 transition-all text-left">
                      <span>
                        <span className="block text-[13px] font-medium text-white">Export chat data</span>
                        <span className="block text-[11px] text-white/35">Every message from the public chat rooms</span>
                      </span>
                      <span className="text-[11px] text-purple-300 shrink-0">{exporting === 'chat' ? 'working..' : 'download'}</span>
                    </button>
                    <button onClick={() => runExport('dms', 'DM data')} disabled={!!exporting} className="w-full flex items-center justify-between gap-3 px-4 py-3 rounded-xl bg-white/[0.04] border border-white/10 hover:border-purple-500/40 hover:bg-white/[0.07] disabled:opacity-50 transition-all text-left">
                      <span>
                        <span className="block text-[13px] font-medium text-white">Export account's dms data</span>
                        <span className="block text-[11px] text-white/35">Direct messages, grouped by conversation</span>
                      </span>
                      <span className="text-[11px] text-purple-300 shrink-0">{exporting === 'dms' ? 'working..' : 'download'}</span>
                    </button>
                    <button onClick={() => runExport('ai', 'AI data')} disabled={!!exporting} className="w-full flex items-center justify-between gap-3 px-4 py-3 rounded-xl bg-white/[0.04] border border-white/10 hover:border-purple-500/40 hover:bg-white/[0.07] disabled:opacity-50 transition-all text-left">
                      <span>
                        <span className="block text-[13px] font-medium text-white">Export AI messages Data</span>
                        <span className="block text-[11px] text-white/35">What users asked MocahAI, and what it replied</span>
                      </span>
                      <span className="text-[11px] text-purple-300 shrink-0">{exporting === 'ai' ? 'working..' : 'download'}</span>
                    </button>
                    <button onClick={() => runExport('drops', 'File dropper data')} disabled={!!exporting} className="w-full flex items-center justify-between gap-3 px-4 py-3 rounded-xl bg-white/[0.04] border border-white/10 hover:border-purple-500/40 hover:bg-white/[0.07] disabled:opacity-50 transition-all text-left">
                      <span>
                        <span className="block text-[13px] font-medium text-white">file dropper</span>
                        <span className="block text-[11px] text-white/35">Download people saved file drops</span>
                      </span>
                      <span className="text-[11px] text-purple-300 shrink-0">{exporting === 'drops' ? 'working..' : 'download'}</span>
                    </button>
                  </div>
                  {exportMsg && <p className="mt-4 text-[12px] text-emerald-300">{exportMsg}</p>}
                </div>
              </div>
            )}
            {tab === 'coderequest' && (
              <div>
                <div className="flex items-center justify-between gap-4 mb-1">
                  <h2 className="text-lg font-bold text-white">Code request</h2>
                  <span className={`text-[11px] px-3 py-1 rounded-full border flex items-center gap-1.5 ${codePc ? 'bg-green-500/10 text-green-300 border-green-500/30' : 'bg-white/5 text-white/40 border-white/10'}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${codePc ? 'bg-green-400 animate-pulse' : 'bg-white/30'}`} />
                    {codePc ? `your pc is connected${codeHost ? ` (${codeHost})` : ''}` : 'your pc is offline'}
                  </span>
                </div>
                <p className="text-gray-500 text-sm mb-5">Runs on your own Claude account through the bridge on your PC. Enter sends it, shift+enter makes a new line.</p>
                <div className="grid lg:grid-cols-[1fr_260px] gap-4 items-start">
                  <div className="space-y-4">
                    <div className="bg-black/40 border border-white/10 rounded-xl p-4 backdrop-blur-md">
                      <div className="flex items-center gap-3 mb-3">
                        <select value={codeProvider} onChange={e => setCodeProvider(e.target.value as 'claude' | 'copilot')} className="px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:border-purple-500/60 transition-all">
                          <option className="bg-[#0d0d12]" value="claude">Claude</option>
                          <option className="bg-[#0d0d12]" value="copilot">GitHub Copilot</option>
                        </select>
                        <span className="text-[11px] text-white/35">{codeProvider === 'claude' ? 'connects to your Claude account' : 'connects to your GitHub Copilot account'}</span>
                      </div>
                      <textarea
                        value={codePrompt}
                        onChange={e => { setCodePrompt(e.target.value); if (codeError) setCodeError(''); }}
                        onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendCodeRequest(); } }}
                        placeholder="type the request you want.."
                        rows={7}
                        className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white text-sm placeholder-gray-500 focus:outline-none focus:border-purple-500/60 transition-all resize-y leading-relaxed"
                      />
                      <div className="flex items-center justify-between gap-3 mt-3">
                        <span className="text-[11px] text-white/25">{codeStage || 'enter = send · shift+enter = new line'}</span>
                        <button onClick={sendCodeRequest} disabled={codeBusy || !codePrompt.trim()} className="px-5 py-2 rounded-lg bg-purple-600 hover:bg-purple-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-semibold transition-all flex items-center gap-2">
                          {codeBusy && <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-90" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.4 0 0 5.4 0 12h4z" /></svg>}
                          {codeBusy ? 'sending' : 'send request'}
                        </button>
                      </div>
                      {codeError && <p className="text-red-400 text-xs mt-3 whitespace-pre-wrap break-words">{codeError}</p>}
                    </div>
                    {codeOut && (
                      <div className="bg-black border border-purple-500/30 rounded-xl overflow-hidden shadow-[0_0_30px_rgba(139,92,246,0.2)]">
                        <div className="bg-white/[0.04] border-b border-white/10 px-4 py-2 flex items-center gap-2">
                          <span className="text-xs font-mono text-purple-300">answer</span>
                          <button onClick={() => setCodeOut('')} className="ml-auto text-[11px] text-white/35 hover:text-white/80 transition-colors">clear</button>
                        </div>
                        <pre className="p-4 max-h-[26rem] overflow-auto font-mono text-[12.5px] text-white/80 whitespace-pre-wrap break-words bg-[#050508]">{codeOut}</pre>
                      </div>
                    )}
                  </div>
                  <div className="bg-black/40 border border-white/10 rounded-xl backdrop-blur-md lg:sticky lg:top-0 overflow-hidden">
                    <div className="px-4 py-3 border-b border-white/[0.07] flex items-center gap-2">
                      <div>
                        <p className="text-xs font-bold text-white leading-tight">recent requests</p>
                        <p className="text-[10px] text-white/30">last 12 from this panel</p>
                      </div>
                      {codeJobs.length > 0 && <span className="ml-auto text-[10px] text-white/35 bg-white/[0.06] border border-white/10 px-2 py-0.5 rounded-full">{codeJobs.length}</span>}
                    </div>
                    <div className="p-2 space-y-1.5 max-h-[32rem] overflow-y-auto">
                      {codeJobs.length === 0 && (
                        <div className="px-3 py-8 text-center">
                          <p className="text-[11px] text-white/30">Nothing sent yet.</p>
                          <p className="text-[10px] text-white/20 mt-1">Your requests will show up here.</p>
                        </div>
                      )}
                      {codeJobs.map(job => {
                        const tone = job.status === 'done'
                          ? { dot: 'bg-green-400', text: 'text-green-300', edge: 'border-l-green-400/70', chip: 'bg-green-500/10 text-green-300 border-green-500/25' }
                          : job.status === 'error'
                            ? { dot: 'bg-red-400', text: 'text-red-300', edge: 'border-l-red-400/70', chip: 'bg-red-500/10 text-red-300 border-red-500/25' }
                            : { dot: 'bg-amber-400 animate-pulse', text: 'text-amber-300', edge: 'border-l-amber-400/70', chip: 'bg-amber-500/10 text-amber-300 border-amber-500/25' };
                        const open = codeOpen === job.id;
                        return (
                          <button
                            key={job.id}
                            onClick={() => { setCodeOpen(job.id); setCodeOut(job.reply || ''); setCodeError(''); }}
                            className={`w-full text-left pl-3 pr-2.5 py-2.5 rounded-lg border border-l-2 transition-all ${tone.edge} ${open ? 'bg-white/[0.09] border-white/25' : 'bg-white/[0.035] border-white/[0.07] hover:bg-white/[0.06] hover:border-white/20'}`}
                          >
                            <div className="flex items-center gap-1.5 mb-1.5">
                              <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${tone.dot}`} />
                              <span className={`text-[9px] font-bold uppercase tracking-widest ${tone.text}`}>{job.status === 'pending' ? 'queued' : job.status}</span>
                              <span className={`ml-auto text-[9px] px-1.5 py-0.5 rounded border ${tone.chip}`}>{job.provider === 'copilot' ? 'copilot' : 'claude'}</span>
                            </div>
                            <p className="text-[11.5px] text-white/80 leading-snug line-clamp-2 break-words">{job.prompt}</p>
                            <p className="text-[10px] text-white/25 mt-1.5">{codeAgo(job.ts)}</p>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
            )}
            {tab === 'loginprobs' && (
              <div>
                <h2 className="text-lg font-bold text-white mb-1">Login problems</h2>
                <p className="text-gray-500 text-sm mb-5">Votes, error reports and password reset requests.</p>
                <div className="grid md:grid-cols-3 gap-4">
                  <div className="bg-black/40 border border-white/10 rounded-xl p-5 backdrop-blur-md">
                    <p className="text-white font-semibold text-sm mb-3">is the login working votes</p>
                    {problems.votes.length === 0 ? <p className="text-gray-500 text-xs">No votes yet.</p> : (
                      <div className="space-y-2 max-h-80 overflow-y-auto">
                        {problems.votes.slice().reverse().map((v, i) => (
                          <div key={i} className="flex items-center justify-between px-3 py-2 rounded-lg bg-white/[0.04] border border-white/[0.08]">
                            <span className="text-xs text-white font-medium">{v.user}</span>
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${v.working ? 'bg-green-500/15 text-green-300' : 'bg-red-500/15 text-red-300'}`}>{v.working ? 'yes' : 'no'}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="bg-black/40 border border-white/10 rounded-xl p-5 backdrop-blur-md">
                    <p className="text-white font-semibold text-sm mb-3">login error reports</p>
                    {problems.reports.length === 0 ? <p className="text-gray-500 text-xs">No reports yet.</p> : (
                      <div className="space-y-2 max-h-80 overflow-y-auto">
                        {problems.reports.slice().reverse().map((r, i) => (
                          <div key={i} className="px-3 py-2 rounded-lg bg-white/[0.04] border border-white/[0.08]">
                            <p className="text-xs text-white"><span className="font-semibold">{r.user}</span>, has reported the login error of:</p>
                            <p className="text-xs text-orange-200 mt-1 whitespace-pre-wrap break-words">{r.error}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="bg-black/40 border border-white/10 rounded-xl p-5 backdrop-blur-md">
                    <p className="text-white font-semibold text-sm mb-3">password reset requests</p>
                    {problems.resets.length === 0 ? <p className="text-gray-500 text-xs">No requests yet.</p> : (
                      <div className="space-y-2 max-h-80 overflow-y-auto">
                        {problems.resets.slice().reverse().map((r, i) => (
                          <div key={i} className="px-3 py-2 rounded-lg bg-white/[0.04] border border-white/[0.08]">
                            <p className="text-xs text-white"><span className="font-semibold">{r.user}</span> wants an password reset request.</p>
                            <p className="text-[10px] text-gray-500 mt-0.5">{new Date(r.ts).toLocaleString()}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
            {tab === 'status' && (
              <div>
                <h2 className="text-lg font-bold text-white mb-1">Status change</h2>
                <p className="text-gray-500 text-sm mb-5">Manually set how each service shows on the API Status page. Green = available, purple = fixing, red = down, auto = real check.</p>
                <div className="space-y-3">
                  {SERVICES.map((service) => {
                    const current = statusOverrides[service] || 'auto';
                    const options = [{ id: 'green', label: 'Green', dot: 'bg-green-400' }, { id: 'purple', label: 'Purple', dot: 'bg-purple-400' }, { id: 'red', label: 'Red', dot: 'bg-red-400' }, { id: 'auto', label: 'Auto', dot: 'bg-white/40' }];
                    return (
                      <div key={service} className="bg-black/40 border border-white/10 rounded-xl p-4 flex flex-wrap items-center justify-between gap-4">
                        <div className="flex items-center gap-3">
                          <span className={`w-2.5 h-2.5 rounded-full ${options.find(o => o.id === current)?.dot}`} />
                          <span className="text-sm font-medium text-white/90">{service}</span>
                          <span className="text-[11px] text-gray-500 uppercase tracking-wide">{current}</span>
                        </div>
                        <div className="flex gap-2">
                          {options.map((o) => (
                            <button key={o.id} onClick={() => saveStatus(service, o.id)} className={`text-xs px-3.5 py-1.5 rounded-lg border transition-all font-medium flex items-center gap-1.5 ${current === o.id ? 'bg-white/[0.1] text-white border-white/25' : 'bg-white/[0.03] text-white/55 border-white/10 hover:bg-white/[0.07] hover:text-white'}`}>
                              <span className={`w-2 h-2 rounded-full ${o.dot}`} />{o.label}
                            </button>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
            {tab === 'paylater' && (
              <div>
                <h2 className="text-lg font-bold text-white mb-1">Pay-later reminder</h2>
                <p className="text-gray-500 text-sm mb-5">Validated users due within 7 days. Orange = pay-later.</p>
                {filteredUsers.length === 0 ? <p className="text-gray-500 text-sm text-center py-6">No validated users.</p> : (
                  <div className="space-y-2">
                    {filteredUsers.map(u => {
                      const due = u.payLater && u.payLaterSince ? new Date(new Date(u.payLaterSince).getTime()+7*24*60*60*1000).toLocaleDateString() : '';
                      return (
                        <div key={u.id} className={`flex items-center justify-between gap-4 rounded-xl px-5 py-4 border-2 transition-all ${u.payLater ? 'bg-orange-600/20 border-orange-400/60 shadow-[0_0_22px_rgba(251,146,60,0.35)]' : 'bg-white/[0.04] border-white/10'}`}>
                          <div className="min-w-0">
                            <p className={`text-[15px] font-bold truncate ${u.payLater ? 'text-orange-200' : 'text-white'}`}>{u.username} {u.payLater && <span className="text-xs bg-orange-500 text-white px-3 py-1 rounded-full ml-2 font-bold">PAY-LATER DUE {due}</span>}</p>
                            <p className="text-xs text-gray-400 mt-1">code: <span className="text-gray-200 font-mono">{u.invite_code}</span> · added {new Date(u.created_at).toLocaleDateString()}</p>
                          </div>
                          <button onClick={() => togglePayLater(u)} className={`text-xs px-4 py-2 rounded-lg border-2 font-semibold transition-all shrink-0 ${u.payLater ? 'bg-green-600 text-white border-green-500 hover:bg-green-700' : 'bg-orange-500 text-white border-orange-600 hover:bg-orange-600'}`}>{u.payLater ? 'successfully paid' : 'will pay-later'}</button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
            {tab === 'commands' && (
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-2 h-2 rounded-full bg-red-500" />
                  <div className="w-2 h-2 rounded-full bg-yellow-500" />
                  <div className="w-2 h-2 rounded-full bg-green-500" />
                  <h2 className="text-sm font-bold text-white ml-2 tracking-wide">batprox@stealthybat:~$</h2>
                  <span className="ml-auto text-[11px] text-white/30">type "show commands"</span>
                </div>
                <div className="bg-black border border-purple-500/30 rounded-xl overflow-hidden shadow-[0_0_30px_rgba(139,92,246,0.25)]">
                  <div className="bg-white/[0.04] border-b border-white/10 px-4 py-2 flex items-center gap-2">
                    <span className="text-xs font-mono text-purple-300">command panel</span>
                    <span className="text-xs text-white/30">— {users.length} users loaded</span>
                  </div>
                  <div className="p-4 h-80 overflow-y-auto font-mono text-sm bg-[#050508]">
                    {cmdLog.map((l, i) => <div key={i} className={l.startsWith('>') ? 'text-purple-300' : l.startsWith('Available') || l.includes(':') ? 'text-green-300' : 'text-white/70'} style={{ whiteSpace: 'pre-wrap' }}>{l}</div>)}
                  </div>
                  <form onSubmit={e => { e.preventDefault(); runCommand(); }} className="flex gap-0 border-t border-white/10 bg-black">
                    <span className="px-3 py-3 text-green-400 font-mono text-sm select-none">❯</span>
                    <input value={cmdInput} onChange={e => setCmdInput(e.target.value)} placeholder='show commands' className="flex-1 px-2 py-3 bg-transparent text-white placeholder-white/30 text-sm font-mono focus:outline-none" />
                    <button type="submit" className="px-6 bg-purple-600 hover:bg-purple-500 text-white text-sm font-bold tracking-wide">ENTER</button>
                  </form>
                </div>
                <p className="text-[11px] text-white/25 mt-2 font-mono">Tip: "show quick-access codes" reveals all invite codes</p>
              </div>
            )}
          </div>
        </div>
      </main>
      {replyTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-[#0d0d12] border border-white/10 rounded-2xl p-7 max-w-lg w-full shadow-2xl">
            <h3 className="text-base font-semibold text-white mb-1">Reply to this suggestion.</h3>
            <p className="text-[11px] text-white/35 mb-4">
              from <span className="text-amber-300 font-medium">{replyTarget.user_identifier || 'unknown'}</span>
              {replyTarget.title ? <span className="text-white/25"> · {replyTarget.title}</span> : null}
            </p>
            <div className="rounded-xl bg-white/[0.04] border border-white/10 px-4 py-3 mb-4 max-h-32 overflow-y-auto">
              <p className="text-[13px] text-gray-300 whitespace-pre-wrap break-words">{replyTarget.content}</p>
            </div>
            <textarea
              value={replyText}
              onChange={(e) => setReplyText(e.target.value)}
              rows={5}
              maxLength={1000}
              placeholder="Write your reply to them.."
              className="w-full px-4 py-3 rounded-lg bg-white/5 border border-white/10 text-white text-sm placeholder-gray-500 focus:outline-none focus:border-amber-500/60 transition-all resize-y mb-2"
            />
            <p className="text-[10px] text-white/25 mb-4">{replyText.trim().length}/1000 · they will see this on the site and inside the game.</p>
            {replyError && <p className="text-red-400 text-xs mb-3">{replyError}</p>}
            <div className="flex gap-2.5 justify-end">
              <button type="button" onClick={() => setReplyTarget(null)} className="px-5 py-2.5 rounded-lg bg-white/5 hover:bg-white/10 text-white text-sm font-medium transition-all">Cancel</button>
              <button type="button" disabled={replyBusy} onClick={sendReply} className="px-5 py-2.5 rounded-lg bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white text-sm font-semibold transition-all">{replyBusy ? 'Sending..' : 'Approve & send'}</button>
            </div>
          </div>
        </div>
      )}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <form onSubmit={handleCreateAccount} className="bg-[#0d0d12] border border-white/10 rounded-2xl p-7 max-w-md w-full shadow-2xl">
            <h3 className="text-base font-semibold text-white mb-5">Create user account</h3>
            <label className="block text-xs text-white/50 mb-1.5">enter account username for the person</label>
            <input type="text" value={newUsername} onChange={(e) => setNewUsername(e.target.value)} placeholder="username" className="w-full px-4 py-2.5 rounded-lg bg-white/5 border border-white/10 text-white text-sm placeholder-gray-500 focus:outline-none focus:border-purple-500/60 transition-all mb-4" />
            <label className="block text-xs text-white/50 mb-1.5">enter account invite code</label>
            <div className="flex gap-2 mb-4">
              <input type="text" value={newCode} onChange={(e) => setNewCode(e.target.value)} placeholder="invite code" className="flex-1 px-4 py-2.5 rounded-lg bg-white/5 border border-white/10 text-white text-sm placeholder-gray-500 focus:outline-none focus:border-purple-500/60 transition-all" />
              <button type="button" onClick={() => { const c = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'; let s = ''; for (let i = 0; i < 6; i++) s += c[Math.floor(Math.random() * c.length)]; setNewCode(s.slice(0, 3) + '-' + s.slice(3)); }} className="px-4 py-2.5 rounded-lg bg-purple-600/20 hover:bg-purple-600/40 text-purple-200 border border-purple-500/30 text-xs font-semibold whitespace-nowrap transition-all">generate/randomize a password</button>
            </div>
            {createError && <p className="text-red-400 text-xs mb-3">{createError}</p>}
            <div className="flex gap-2.5 justify-end">
              <button type="button" onClick={() => setShowCreateModal(false)} className="px-5 py-2.5 rounded-lg bg-white/5 hover:bg-white/10 text-white text-sm font-medium transition-all">Cancel</button>
              <button type="submit" className="px-5 py-2.5 rounded-lg bg-purple-600 hover:bg-purple-500 text-white text-sm font-semibold transition-all">+ create account</button>
            </div>
          </form>
        </div>
      )}
      {revokeTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <form onSubmit={handleRevokeKey} className="bg-[#0d0d12] border border-white/10 rounded-2xl p-7 max-w-md w-full shadow-2xl">
            <h3 className="text-base font-semibold text-white mb-5">enter a new access invite key for the <span className="text-purple-300">{revokeTarget.username}</span></h3>
            <input type="text" value={revokeCode} onChange={(e) => setRevokeCode(e.target.value)} placeholder="new invite code" className="w-full px-4 py-2.5 rounded-lg bg-white/5 border border-white/10 text-white text-sm placeholder-gray-500 focus:outline-none focus:border-purple-500/60 transition-all mb-4" />
            {revokeError && <p className="text-red-400 text-xs mb-3">{revokeError}</p>}
            <div className="flex gap-2.5 justify-end">
              <button type="button" onClick={() => setRevokeTarget(null)} className="px-5 py-2.5 rounded-lg bg-white/5 hover:bg-white/10 text-white text-sm font-medium transition-all">Cancel</button>
              <button type="submit" className="px-5 py-2.5 rounded-lg bg-yellow-600 hover:bg-yellow-500 text-black text-sm font-semibold transition-all">Revoke key</button>
            </div>
          </form>
        </div>
      )}
      {dueTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <form onSubmit={handleDueRemove} className="bg-[#0d0d12] border border-white/10 rounded-2xl p-7 max-w-md w-full shadow-2xl">
            <h3 className="text-base font-semibold text-white mb-3">set a date for this account to be removed</h3>
            <p className="text-xs text-white/50 mb-3">remove <span className="text-purple-300">{dueTarget.username}</span> account.</p>
            <input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} className="w-full px-4 py-2.5 rounded-lg bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:border-purple-500/60 mb-3" />
            <input type="text" value={dueCode} onChange={e => setDueCode(e.target.value)} placeholder="enter quick-access code to remove this account" className="w-full px-4 py-2.5 rounded-lg bg-white/5 border border-white/10 text-white text-sm placeholder-gray-500 focus:outline-none focus:border-purple-500/60 mb-3" />
            {dueError && <p className="text-red-400 text-xs mb-3">{dueError}</p>}
            <div className="flex gap-2.5 justify-end">
              <button type="button" onClick={() => setDueTarget(null)} className="px-5 py-2.5 rounded-lg bg-white/5 hover:bg-white/10 text-white text-sm">Cancel</button>
              <button type="submit" className="px-5 py-2.5 rounded-lg bg-red-600 hover:bg-red-500 text-white text-sm font-semibold">remove {dueTarget.username} account.</button>
            </div>
          </form>
        </div>
      )}
      {tempTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <form onSubmit={handleTempRemove} className="bg-[#0d0d12] border border-white/10 rounded-2xl p-7 max-w-md w-full shadow-2xl">
            <h3 className="text-base font-semibold text-white mb-4">how long do you want this account to be temp removed?</h3>
            <p className="text-xs text-white/50 mb-2">number of days here.</p>
            <input type="number" min="1" value={tempDays} onChange={e => setTempDays(e.target.value)} placeholder="e.g. 7" className="w-full px-4 py-2.5 rounded-lg bg-white/5 border border-white/10 text-white text-sm placeholder-gray-500 focus:outline-none focus:border-purple-500/60 mb-3" />
            {tempError && <p className="text-red-400 text-xs mb-3">{tempError}</p>}
            <div className="flex gap-2.5 justify-end">
              <button type="button" onClick={() => setTempTarget(null)} className="px-5 py-2.5 rounded-lg bg-white/5 hover:bg-white/10 text-white text-sm">Cancel</button>
              <button type="submit" className="px-5 py-2.5 rounded-lg bg-purple-600 hover:bg-purple-500 text-white text-sm font-semibold">Confirm</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
