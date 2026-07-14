import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/play.php")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);

        // Best-effort admin/block/logging — never let it break the player.
        try {
          const {
            extractClient,
            checkBlocked,
            getBlockMessage,
            logAccess,
            blockPageHtml,
          } = await import("../lib/admin.server");
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

          const block = await checkBlocked({ client, batch_id }).catch(() => ({
            matched: false as const,
          }));
          void logAccess({
            kind: "play",
            path: url.pathname + url.search,
            method: "GET",
            client,
            batch_id,
            video_id,
            video_name,
            blocked: block.matched,
          }).catch(() => {});
          if (block.matched) {
            const msg =
              ("message" in block && block.message) ||
              (await getBlockMessage().catch(() => "Access denied."));
            return new Response(blockPageHtml(msg), {
              status: 403,
              headers: { "content-type": "text/html; charset=utf-8" },
            });
          }
        } catch (e) {
          console.error("[play.php] admin layer failed, continuing", e);
        }

        // Load the player from the upstream origin directly. The DASH/HLS stream
        // decryption and CDN referer checks are tied to the upstream hostname —
        // proxying it breaks playback ("DASH stream error"). The iframe still keeps
        // the top-level URL as /play.php on our domain.
        const target = `https://studystark.testwave.cc/play.php${url.search}`;
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
