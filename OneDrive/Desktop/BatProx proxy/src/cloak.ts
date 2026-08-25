export function launchAboutBlankCloak() {
  if (window.self !== window.top) return;
  const win = window.open('about:blank', '_blank');
  if (!win) return;
  const doc = win.document;
  doc.open();
  doc.write('<!DOCTYPE html><html><head><title>Home</title><style>html,body{margin:0;padding:0;overflow:hidden;height:100%}iframe{position:fixed;top:0;left:0;width:100%;height:100%;border:none;}</style></head><body></body></html>');
  doc.close();
  const frame = doc.createElement('iframe');
  frame.src = window.location.origin + '/dashboard';
  frame.setAttribute('allow', 'fullscreen; autoplay; clipboard-read; clipboard-write; encrypted-media; picture-in-picture');
  doc.body.appendChild(frame);
  try {
    win.history.pushState(null, '', 'about:blank');
    win.history.pushState(null, '', 'about:blank');
  } catch {
  }
  window.location.replace('https://www.google.com');
}

export function isAboutBlankTabEnabled() {
  try {
    const s = JSON.parse(localStorage.getItem('batprox-settings') || '{}');
    return s.aboutBlankTab === true;
  } catch {
    return false;
  }
}
