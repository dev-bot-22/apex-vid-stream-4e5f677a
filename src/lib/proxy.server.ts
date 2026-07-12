const UPSTREAM = "https://stream.studyratna.cc";
const UPSTREAM_HOST = "stream.studyratna.cc";

const NEW_LOGO = "https://i.ibb.co/v6ZKsh53/logo.png";
const OLD_LOGO_RE =
  /https:\/\/encrypted-tbn0\.gstatic\.com\/images\?q=tbn:ANd9GcT1fXfQMfsh9IK27z-hikKlLU2h8R_A9XUaLg&s/g;

// Order matters — longer/more specific patterns first.
const TEXT_REPLACEMENTS: Array<[RegExp, string]> = [
  [OLD_LOGO_RE, NEW_LOGO],
  // Swap batches JSON source to our own proxied endpoint (rarestudy-backed).
  [
    /https?:\/\/semfy-gros\.github\.io\/batches\/batcha\.json/g,
    "/api/batches-static.json",
  ],
  // Telegram channel/group link replacement.
  [/t\.me\/\+DGqOIShXqlYwMzhl/g, "t.me/official_marco_22"],
  [/t\.me\/mee_ratna/g, "t.me/official_marco_22"],
  [/Ratna\s*Bhai/gi, "Mr. Marco"],
  [/RatnaBhai/gi, "Mr. Marco"],
  [/Study\s*Ratna/g, "ApexLecture"],
  [/StudyRatna/g, "ApexLecture"],
  [/studyratna/g, "apexlecture"],
  [/STUDYRATNA/g, "APEXLECTURE"],
  [/Ratna/g, "Marco"],
  [/ratna/g, "marco"],
];

function rewriteText(body: string): string {
  let out = body;
  for (const [re, rep] of TEXT_REPLACEMENTS) out = out.replace(re, rep);
  // Make upstream absolute URLs relative so they route back through this proxy.
  out = out.replace(/https?:\/\/stream\.studyratna\.cc/g, "");
  if (/<\/body>/i.test(out)) {
    out = out.replace(/<\/body>/i, `${INSTANT_BATCHES_FALLBACK}</body>`);
  }
  return out;
}

const INSTANT_BATCHES_FALLBACK = String.raw`<script>
(function(){
  const DATA_URL='/api/batches-static.json';
  const esc=(s)=>String(s||'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
  const img=(b)=>b.photo||b.previewImage||'https://i.ibb.co/v6ZKsh53/logo.png';
  const id=(b)=>b.batch_id||b._id||'';
  const fmtDate=(d)=>{try{return d?new Date(d).toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'}):''}catch(e){return d||''}};
  let all=[], page=1, q='';
  async function load(){
    if(all.length) return all;
    const cached=sessionStorage.getItem('apex_batches_cache');
    if(cached){ try{ all=JSON.parse(cached); return all; }catch(e){} }
    const j=await fetch(DATA_URL,{cache:'force-cache'}).then(r=>r.json());
    all=(j.batches||[]).map(b=>{ if(!b._id) b._id=id(b); if(!b.batch_id) b.batch_id=id(b); return b; });
    try{ sessionStorage.setItem('apex_batches_cache', JSON.stringify(all)); }catch(e){}
    window.batchCache={batches:all,isLoaded:true,loadBatches:async()=>all,search:(s,l=50)=>filter(s).slice(0,l),getAllBatches:()=>all};
    return all;
  }
  function filter(s){
    const term=(s||'').toLowerCase().trim();
    if(!term) return all;
    return all.filter(b=>[b.name,b.byName,b.language,b.exam,b.class].join(' ').toLowerCase().includes(term));
  }
  function card(b){
    const bid=esc(id(b));
    return '<div class="batch-card" data-id="'+bid+'" data-batch-id="'+bid+'" data-api-id="'+bid+'" data-batch-type="new">'
      +'<div class="batch-image"><img src="'+esc(img(b))+'" alt="'+esc(b.name)+'" class="lazy-image loaded"><button class="favorite-btn"><i class="fa-regular fa-heart"></i></button></div>'
      +'<div class="batch-content"><div class="batch-tags"><span class="batch-tag language-tag">'+esc(b.language||'')+'</span><span class="batch-tag exam-tag">'+esc(b.exam||b.class||'')+'</span></div>'
      +'<h3 class="batch-title">'+esc(b.name)+'</h3><p class="batch-subtitle">'+esc(b.byName)+'</p><div class="batch-footer"><span class="batch-date">'+esc(fmtDate(b.start_date||b.startDate))+'</span><a href="#batch/'+bid+'" class="study-btn">Let\'s Study</a></div></div></div>';
  }
  function ensurePage(){
    const app=document.querySelector('#app-view'); if(!app) return null;
    if(!document.querySelector('#batches-grid')){
      const t=document.querySelector('#batches-template');
      app.innerHTML=t?t.innerHTML:'<div class="batches-page"><div class="search-container"><div class="search-input-wrapper"><i class="fa-solid fa-search search-icon"></i><input id="search-input" placeholder="Search batches..."><button id="clear-search" class="clear-btn">×</button></div></div><div class="batches-container" id="batches-grid"></div><div class="load-more-container"><button id="load-more" class="load-more-btn">Load More</button></div></div>';
    }
    return document.querySelector('#batches-grid');
  }
  function render(){
    const grid=ensurePage(); if(!grid) return;
    const data=filter(q); const shown=data.slice(0,page*50);
    grid.innerHTML=shown.map(card).join('') || '<div class="no-content">No batches found.</div>';
    const more=document.querySelector('#load-more'); if(more) more.style.display=shown.length<data.length?'inline-flex':'none';
    document.querySelectorAll('.batch-card').forEach(el=>{el.onclick=(ev)=>{ if(ev.target.closest('button')) return; location.hash='#batch/'+el.dataset.batchId; };});
  }
  function bind(){
    const s=document.querySelector('#search-input'); if(s && !s.dataset.apex){s.dataset.apex='1'; s.oninput=()=>{q=s.value; page=1; render();};}
    const c=document.querySelector('#clear-search'); if(c && !c.dataset.apex){c.dataset.apex='1'; c.onclick=()=>{q=''; if(s)s.value=''; page=1; render();};}
    const m=document.querySelector('#load-more'); if(m && !m.dataset.apex){m.dataset.apex='1'; m.onclick=()=>{page++; render();};}
  }
  async function boot(){
    if(location.hash && !/^#batches?$|^$/.test(location.hash)) return;
    await load(); render(); bind();
    setTimeout(()=>{ const g=document.querySelector('#batches-grid'); if(g && /loading/i.test(g.innerText||'')){ render(); bind(); } }, 800);
  }
  document.addEventListener('DOMContentLoaded', boot);
  window.addEventListener('hashchange', boot);
  setTimeout(boot, 1200);
})();
</script>`;

export async function proxyRequest(request: Request, splat: string): Promise<Response> {
  const url = new URL(request.url);
  const cleanSplat = splat.replace(/^\/+/, "");
  const upstreamUrl = `${UPSTREAM}/${cleanSplat}${url.search}`;

  const headers = new Headers();
  // Forward a minimal, safe subset of headers.
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
  headers.set("referer", UPSTREAM + "/");
  headers.set("origin", UPSTREAM);
  headers.set("host", UPSTREAM_HOST);

  const init: RequestInit = {
    method: request.method,
    headers,
    redirect: "manual",
  };
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
  // Copy safe response headers.
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
  // Rewrite Location on redirects.
  const location = upstream.headers.get("location");
  if (location) {
    respHeaders.set(
      "location",
      location.replace(/^https?:\/\/stream\.studyratna\.cc/, ""),
    );
  }
  // Rewrite Set-Cookie domain.
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
    return new Response(rewriteText(body), {
      status: upstream.status,
      headers: respHeaders,
    });
  }

  return new Response(upstream.body, {
    status: upstream.status,
    headers: respHeaders,
  });
}
