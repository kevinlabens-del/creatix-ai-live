(() => {
  'use strict';
  const SUPPORT_URL = 'https://kevinlabens-del.github.io/CR3-TIX-SOUTIEN-/';
  if (document.getElementById('cr3atix-support-button-host')) return;

  const mount = () => {
    if (!document.body || document.getElementById('cr3atix-support-button-host')) return;
    const host = document.createElement('div');
    host.id = 'cr3atix-support-button-host';
    document.body.appendChild(host);
    const root = host.attachShadow({ mode: 'open' });
    const link = document.createElement('a');
    link.href = SUPPORT_URL;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.title = 'Soutenir les projets CR3@TIX';
    link.setAttribute('aria-label', 'Soutenir les projets CR3@TIX');
    link.innerHTML = '<span aria-hidden="true">❤</span><b>Soutenir</b>';
    const style = document.createElement('style');
    style.textContent = `
      :host{all:initial}
      a{position:fixed;right:max(12px,env(safe-area-inset-right));bottom:max(12px,env(safe-area-inset-bottom));z-index:2147483646;min-height:44px;box-sizing:border-box;display:inline-flex;align-items:center;gap:7px;padding:9px 14px;border:1px solid rgba(118,220,255,.72);border-radius:999px;background:rgba(7,11,24,.92);color:#f6fbff;text-decoration:none;font:700 14px/1 system-ui,-apple-system,"Segoe UI",sans-serif;box-shadow:0 7px 26px rgba(0,0,0,.38),0 0 20px rgba(0,205,255,.16);backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);transition:transform .18s ease,border-color .18s ease,box-shadow .18s ease}
      a:hover,a:focus-visible{transform:translateY(-2px);border-color:rgba(183,113,255,.95);box-shadow:0 9px 30px rgba(0,0,0,.42),0 0 24px rgba(153,75,255,.28);outline:none}
      a:active{transform:scale(.97)} span{color:#ff4e78;font-size:17px;filter:drop-shadow(0 0 5px rgba(255,78,120,.42))}
      @media(max-width:420px){a{right:max(9px,env(safe-area-inset-right));bottom:max(9px,env(safe-area-inset-bottom));padding:9px 12px;font-size:13px}}
      @media(prefers-reduced-motion:reduce){a{transition:none}} @media print{a{display:none!important}}
    `;
    root.append(style, link);
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount, { once: true });
  else mount();
})();
