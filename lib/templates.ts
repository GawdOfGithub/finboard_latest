import { Widget } from "./types";

export const TEMPLATES: Record<string, Widget[]> = {
  "crypto-live": [
    {
      id: "btc-live",
      type: "card",
      config: {
        label: "Bitcoin Live (WebSocket)",
        apiUrl: "",
        socketUrl: "wss://stream.binance.com:9443/ws/btcusdt@trade",
        refreshInterval: 0,
        fields: [{ id: "1", label: "Price", path: "p" }, { id: "2", label: "Qty", path: "q" }]
      }
    },
    {
      id: "eth-live",
      type: "chart",
      config: {
        label: "Ethereum Live Feed",
        apiUrl: "",
        socketUrl: "wss://stream.binance.com:9443/ws/ethusdt@trade",
        refreshInterval: 0,
        fields: [{ id: "1", label: "Price", path: "p" }]
      }
    }
  ],
  "market-overview": [
    {
      id: "top-coins",
      type: "table",
      config: {
        label: "Top 10 Crypto Assets",
        apiUrl: "https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=10&page=1&sparkline=false",
        refreshInterval: 60,
        fields: [
          { id: "1", label: "Name", path: "name" },
          { id: "2", label: "Price", path: "current_price" },
          { id: "3", label: "High 24h", path: "high_24h" }
        ]
      }
    },
    {
      id: "btc-card",
      type: "card",
      config: {
        label: "Bitcoin Overview",
        apiUrl: "https://api.coingecko.com/api/v3/coins/bitcoin",
        refreshInterval: 30,
        fields: [
          { id: "1", label: "Current Price", path: "market_data.current_price.usd" },
          { id: "2", label: "24h Change %", path: "market_data.price_change_percentage_24h" }
        ]
      }
    }
  ]
};
