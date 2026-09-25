import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';

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

type AdminTab = 'feedbacks' | 'fnadfeedback' | 'accounts' | 'status' | 'paylater' | 'commands' | 'ranks' | 'loginprobs' | 'coderequest' | 'datainfo' | 'votes';

type CmdLine = { t: 'in' | 'out' | 'ok' | 'err' | 'help'; text: string };

const CMD_HELP: Array<[string, string]> = [
  ['name <username> <display name>', 'change what a user shows as in chat'],
  ['name <username> reset', 'put their username back as the display name'],
  ['show users', 'list every username'],
  ['show quick-access codes', 'list every user with their invite code'],
  ['reset feedbacks', 'clear all feedback suggestions'],
  ['<code> to <username>', 'remove an account (needs their code)'],
  ['clear', 'clear this panel'],
  ['show commands', 'show this list']
];

interface VoteItem {
  id: string;
  title: string;
  options: string[];
  images: string[];
  created: number;
  closed: boolean;
  counts: number[];
  total: number;
}

const shrinkImage = (file: File, max: number, quality: number) => new Promise<string>((resolve, reject) => {
  const reader = new FileReader();
  reader.onerror = () => reject(new Error('read'));
  reader.onload = () => {
    const img = new Image();
    img.onerror = () => reject(new Error('decode'));
    img.onload = () => {
      const scale = Math.min(1, max / Math.max(img.width, img.height));
      const c = document.createElement('canvas');
      c.width = Math.max(1, Math.round(img.width * scale));
      c.height = Math.max(1, Math.round(img.height * scale));
      const ctx = c.getContext('2d');
      if (!ctx) { reject(new Error('canvas')); return; }
      ctx.drawImage(img, 0, 0, c.width, c.height);
      resolve(c.toDataURL('image/jpeg', quality));
    };
    img.src = String(reader.result || '');
  };
  reader.readAsDataURL(file);
});

function WorkspaceReply({ text }: { text: string }) {
  const [copied, setCopied] = useState(-1);
  let block = 0;
  return (
    <div className="text-[13px] leading-relaxed text-white/80 [&_p]:my-2 [&_ul]:my-2 [&_ul]:pl-5 [&_ul]:list-disc [&_ol]:my-2 [&_ol]:pl-5 [&_ol]:list-decimal [&_li]:my-0.5 [&_strong]:text-white [&_h1]:text-white [&_h2]:text-white [&_h3]:text-white [&_h1]:font-semibold [&_h2]:font-semibold [&_h3]:font-semibold [&_a]:text-purple-300">
      <ReactMarkdown
        components={{
          pre({ children }: any) {
            const child = Array.isArray(children) ? children[0] : children;
            const cls = String(child?.props?.className || '');
            const src = String(child?.props?.children ?? '').replace(/\n$/, '');
            const lang = cls.replace('language-', '') || 'code';
            const me = block++;
            return (
              <div className="my-3 rounded-xl overflow-hidden border border-white/[0.08] bg-[#0c0c13]">
                <div className="flex items-center justify-between px-3.5 py-1.5 border-b border-white/[0.06] bg-white/[0.025]">
                  <span className="text-[10px] font-mono uppercase tracking-wider text-white/35">{lang}</span>
                  <button
                    onClick={() => { navigator.clipboard.writeText(src).then(() => { setCopied(me); setTimeout(() => setCopied(-1), 1400); }).catch(() => {}); }}
                    className="text-[11px] text-white/45 hover:text-white px-2 py-0.5 rounded-md hover:bg-white/10 transition-colors"
                  >
                    {copied === me ? 'copied' : 'copy'}
                  </button>
                </div>
                <pre className="p-3.5 overflow-x-auto text-[12px] leading-relaxed font-mono text-white/85"><code>{src}</code></pre>
              </div>
            );
          },
          code({ children }: any) {
            return <code className="px-1.5 py-0.5 rounded-md bg-white/[0.08] text-purple-200 text-[12px] font-mono">{children}</code>;
          }
        }}
      >
        {text}
      </ReactMarkdown>
    </div>
  );
}

export default function AdminPanel() {
  const navigate = useNavigate();
  const [isAuthed, setIsAuthed] = useState<boolean | null>(null);
  const [loggedIn, setLoggedIn] = useState(false);
  const [tab, setTab] = useState<AdminTab>('feedbacks');
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
  const [cmdLog, setCmdLog] = useState<CmdLine[]>([{ t: 'out', text: 'Type "show commands" to see everything you can run.' }]);
  const [cmdHist, setCmdHist] = useState<string[]>([]);
  const [cmdHistIdx, setCmdHistIdx] = useState(-1);
  const cmdScrollRef = useRef<HTMLDivElement>(null);
  const cmdInputRef = useRef<HTMLInputElement>(null);
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
  const [codeAsked, setCodeAsked] = useState('');
  const [aiOnline, setAiOnline] = useState(true);
  const [votes, setVotes] = useState<VoteItem[]>([]);
  const [voteModal, setVoteModal] = useState(false);
  const [voteTitle, setVoteTitle] = useState('');
  const [voteQ1, setVoteQ1] = useState('');
  const [voteQ2, setVoteQ2] = useState('');
  const [voteImgs, setVoteImgs] = useState<string[]>(['', '']);
  const [voteError, setVoteError] = useState('');
  const [voteBusy, setVoteBusy] = useState(false);
  const voteFileRef = useRef<HTMLInputElement>(null);

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
      setExportMsg(`${label} downloaded, ${count} records`);
      setTimeout(() => setExportMsg(''), 5000);
    } catch { setExportMsg(`${label} failed, network error`); }
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

  const logLine = (t: CmdLine['t'], text: string) => setCmdLog(prev => [...prev, { t, text }].slice(-300));

  const runCommand = async (preset?: string) => {
    const raw = (preset ?? cmdInput).trim();
    if (!raw) return;
    logLine('in', raw);
    setCmdHist(prev => [...prev.filter(x => x !== raw), raw].slice(-40));
    setCmdHistIdx(-1);
    setCmdInput('');
    const lower = raw.toLowerCase();
    if (lower === 'clear' || lower === 'cls') { setCmdLog([]); return; }
    if (lower === 'show quick-access codes') {
      if (!users.length) { logLine('err', 'No users loaded'); return; }
      users.forEach(u => logLine('out', `${u.username.padEnd(22)} ${u.invite_code}`));
      return;
    }
    if (lower === 'show commands' || lower === 'show all' || lower === 'help' || lower === 'commands') {
      logLine('help', CMD_HELP.map(([c, d]) => `${c.padEnd(34)} ${d}`).join('\n'));
      return;
    }
    const nameCmd = raw.match(/^name\s+@?(\S+)\s+(.+)$/i);
    if (nameCmd) {
      const username = nameCmd[1];
      const display = nameCmd[2].trim();
      try {
        const response = await fetch('/api/admin/set-display', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${getToken()}` }, body: JSON.stringify({ username, display }) });
        const d = await response.json().catch(() => ({}));
        if (!response.ok || !d.success) { logLine('err', d.error || 'Could not change that name'); return; }
        logLine('ok', d.reset ? `${d.username} now shows as their username again` : `${d.username} now shows as "${d.display}"`);
      } catch { logLine('err', 'Network error'); }
      return;
    }
    if (/^name\b/i.test(raw)) { logLine('err', 'Usage: name <username> <new display name>'); return; }
    if (lower === 'reset feedbacks') {
      try {
        const response = await fetch('/api/admin/reset-feedbacks', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${getToken()}` } });
        if (response.ok) { setFeedbacks([]); logLine('ok', 'All feedbacks have been reset.'); }
        else { const d = await response.json().catch(() => ({})); logLine('err', d.error || 'Failed'); }
      } catch { logLine('err', 'Network error'); }
      return;
    }
    if (lower === 'show users') {
      try {
        const response = await fetch('/api/users');
        const d = await response.json();
        const list = (d.users || []).map((u: any) => u.username).filter(Boolean);
        if (!list.length) { logLine('out', 'No users'); return; }
        logLine('out', list.join('   '));
        logLine('ok', `total users: ${list.length}`);
      } catch { logLine('err', 'Network error'); }
      return;
    }
    const m = raw.match(/^(.+?)\s+to\s+(.+)$/i);
    if (m) {
      const code = m[1].trim(), username = m[2].trim();
      try {
        const user = users.find(u => u.username === username);
        if (!user || user.invite_code !== code) { logLine('err', 'Invalid code or username'); return; }
        const response = await fetch('/api/admin/remove-user', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${getToken()}` }, body: JSON.stringify({ username }) });
        if (response.ok) { setUsers(prev => prev.filter(u => u.username !== username)); logLine('ok', `${username} has been removed.`); }
        else { const d = await response.json().catch(() => ({})); logLine('err', d.error || 'Failed'); }
      } catch { logLine('err', 'Network error'); }
      return;
    }
    logLine('err', `Unknown command "${raw}". Type "show commands"`);
  };

  useEffect(() => {
    const el = cmdScrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [cmdLog]);

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
        if (job.status === 'running') setCodeStage('The local agent is applying the change..');
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
    const prev = codeJobs.find(j => j.id === codeOpen);
    const history = prev && prev.status === 'done' ? [{ role: 'user', content: prev.prompt }, { role: 'assistant', content: prev.reply || '' }] : [];
    setCodeBusy(true);
    setCodeError('');
    setCodeOut('');
    setCodeAsked(prompt);
    setCodePrompt('');
    setCodeStage(codePc ? 'Sending it to the local agent..' : 'batprox-ai is writing the code..');
    try {
      const response = await fetch('/api/admin/code-request', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${getToken()}` }, body: JSON.stringify({ provider: codeProvider, prompt, history }) });
      const data = await response.json();
      if (!data.success) {
        setCodeError(data.error || 'Request failed.');
        setCodeBusy(false);
        setCodeStage('');
        loadCodeJobs();
        return;
      }
      setCodeOpen(data.id);
      if (data.job) {
        if (data.job.status === 'done') setCodeOut(data.job.reply || 'Done.');
        else setCodeError(data.job.reply || 'The request failed.');
        setCodeBusy(false);
        setCodeStage('');
        loadCodeJobs();
        return;
      }
      loadCodeJobs();
      setCodeStage('Waiting for the local agent..');
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

  const loadVotes = async () => {
    try {
      const response = await fetch('/api/votes', { cache: 'no-store' });
      const data = await response.json();
      if (response.ok) setVotes(data.votes || []);
    } catch {}
  };

  const openVoteModal = () => {
    setVoteTitle('');
    setVoteQ1('');
    setVoteQ2('');
    setVoteImgs(['', '']);
    setVoteError('');
    setVoteModal(true);
  };

  const addVoteImage = async (file: File) => {
    if (!file.type.startsWith('image/')) { setVoteError('That file is not an image.'); return; }
    try {
      const data = await shrinkImage(file, 900, 0.82);
      setVoteImgs(prev => {
        const n = [...prev];
        const slot = n[0] ? (n[1] ? -1 : 1) : 0;
        if (slot >= 0) n[slot] = data;
        return n;
      });
      setVoteError('');
    } catch { setVoteError('Could not read that image.'); }
  };

  const submitVote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!voteTitle.trim() || !voteQ1.trim() || !voteQ2.trim()) { setVoteError('Fill in the title and both questions.'); return; }
    setVoteBusy(true);
    setVoteError('');
    try {
      const response = await fetch('/api/votes', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${getToken()}` }, body: JSON.stringify({ title: voteTitle.trim(), q1: voteQ1.trim(), q2: voteQ2.trim(), images: voteImgs.filter(Boolean) }) });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.success) { setVoteError(data.error || 'Could not publish the vote.'); setVoteBusy(false); return; }
      setVoteModal(false);
      setMessage('Vote published');
      setTimeout(() => setMessage(''), 2200);
      loadVotes();
    } catch { setVoteError('Network error while publishing the vote.'); }
    setVoteBusy(false);
  };

  const voteAction = async (kind: 'close' | 'delete', id: string) => {
    try {
      const response = await fetch(`/api/votes/${kind}`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${getToken()}` }, body: JSON.stringify({ id }) });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) { setError(data.error || 'Vote update failed'); return; }
      setMessage(kind === 'delete' ? 'Vote deleted' : data.closed ? 'Vote closed' : 'Vote reopened');
      setTimeout(() => setMessage(''), 2000);
      loadVotes();
    } catch { setError('Network error'); }
  };

  useEffect(() => {
    if (!isAuthed) return;
    loadVotes();
    if (tab !== 'votes') return;
    const id = setInterval(loadVotes, 6000);
    return () => clearInterval(id);
  }, [isAuthed, tab]);

  useEffect(() => {
    if (!isAuthed || tab !== 'coderequest') return;
    let alive = true;
    const check = async () => {
      try { const r = await fetch('/api/ai/status', { cache: 'no-store' }); const d = await r.json(); if (alive) setAiOnline(!!d.online); } catch { if (alive) setAiOnline(false); }
    };
    check();
    const id = setInterval(check, 20000);
    return () => { alive = false; clearInterval(id); };
  }, [isAuthed, tab]);

  const newCodeSession = () => {
    setCodeOpen('');
    setCodeAsked('');
    setCodeOut('');
    setCodeError('');
    setCodeStage('');
    setCodePrompt('');
  };

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

  const me = (() => { try { return localStorage.getItem('batprox-user') || 'admin'; } catch { return 'admin'; } })();
  const NAV: Array<{ group: string; items: Array<{ id: AdminTab; label: string; d: string; badge?: number; tone?: string }> }> = [
    {
      group: 'Community',
      items: [
        { id: 'feedbacks', label: 'Feedback Suggestions', d: 'M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z', badge: pendingFeedbacks.length },
        { id: 'fnadfeedback', label: '6th nights game, suggestions', d: 'M15 10h.01M9 10h.01M7 16h10a4 4 0 004-4V9a4 4 0 00-4-4H7a4 4 0 00-4 4v3a4 4 0 004 4zm-2 5l2-5m12 5l-2-5', badge: fnadFeedbacks.length, tone: 'amber' },
        { id: 'votes', label: 'Voting System', d: 'M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z', badge: votes.filter(v => !v.closed).length, tone: 'emerald' }
      ]
    },
    {
      group: 'Accounts',
      items: [
        { id: 'accounts', label: 'Create user accounts', d: 'M17 20h5v-2a4 4 0 00-3-3.87M9 20H4v-2a4 4 0 013-3.87m6-1.13a4 4 0 10-4-4 4 4 0 004 4zm6-4a3 3 0 11-3-3' },
        { id: 'ranks', label: 'User ranks', d: 'M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z' },
        { id: 'paylater', label: 'Pay-later reminder', d: 'M12 8c-1.657 0-3 1.343-3 3s1.343 3 3 3 3-1.343 3-3-1.343-3-3-3zm0 0V6m0 8v2m-7-4a7 7 0 1114 0 7 7 0 01-14 0z' },
        { id: 'loginprobs', label: 'Login problems', d: 'M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z', badge: problems.reports.length + problems.resets.length, tone: 'orange' }
      ]
    },
    {
      group: 'Site',
      items: [
        { id: 'status', label: 'Status change', d: 'M13 10V3L4 14h7v7l9-11h-7z' },
        { id: 'commands', label: 'Command panel', d: 'M6.75 7.5l3 2.25-3 2.25m4.5 0h3M4.5 19.5h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5z' },
        { id: 'coderequest', label: 'Code request', d: 'M17.25 6.75L21 10.5l-3.75 3.75M6.75 17.25L3 13.5l3.75-3.75M14.25 4.5l-4.5 15' },
        { id: 'datainfo', label: 'Data information', d: 'M20.25 6.375c0 2.278-3.694 4.125-8.25 4.125S3.75 8.653 3.75 6.375m16.5 0c0-2.278-3.694-4.125-8.25-4.125S3.75 4.097 3.75 6.375m16.5 0v11.25c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125V6.375m16.5 0v3.75m-16.5-3.75v3.75m16.5 0v3.75C20.25 16.153 16.556 18 12 18s-8.25-1.847-8.25-4.125v-3.75' }
      ]
    }
  ];
  const currentNav = NAV.flatMap(g => g.items).find(i => i.id === tab);
  const wide = tab === 'coderequest';
  const badgeTone: Record<string, string> = {
    amber: 'bg-amber-500/20 text-amber-200',
    emerald: 'bg-emerald-500/20 text-emerald-200',
    orange: 'bg-orange-500/20 text-orange-200'
  };

  return (
    <div className="relative h-screen w-full bg-black overflow-hidden font-sans text-white">
      {background}
      <main className="relative z-10 flex h-screen">
        <aside className="w-64 shrink-0 h-screen flex flex-col border-r border-white/[0.06] bg-[#08080d]/90 backdrop-blur-xl">
          <div className="h-14 shrink-0 px-5 flex items-center gap-3 border-b border-white/[0.05]">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-500/30 to-indigo-500/20 border border-purple-400/25 flex items-center justify-center">
              <svg className="w-4 h-4 text-purple-200" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
            </div>
            <div className="min-w-0">
              <p className="text-[13px] font-semibold text-white leading-tight">Admin Panel</p>
              <p className="text-[10px] text-white/30">batprox control center</p>
            </div>
          </div>
          <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-5">
            {NAV.map(g => (
              <div key={g.group}>
                <p className="px-3 mb-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-white/25">{g.group}</p>
                <div className="space-y-0.5">
                  {g.items.map(it => {
                    const on = tab === it.id;
                    return (
                      <button
                        key={it.id}
                        onClick={() => setTab(it.id)}
                        className={`group relative w-full flex items-center gap-2.5 pl-3 pr-2.5 py-2 rounded-lg text-left text-[13px] transition-colors ${on ? 'bg-white/[0.07] text-white' : 'text-white/50 hover:text-white/90 hover:bg-white/[0.035]'}`}
                      >
                        {on && <span className="absolute left-0 top-2 bottom-2 w-[3px] rounded-r-full bg-purple-400" />}
                        <svg className={`w-4 h-4 shrink-0 transition-colors ${on ? 'text-purple-300' : 'text-white/35 group-hover:text-white/60'}`} fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d={it.d} /></svg>
                        <span className="truncate">{it.label}</span>
                        {!!it.badge && <span className={`ml-auto shrink-0 text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${badgeTone[it.tone || ''] || 'bg-purple-500/25 text-purple-200'}`}>{it.badge}</span>}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </nav>
          <div className="shrink-0 p-3 border-t border-white/[0.05]">
            <div className="flex items-center gap-2.5 px-2 py-2 mb-1.5 rounded-lg bg-white/[0.03]">
              <div className="w-7 h-7 rounded-full bg-purple-600/30 border border-purple-400/25 flex items-center justify-center text-[11px] font-bold text-purple-100 uppercase">{me.charAt(0)}</div>
              <div className="min-w-0">
                <p className="text-[12px] text-white/85 font-medium truncate">{me}</p>
                <p className="text-[10px] text-emerald-300/70">admin</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-1.5">
              <button onClick={() => navigate('/dashboard')} className="px-2 py-2 rounded-lg text-[12px] font-medium text-white/60 hover:text-white bg-white/[0.02] hover:bg-white/[0.06] border border-white/[0.06] transition-colors">Dashboard</button>
              <button onClick={logout} className="px-2 py-2 rounded-lg text-[12px] font-medium text-red-300/80 hover:text-red-200 bg-red-500/[0.04] hover:bg-red-500/10 border border-red-500/15 transition-colors">Logout</button>
            </div>
          </div>
        </aside>
        <section className="flex-1 min-w-0 flex flex-col h-screen">
          <header className="h-14 shrink-0 px-6 lg:px-8 flex items-center gap-2.5 border-b border-white/[0.06] bg-black/40 backdrop-blur-xl">
            <span className="text-[12px] text-white/35">Admin</span>
            <svg className="w-3 h-3 text-white/20" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
            <span className="text-[13px] font-medium text-white">{currentNav?.label || 'Overview'}</span>
            <div className="ml-auto flex items-center gap-2 min-w-0">
              {message && <div className="text-xs text-green-300 bg-green-500/10 border border-green-500/20 px-3 py-1.5 rounded-full inline-flex items-center gap-1.5 truncate"><svg className="w-3 h-3 shrink-0" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>{message}</div>}
              {error && <button onClick={() => setError('')} className="text-xs text-red-300 bg-red-500/10 border border-red-500/20 px-3 py-1.5 rounded-full truncate max-w-[420px]">{error}</button>}
            </div>
          </header>
          <div className={`flex-1 min-h-0 ${wide ? 'overflow-hidden' : 'overflow-y-auto'}`}>
            <div className={wide ? 'h-full' : 'max-w-5xl mx-auto px-6 lg:px-8 py-7'}>
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
              <div className="h-full flex bg-[#09090e]">
                <div className="w-64 shrink-0 border-r border-white/[0.06] bg-[#0b0b11] flex flex-col">
                  <div className="p-3">
                    <button
                      onClick={newCodeSession}
                      className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-purple-600 hover:bg-purple-500 text-white text-[12px] font-semibold transition-colors"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2.4} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 5v14M5 12h14" /></svg>
                      New session
                    </button>
                  </div>
                  <div className="px-3 pb-3 border-b border-white/[0.06]">
                    <p className="px-1 mb-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-white/25">Model</p>
                    <div className="space-y-1">
                      <button
                        onClick={() => setCodeProvider('claude')}
                        className="w-full text-left px-3 py-2.5 rounded-lg border bg-purple-600/[0.12] border-purple-500/30 transition-colors"
                      >
                        <span className="flex items-center gap-2">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                          <span className="text-[12px] font-medium text-white">BatProx Agentic</span>
                          <span className="ml-auto text-[9px] font-semibold uppercase tracking-wider text-purple-200/70">selected</span>
                        </span>
                        <span className="block text-[10px] text-white/35 mt-0.5 pl-3.5">powered by batprox-ai</span>
                      </button>
                      <div className="w-full px-3 py-2.5 rounded-lg border border-white/[0.05] bg-white/[0.015] opacity-55 cursor-not-allowed select-none">
                        <span className="flex items-center gap-2">
                          <span className="w-1.5 h-1.5 rounded-full bg-white/25" />
                          <span className="text-[12px] font-medium text-white/60">InferForge codex</span>
                        </span>
                        <span className="block text-[10px] text-white/30 mt-0.5 pl-3.5">(coming soon)</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex-1 min-h-0 flex flex-col px-3 pt-3">
                    <p className="px-1 mb-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-white/25">Sessions</p>
                    <div className="flex-1 overflow-y-auto space-y-0.5 pb-3">
                      {codeJobs.length === 0 && <p className="text-[11px] text-white/25 px-1">No sessions yet.</p>}
                      {codeJobs.map(j => (
                        <button
                          key={j.id}
                          onClick={() => { setCodeOpen(j.id); setCodeAsked(j.prompt); setCodeOut(j.status === 'done' ? (j.reply || '') : ''); setCodeError(j.status === 'error' ? (j.reply || 'The request failed.') : ''); }}
                          className={`w-full text-left px-2.5 py-2 rounded-lg transition-colors ${codeOpen === j.id ? 'bg-white/[0.07]' : 'hover:bg-white/[0.035]'}`}
                        >
                          <span className="flex items-center gap-1.5 mb-0.5">
                            <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${j.status === 'done' ? 'bg-emerald-400' : j.status === 'error' ? 'bg-red-400' : 'bg-amber-400 animate-pulse'}`} />
                            <span className="text-[10px] text-white/30">{codeAgo(j.ts)}</span>
                          </span>
                          <span className="block text-[12px] text-white/70 leading-snug line-clamp-2">{j.prompt}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="flex-1 min-w-0 flex flex-col">
                  <div className="h-12 shrink-0 px-5 flex items-center gap-3 border-b border-white/[0.06] bg-[#0b0b11]/60">
                    <svg className="w-4 h-4 text-purple-300/80" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M17.25 6.75L21 10.5l-3.75 3.75M6.75 17.25L3 13.5l3.75-3.75M14.25 4.5l-4.5 15" /></svg>
                    <span className="text-[13px] font-medium text-white/85">batprox workspace</span>
                    <span className="text-[11px] text-white/25 font-mono">~/batprox-proxy</span>
                    <div className="ml-auto flex items-center gap-2">
                      <span className={`text-[11px] px-2.5 py-1 rounded-full border flex items-center gap-1.5 ${aiOnline ? 'text-emerald-300 border-emerald-500/25 bg-emerald-500/10' : 'text-amber-300 border-amber-500/25 bg-amber-500/10'}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${aiOnline ? 'bg-emerald-400' : 'bg-amber-400 animate-pulse'}`} />
                        {aiOnline ? 'batprox-ai online' : 'batprox-ai reconnecting'}
                      </span>
                      {codePc && (
                        <span className="text-[11px] px-2.5 py-1 rounded-full border text-sky-300 border-sky-500/25 bg-sky-500/10">
                          applying to repo{codeHost ? ` · ${codeHost}` : ''}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex-1 min-h-0 overflow-y-auto">
                    <div className="max-w-3xl mx-auto px-6 py-7 space-y-5">
                      {!codeAsked && !codeBusy && !codeError && (
                        <div className="pt-16 flex flex-col items-center text-center">
                          <div className="w-14 h-14 rounded-2xl bg-purple-600/[0.12] border border-purple-500/25 flex items-center justify-center mb-4">
                            <svg className="w-7 h-7 text-purple-300/80" fill="none" stroke="currentColor" strokeWidth={1.6} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M17.25 6.75L22.5 12l-5.25 5.25m-10.5 0L1.5 12l5.25-5.25m7.5-3l-4.5 16.5" /></svg>
                          </div>
                          <p className="text-[15px] font-medium text-white/80">What should we build?</p>
                          <p className="text-[12px] text-white/35 mt-1.5 max-w-sm">Describe a change to the site. batprox-ai plans it and writes the code for every file it touches.</p>
                          <div className="mt-6 flex flex-wrap justify-center gap-2 max-w-lg">
                            {['Add a dark mode toggle to settings', 'Make the dashboard cards rounder', 'Add a word counter to the chat box'].map(s => (
                              <button key={s} onClick={() => setCodePrompt(s)} className="px-3 py-1.5 rounded-full text-[11px] text-white/55 hover:text-white bg-white/[0.03] hover:bg-white/[0.07] border border-white/[0.08] transition-colors">{s}</button>
                            ))}
                          </div>
                        </div>
                      )}
                      {codeAsked && (
                        <div className="flex justify-end">
                          <div className="max-w-[85%] px-4 py-2.5 rounded-2xl rounded-br-md bg-purple-600/20 border border-purple-500/25 text-[13px] text-white/90 whitespace-pre-wrap break-words">{codeAsked}</div>
                        </div>
                      )}
                      {codeBusy && !codeOut && (
                        <div className="flex items-center gap-2.5 text-[12px] text-white/50">
                          <span className="w-3.5 h-3.5 rounded-full border-2 border-purple-400/30 border-t-purple-400 animate-spin" />
                          {codeStage || 'batprox-ai is working on it'}
                        </div>
                      )}
                      {codeError && (
                        <div className="px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/25 text-[12px] text-red-300">{codeError}</div>
                      )}
                      {codeOut && (
                        <div className="flex gap-3">
                          <div className="w-7 h-7 shrink-0 rounded-lg bg-purple-600/20 border border-purple-500/25 flex items-center justify-center mt-0.5">
                            <svg className="w-3.5 h-3.5 text-purple-200" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 3l1.8 4.2L18 9l-4.2 1.8L12 15l-1.8-4.2L6 9l4.2-1.8L12 3z" /></svg>
                          </div>
                          <div className="flex-1 min-w-0"><WorkspaceReply text={codeOut} /></div>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="shrink-0 border-t border-white/[0.06] bg-[#0b0b11]/60 px-6 py-4">
                    <div className="max-w-3xl mx-auto">
                      <div className="rounded-2xl border border-white/10 bg-[#0e0e16] focus-within:border-purple-500/40 transition-colors">
                        <textarea
                          value={codePrompt}
                          onChange={e => setCodePrompt(e.target.value)}
                          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendCodeRequest(); } }}
                          rows={2}
                          placeholder="Describe the change you want.."
                          className="w-full px-4 pt-3 pb-1 bg-transparent text-white text-[13px] placeholder-white/25 resize-none outline-none leading-relaxed"
                        />
                        <div className="flex items-center gap-3 px-3 pb-2.5">
                          <span className="text-[10px] text-white/25">enter to run · shift+enter for a new line</span>
                          <button
                            onClick={sendCodeRequest}
                            disabled={!codePrompt.trim() || codeBusy}
                            className="ml-auto flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-500 disabled:opacity-35 disabled:hover:bg-purple-600 text-white text-[12px] font-semibold transition-colors"
                          >
                            {codeBusy ? 'Running' : 'Run'}
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2.4} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14M13 5l7 7-7 7" /></svg>
                          </button>
                        </div>
                      </div>
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
            {tab === 'votes' && (
              <div>
                <div className="flex items-start justify-between gap-4 mb-6">
                  <div>
                    <h2 className="text-lg font-bold text-white">Voting System</h2>
                    <p className="text-[13px] text-white/40 mt-1">Publish votes and everyone on BatProx gets to pick an answer.</p>
                  </div>
                  <button onClick={openVoteModal} className="shrink-0 px-4 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-[13px] font-semibold shadow-lg shadow-purple-900/40 transition-colors">+ Create a new vote</button>
                </div>
                {votes.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.02] py-14 flex flex-col items-center text-center">
                    <div className="w-12 h-12 rounded-2xl bg-white/[0.04] border border-white/10 flex items-center justify-center mb-3">
                      <svg className="w-6 h-6 text-white/40" fill="none" stroke="currentColor" strokeWidth={1.7} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                    </div>
                    <p className="text-[14px] text-white/70 font-medium">No votes yet</p>
                    <p className="text-[12px] text-white/35 mt-1">Create one and it shows up for users on their dashboard.</p>
                  </div>
                ) : (
                  <div className="grid gap-4 md:grid-cols-2">
                    {votes.map(v => (
                      <div key={v.id} className="rounded-2xl border border-white/[0.08] bg-white/[0.025] p-5">
                        <div className="flex items-start gap-3 mb-4">
                          <div className="min-w-0 flex-1">
                            <p className="text-[15px] font-semibold text-white leading-snug break-words">{v.title}</p>
                            <p className="text-[11px] text-white/35 mt-1">{codeAgo(v.created)} · {v.total} vote{v.total === 1 ? '' : 's'}</p>
                          </div>
                          <span className={`shrink-0 text-[10px] font-semibold uppercase tracking-wider px-2 py-1 rounded-full ${v.closed ? 'bg-white/[0.06] text-white/40' : 'bg-emerald-500/15 text-emerald-300'}`}>{v.closed ? 'closed' : 'live'}</span>
                        </div>
                        <div className="space-y-2.5">
                          {v.options.map((o, i) => {
                            const pct = v.total ? Math.round((v.counts[i] / v.total) * 100) : 0;
                            const img = v.images.find(u => u.endsWith('/' + i));
                            return (
                              <div key={i} className="relative overflow-hidden rounded-xl border border-white/[0.07] bg-black/30">
                                <div className="absolute inset-y-0 left-0 bg-purple-500/[0.14] transition-all" style={{ width: pct + '%' }} />
                                <div className="relative flex items-center gap-3 p-2.5">
                                  {img ? <img src={img} alt="" className="w-11 h-11 rounded-lg object-cover border border-white/10 shrink-0" /> : <div className="w-11 h-11 rounded-lg bg-white/[0.04] border border-white/[0.06] shrink-0 flex items-center justify-center text-[11px] text-white/30">{i + 1}</div>}
                                  <p className="flex-1 min-w-0 text-[13px] text-white/85 break-words">{o}</p>
                                  <div className="text-right shrink-0">
                                    <p className="text-[13px] font-semibold text-white">{pct}%</p>
                                    <p className="text-[10px] text-white/35">{v.counts[i]}</p>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                        <div className="flex gap-2 mt-4">
                          <button onClick={() => voteAction('close', v.id)} className="flex-1 px-3 py-2 rounded-lg text-[12px] font-medium bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] text-white/70 hover:text-white transition-colors">{v.closed ? 'Reopen vote' : 'Close vote'}</button>
                          <button onClick={() => { if (window.confirm('Delete this vote and all of its results?')) voteAction('delete', v.id); }} className="px-3 py-2 rounded-lg text-[12px] font-medium bg-red-500/[0.06] hover:bg-red-500/15 border border-red-500/20 text-red-300/90 transition-colors">Delete</button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
            {tab === 'commands' && (
              <div>
                <div className="flex items-end justify-between gap-4 mb-5">
                  <div>
                    <h2 className="text-lg font-bold text-white">Command panel</h2>
                    <p className="text-[13px] text-white/40 mt-1">Run quick admin actions. Type <span className="font-mono text-purple-300">show commands</span> for the full list.</p>
                  </div>
                  <span className="shrink-0 text-[11px] px-2.5 py-1 rounded-full bg-white/[0.04] border border-white/[0.08] text-white/45">{users.length} users loaded</span>
                </div>
                <div className="rounded-2xl overflow-hidden border border-white/[0.08] bg-[#07070b] shadow-[0_20px_60px_-20px_rgba(124,58,237,0.35)]">
                  <div className="h-10 px-4 flex items-center gap-2 border-b border-white/[0.06] bg-white/[0.02]">
                    <span className="w-2.5 h-2.5 rounded-full bg-[#ff5f57]" />
                    <span className="w-2.5 h-2.5 rounded-full bg-[#febc2e]" />
                    <span className="w-2.5 h-2.5 rounded-full bg-[#28c840]" />
                    <span className="ml-2 text-[12px] font-mono text-white/50">batprox@admin:~$</span>
                    <button onClick={() => setCmdLog([])} className="ml-auto text-[11px] text-white/35 hover:text-white px-2 py-0.5 rounded-md hover:bg-white/[0.06] transition-colors">clear</button>
                  </div>
                  <div ref={cmdScrollRef} onClick={() => cmdInputRef.current?.focus()} className="px-4 py-3.5 h-80 overflow-y-auto font-mono text-[12.5px] leading-relaxed space-y-1 cursor-text">
                    {cmdLog.length === 0 && <p className="text-white/25">Nothing here yet. Try a command below.</p>}
                    {cmdLog.map((l, i) => (
                      l.t === 'in' ? (
                        <div key={i} className="flex gap-2 text-white/90"><span className="text-emerald-400 select-none">❯</span><span className="break-all">{l.text}</span></div>
                      ) : l.t === 'help' ? (
                        <pre key={i} className="whitespace-pre-wrap text-purple-200/90 bg-purple-500/[0.06] border border-purple-500/15 rounded-lg px-3 py-2 my-1">{l.text}</pre>
                      ) : (
                        <div key={i} className={`pl-4 whitespace-pre-wrap break-words ${l.t === 'ok' ? 'text-emerald-300' : l.t === 'err' ? 'text-red-300' : 'text-white/65'}`}>{l.text}</div>
                      )
                    ))}
                  </div>
                  <div className="px-3 py-2 flex flex-wrap gap-1.5 border-t border-white/[0.05] bg-white/[0.015]">
                    {['show commands', 'show users', 'name ', 'clear'].map(c => (
                      <button key={c} onClick={() => { if (c.endsWith(' ')) { setCmdInput(c); cmdInputRef.current?.focus(); } else runCommand(c); }} className="px-2.5 py-1 rounded-md text-[11px] font-mono text-white/55 hover:text-white bg-white/[0.03] hover:bg-white/[0.08] border border-white/[0.07] transition-colors">{c.trim()}</button>
                    ))}
                  </div>
                  <form onSubmit={e => { e.preventDefault(); runCommand(); }} className="flex items-center border-t border-white/[0.06] bg-black/40">
                    <span className="pl-4 pr-2 text-emerald-400 font-mono text-sm select-none">❯</span>
                    <input
                      ref={cmdInputRef}
                      value={cmdInput}
                      onChange={e => setCmdInput(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'ArrowUp' && cmdHist.length) { e.preventDefault(); const i = cmdHistIdx < 0 ? cmdHist.length - 1 : Math.max(0, cmdHistIdx - 1); setCmdHistIdx(i); setCmdInput(cmdHist[i]); }
                        if (e.key === 'ArrowDown' && cmdHistIdx >= 0) { e.preventDefault(); const i = cmdHistIdx + 1; if (i >= cmdHist.length) { setCmdHistIdx(-1); setCmdInput(''); } else { setCmdHistIdx(i); setCmdInput(cmdHist[i]); } }
                      }}
                      placeholder="name jacobieog Jacob"
                      spellCheck={false}
                      autoComplete="off"
                      className="flex-1 py-3 bg-transparent text-white placeholder-white/20 text-[13px] font-mono focus:outline-none"
                    />
                    <button type="submit" className="m-1.5 px-4 py-2 rounded-lg bg-purple-600 hover:bg-purple-500 text-white text-[12px] font-semibold transition-colors">Run</button>
                  </form>
                </div>
                <p className="text-[11px] text-white/30 mt-3">Tip: use the up and down arrows to repeat earlier commands.</p>
              </div>
            )}
            </div>
          </div>
        </section>
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
      {voteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
          <form onSubmit={submitVote} className="bg-[#0d0d12] border border-white/10 rounded-2xl w-full max-w-lg shadow-2xl max-h-[92vh] flex flex-col">
            <div className="px-7 pt-6 pb-4 border-b border-white/[0.06] flex items-center">
              <div>
                <h3 className="text-base font-semibold text-white">Create a new vote</h3>
                <p className="text-[11px] text-white/35 mt-0.5">Users pick between question 1 and question 2.</p>
              </div>
              <button type="button" onClick={() => setVoteModal(false)} className="ml-auto w-8 h-8 rounded-lg flex items-center justify-center text-white/40 hover:text-white hover:bg-white/10">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 6l12 12M18 6L6 18" /></svg>
              </button>
            </div>
            <div className="px-7 py-5 overflow-y-auto space-y-4">
              <div>
                <label className="block text-xs text-white/55 mb-1.5">Enter vote title:</label>
                <input value={voteTitle} onChange={e => setVoteTitle(e.target.value)} maxLength={120} placeholder="What should we add next?" className="w-full px-4 py-2.5 rounded-lg bg-white/5 border border-white/10 text-white text-sm placeholder-gray-500 focus:outline-none focus:border-purple-500/60 transition-all" />
              </div>
              <div>
                <label className="block text-xs text-white/55 mb-1.5">Enter vote question (question 1)</label>
                <input value={voteQ1} onChange={e => setVoteQ1(e.target.value)} maxLength={160} placeholder="First option" className="w-full px-4 py-2.5 rounded-lg bg-white/5 border border-white/10 text-white text-sm placeholder-gray-500 focus:outline-none focus:border-purple-500/60 transition-all" />
              </div>
              <div>
                <label className="block text-xs text-white/55 mb-1.5">Enter vote question (question 2)</label>
                <input value={voteQ2} onChange={e => setVoteQ2(e.target.value)} maxLength={160} placeholder="Second option" className="w-full px-4 py-2.5 rounded-lg bg-white/5 border border-white/10 text-white text-sm placeholder-gray-500 focus:outline-none focus:border-purple-500/60 transition-all" />
              </div>
              <div>
                <div className="flex items-center mb-1.5">
                  <label className="text-xs text-white/55">Images</label>
                  <span className="ml-auto text-[10px] text-white/30">{voteImgs.filter(Boolean).length}/2</span>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  {[0, 1].map(i => (
                    <div key={i} className="group relative aspect-[4/3] rounded-xl overflow-hidden border border-white/10 bg-white/[0.03]">
                      {voteImgs[i] ? (
                        <>
                          <img src={voteImgs[i]} alt="" className="w-full h-full object-cover" />
                          <button type="button" onClick={() => setVoteImgs(prev => { const n = [...prev]; n[i] = ''; return n; })} className="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/70 text-white/80 hover:text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2.4} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 6l12 12M18 6L6 18" /></svg>
                          </button>
                        </>
                      ) : (
                        <div className="w-full h-full flex flex-col items-center justify-center text-white/25">
                          <svg className="w-6 h-6 mb-1" fill="none" stroke="currentColor" strokeWidth={1.6} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0022.5 18.75V5.25A2.25 2.25 0 0020.25 3H3.75A2.25 2.25 0 001.5 5.25v13.5A2.25 2.25 0 003.75 21z" /></svg>
                          <span className="text-[11px]">image for question {i + 1}</span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
                <input ref={voteFileRef} type="file" accept="image/*" className="hidden" onChange={e => { const f = e.target.files?.[0]; e.target.value = ''; if (f) addVoteImage(f); }} />
                <button type="button" disabled={voteImgs.filter(Boolean).length >= 2} onClick={() => voteFileRef.current?.click()} className="mt-3 w-full px-4 py-2.5 rounded-lg border border-dashed border-white/15 hover:border-purple-400/50 text-[12px] font-medium text-white/60 hover:text-white disabled:opacity-40 disabled:hover:border-white/15 disabled:hover:text-white/60 transition-colors">add image</button>
              </div>
              {voteError && <p className="text-red-400 text-xs">{voteError}</p>}
            </div>
            <div className="px-7 py-4 border-t border-white/[0.06] flex gap-2.5 justify-end">
              <button type="button" onClick={() => setVoteModal(false)} className="px-5 py-2.5 rounded-lg bg-white/5 hover:bg-white/10 text-white text-sm font-medium transition-all">Cancel</button>
              <button type="submit" disabled={voteBusy} className="px-5 py-2.5 rounded-lg bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white text-sm font-semibold transition-all">{voteBusy ? 'Publishing..' : 'submit vote'}</button>
            </div>
          </form>
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
