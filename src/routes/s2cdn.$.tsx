import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/s2cdn/$")({
  server: {
    handlers: ({ createHandlers }) => {
      const handle = async ({
        request,
        params,
      }: {
        request: Request;
        params: { _splat?: string };
      }) => {
        const { proxyUpstream } = await import("../lib/player-upstream.server");
        return proxyUpstream(request, params._splat ?? "", {
          upstream: "https://s2-cdn.studyratna.cc",
          host: "s2-cdn.studyratna.cc",
          prefix: "/s2cdn",
        });
      };
      return createHandlers({
        GET: handle,
        POST: handle,
        PUT: handle,
        DELETE: handle,
        PATCH: handle,
        OPTIONS: handle,
        HEAD: handle,
      });
    },
  },
});
