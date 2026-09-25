import { useEffect, useState } from 'react';

export interface DeckItem { head: string; body: string }
export interface DeckJob { kind: 'slides' | 'flashcards'; title: string; items: DeckItem[]; user: string }

const esc = (v: string) => String(v || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

export function buildDeckHtml(kind: string, title: string, items: DeckItem[]) {
  const flash = kind === 'flashcards';
  const cards = items.map((it, i) => flash
    ? `<div class="card" data-i="${i}"><div class="inner"><div class="face front"><span class="n">${i + 1} / ${items.length}</span><p>${esc(it.head)}</p><span class="hint">click to flip</span></div><div class="face back"><p>${esc(it.body)}</p></div></div></div>`
    : `<section class="slide"><span class="n">${i + 1}</span><h2>${esc(it.head)}</h2><div class="body">${esc(it.body).split('\n').filter(Boolean).map(l => `<p>${l.replace(/^[-*]\s*/, '')}</p>`).join('')}</div></section>`
  ).join('');
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)}</title><style>
*{box-sizing:border-box}html,body{margin:0;background:#07070c;color:#eceaf5;font-family:system-ui,-apple-system,Segoe UI,sans-serif}
header{position:sticky;top:0;z-index:5;display:flex;align-items:center;gap:12px;padding:16px 24px;background:rgba(7,7,12,.92);backdrop-filter:blur(12px);border-bottom:1px solid #ffffff12}
header .dot{width:30px;height:30px;border-radius:9px;background:linear-gradient(135deg,#a855f7,#6366f1);display:flex;align-items:center;justify-content:center;font-weight:700;font-size:14px}
header h1{font-size:15px;margin:0;font-weight:600}header .sub{font-size:11px;color:#8b8ba3;margin-left:auto}
main{max-width:940px;margin:0 auto;padding:28px 20px 70px}
.slide{position:relative;background:#0e0e17;border:1px solid #ffffff14;border-radius:20px;padding:34px 38px;margin-bottom:18px;box-shadow:0 18px 50px -24px #000}
.slide .n{position:absolute;top:18px;right:22px;font-size:11px;color:#6f6f8a}
.slide h2{margin:0 0 16px;font-size:23px;line-height:1.25;background:linear-gradient(135deg,#c4b5fd,#818cf8);-webkit-background-clip:text;background-clip:text;color:transparent}
.slide .body p{margin:0 0 10px;padding-left:18px;position:relative;font-size:15px;line-height:1.6;color:#cfcde0}
.slide .body p:before{content:"";position:absolute;left:0;top:9px;width:6px;height:6px;border-radius:50%;background:#a855f7}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(250px,1fr));gap:16px}
.card{perspective:1100px;height:190px;cursor:pointer}
.inner{position:relative;width:100%;height:100%;transition:transform .55s cubic-bezier(.2,.7,.2,1);transform-style:preserve-3d}
.card.flip .inner{transform:rotateY(180deg)}
.face{position:absolute;inset:0;backface-visibility:hidden;border-radius:18px;border:1px solid #ffffff14;padding:22px;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center}
.front{background:#0e0e17}.back{background:linear-gradient(160deg,#1b1330,#0e0e17);transform:rotateY(180deg)}
.face p{margin:0;font-size:15px;line-height:1.5}.front p{font-weight:600}
.face .n{position:absolute;top:12px;left:16px;font-size:10px;color:#6f6f8a}
.hint{position:absolute;bottom:12px;font-size:10px;color:#5c5c78}
footer{text-align:center;color:#5c5c78;font-size:11px;padding:26px}
button.dl{margin-left:auto;background:linear-gradient(135deg,#a855f7,#6366f1);color:#fff;border:0;border-radius:10px;padding:9px 16px;font-size:12px;font-weight:600;cursor:pointer;display:flex;align-items:center;gap:7px}
button.dl:hover{filter:brightness(1.12)}
@media print{
 header,footer,.hint,button.dl{display:none}
 html,body{background:#fff;color:#000}
 main{padding:0;max-width:none}
 .slide{page-break-after:always;border:1px solid #ccc;background:#fff;box-shadow:none;margin:0 0 14px}
 .slide h2{color:#111;-webkit-text-fill-color:#111}
 .slide .body p{color:#222}
 .slide .body p:before{background:#666}
 .grid{display:block}
 .card{height:auto;page-break-inside:avoid;margin:0 0 10px;perspective:none}
 .inner{position:static;transform:none!important;height:auto}
 .face{position:static;backface-visibility:visible;transform:none!important;background:#fff!important;border:1px solid #ccc;display:block;padding:14px}
 .face p{color:#000}
 .front p{font-weight:700;margin-bottom:6px}
 .back{border-top:0}
}
</style></head><body>
<header><div class="dot">B</div><h1>${esc(title)}</h1><span class="sub">${items.length} ${flash ? 'cards' : 'slides'} &middot; made by BatProx AI 2.0</span><button class="dl" onclick="window.print()"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v12m0 0l-4-4m4 4l4-4M4 19h16"/></svg>Download PDF</button></header>
<main>${flash ? `<div class="grid">${cards}</div>` : cards}</main>
<footer>Generated from your BatProx AI conversation</footer>
<script>document.addEventListener('click',function(e){var c=e.target.closest('.card');if(c)c.classList.toggle('flip')});window.addEventListener('beforeprint',function(){document.querySelectorAll('.card').forEach(function(c){c.classList.remove('flip')})});<\/script>
</body></html>`;
}

export function openDeck(kind: string, title: string, items: DeckItem[]) {
  const w = window.open('about:blank', '_blank');
  if (!w) return false;
  w.document.open();
  w.document.write(buildDeckHtml(kind, title, items));
  w.document.close();
  return true;
}

export default function DeckBuild({ job, onDone }: { job: DeckJob; onDone: () => void }) {
  const [pct, setPct] = useState(0);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let raf = 0;
    const started = performance.now();
    const span = 2600;
    const step = (now: number) => {
      const t = Math.min(1, (now - started) / span);
      const eased = t < 1 ? 1 - Math.pow(1 - t, 2.2) : 1;
      setPct(Math.round(eased * 100));
      if (t < 1) raf = requestAnimationFrame(step);
      else setReady(true);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, []);

  useEffect(() => {
    if (!ready) return;
    const u = job.user;
    if (!u) return;
    fetch('/api/ai/deck', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ user: u, kind: job.kind, title: job.title, items: job.items }) }).catch(() => {});
  }, [ready]);

  const label = job.kind === 'flashcards' ? 'flash cards' : 'slides';
  const noun = job.kind === 'flashcards' ? 'flash cards' : 'slide';

  return (
    <div className="flex gap-3 justify-start">
      <div className="w-8 h-8 rounded-full bg-purple-900/60 border border-purple-500/30 flex items-center justify-center shrink-0">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-purple-200"><path d="M12 3l1.8 4.2L18 9l-4.2 1.8L12 15l-1.8-4.2L6 9l4.2-1.8L12 3z" /></svg>
      </div>
      <div className="max-w-[80%] w-[360px] rounded-2xl px-5 py-4 bg-[#120e1e] border border-[#2d2248] shadow-md">
        <p className="text-[13px] text-purple-100 mb-3">Generating {label} based off of our conversation session..</p>
        <div className="h-2 rounded-full bg-white/[0.06] overflow-hidden">
          <div className="h-full rounded-full transition-[width] duration-100" style={{ width: pct + '%', background: 'linear-gradient(90deg,#a855f7,#6366f1)', boxShadow: '0 0 12px rgba(168,85,247,.55)' }} />
        </div>
        <div className="flex items-center mt-2">
          <span className="text-[11px] text-white/35">{ready ? 'done' : 'working..'}</span>
          <span className="ml-auto text-[12px] font-semibold text-purple-200 tabular-nums">{pct}%</span>
        </div>
        {ready && (
          <div className="mt-4 pt-3 border-t border-white/[0.07]" style={{ animation: 'bpDeckIn .3s ease-out' }}>
            <style>{'@keyframes bpDeckIn{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}'}</style>
            <p className="text-[13px] text-white font-medium">Your batprox {noun} is done.</p>
            <button
              onClick={() => { openDeck(job.kind, job.title, job.items); onDone(); }}
              className="mt-2 text-[13px] text-white/80 hover:text-white transition-colors"
            >
              Click <span className="text-blue-400 underline">here</span> to check your batprox {noun}.
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
