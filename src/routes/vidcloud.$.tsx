import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/vidcloud/$")({
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
          upstream: "https://vidcloud.eu.org",
          host: "vidcloud.eu.org",
          prefix: "/vidcloud",
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
