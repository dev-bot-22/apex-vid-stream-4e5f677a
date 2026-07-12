import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const { proxyRequest } = await import("../lib/proxy.server");
        return proxyRequest(request, "");
      },
    },
  },
});
