import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/play2.html")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const {
          extractClient,
          checkBlocked,
          getBlockMessage,
          logAccess,
          blockPageHtml,
        } = await import("../lib/admin.server");
        const url = new URL(request.url);
        const client = extractClient(request);
        const batch_id =
          url.searchParams.get("batch") ||
          url.searchParams.get("batch_id") ||
          undefined;
        const video_id =
          url.searchParams.get("vid") ||
          url.searchParams.get("id") ||
          url.searchParams.get("v") ||
          undefined;
        const video_name =
          url.searchParams.get("name") ||
          url.searchParams.get("title") ||
          undefined;

        const block = await checkBlocked({ client, batch_id });
        void logAccess({
          kind: "play2",
          path: url.pathname + url.search,
          method: "GET",
          client,
          batch_id,
          video_id,
          video_name,
          blocked: block.matched,
        });
        if (block.matched) {
          const msg = block.message || (await getBlockMessage());
          return new Response(blockPageHtml(msg), {
            status: 403,
            headers: { "content-type": "text/html; charset=utf-8" },
          });
        }

        const target = `/s2cdn/play.php${url.search}`;
        const safeTarget = target.replace(/"/g, "&quot;");
        const html = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Player</title><style>html,body{margin:0;padding:0;background:#000;overflow:hidden;width:100%;height:100%}iframe{margin:0;padding:0;border:0;width:100%;height:100%;background:#000;display:block}</style></head><body><iframe id="player" src="${safeTarget}" allow="encrypted-media; autoplay; fullscreen; picture-in-picture" allowfullscreen></iframe><script>
(function(){
  var lockedHref = location.href;
  window.addEventListener('beforeunload', function(e){ e.preventDefault(); e.returnValue=''; return ''; });
  try {
    history.pushState(null, '', lockedHref);
    window.addEventListener('popstate', function(){ history.pushState(null, '', lockedHref); });
  } catch(e) {}
  try { window.open = function(){ return null; }; } catch(e){}
})();
</script></body></html>`;
        return new Response(html, {
          headers: { "content-type": "text/html; charset=utf-8" },
        });
      },
    },
  },
});
