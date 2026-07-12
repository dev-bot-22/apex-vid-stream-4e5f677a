import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/$")({
  server: {
    handlers: ({ createHandlers }) => {
      const handle = async ({
        request,
        params,
      }: {
        request: Request;
        params: { _splat?: string };
      }) => {
        const { proxyRequest } = await import("../lib/proxy.server");
        return proxyRequest(request, params._splat ?? "");
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
