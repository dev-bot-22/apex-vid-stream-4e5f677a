// Generic upstream proxy for player pages (vidcloud, s2-cdn, etc.).
// Rewrites absolute upstream URLs to same-origin proxied paths and
// injects a hard navigation lock so nothing inside can escape the page.

export interface UpstreamConfig {
  upstream: string; // e.g. https://vidcloud.eu.org
  host: string; // e.g. vidcloud.eu.org
  prefix: string; // path prefix on our domain, e.g. /vidcloud
}

// Hide the "Ask AI" button and any download button before it can flash, and remove late-injected instances.
const ASK_AI_HIDE = String.raw`<style id="__apex_hide_askai">
[class*="ask-ai" i],[class*="askAi" i],[class*="AskAI" i],[id*="ask-ai" i],[id*="askai" i],[data-testid*="ask-ai" i],[aria-label="Ask AI" i],button[title="Ask AI" i],
[class*="download" i],[id*="download" i],[data-testid*="download" i],[aria-label*="download" i],[title*="download" i],a[download],a[href*="download" i]{display:none!important;visibility:hidden!important;opacity:0!important;pointer-events:none!important;width:0!important;height:0!important;overflow:hidden!important}
</style><script>(function(){
function isAskAi(el){try{if(!el||el.nodeType!==1)return false;var tag=(el.tagName||'').toLowerCase();if(tag!=='button'&&tag!=='a'&&el.getAttribute&&el.getAttribute('role')!=='button')return false;var t=(el.innerText||el.textContent||'').trim().toLowerCase();var al=((el.getAttribute&&(el.getAttribute('aria-label')||el.getAttribute('title')))||'').toLowerCase();var cn=(((el.className&&el.className.baseVal)||el.className||'')+' '+(el.id||'')).toLowerCase();if(t==='ask ai'||al==='ask ai'||/ask[-_]?ai/.test(cn))return true;}catch(e){}return false;}
function isDownload(el){try{if(!el||el.nodeType!==1)return false;var tag=(el.tagName||'').toLowerCase();if(tag!=='button'&&tag!=='a'&&tag!=='i'&&tag!=='svg'&&el.getAttribute&&el.getAttribute('role')!=='button')return false;var t=(el.innerText||el.textContent||'').trim().toLowerCase();var al=((el.getAttribute&&(el.getAttribute('aria-label')||el.getAttribute('title')))||'').toLowerCase();var cn=(((el.className&&el.className.baseVal)||el.className||'')+' '+(el.id||'')).toLowerCase();var href=(el.getAttribute&&el.getAttribute('href')||'').toLowerCase();if(el.hasAttribute&&el.hasAttribute('download'))return true;if(/\bdownload\b/.test(t))return true;if(/download/.test(al))return true;if(/download/.test(cn))return true;if(/\.(mp4|m3u8|mkv|mp3|pdf)(\?|$)/i.test(href))return true;}catch(e){}return false;}
function hide(el){try{el.style.setProperty('display','none','important');el.setAttribute&&el.setAttribute('aria-hidden','true');}catch(e){try{el.remove();}catch(_){}}}
function sweep(root){try{(root||document).querySelectorAll('button,a,i,svg,[role="button"]').forEach(function(el){if(isAskAi(el)||isDownload(el)){var p=el;for(var i=0;i<2&&p&&p.parentElement;i++){var pt=(p.parentElement.tagName||'').toLowerCase();if(pt==='button'||pt==='a'||(p.parentElement.getAttribute&&p.parentElement.getAttribute('role')==='button')){p=p.parentElement;}else break;}hide(p);}});}catch(e){}}
if(document.readyState==='loading'){document.addEventListener('DOMContentLoaded',function(){sweep(document);});}else{sweep(document);}
try{var mo=new MutationObserver(function(muts){muts.forEach(function(m){m.addedNodes&&m.addedNodes.forEach(function(n){if(n.nodeType===1){if(isAskAi(n)||isDownload(n))hide(n);sweep(n);}});});});mo.observe(document.documentElement,{childList:true,subtree:true});}catch(e){}
// Block download keyboard shortcuts (Ctrl+S, Ctrl+Shift+S).
document.addEventListener('keydown',function(e){if((e.ctrlKey||e.metaKey)&&(e.key==='s'||e.key==='S')){e.preventDefault();e.stopPropagation();return false;}},true);
setInterval(function(){sweep(document);},1500);
})();</script>`;

const NAV_LOCK_SCRIPT = String.raw`<script>

(function(){
  try {
    // Kill window.open so player cannot spawn new tabs.
    window.open = function(){ return null; };
    // Prevent leaving the iframe.
    window.addEventListener('beforeunload', function(e){ e.preventDefault(); e.returnValue=''; return ''; });
    // Force any link/form target to stay inside the iframe (never _top/_parent/_blank).
    function fixTarget(el){
      if(!el || !el.getAttribute) return;
      var t = (el.getAttribute('target')||'').toLowerCase();
      if(t === '_top' || t === '_parent' || t === '_blank') el.setAttribute('target','_self');
    }
    document.addEventListener('click', function(ev){
      var a = ev.target && ev.target.closest ? ev.target.closest('a,button,[role="button"]') : null;
      if(!a) return;
      // Detect known "back to batch" / navigation intent and cancel it.
      var txt = (a.innerText||a.textContent||'').toLowerCase();
      var href = a.getAttribute && a.getAttribute('href') || '';
      if (/back\s*to\s*batch|go\s*back|home|batch/i.test(txt) || /batch|home|index/i.test(href)) {
        ev.preventDefault(); ev.stopPropagation();
        return false;
      }
      if (a.tagName === 'A') {
        fixTarget(a);
        // Block links that leave the current page unless they are hash / javascript / same-page.
        if (href && !href.startsWith('#') && !href.startsWith('javascript:')) {
          try {
            var u = new URL(href, location.href);
            // Same-origin, same path: allow (query change); otherwise cancel.
            if (u.origin !== location.origin || (u.pathname !== location.pathname && !/play\.php$/i.test(u.pathname))) {
              ev.preventDefault(); ev.stopPropagation();
              return false;
            }
          } catch(e) { ev.preventDefault(); ev.stopPropagation(); return false; }
        }
      }
    }, true);
    document.addEventListener('submit', function(ev){
      fixTarget(ev.target);
    }, true);
    // Neutralize video-unavailable auto-redirects: some players call location.replace/assign.
    try {
      var _assign = location.assign.bind(location);
      var _replace = location.replace.bind(location);
      location.assign = function(u){
        try { var uu = new URL(u, location.href); if (uu.origin === location.origin && /play\.php$/i.test(uu.pathname)) return _assign(u); } catch(e){}
        console.warn('[player] blocked navigation', u);
      };
      location.replace = function(u){
        try { var uu = new URL(u, location.href); if (uu.origin === location.origin && /play\.php$/i.test(uu.pathname)) return _replace(u); } catch(e){}
        console.warn('[player] blocked navigation', u);
      };
    } catch(e){}
    // Watch DOM for injected "Back to Batch" buttons and disable them.
    var kill = function(root){
      root.querySelectorAll && root.querySelectorAll('a,button').forEach(function(el){
        var t = (el.innerText||el.textContent||'').toLowerCase();
        if (/back\s*to\s*batch|go\s*back/i.test(t)) {
          el.addEventListener('click', function(e){ e.preventDefault(); e.stopPropagation(); return false; }, true);
        }
      });
    };
    var mo = new MutationObserver(function(muts){ muts.forEach(function(m){ m.addedNodes && m.addedNodes.forEach(function(n){ if(n.nodeType===1) kill(n); }); }); });
    document.addEventListener('DOMContentLoaded', function(){ kill(document); mo.observe(document.documentElement,{childList:true,subtree:true}); });
  } catch(e){ console.error('[player nav-lock]', e); }
})();
</script>`;

function rewriteText(body: string, cfg: UpstreamConfig): string {
  const abs = new RegExp(
    `https?://${cfg.host.replace(/\./g, "\\.")}`,
    "g",
  );
  let out = body.replace(abs, cfg.prefix);
  // Rewrite protocol-relative //host references too.
  const proto = new RegExp(`//${cfg.host.replace(/\./g, "\\.")}`, "g");
  out = out.replace(proto, cfg.prefix);
  if (/<\/head>/i.test(out)) {
    out = out.replace(/<\/head>/i, `${ASK_AI_HIDE}</head>`);
  }
  if (/<\/body>/i.test(out)) {
    out = out.replace(/<\/body>/i, `${NAV_LOCK_SCRIPT}</body>`);
  }
  return out;
}

export async function proxyUpstream(
  request: Request,
  splat: string,
  cfg: UpstreamConfig,
): Promise<Response> {
  const url = new URL(request.url);
  const cleanSplat = splat.replace(/^\/+/, "");
  const upstreamUrl = `${cfg.upstream}/${cleanSplat}${url.search}`;

  const headers = new Headers();
  const forward = [
    "accept",
    "accept-language",
    "content-type",
    "range",
    "user-agent",
    "cookie",
  ];
  for (const h of forward) {
    const v = request.headers.get(h);
    if (v) headers.set(h, v);
  }
  headers.set("referer", cfg.upstream + "/");
  headers.set("origin", cfg.upstream);
  headers.set("host", cfg.host);

  const init: RequestInit = { method: request.method, headers, redirect: "manual" };
  if (!["GET", "HEAD"].includes(request.method)) {
    init.body = await request.arrayBuffer();
  }

  let upstream: Response;
  try {
    upstream = await fetch(upstreamUrl, init);
  } catch (err) {
    return new Response(`Upstream fetch failed: ${(err as Error).message}`, {
      status: 502,
    });
  }

  const respHeaders = new Headers();
  const passThrough = [
    "content-type",
    "cache-control",
    "etag",
    "last-modified",
    "expires",
    "accept-ranges",
    "content-range",
  ];
  for (const h of passThrough) {
    const v = upstream.headers.get(h);
    if (v) respHeaders.set(h, v);
  }
  // Strip frame-blocking headers so the player embeds inside our iframe wrapper.
  respHeaders.delete("x-frame-options");
  respHeaders.delete("content-security-policy");

  const location = upstream.headers.get("location");
  if (location) {
    respHeaders.set(
      "location",
      location
        .replace(new RegExp(`^https?://${cfg.host.replace(/\./g, "\\.")}`), cfg.prefix),
    );
  }

  const setCookies = upstream.headers.getSetCookie?.() ?? [];
  for (const c of setCookies) {
    respHeaders.append(
      "set-cookie",
      c.replace(/;\s*Domain=[^;]+/gi, "").replace(/;\s*Secure/gi, ""),
    );
  }

  const ct = upstream.headers.get("content-type") || "";
  const isText =
    /text\/|application\/(json|javascript|xml|xhtml|manifest\+json|ld\+json)/i.test(
      ct,
    );

  if (isText) {
    const body = await upstream.text();
    return new Response(rewriteText(body, cfg), {
      status: upstream.status,
      headers: respHeaders,
    });
  }

  return new Response(upstream.body, {
    status: upstream.status,
    headers: respHeaders,
  });
}
