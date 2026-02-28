import { privateKeyToAccount, type PrivateKeyAccount } from "viem/accounts";
import {
  type Address,
  type Hex,
  encodePacked,
  keccak256,
  toHex,
} from "viem";

// --- Configuration ---

const MAINNET_URL = "https://api.hyperliquid.xyz";
const TESTNET_URL = "https://api.hyperliquid-testnet.xyz";

interface HyperliquidConfig {
  baseUrl: string;
  account: PrivateKeyAccount;
}

interface OrderParams {
  coin: string;
  isBuy: boolean;
  size: string;
  price: string;
  orderType: LimitOrderType | TriggerOrderType;
  reduceOnly: boolean;
  cloid?: string;
}

interface LimitOrderType {
  limit: { tif: "Gtc" | "Ioc" | "Alo" };
}

interface TriggerOrderType {
  trigger: {
    triggerPx: string;
    isMarket: boolean;
    tpsl: "tp" | "sl";
  };
}

interface AssetMeta {
  name: string;
  szDecimals: number;
  maxLeverage: number;
}

interface Meta {
  universe: AssetMeta[];
}

interface OrderStatus {
  resting?: { oid: number };
  filled?: { oid: number; totalSz: string; avgPx: string };
  error?: string;
}

interface ExchangeResponse {
  status: "ok" | "err";
  response:
    | {
        type: string;
        data: { statuses: OrderStatus[] };
      }
    | string;
}

interface Position {
  coin: string;
  szi: string;
  entryPx: string;
  unrealizedPnl: string;
  liquidationPx: string | null;
  leverage: { type: "cross" | "isolated"; value: number };
}

interface MarginSummary {
  accountValue: string;
  totalMarginUsed: string;
  totalNtlPos: string;
}

interface ClearinghouseState {
  marginSummary: MarginSummary;
  assetPositions: Array<{ position: Position }>;
  withdrawable: string;
}

// --- Client ---

class HyperliquidClient {
  private config: HyperliquidConfig;
  private assetMap: Map<string, number> = new Map();

  constructor(config: HyperliquidConfig) {
    this.config = config;
  }

  // EIP-712 signing is handled by the backend SDK.
  // For TypeScript, use @nktkas/hyperliquid for production signing.
  // This client covers Info API (no auth) and demonstrates structure.

  // --- Info API (no auth) ---

  private async infoRequest<T>(body: Record<string, unknown>): Promise<T> {
    const res = await fetch(`${this.config.baseUrl}/info`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      throw new Error(`Info request failed: ${res.status} ${res.statusText}`);
    }
    return res.json() as Promise<T>;
  }

  async getMeta(): Promise<Meta> {
    const meta = await this.infoRequest<Meta>({ type: "meta" });
    this.assetMap.clear();
    for (let i = 0; i < meta.universe.length; i++) {
      this.assetMap.set(meta.universe[i].name, i);
    }
    return meta;
  }

  resolveAssetIndex(coin: string): number {
    const index = this.assetMap.get(coin);
    if (index === undefined) {
      throw new Error(
        `Unknown asset: ${coin}. Call getMeta() first to load the universe.`
      );
    }
    return index;
  }

  async getAllMids(): Promise<Record<string, string>> {
    return this.infoRequest<Record<string, string>>({ type: "allMids" });
  }

  async getL2Book(
    coin: string,
    nSigFigs?: number
  ): Promise<{
    levels: Array<Array<{ px: string; sz: string; n: number }>>;
    coin: string;
    time: number;
  }> {
    return this.infoRequest({
      type: "l2Book",
      coin,
      ...(nSigFigs !== undefined && { nSigFigs }),
    });
  }

  async getClearinghouseState(user: Address): Promise<ClearinghouseState> {
    return this.infoRequest<ClearinghouseState>({
      type: "clearinghouseState",
      user,
    });
  }

  async getOpenOrders(
    user: Address
  ): Promise<
    Array<{
      oid: number;
      coin: string;
      side: string;
      limitPx: string;
      sz: string;
      orderType: string;
      triggerPx?: string;
      reduceOnly: boolean;
    }>
  > {
    return this.infoRequest({ type: "frontendOpenOrders", user });
  }

  async getUserFills(
    user: Address
  ): Promise<
    Array<{
      px: string;
      sz: string;
      side: string;
      coin: string;
      fee: string;
      closedPnl: string;
      dir: string;
      tid: number;
      hash: string;
    }>
  > {
    return this.infoRequest({ type: "userFills", user });
  }

  async getFundingHistory(
    coin: string,
    startTime: number,
    endTime?: number
  ): Promise<
    Array<{ coin: string; fundingRate: string; premium: string; time: number }>
  > {
    return this.infoRequest({
      type: "fundingHistory",
      coin,
      startTime,
      ...(endTime !== undefined && { endTime }),
    });
  }

  async getUserRateLimit(
    user: Address
  ): Promise<{
    cumVlm: string;
    nRequestsUsed: number;
    nRequestsCap: number;
    nRequestsSurplus: number;
  }> {
    return this.infoRequest({ type: "userRateLimit", user });
  }

  async getCandles(
    coin: string,
    interval: string,
    startTime: number,
    endTime: number
  ): Promise<
    Array<{
      T: number;
      o: string;
      h: string;
      l: string;
      c: string;
      v: string;
      n: number;
    }>
  > {
    return this.infoRequest({
      type: "candleSnapshot",
      req: { coin, interval, startTime, endTime },
    });
  }

  // --- Position Helpers ---

  async getPositions(user: Address): Promise<Position[]> {
    const state = await this.getClearinghouseState(user);
    return state.assetPositions.map((ap) => ap.position);
  }

  async getPosition(user: Address, coin: string): Promise<Position | null> {
    const positions = await this.getPositions(user);
    return positions.find((p) => p.coin === coin) ?? null;
  }

  // --- Formatting Helpers ---

  formatSize(size: number, szDecimals: number): string {
    return size.toFixed(szDecimals);
  }

  formatPrice(price: number, coin: string): string {
    // Prices must be divisible by tick size.
    // Default to 1 decimal for most assets, 0 for BTC-level prices.
    if (price > 10000) return price.toFixed(1);
    if (price > 100) return price.toFixed(2);
    return price.toFixed(4);
  }
}

// --- WebSocket Helper ---

interface WsSubscription {
  type: string;
  coin?: string;
  user?: string;
  interval?: string;
  dex?: string;
}

type WsMessageHandler = (channel: string, data: unknown) => void;

class HyperliquidWs {
  private url: string;
  private ws: WebSocket | null = null;
  private subscriptions: WsSubscription[] = [];
  private handler: WsMessageHandler;
  private reconnectDelay = 1000;
  private maxReconnectDelay = 60000;
  private shouldReconnect = true;

  constructor(url: string, handler: WsMessageHandler) {
    this.url = url;
    this.handler = handler;
  }

  connect(): void {
    this.ws = new WebSocket(this.url);

    this.ws.onopen = () => {
      this.reconnectDelay = 1000;
      for (const sub of this.subscriptions) {
        this.ws?.send(
          JSON.stringify({ method: "subscribe", subscription: sub })
        );
      }
    };

    this.ws.onmessage = (event) => {
      const data = JSON.parse(event.data as string) as {
        channel?: string;
        data?: unknown;
      };
      if (data.channel && data.data) {
        this.handler(data.channel, data.data);
      }
    };

    this.ws.onclose = () => {
      if (this.shouldReconnect) {
        setTimeout(() => this.connect(), this.reconnectDelay);
        this.reconnectDelay = Math.min(
          this.reconnectDelay * 2,
          this.maxReconnectDelay
        );
      }
    };

    this.ws.onerror = (error) => {
      console.error("WebSocket error:", error);
    };
  }

  subscribe(sub: WsSubscription): void {
    this.subscriptions.push(sub);
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ method: "subscribe", subscription: sub }));
    }
  }

  unsubscribe(sub: WsSubscription): void {
    this.subscriptions = this.subscriptions.filter(
      (s) => JSON.stringify(s) !== JSON.stringify(sub)
    );
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(
        JSON.stringify({ method: "unsubscribe", subscription: sub })
      );
    }
  }

  close(): void {
    this.shouldReconnect = false;
    this.ws?.close();
  }
}

// --- Usage Example ---

async function main() {
  const account = privateKeyToAccount(process.env.PRIVATE_KEY as Hex);

  const client = new HyperliquidClient({
    baseUrl: MAINNET_URL,
    account,
  });

  const meta = await client.getMeta();
  console.log(`Loaded ${meta.universe.length} assets`);

  const mids = await client.getAllMids();
  console.log(`BTC: ${mids["BTC"]}, ETH: ${mids["ETH"]}`);

  const book = await client.getL2Book("ETH", 5);
  const bestBid = book.levels[0][0];
  const bestAsk = book.levels[1][0];
  console.log(`ETH BBO: ${bestBid.px} / ${bestAsk.px}`);

  const state = await client.getClearinghouseState(account.address);
  console.log(`Account value: ${state.marginSummary.accountValue}`);

  for (const pos of state.assetPositions) {
    const p = pos.position;
    const direction = parseFloat(p.szi) > 0 ? "LONG" : "SHORT";
    console.log(
      `${p.coin} ${direction} size=${p.szi} entry=${p.entryPx} pnl=${p.unrealizedPnl}`
    );
  }

  const rateLimit = await client.getUserRateLimit(account.address);
  console.log(
    `Rate limit: ${rateLimit.nRequestsUsed}/${rateLimit.nRequestsCap}`
  );

  // WebSocket streaming
  const ws = new HyperliquidWs(
    "wss://api.hyperliquid.xyz/ws",
    (channel, data) => {
      if (channel === "trades") {
        const trades = data as Array<{
          coin: string;
          side: string;
          sz: string;
          px: string;
        }>;
        for (const t of trades) {
          console.log(`TRADE ${t.coin} ${t.side} ${t.sz}@${t.px}`);
        }
      } else if (channel === "userFills") {
        const fills = data as Array<{
          coin: string;
          dir: string;
          sz: string;
          px: string;
          fee: string;
        }>;
        for (const f of fills) {
          console.log(
            `FILL ${f.coin} ${f.dir} ${f.sz}@${f.px} fee=${f.fee}`
          );
        }
      }
    }
  );

  ws.connect();
  ws.subscribe({ type: "trades", coin: "BTC" });
  ws.subscribe({ type: "userFills", user: account.address });

  // For placing orders with signing, use @nktkas/hyperliquid:
  //
  // import Hyperliquid from "@nktkas/hyperliquid";
  // const sdk = new Hyperliquid(privateKey);
  // await sdk.exchange.placeOrder({ ... });
}

main().catch(console.error);
