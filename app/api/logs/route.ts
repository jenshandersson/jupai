import { NextRequest, NextResponse } from "next/server";
import { kv } from "@vercel/kv";
import { Log } from "@/lib/portfolio";
import { extractTag } from "@/lib/helpers";

export const maxDuration = 180; // This function can run for a maximum of 5 seconds
export const dynamic = "force-dynamic";

export const revalidate = 0;

export async function GET(req: NextRequest) {
  const all = await kv.lrange<Log>("portfolioLogs", 0, -1);

  const logs = all.reverse();
  // const csv = logs
  //   .map((l) =>
  //     [l.time, l.total, ...l.assets.map((a) => [a.price, a.value])].join(",")
  //   )
  //   .join("\n");

  const analysis = await kv.get("latestAnalysis");
  const summary = analysis && extractTag(analysis as string, "summary");

  return NextResponse.json({ logs, analysis, summary });
}
