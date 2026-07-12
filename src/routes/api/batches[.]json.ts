import { createFileRoute } from "@tanstack/react-router";

const SOURCE = "https://rarestudy.github.io/rarestudy/batches.json";

type Src = {
  _id?: string;
  batch_id?: string;
  name?: string;
  byName?: string;
  previewImage?: string;
  photo?: string;
  startDate?: string;
  start_date?: string;
  endDate?: string;
  end_date?: string;
  language?: string;
  feeTotal?: number;
  amount?: number;
  class?: string;
  exam?: string;
};

function toIso(d?: string): string {
  if (!d) return "";
  const t = Date.parse(d);
  if (!isNaN(t)) return new Date(t).toISOString();
  return d;
}

export const Route = createFileRoute("/api/batches.json")({
  server: {
    handlers: {
      GET: async () => {
        try {
          const res = await fetch(SOURCE, { headers: { accept: "application/json" } });
          const json = (await res.json()) as { batches?: Src[] };
          const batches = (json.batches ?? []).map((b) => ({
            batch_id: b._id ?? b.batch_id ?? "",
            name: b.name ?? "",
            byName: b.byName ?? "",
            photo: b.previewImage ?? b.photo ?? "",
            class: b.class ?? "",
            exam: b.exam ?? "",
            language: b.language ?? "",
            start_date: toIso(b.startDate ?? b.start_date),
            end_date: toIso(b.endDate ?? b.end_date),
            amount: b.feeTotal ?? b.amount ?? 0,
          }));
          return Response.json(
            { generated_at: new Date().toISOString(), batches },
            {
              headers: {
                "cache-control": "public, max-age=300",
                "access-control-allow-origin": "*",
              },
            },
          );
        } catch (err) {
          return new Response(
            `Failed to load batches: ${(err as Error).message}`,
            { status: 502 },
          );
        }
      },
    },
  },
});
