import { useEffect, useState, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { fetchPrediction, fetchHistory, fetchSentiment, triggerDataUpdate } from "@/lib/api";
import type { PredictionResponse, HistoryEntry, SentimentEntry } from "@/lib/api";
import DashboardNavbar from "@/components/DashboardNavbar";
import { getCurrencySymbol, formatCurrency } from "@/lib/currency";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  ResponsiveContainer,
  Legend,
  PieChart,
  Pie,
  Cell,
  CartesianGrid,
  Tooltip,
  AreaChart,
  Area,
} from "recharts";
import { ArrowUpRight, ArrowDownRight, Loader2, AlertTriangle, RefreshCw, Star, ShieldCheck, Quote } from "lucide-react";
import { apiGetWatchlist, apiAddToWatchlist, apiRemoveFromWatchlist } from "@/lib/api";
import { toast } from "sonner";

const Results = () => {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const [searchParams] = useSearchParams();
  const symbol = searchParams.get("symbol") || "AAPL";

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [prediction, setPrediction] = useState<PredictionResponse | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [sentiment, setSentiment] = useState<{ summary: string; impact: string; feed: SentimentEntry[] } | null>(null);
  const [isInWatchlist, setIsInWatchlist] = useState(false);
  const [watchListLoading, setWatchListLoading] = useState(false);

  if (!isAuthenticated) {
    navigate("/auth");
    return null;
  }

  useEffect(() => {
    loadData();
  }, [symbol]);

  const loadData = async (forceRefresh = false) => {
    setLoading(true);
    setError(null);
    try {
      if (forceRefresh) {
        await triggerDataUpdate(symbol);
      }

      const [histData, predData, sentData] = await Promise.allSettled([
        fetchHistory(symbol),
        fetchPrediction(symbol, forceRefresh),
        fetchSentiment(symbol, forceRefresh)
      ]);
      
      if (histData.status === "fulfilled") {
        setHistory(histData.value);
        if (histData.value.length === 0 && !forceRefresh) {
          console.log("History empty, retrying in 3s...");
          setTimeout(() => loadData(true), 3000);
        }
      }

      if (predData.status === "fulfilled") {
        setPrediction(predData.value);
      } else {
        console.error("Prediction failed:", predData.reason);
        setError(predData.reason?.message || "Failed to get predictions.");
      }

      if (sentData.status === "fulfilled") {
        setSentiment(sentData.value);
        // If summary is analyzing/missing and we haven't forced update, retry once
        if (!sentData.value.summary || sentData.value.summary.includes("Analyzing") || sentData.value.summary.includes("available yet")) {
          if (!forceRefresh) {
             console.log("Summary still analyzing, retrying in 5s...");
             setTimeout(() => loadData(true), 5000);
          }
        }
      }

      // Watchlist check
      try {
        const wl = await apiGetWatchlist();
        setIsInWatchlist(wl.some(w => w.ticker === symbol));
      } catch (err) {
        console.error("Could not fetch user data", err);
      }

    } catch (err: any) {
      setError(err.message || "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  const toggleWatchlist = async () => {
    setWatchListLoading(true);
    try {
      if (isInWatchlist) {
        await apiRemoveFromWatchlist(symbol);
        setIsInWatchlist(false);
      } else {
        await apiAddToWatchlist(symbol);
        setIsInWatchlist(true);
      }
    } catch (err) {
      console.error("Watchlist toggle failed", err);
    } finally {
      setWatchListLoading(false);
    }
  };

  // Derive chart data from history for Recharts AreaChart
  const historyChartData = history
    .filter(h => h && h.date && h.close !== undefined)
    .map(h => {
      let timeStr = String(h.date);
      if (timeStr.includes('T')) timeStr = timeStr.split('T')[0];
      return {
        date: timeStr.slice(0, 10),
        price: Number(h.close.toFixed(2)),
      };
    })
    .sort((a, b) => a.date.localeCompare(b.date));

  // Derive stat cards from last history entry
  const lastPrice = history.length > 0 ? history[history.length - 1] : null;
  const prevPrice = history.length > 1 ? history[history.length - 2] : null;

  const currentClose = lastPrice?.close ?? 0;
  const prevClose = prevPrice?.close ?? currentClose;
  const change = currentClose - prevClose;
  const changePercent = prevClose ? (change / prevClose) * 100 : 0;
  const isPositive = change >= 0;

  const statCards = lastPrice
    ? [
      { label: "Open", value: lastPrice.open.toFixed(2), variant: "blue" },
      { label: "High", value: lastPrice.high.toFixed(2), variant: "blue" },
      { label: "Low", value: lastPrice.low.toFixed(2), variant: "green" },
      { label: "Close", value: lastPrice.close.toFixed(2), variant: "red" },
      { label: "Volume", value: (lastPrice.volume / 1e6).toFixed(1) + "M", variant: "blue" },
      { label: "Prev Close", value: prevClose.toFixed(2), variant: "red" },
    ]
    : [];

  // Model accuracy: compare last N predictions vs actual (simulated from ensemble)
  const modelAccuracyData = prediction
    ? prediction.predictions.ensemble.map((pred, i) => ({
      x: i + 1,
      predicted: Number(pred.toFixed(2)),
      actual: Number(((pred * (1 + (Math.random() - 0.5) * 0.02))).toFixed(2)),
    }))
    : [];

  // Sentiment donut
  const sentimentSummary = (() => {
    if (!sentiment || sentiment.feed.length === 0) {
      return [
        { name: "Positive", value: 50, color: "hsl(142 76% 36%)" },
        { name: "Neutral", value: 30, color: "hsl(45 100% 51%)" },
        { name: "Negative", value: 20, color: "hsl(0 84% 60%)" },
      ];
    }
    const pos = sentiment.feed.filter((s) => s.score > 0.1).length;
    const neg = sentiment.feed.filter((s) => s.score < -0.1).length;
    const neu = sentiment.feed.length - pos - neg;
    const total = sentiment.feed.length;
    const chartData = [
      { name: "Positive", value: Number(((pos / total) * 100).toFixed(1)), color: "hsl(142 76% 36%)" },
      { name: "Neutral", value: Number(((neu / total) * 100).toFixed(1)), color: "hsl(45 100% 51%)" },
      { name: "Negative", value: Number(((neg / total) * 100).toFixed(1)), color: "hsl(0 84% 60%)" },
    ];
    // Filter out segments with 0% to prevent overlapping labels
    return chartData.filter(d => d.value > 0);
  })();

  const overallSentiment = sentiment?.impact || (sentimentSummary.length > 0 ? (sentimentSummary.reduce((prev, current) => (prev.value > current.value) ? prev : current).name) : "Neutral");

  // Predicted prices for Today + 7 days
  const predictedPrices = prediction
    ? prediction.predictions.dates.map((date, i) => ({
      day: i === 0 ? "Today" : `Day ${i}`,
      date,
      price: prediction.predictions.ensemble[i],
    }))
    : [];

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <DashboardNavbar />
        <main className="pt-20 px-4 pb-8">
          <div className="container mx-auto max-w-6xl flex flex-col items-center justify-center min-h-[60vh] gap-4">
            <Loader2 className="w-12 h-12 animate-spin text-primary" />
            <h2 className="text-xl font-display text-gradient-gold">Analyzing {symbol}...</h2>
            <p className="text-muted-foreground text-sm text-center max-w-md">
              Running ARIMA, LSTM, Linear Regression, and Transformer models. This may take 30-60 seconds for the first prediction.
            </p>
          </div>
        </main>
      </div>
    );
  }

  // Error state
  if (error && !prediction) {
    return (
      <div className="min-h-screen bg-background">
        <DashboardNavbar />
        <main className="pt-20 px-4 pb-8">
          <div className="container mx-auto max-w-6xl flex flex-col items-center justify-center min-h-[60vh] gap-4">
            <AlertTriangle className="w-12 h-12 text-destructive" />
            <h2 className="text-xl font-display text-foreground">Prediction Failed</h2>
            <p className="text-muted-foreground text-sm text-center max-w-md">{error}</p>
            <div className="flex gap-3">
              <Button onClick={() => loadData()} variant="outline" className="gap-2">
                <RefreshCw className="w-4 h-4" /> Retry
              </Button>
              <Button onClick={() => navigate("/dashboard")} className="bg-primary text-primary-foreground">
                Back to Dashboard
              </Button>
            </div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <DashboardNavbar />

      <main className="pt-20 px-4 pb-8">
        <div className="container mx-auto max-w-6xl animate-fade-in">
          {/* Header */}
          <div className="flex items-center gap-4 mb-8">
            <div>
              <div className="flex items-center gap-3">
                <h1 className="font-display text-2xl md:text-3xl text-gradient-gold">
                  {symbol}
                </h1>
                <Button
                  variant="ghost"
                  size="icon"
                  className={`rounded-full hover:bg-primary/20 transition-colors ${isInWatchlist ? "text-yellow-400 hover:text-yellow-500" : "text-muted-foreground hover:text-foreground"}`}
                  onClick={toggleWatchlist}
                  disabled={watchListLoading}
                >
                  {watchListLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Star className="w-5 h-5" fill={isInWatchlist ? "currentColor" : "none"} />}
                </Button>
              </div>
              <p className="text-muted-foreground text-sm">Prediction Results</p>
            </div>
            <div className="ml-auto text-right flex flex-col items-end gap-2">
              <span className={`inline-flex items-center gap-1 text-sm font-mono ${isPositive ? "stock-positive" : "stock-negative"}`}>
                {isPositive ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownRight className="w-4 h-4" />}
                {isPositive ? "+" : ""}{getCurrencySymbol(symbol)}{Math.abs(change).toFixed(2)} ({isPositive ? "+" : ""}{changePercent.toFixed(2)}%)
              </span>
            </div>
          </div>

          {/* Stats Cards */}
          {statCards.length > 0 && (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-8">
              {statCards.map((card) => (
                <div key={card.label} className={`stat-card-${card.variant} rounded-xl`}>
                  <p className="text-xl font-bold font-mono">{getCurrencySymbol(symbol)}{card.value}</p>
                  <p className="text-xs uppercase opacity-70 mt-1">{card.label}</p>
                </div>
              ))}
            </div>
          )}

          {/* Charts Grid */}
          <div className="grid md:grid-cols-2 gap-6 mb-8">
            {/* Trend Chart - TradingView */}
            {history.length > 0 && (
              <Card className="card-financial border-border/50 lg:col-span-2">
                <CardHeader className="pb-2">
                  <CardTitle className="text-xs uppercase text-muted-foreground tracking-wider font-display">
                    Interactive Historical Prices ({symbol})
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-80 w-full rounded-md overflow-hidden bg-background border border-border/50">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={historyChartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                        <defs>
                          <linearGradient id="colorPrice" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                            <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" fontSize={10} tickLine={false} axisLine={false} minTickGap={30} />
                        <YAxis stroke="hsl(var(--muted-foreground))" fontSize={10} tickLine={false} axisLine={false} domain={['auto', 'auto']} tickFormatter={(val) => `${getCurrencySymbol(symbol)}${val}`} />
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: "hsl(var(--card))",
                            border: "1px solid hsl(var(--border))",
                            borderRadius: "8px",
                            color: "hsl(var(--foreground))",
                          }}
                          labelStyle={{ color: "hsl(var(--muted-foreground))", marginBottom: "4px" }}
                          itemStyle={{ color: "hsl(var(--primary))", fontWeight: "bold" }}
                          formatter={(value: any) => [`${getCurrencySymbol(symbol)}${value}`, 'Close Price']}
                        />
                        <Area type="monotone" dataKey="price" stroke="hsl(var(--primary))" strokeWidth={2} fillOpacity={1} fill="url(#colorPrice)" />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Model Accuracy Charts */}
            {prediction && ["ARIMA", "LSTM", "Linear Regression", "Transformer"].map((model) => {
              const key = model === "ARIMA" ? "arima" : model === "LSTM" ? "lstm" : model === "Linear Regression" ? "lr" : "trans";
              const preds = prediction.predictions[key as keyof typeof prediction.predictions] as number[];
              const chartData = preds.map((pred, i) => ({
                day: i === 0 ? "Today" : `Day ${i}`,
                predicted: Number(pred.toFixed(2)),
              }));

              return (
                <Card key={model} className="card-financial border-border/50">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-xs uppercase text-muted-foreground tracking-wider font-display">
                      {model} Model Predictions
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="h-56">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={chartData}>
                          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                          <XAxis dataKey="day" stroke="hsl(var(--muted-foreground))" fontSize={10} tickLine={false} axisLine={false} />
                          <YAxis stroke="hsl(var(--muted-foreground))" fontSize={10} tickLine={false} axisLine={false} domain={["dataMin - 2", "dataMax + 2"]} />
                          <Tooltip
                            contentStyle={{
                              backgroundColor: "hsl(var(--card))",
                              border: "1px solid hsl(var(--border))",
                              borderRadius: "8px",
                              color: "hsl(var(--foreground))",
                            }}
                          />
                          <Legend wrapperStyle={{ fontSize: "11px" }} />
                          <Line type="monotone" dataKey="predicted" stroke="hsl(var(--stock-positive))" strokeWidth={2} name={`${model} Prediction`} dot={{ r: 3 }} />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {/* Pros and Cons - Temporarily Disabled
          {prediction?.pros_cons && (
            <div className="mb-8">
              <div className="grid md:grid-cols-2 gap-6">
                <Card className="border-green-500/20 bg-green-500/5 shadow-sm">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-xs uppercase text-green-500 tracking-widest font-display font-bold">
                      PROS
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-3">
                      {prediction.pros_cons.pros.map((pro, i) => (
                        <li key={i} className="text-sm flex gap-2 text-foreground/90 leading-relaxed">
                          <span className="text-green-500 mt-1">•</span>
                          {pro}
                        </li>
                      ))}
                      {prediction.pros_cons.pros.length === 0 && <li className="text-sm text-muted-foreground italic">No specific pros identified.</li>}
                    </ul>
                  </CardContent>
                </Card>

                <Card className="border-red-500/20 bg-red-500/5 shadow-sm">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-xs uppercase text-red-500 tracking-widest font-display font-bold">
                      CONS
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-3">
                      {prediction.pros_cons.cons.map((con, i) => (
                        <li key={i} className="text-sm flex gap-2 text-foreground/90 leading-relaxed">
                          <span className="text-red-500 mt-1">•</span>
                          {con}
                        </li>
                      ))}
                      {prediction.pros_cons.cons.length === 0 && <li className="text-sm text-muted-foreground italic">No specific cons identified.</li>}
                    </ul>
                  </CardContent>
                </Card>
              </div>
              <p className="text-[10px] text-muted-foreground mt-3 ml-1 flex items-center gap-1">
                * The pros and cons are machine generated. <span className="opacity-50">ⓘ</span>
              </p>
            </div>
          )}
          */}

          {prediction && (
            <div className="space-y-4 mb-8">
              <div className="p-4 rounded-xl bg-gradient-to-r from-primary/20 to-primary/5 border border-primary/30 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-primary/20 rounded-lg">
                    <ShieldCheck className="w-6 h-6 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-display text-sm font-bold text-primary uppercase tracking-tight">Most Reliable Prediction</h3>
                    <p className="text-xl font-mono font-bold">{getCurrencySymbol(symbol)}{(prediction.predictions.ensemble[0] ?? 0).toFixed(2)}</p>
                  </div>
                </div>
                <div className="text-right">
                  <span className="px-2 py-1 bg-primary text-primary-foreground text-[10px] font-bold rounded uppercase">Ensemble Model</span>
                  <p className="text-[10px] text-muted-foreground mt-1">Today's Optimized Forecast</p>
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {[
                  { model: "ARIMA", price: prediction.predictions.arima[0]?.toFixed(2) ?? "N/A", variant: "blue" },
                  { model: "LSTM", price: prediction.predictions.lstm[0]?.toFixed(2) ?? "N/A", variant: "green" },
                  { model: "Transformer", price: prediction.predictions.trans[0]?.toFixed(2) ?? "N/A", variant: "indigo" },
                  { model: "Linear Reg", price: prediction.predictions.lr[0]?.toFixed(2) ?? "N/A", variant: "red" },
                ].map((pred) => (
                  <div key={pred.model} className={`stat-card-${pred.variant} rounded-xl`}>
                    <p className="text-2xl font-bold font-mono">{getCurrencySymbol(symbol)}{pred.price}</p>
                    <p className="text-xs uppercase opacity-70 mt-1">Today's {symbol} by {pred.model}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* RMSE Cards */}
          {prediction?.predictions.metrics && (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-8">
              {[
                { model: "ARIMA", rmse: prediction.predictions.metrics.arima_rmse?.toFixed(2) ?? "N/A", variant: "blue" },
                { model: "LSTM", rmse: prediction.predictions.metrics.lstm_rmse?.toFixed(2) ?? "N/A", variant: "green" },
                { model: "Transformer", rmse: prediction.predictions.metrics.trans_rmse?.toFixed(2) ?? "N/A", variant: "indigo" },
                { model: "Linear Regression", rmse: prediction.predictions.metrics.lr_rmse?.toFixed(2) ?? "N/A", variant: "red" },
              ].map((item) => (
                <div key={item.model} className={`stat-card-${item.variant} rounded-xl`}>
                  <p className="text-2xl font-bold font-mono">{item.rmse}</p>
                  <p className="text-xs uppercase opacity-70 mt-1">{item.model} RMSE</p>
                </div>
              ))}
            </div>
          )}

          {/* Bottom Section */}
          <div className="grid md:grid-cols-2 gap-6">
            {/* Sentiment Analysis */}
            <Card className="card-financial border-border/50">
              <CardHeader className="pb-2">
                <CardTitle className="text-xs uppercase text-muted-foreground tracking-wider font-display">
                  Sentiment Analysis for {symbol}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-64 flex items-center justify-center">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={sentimentSummary}
                        cx="50%"
                        cy="50%"
                        innerRadius={55}
                        outerRadius={85}
                        dataKey="value"
                        label={({ name, value }) => `${name}: ${value}%`}
                        labelLine={false}
                        strokeWidth={0}
                      >
                        {sentimentSummary.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "hsl(var(--card))",
                          border: "1px solid hsl(var(--border))",
                          borderRadius: "8px",
                          color: "hsl(var(--foreground))",
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="mt-4">
                  <div className={`stat-card-${overallSentiment === "Positive" ? "green" : overallSentiment === "Negative" ? "red" : "blue"} rounded-xl`}>
                    <p className="text-lg font-bold">Overall {overallSentiment}</p>
                    <p className="text-xs uppercase opacity-70">Sentiment Polarity</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Predicted Prices */}
            <Card className="card-financial border-border/50">
              <CardHeader className="pb-2">
                <CardTitle className="text-xs uppercase text-muted-foreground tracking-wider font-display">
                  Predicted {symbol} Price — Next 7 Days
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-hidden rounded-lg border border-border">
                  <table className="w-full">
                    <thead>
                      <tr className="bg-secondary/30">
                        <th className="text-left py-2.5 px-4 text-xs text-muted-foreground uppercase tracking-wider">Day</th>
                        <th className="text-right py-2.5 px-4 text-xs text-muted-foreground uppercase tracking-wider">Date</th>
                        <th className="text-right py-2.5 px-4 text-xs text-primary uppercase tracking-wider">Close</th>
                      </tr>
                    </thead>
                    <tbody>
                      {predictedPrices.map((item) => (
                        <tr key={item.day} className="border-t border-border/50 hover:bg-secondary/20 transition-colors">
                          <td className="py-2.5 px-4 text-sm font-medium">{item.day}</td>
                          <td className="text-right py-2.5 px-4 text-sm text-muted-foreground font-mono">{item.date}</td>
                          <td className="text-right py-2.5 px-4 font-mono text-sm">{getCurrencySymbol(symbol)}{item.price.toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {prediction && (
                  <div className={`mt-4 stat-card-${prediction.recommendation === "BUY" ? "green" : prediction.recommendation === "SELL" ? "red" : "blue"} rounded-xl text-center`}>
                    <p className="text-sm font-medium">
                      AI Outlook: <strong className="text-lg">{prediction.recommendation}</strong>
                      {prediction.recommendation === "BUY" && <span className="ml-2">↑ (Bullish)</span>}
                      {prediction.recommendation === "SELL" && <span className="ml-2">↓ (Bearish)</span>}
                      {prediction.recommendation === "NEUTRAL" && <span className="ml-2">↔ (Stable)</span>}
                    </p>
                    <p className="text-[10px] uppercase opacity-70 mt-1">Geopolitical & ML Recommendation</p>
                  </div>
                )}
              </CardContent>
            </Card>

          </div>

          {/* Expert Summary */}
          <div className="mt-8">
            <Card className="card-financial border-border/50">
              <CardHeader className="pb-2">
                <CardTitle className="text-xs uppercase text-primary tracking-wider font-display flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4" />
                    AI Expert Analysis & Summary
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={() => loadData(true)}
                    title="Refresh Analysis"
                  >
                    <RefreshCw className={`w-3 h-3 ${loading ? "animate-spin" : ""}`} />
                  </Button>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="p-5 rounded-xl bg-primary/5 border border-primary/20 relative overflow-hidden">
                  <div className="absolute top-0 right-0 p-3 opacity-10">
                    <Quote className="w-12 h-12" />
                  </div>
                  <h4 className="text-sm font-semibold text-primary mb-3 flex items-center gap-2">
                    Main News & Market Sentiment
                  </h4>
                  <div className="text-sm leading-relaxed text-foreground/90 whitespace-pre-line">
                    {(sentiment?.summary || "Analyzing latest market signals...").split('\n').map((line, idx) => {
                      const trimmed = line.trim();
                      if (!trimmed) return <br key={idx} />;
                      if (trimmed.startsWith('•') || trimmed.startsWith('-')) {
                        return (
                          <div key={idx} className="ml-2 my-1 flex gap-2">
                            <span className="text-primary flex-shrink-0">{trimmed.charAt(0)}</span>
                            <span>{trimmed.slice(1).trim()}</span>
                          </div>
                        );
                      }
                      return <p key={idx} className="my-1">{trimmed}</p>;
                    })}
                  </div>
                </div>

                <div className="grid sm:grid-cols-2 gap-4">
                  <div className={`p-4 rounded-xl border flex flex-col justify-center ${overallSentiment === "Positive" ? "bg-green-500/10 border-green-500/20" : overallSentiment === "Negative" ? "bg-red-500/10 border-red-500/20" : "bg-blue-500/10 border-blue-500/20"}`}>
                    <p className="text-[10px] uppercase text-muted-foreground font-bold tracking-widest mb-1">Market Impact</p>
                    <div className="flex items-center gap-2">
                      <span className={`text-xl font-bold ${overallSentiment === "Positive" ? "text-green-500" : overallSentiment === "Negative" ? "text-red-500" : "text-blue-500"}`}>
                        {overallSentiment}
                      </span>
                      {overallSentiment === "Positive" ? <ArrowUpRight className="w-5 h-5 text-green-500" /> : overallSentiment === "Negative" ? <ArrowDownRight className="w-5 h-5 text-red-500" /> : <RefreshCw className="w-4 h-4 text-blue-500" />}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Results;
