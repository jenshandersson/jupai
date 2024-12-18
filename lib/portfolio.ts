import { anthropic } from "@ai-sdk/anthropic";
import {
  ChainId,
  createConfig,
  getToken,
  getTokenBalances,
  KeypairWalletAdapter,
  Solana,
} from "@lifi/sdk";
import { ASSETS, DataFetcher, extractTag, getImageContent } from "./helpers";
import { CoreMessage, generateText } from "ai";
import { jupiterSwap } from "./jupiter";
import { Allocation, getTrades } from "./utils/portfolio";
import { kv } from "@vercel/kv";
import promiseRetry from "promise-retry";

if (!process.env.SOLANA_KEY) {
  throw Error("Missing key");
}

const WSOL_ADDRESS = "So11111111111111111111111111111111111111112";
const USDC_ADDRESS = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
const WBTC_ADDRESS = "3NZ9JMVBmGAqocybic2c7LQCJScmgsAZ6vQqTDzcqmJh";

const walletAddress = process.env.NEXT_PUBLIC_SOLANA_WALLET_ADDRESS!;

const walletAdapter = new KeypairWalletAdapter(process.env.SOLANA_KEY);

createConfig({
  integrator: "JensTest",
  providers: [
    Solana({
      getWalletAdapter: async () => walletAdapter,
    }),
  ],
  rpcUrls: {
    [ChainId.SOL]: [process.env.SOLANA_RPC_URL!],
  },
});

export const getAnalysis = async (currentAllocation = 50) => {
  const model = anthropic("claude-3-5-sonnet-latest");

  const images = await Promise.all([
    getImageContent(ASSETS.BTC, "1h"),
    getImageContent(ASSETS.SOL, "15m"),
  ]);

  const messages: CoreMessage[] = [
    {
      role: "system",
      content:
        "You are an expert trader specializing in technical analysis of cryptocurrencies.",
    },
    {
      role: "user",
      content: [
        ...images,
        {
          type: "text",
          text: `See the 1h chart for BTC and 15min chart for SOL. Included indicators are SMA 50, SMA 200, volume and Stochastic RSI.`,
        },
        {
          type: "text",
          text: `Analyze the provided charts carefully, look for price momentum and volume momentum. Look for support and resistance levels. Look for potential reversals, breakouts or take profit zones. 

<current_sol_percentage>
${currentAllocation}%
</current_sol_percentage>

Your job is to trade SOL, if you are bullish in the near term allocate 100% or 80%. If bearish then allocate 0% or maybe 20%.
If no significant change in the price/volume movements then leave allocation as is to avoid unnecessary transaction fees.

* If SOL is showing strength with increased price and increasing volume, be heavy on SOL.
* If SOL or BTC is showing weakness or high volatility, decrease SOL allocation.
* If SOL is near support level and looking to reverse up, allocate more to SOL.

Make sure to think through, and use a <thinking> tag.

Respond with a short (1-2 sentence) summary in <summary> tags. If you changed the allocation, explain why in the summary.
Write your allocation to SOL in <sol_percentage> tags. eg <sol_percentage>100%</sol_percentage>.
`,
        },
      ],
    },
  ];
  console.log(messages[1]);
  const { text } = await generateText({
    model,
    messages,
  });

  const summary = extractTag(text, "summary");
  const percentageStr = extractTag(text, "sol_percentage");
  const percentage = parseFloat(percentageStr);

  return {
    text,
    summary,
    percentage,
  };
};

export type Log = {
  time: string;
  total: number;
  assets: [
    {
      symbol: string;
      price: string;
      value: number;
      amount: number;
    },
    {
      symbol: string;
      price: string;
      value: number;
      amount: number;
    },
    {
      symbol: string;
      price: string;
      value: number;
      amount: number;
    }
  ];
  percentages: Allocation;
};

export const rebalance = async (solPercentage: number, execute = false) => {
  const portfolio = await getPortfolio();
  const currentPercentage = Math.round(
    (portfolio.assets[0].valueUSD / portfolio.totalValueUSD) * 100
  );
  const diffPercentage = Math.abs(currentPercentage - solPercentage);
  console.log({ currentPercentage, diffPercentage });
  if (diffPercentage < 5) {
    console.log("No real change", currentPercentage - solPercentage);
    return { status: "No Trade, no change" };
  }
  const usdToTrade = (diffPercentage / 100) * portfolio.totalValueUSD;
  console.log(usdToTrade);

  const [solAsset, usdAsset] = portfolio.assets;

  let sellAsset = solAsset;
  let buyAsset = usdAsset;

  if (solPercentage > currentPercentage) {
    // SELL USDC
    sellAsset = usdAsset;
    buyAsset = solAsset;
  }

  const amountUSD = usdToTrade / parseFloat(sellAsset.priceUSD);
  let lampards = Math.floor(amountUSD * 10 ** sellAsset.decimals);
  const maxLampards = sellAsset.amountLamports;
  if (lampards > maxLampards) {
    console.log("SELLING ALL!!!!", sellAsset);
    lampards = maxLampards;
  }
  const response = await jupiterSwap(
    sellAsset.address,
    buyAsset.address,
    lampards,
    execute
  );
  return response;
};

export const getPortfolio = async (log = true) => {
  const chainId = ChainId.SOL;
  const solToken = await getToken(chainId, WSOL_ADDRESS);
  const usdcToken = await getToken(chainId, USDC_ADDRESS);
  const btcToken = await getToken(chainId, WBTC_ADDRESS);

  const tokens = [solToken, usdcToken, btcToken];

  const tokenBalance = await getTokenBalances(walletAddress, tokens);
  console.log(tokenBalance);

  let total = 0;

  const assets = [];

  for (const balance of tokenBalance) {
    const amountFloat = !balance.amount
      ? 0
      : Number(balance.amount) / Math.pow(10, balance.decimals);
    const value = amountFloat * parseFloat(balance.priceUSD);
    console.log(value);
    total += value;
    assets.push({
      symbol: balance.symbol,
      name: balance.name,
      amount: amountFloat,
      amountLamports: Number(balance.amount ?? 0),
      priceUSD: balance.priceUSD,
      valueUSD: value,
      decimals: balance.decimals,
      address: balance.address,
    });
  }

  const percentages = {} as Allocation;
  assets.forEach((d) => {
    percentages[d.symbol] = Math.floor((d.valueUSD / total) * 100) + "%";
  });
  console.log({ total, assets, percentages });

  if (log) {
    await kv.lpush("portfolioLogs", {
      time: new Date().toISOString(),
      total,
      assets: assets.map((a) => ({
        symbol: a.symbol,
        price: a.priceUSD,
        value: a.valueUSD,
        amount: a.amount,
      })),
      percentages,
    } as Log);
  }

  return {
    totalValueUSD: total,
    assets: assets,
    percentages,
  };
};

export const rebalancePortfolio = async (execute = false) => {
  const model = anthropic("claude-3-5-sonnet-latest");

  const current = await getPortfolio(false);

  console.log(current);

  const interval = "4h";

  const images = await Promise.all([
    getImageContent(ASSETS.BTC, interval),
    getImageContent(ASSETS.SOL, interval),
  ]);

  const dataFetcher = new DataFetcher();
  const fg = await dataFetcher.fetchFearAndGreedString(false);

  const messages: CoreMessage[] = [
    {
      role: "system",
      content:
        "You are an expert trader specializing in technical analysis of cryptocurrencies.",
    },
    {
      role: "user",
      content: [
        ...images,
        {
          type: "text",
          text: `See the ${interval} charts for BTC and SOL. Included indicators are SMA 50, SMA 200, volume and Stochastic RSI.`,
        },
        {
          type: "text",
          text: `Analyze the provided charts very carefully, look for price momentum and volume momentum. Look for bullish market structur, support and resistance levels. Look for potential reversals, breakouts or take profit zones.

Latest days Crypto Fear & Greed index (most recent first):
<fear_and_greed>
${fg}
</fear_and_greed>

Your job is to decide the portfolio allocation for the coming days. Available assets are WBTC, wSOL and USDC.
If no significant change in the price/volume movements then leave allocation as is to avoid unnecessary transaction fees.

<current_portfolio>
${JSON.stringify(current.percentages)}
</current_portfolio>

<strategy>
* Look for market structure, in bullish trend be more allocated to riskier assets. In negative trend prefer WBTC or USDC, unless you predict a reversal to the upside, then scale into BTC.
* If SOL is showing strength with increased price and increasing volume, be heavy on SOL.
* If SOL or BTC is showing weakness or high volatility, decrease SOL allocation.
* In high volatility or bearish trend, make sure to keep USDC to buy the dips.
* When FG (Fear & Greed) is extreme greed take some profits.
* When FG is fear/extreme fear allocate majority to WBTC.
</strategy>

Make sure to think through, and use a <thinking> tag.

Respond with a short summary in <summary> tags, clearly explain any updates to the portfolio.
Write your portfolio allocation in <portfolio> tag using the following JSON format: { "WBTC": "30%", "wSOL": "50%", "USDC": "20%" }`,
        },
      ],
    },
  ];
  const { text } = await generateText({
    model,
    messages,
  });

  const summary = extractTag(text, "summary");
  const portfolio: Allocation = JSON.parse(
    extractTag(text, "portfolio").trim()
  );

  await kv.set("latestAnalysis", text);

  console.log(text);

  console.log(portfolio);

  const trades = getTrades(current.percentages, portfolio);

  console.log(trades);

  const transactions = [];

  for (const trade of trades) {
    if (trade.percentage < 3) {
      transactions.push({
        status: "ignored",
        message: "Less than 5% change, ignoring",
      });
      continue;
    }
    const sellAsset = current.assets.find((a) => a.symbol == trade.from);
    const buyAsset = current.assets.find((a) => a.symbol == trade.to);
    if (!sellAsset || !buyAsset) {
      throw Error("ASSSETS MISSING: " + JSON.stringify(trade));
    }
    const amountUSD = trade.percentage / parseFloat(sellAsset!.priceUSD);
    let lampards = Math.floor(amountUSD * 10 ** sellAsset!.decimals);
    const maxLampards = sellAsset!.amountLamports;
    if (lampards > maxLampards) {
      console.log("SELLING ALL!!!!", sellAsset);
      lampards = maxLampards;
    }
    console.log(sellAsset.address, buyAsset.address, lampards);

    try {
      const response = await promiseRetry(
        async (retry) => {
          return jupiterSwap(
            sellAsset.address,
            buyAsset.address,
            lampards,
            execute
          ).catch((e) => {
            console.warn(e);
            retry(e);
          });
        },
        {
          retries: 1,
        }
      );
      console.log(response);
      transactions.push(response);
    } catch (e) {
      console.warn(e);
      transactions.push({
        status: "error",
        message: (e as Error).message,
      });
    }
  }

  return {
    text,
    summary,
    portfolio,
    trades,
    transactions,
    old: current.percentages,
  };
};
