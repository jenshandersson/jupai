import { NextRequest, NextResponse } from "next/server";
import { rebalancePortfolio, getPortfolio } from "@/lib/portfolio";
import { sendTelegramMessage } from "@/lib/telegram";
import { Allocation } from "@/lib/utils/portfolio";

export const maxDuration = 300;
export const dynamic = "force-dynamic";

export const revalidate = 0;

const portStr = (a: Allocation) =>
  Object.entries(a)
    .sort()
    .map((a) => a.join(": "))
    .join(", ");

export async function GET(req: NextRequest) {
  const execute = new URL(req.url).searchParams.get("execute");
  console.log(execute);

  const data = await rebalancePortfolio(!!execute);

  const updated = await getPortfolio();

  await sendTelegramMessage(`*Portfolio Rebalancing*
Total value: *${updated.totalValueUSD.toFixed(2)}*
*Summary:* ${data.summary}
Before: ${portStr(data.old)}
Updated: ${portStr(updated.percentages)}
Trades: ${data.trades
    .map((t) => `${t.from}->${t.to} ${t.percentage}%`)
    .join(",  ")}
Txn: ${JSON.stringify(data.transactions)}
`);

  return NextResponse.json(data);
}
