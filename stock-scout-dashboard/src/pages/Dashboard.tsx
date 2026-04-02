import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import DashboardNavbar from "@/components/DashboardNavbar";
import StockTicker from "@/components/StockTicker";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, TrendingUp, TrendingDown, Sparkles, Loader2 } from "lucide-react";
import { mockStocks, Stock } from "@/data/stocks";
import { getCurrencySymbol } from "@/lib/currency";
import { fetchHistory, apiGetQuotes } from "@/lib/api";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { LineChart, Line, XAxis, YAxis, ResponsiveContainer, Tooltip as RechartsTooltip } from "recharts";
import { apiGetWatchlist, WatchlistEntry } from "@/lib/api";

const Dashboard = () => {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");
  const [stocks, setStocks] = useState<Stock[]>([]);
  const [trendData, setTrendData] = useState<any[]>([]);
  const [period, setPeriod] = useState("1Y");
  const [loadingTrend, setLoadingTrend] = useState(false);
  const [watchlist, setWatchlist] = useState<WatchlistEntry[]>([]);
  const [loadingWatchlist, setLoadingWatchlist] = useState(false);
  const [loadingStocks, setLoadingStocks] = useState(true);

  useEffect(() => {
    if (isAuthenticated) {
      loadTrendData(period);
      loadWatchlist();
      loadRealStocks();
    }
  }, [period, isAuthenticated]);

  const loadRealStocks = async () => {
    setLoadingStocks(true);
    try {
      const symbols = mockStocks.map(s => s.symbol);
      const quotes = await apiGetQuotes(symbols);

      if (quotes && quotes.length > 0) {
        const merged = mockStocks.map(mock => {
          const real = quotes.find((q: any) => q.symbol === mock.symbol);
          return real ? { ...mock, ...real } : mock;
        });
        setStocks(merged);
      }
    } catch (err) {
      console.error("Failed to load real stock quotes", err);
    } finally {
      setLoadingStocks(false);
    }
  };

  const loadWatchlist = async () => {
    setLoadingWatchlist(true);
    try {
      const data = await apiGetWatchlist();
      setWatchlist(data);
    } catch (err) {
      console.error("Failed to load watchlist", err);
    } finally {
      setLoadingWatchlist(false);
    }
  }

  const loadTrendData = async (selectedPeriod: string) => {
    setLoadingTrend(true);
    let days = 365;
    if (selectedPeriod === "1D") days = 1;
    else if (selectedPeriod === "1M") days = 30;
    else if (selectedPeriod === "3M") days = 90;
    else if (selectedPeriod === "5Y") days = 1825;
    else if (selectedPeriod === "All") days = 3650;

    try {
      // Use S&P 500 as market benchmark
      const history = await fetchHistory("^GSPC", days);
      const formatted = history.map(h => ({
        date: new Date(h.date).toLocaleDateString('en-US', { month: 'short', day: days <= 31 ? 'numeric' : undefined }),
        value: h.close
      }));
      setTrendData(formatted);
    } catch (error) {
      console.error("Failed to fetch market trend:", error);
    } finally {
      setLoadingTrend(false);
    }
  };

  if (!isAuthenticated) {
    navigate("/auth");
    return null;
  }

  const handleSearch = () => {
    if (searchQuery.trim()) {
      navigate(`/results?symbol=${searchQuery.toUpperCase()}`);
    }
  };

  const handleRowClick = (symbol: string) => {
    navigate(`/results?symbol=${symbol}`);
  };

  const filteredStocks = stocks.filter(
    (stock) =>
      stock.symbol.toLowerCase().includes(searchQuery.toLowerCase()) ||
      stock.name.toLowerCase().includes(searchQuery.toLowerCase())
  );


  return (
    <div className="min-h-screen bg-background">
      <DashboardNavbar />
      <StockTicker />

      <main className="pt-24 px-4 pb-8">
        <div className="container mx-auto">
          {/* Search Bar with Predict Button */}
          <div className="flex gap-3 mb-8 max-w-2xl mx-auto">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Search for a stock symbol (e.g., AAPL, GOOGL)"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                className="bg-secondary/50 border-border pl-10 h-12 focus:border-primary"
              />
            </div>

            <Button
              onClick={handleSearch}
              className="bg-primary text-primary-foreground hover:bg-primary/90 h-12 px-6 glow-gold"
            >
              <Sparkles className="w-4 h-4 mr-2" />
              Predict
            </Button>
          </div>

          <div className="grid lg:grid-cols-3 gap-6">
            {/* Stock Table & Market Trend */}
            <div className="lg:col-span-2 space-y-6">
              {/* Market Trend Chart */}
              <div className="card-financial p-6">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h2 className="font-display text-sm text-primary tracking-wider uppercase">Market Trend (^GSPC)</h2>
                    <p className="text-[10px] text-muted-foreground uppercase mt-1">S&P 500 Index Performance</p>
                  </div>
                  <div className="flex gap-1.5">
                    {["1D", "1M", "3M", "1Y", "5Y", "All"].map((p) => (
                      <Button
                        key={p}
                        variant={period === p ? "default" : "ghost"}
                        size="sm"
                        onClick={() => setPeriod(p)}
                        className={`text-[10px] h-7 px-3 ${period === p ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}
                      >
                        {p}
                      </Button>
                    ))}
                  </div>
                </div>

                <div className="h-64 mt-4 relative">
                  {loadingTrend ? (
                    <div className="absolute inset-0 flex items-center justify-center bg-background/50 backdrop-blur-sm z-10 rounded-lg">
                      <Loader2 className="w-8 h-8 animate-spin text-primary" />
                    </div>
                  ) : trendData.length === 0 ? (
                    <div className="absolute inset-0 flex items-center justify-center border border-dashed border-border rounded-lg">
                      <p className="text-xs text-muted-foreground">No trend data available for this period.</p>
                    </div>
                  ) : null}

                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={trendData}>
                      <defs>
                        <linearGradient id="lineGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.1} />
                          <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <XAxis
                        dataKey="date"
                        stroke="hsl(var(--muted-foreground))"
                        fontSize={10}
                        tickLine={false}
                        axisLine={false}
                        minTickGap={30}
                      />
                      <YAxis
                        stroke="hsl(var(--muted-foreground))"
                        fontSize={10}
                        tickLine={false}
                        axisLine={false}
                        domain={['auto', 'auto']}
                        tickFormatter={(val) => val.toLocaleString()}
                      />
                      <RechartsTooltip
                        contentStyle={{
                          backgroundColor: "hsl(var(--secondary))",
                          border: "1px solid hsl(var(--border))",
                          borderRadius: "8px",
                          fontSize: "12px"
                        }}
                        itemStyle={{ color: "hsl(var(--primary))" }}
                      />
                      <Line
                        type="monotone"
                        dataKey="value"
                        stroke="hsl(var(--primary))"
                        strokeWidth={2}
                        dot={false}
                        activeDot={{ r: 4, strokeWidth: 0 }}
                        animationDuration={1000}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Stock Table */}
              <div className="card-financial overflow-hidden relative">
                {loadingStocks && (
                  <div className="absolute inset-0 flex items-center justify-center bg-background/70 backdrop-blur-sm z-10">
                    <div className="flex flex-col items-center gap-2">
                      <Loader2 className="w-8 h-8 animate-spin text-primary" />
                      <p className="text-xs text-muted-foreground">Loading live prices...</p>
                    </div>
                  </div>
                )}
                <div className="p-4 border-b border-border flex items-center justify-between">
                  <h2 className="font-display text-sm text-primary tracking-wider">MARKET OVERVIEW</h2>
                  <p className="text-xs text-muted-foreground">Click any stock to predict</p>
                </div>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="border-border hover:bg-transparent">
                        <TableHead className="text-muted-foreground text-xs uppercase tracking-wider">Name</TableHead>
                        <TableHead className="text-muted-foreground text-xs uppercase tracking-wider text-right">Value</TableHead>
                        <TableHead className="text-muted-foreground text-xs uppercase tracking-wider text-right">Change</TableHead>
                        <TableHead className="text-muted-foreground text-xs uppercase tracking-wider text-right">% Change</TableHead>
                        <TableHead className="text-muted-foreground text-xs uppercase tracking-wider text-right hidden md:table-cell">Open</TableHead>
                        <TableHead className="text-muted-foreground text-xs uppercase tracking-wider text-right hidden lg:table-cell">High</TableHead>
                        <TableHead className="text-muted-foreground text-xs uppercase tracking-wider text-right hidden lg:table-cell">Low</TableHead>
                        <TableHead className="text-muted-foreground text-xs uppercase tracking-wider text-right hidden md:table-cell">Prev</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredStocks.map((stock) => (
                        <TableRow
                          key={stock.symbol}
                          onClick={() => handleRowClick(stock.symbol)}
                          className="cursor-pointer border-border hover:bg-primary/5 transition-colors"
                        >
                          <TableCell className="font-semibold">
                            <div>
                              <span className="text-foreground">{stock.symbol}</span>
                              <p className="text-xs text-muted-foreground font-normal">{stock.name}</p>
                            </div>
                          </TableCell>
                          <TableCell className="text-right font-mono">
                            {getCurrencySymbol(stock.symbol)}{stock.value.toFixed(2)}
                          </TableCell>
                          <TableCell
                            className={`text-right font-mono ${stock.change >= 0 ? "stock-positive" : "stock-negative"
                              }`}
                          >
                            {stock.change >= 0 ? "+" : ""}
                            {stock.change.toFixed(2)}
                          </TableCell>
                          <TableCell
                            className={`text-right font-mono ${stock.changePercent >= 0 ? "stock-positive" : "stock-negative"
                              }`}
                          >
                            <span className="inline-flex items-center gap-1">
                              {stock.changePercent >= 0 ? (
                                <TrendingUp className="w-3 h-3" />
                              ) : (
                                <TrendingDown className="w-3 h-3" />
                              )}
                              {stock.changePercent >= 0 ? "+" : ""}
                              {stock.changePercent.toFixed(2)}%
                            </span>
                          </TableCell>
                          <TableCell className="text-right font-mono hidden md:table-cell">{getCurrencySymbol(stock.symbol)}{stock.open.toFixed(2)}</TableCell>
                          <TableCell className="text-right font-mono hidden lg:table-cell">{getCurrencySymbol(stock.symbol)}{stock.high.toFixed(2)}</TableCell>
                          <TableCell className="text-right font-mono hidden lg:table-cell">{getCurrencySymbol(stock.symbol)}{stock.low.toFixed(2)}</TableCell>
                          <TableCell className="text-right font-mono hidden md:table-cell">{getCurrencySymbol(stock.symbol)}{stock.prev.toFixed(2)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            </div>

            {/* Right Sidebar */}
            <div className="space-y-6">
              {/* My Watchlist */}
              <div className="card-financial p-5 space-y-2 flex-1 min-h-[400px]">
                <h3 className="font-display text-xs text-primary tracking-wider mb-3 flex items-center justify-between">
                  MY WATCHLIST
                  {loadingWatchlist && <Loader2 className="w-3 h-3 animate-spin" />}
                </h3>
                {watchlist.length === 0 && !loadingWatchlist ? (
                  <p className="text-sm text-muted-foreground text-center py-4 border border-dashed border-border rounded-lg">
                    Your watchlist is empty. <br /> Search and add stocks to track them here.
                  </p>
                ) : (
                  <div className="space-y-2 overflow-y-auto max-h-[500px] pr-2">
                    {watchlist.map((item) => {
                      // Find mock data for value/change if possible, otherwise placeholder
                      const stockInfo = stocks.find(s => s.symbol === item.ticker);
                      return (
                        <div
                          key={item.ticker}
                          onClick={() => handleRowClick(item.ticker)}
                          className="flex items-center justify-between p-3 rounded-lg bg-secondary/30 cursor-pointer hover:bg-secondary/60 transition-colors border border-transparent hover:border-border"
                        >
                          <div>
                            <p className="font-semibold text-sm">{item.ticker}</p>
                            <p className="text-[10px] text-muted-foreground">Added: {new Date(item.added_date).toLocaleDateString()}</p>
                          </div>
                          <div className="text-right">
                            {stockInfo ? (
                              <>
                                <p className="font-mono text-sm font-semibold">{getCurrencySymbol(item.ticker)}{stockInfo.value.toFixed(2)}</p>
                                <p
                                  className={`text-xs font-mono ${stockInfo.changePercent >= 0 ? "stock-positive" : "stock-negative"
                                    }`}
                                >
                                  {stockInfo.changePercent >= 0 ? "+" : ""}
                                  {stockInfo.changePercent.toFixed(2)}%
                                </p>
                              </>
                            ) : (
                              <p className="text-xs text-muted-foreground">Click to track</p>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
            {stocks.slice(0, 6).map((stock) => (
              <div
                key={stock.symbol}
                onClick={() => handleRowClick(stock.symbol)}
                className="flex flex-col justify-between p-4 rounded-lg bg-card border border-border cursor-pointer hover:bg-secondary/60 transition-all hover:scale-[1.02] shadow-sm"
              >
                <div className="mb-2">
                  <p className="font-display text-sm font-bold text-primary">{stock.symbol}</p>
                  <p className="text-[10px] text-muted-foreground truncate">{stock.name}</p>
                </div>
                <div className="flex justify-between items-end">
                  <p className="font-mono text-sm font-semibold">{getCurrencySymbol(stock.symbol)}{stock.value.toFixed(2)}</p>
                  <p
                    className={`text-xs font-mono font-bold ${stock.changePercent >= 0 ? "stock-positive" : "stock-negative"
                      }`}
                  >
                    {stock.changePercent >= 0 ? "+" : ""}
                    {stock.changePercent.toFixed(2)}%

                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
};

export default Dashboard;
