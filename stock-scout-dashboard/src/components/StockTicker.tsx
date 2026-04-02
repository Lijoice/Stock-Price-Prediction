import { useState, useEffect } from "react";
import { apiGetQuotes } from "@/lib/api";
import { Loader2 } from "lucide-react";

const TICKER_SYMBOLS = ["AAPL", "MSFT", "AMZN", "GOOGL", "HDFCBANK.NS", "ICICIBANK.NS", "TATAMOTORS.NS"];

interface TickerItem {
  symbol: string;
  price: number;
  change: number;
  changePercent: number;
}

const StockTicker = () => {
  const [tickerData, setTickerData] = useState<TickerItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadQuotes = async () => {
      try {
        const quotes = await apiGetQuotes(TICKER_SYMBOLS);
        if (quotes && quotes.length > 0) {
          const items: TickerItem[] = quotes.map((q: any) => ({
            symbol: q.symbol,
            price: q.value,
            change: q.change,
            changePercent: q.changePercent
          }));
          setTickerData(items);
        }
      } catch (err) {
        console.error("Failed to load ticker quotes", err);
      } finally {
        setLoading(false);
      }
    };
    loadQuotes();
  }, []);

  if (loading) {
    return (
      <div className="bg-card border-y border-border overflow-hidden">
        <div className="flex items-center justify-center gap-2 py-2">
          <Loader2 className="w-3 h-3 animate-spin text-primary" />
          <span className="text-xs text-muted-foreground">Loading live market data...</span>
        </div>
      </div>
    );
  }

  if (tickerData.length === 0) return null;

  return (
    <div className="bg-card border-y border-border overflow-hidden">
      <div className="flex ticker-scroll">
        {[...tickerData, ...tickerData].map((stock, index) => (
          <div
            key={`${stock.symbol}-${index}`}
            className="flex items-center gap-2 px-6 py-2 whitespace-nowrap"
          >
            <span className="font-semibold text-foreground">{stock.symbol}</span>
            <span className="text-primary">•</span>
            <span className="text-foreground">{stock.price.toFixed(2)}</span>
            <span className={stock.change >= 0 ? "stock-positive" : "stock-negative"}>
              {stock.change >= 0 ? "+" : ""}
              {stock.change.toFixed(2)} ({stock.changePercent >= 0 ? "+" : ""}
              {stock.changePercent.toFixed(2)}%)
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default StockTicker;

