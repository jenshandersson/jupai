import * as fs from "fs/promises";
import { ImagePart } from "ai";

export const ASSETS = {
  BTC: "BINANCE:BTCUSDT",
  ETH: "BINANCE:ETHUSDT",
  SOL: "BINANCE:SOLUSDT",
  FET: "BINANCE:FETUSDT",
  ACH: "BINANCE:ACHUSDT",
  ALGO: "BINANCE:ALGOUSDT",
  BICO: "BINANCE:BICOUSDT",
  CGLD: "BINANCE:CGLDUSDT",
  FLOW: "BINANCE:FLOWUSDT",
  GLM: "BINANCE:GLMUSDT",
  GMT: "BINANCE:GMTUSDT",
  GRT: "BINANCE:GRTUSDT",
  LRC: "BINANCE:LRCUSDT",
  MATIC: "BINANCE:MATICUSDT",
  MINA: "BINANCE:MINAUSDT",
  NKN: "BINANCE:NKNUSDT",
  OGN: "BINANCE:OGNUSDT",
  ORN: "BINANCE:ORNUSDT",
  PERP: "BINANCE:PERPUSDT",
  POLS: "BINANCE:POLSUSDT",
  POWR: "BINANCE:POWRUSDT",
  RNDR: "COINBASE:RNDRUSDT",
  SKL: "BINANCE:SKLUSDT",
  STORJ: "BINANCE:STORJUSDT",
  SUPER: "BINANCE:SUPERUSDT",
  SYN: "BINANCE:SYNUSDT",
  TRAC: "BINANCE:TRACUSDT",
  TRU: "BINANCE:TRUUSDT",
  DOGE: "BINANCE:DOGEUSDT",
  AVAX: "BINANCE:AVAXUSDT",
  LINK: "BINANCE:LINKUSDT",
  SUI: "BINANCE:SUIUSDT",
  BONK: "BINANCE:BONKUSDT",
  WIF: "BINANCE:WIFUSDT",
  XRP: "BINANCE:XRPUSDT",
  PEPE: "BINANCE:PEPEUSDT",
  ARB: "BINANCE:ARBUSDT",
  OP: "BINANCE:OPUSDT",
  XLM: "BINANCE:XLMUSDT",
} as const;

export type Asset = keyof typeof ASSETS;

export class DataFetcher {
  async fetchCached(url: string, name: string, useCache = true) {
    const fn = `./data/${name}.json`;
    try {
      const cached = await fs.readFile(fn, "utf-8");
      if (cached && useCache) {
        return JSON.parse(cached);
      }
    } catch {}

    const data = await fetch(url).then((r) => r.json());

    try {
      await fs.writeFile(fn, JSON.stringify(data, null, 2));
    } catch {}

    return data;
  }
  async fetchFearAndGreed(
    useCache = false
  ): Promise<{ data: { value: number }[] }> {
    const data = await this.fetchCached(
      `https://api.alternative.me/fng/?limit=30`,
      "fearAndGreed",
      useCache
    );
    return data;
  }
  async fetchFearAndGreedString(useCache = false): Promise<string> {
    try {
      const data = await this.fetchFearAndGreed(useCache);
      return data.data.map((d) => d.value).join("\n");
    } catch (e) {
      console.error(e);
    }
    return "Couldn't fetch fear and greed data at this time.";
  }
}

export const pick = <T extends object, K extends keyof T>(
  obj: T,
  keys: K[]
): Pick<T, K> => {
  const result = {} as Pick<T, K>;
  keys.forEach((key) => {
    if (key in obj) {
      result[key] = obj[key];
    }
  });
  return result;
};

export const extractTag = (text: string, tag: string) => {
  const regex = new RegExp(`<${tag}>([\\s\\S]*?)<\/${tag}>`);
  const report = text.match(regex);
  if (report?.[1]) {
    return report[1].trim();
  }
  return "";
};

export const removeTag = (text: string, tag: string) => {
  const regex = new RegExp(`<${tag}>([\\s\\S]*?)<\/${tag}>`);
  return text.replace(regex, "");
};

export type ChartInterval = "1d" | "1h" | "4h" | "1w" | "15m";
export const getImageContent = async (
  symbol = "",
  interval: ChartInterval = "1d"
) => {
  const url = `https://api.chart-img.com/v1/tradingview/advanced-chart?interval=${interval}&symbol=${symbol}&studies=STOCHRSI:3,3,14,14,close&studies=MA:50,close&studies=MA:200,close&theme=light&key=pzjLBSW4ZK7FN0Z8ZfW7Oa6O9efJlpYt5KF5H5PV`;

  console.log(url);
  const image = await fetch(url);
  if (!image.ok) {
    console.error(url, image.statusText);
    throw Error("Error fetching image");
  }

  const buffer = await image.arrayBuffer();

  const base64 = Buffer.from(buffer).toString("base64");
  console.log(base64.slice(0, 10));
  return { type: "image", image: base64 } as ImagePart;
};
