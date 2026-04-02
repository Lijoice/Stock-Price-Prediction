import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { apiGetPortfolio, apiGetPortfolioHistory } from "@/lib/api";
import type { PortfolioResponse, TransactionEntry } from "@/lib/api";
import DashboardNavbar from "@/components/DashboardNavbar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency } from "@/lib/currency";
import {
  Loader2,
  TrendingUp,
  TrendingDown,
  Wallet,
  Briefcase,
  History,
  ArrowUpRight,
  ArrowDownRight,
  Clock
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  PieChart,
  Pie
} from "recharts";

const Portfolio = () => {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const [loading, setLoading] = useState(true);
  const [portfolio, setPortfolio] = useState<PortfolioResponse | null>(null);
  const [history, setHistory] = useState<TransactionEntry[]>([]);

  useEffect(() => {
    if (!isAuthenticated) {
      navigate("/auth");
      return;
    }
    loadData();
  }, [isAuthenticated]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [portData, histData] = await Promise.all([
        apiGetPortfolio(),
        apiGetPortfolioHistory()
      ]);
      setPortfolio(portData);
      setHistory(histData);
    } catch (err) {
      console.error("Failed to fetch portfolio:", err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <DashboardNavbar />
        <div className="flex items-center justify-center min-h-[80vh]">
          <Loader2 className="w-12 h-12 animate-spin text-primary" />
        </div>
      </div>
    );
  }

  const profitLoss = portfolio ? portfolio.total_market_value - portfolio.total_invested : 0;
  const plPercent = portfolio && portfolio.total_invested > 0
    ? (profitLoss / portfolio.total_invested) * 100
    : 0;

  const chartData = portfolio?.holdings.map(h => ({
    name: h.ticker,
    value: h.quantity * h.current_price
  })) || [];

  const COLORS = ['#D4AF37', '#C0C0C0', '#8E24AA', '#1E88E5', '#43A047', '#E53935'];

  return (
    <div className="min-h-screen bg-background text-foreground">
      <DashboardNavbar />

      <main className="pt-24 px-4 pb-12">
        <div className="container mx-auto max-w-6xl animate-fade-in">

          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-12">
            <div>
              <h1 className="text-4xl font-display text-gradient-gold mb-2">Virtual Portfolio</h1>
              <p className="text-muted-foreground text-lg">Manage your simulated investments and track performance.</p>
            </div>
            <div className="flex items-center">
              <div className="bg-blue-600 px-8 py-5 rounded-2xl shadow-xl shadow-blue-900/20 border border-blue-500/30 flex flex-col items-center justify-center min-w-[220px] transition-transform hover:scale-105 duration-300">
                <p className="text-[10px] uppercase font-bold text-blue-100/70 tracking-widest mb-1">Available Cash</p>
                <p className="text-3xl font-mono font-bold text-white tracking-tighter">
                  {formatCurrency(portfolio?.balance || 0, "INR")}
                </p>
              </div>
            </div>
          </div>

          {/* Overview Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
            <Card className="card-financial border-border/50 bg-secondary/10 backdrop-blur-md hover:border-primary/30 transition-all duration-300">
              <CardContent className="pt-8 pb-8 px-8">
                <div className="flex items-center gap-6">
                  <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center text-primary border border-primary/20 shadow-[0_0_20px_rgba(var(--primary-rgb),0.1)]">
                    <Wallet className="w-7 h-7" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground uppercase font-bold tracking-widest mb-1">Total Value</p>
                    <h2 className="text-3xl font-mono font-bold text-gradient-gold tracking-tight">
                      {formatCurrency(portfolio?.total_portfolio_value || 0, "INR")}
                    </h2>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="card-financial border-border/50 bg-secondary/10 backdrop-blur-md hover:border-green-500/30 transition-all duration-300">
              <CardContent className="pt-8 pb-8 px-8">
                <div className="flex items-center gap-6">
                  <div className="w-14 h-14 rounded-2xl bg-green-500/10 flex items-center justify-center text-green-500 border border-green-500/20 shadow-[0_0_20px_rgba(34,197,94,0.1)]">
                    <Briefcase className="w-7 h-7" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground uppercase font-bold tracking-widest mb-1">Invested Capital</p>
                    <h2 className="text-3xl font-mono font-bold tracking-tight text-foreground/90">
                      {formatCurrency(portfolio?.total_invested || 0, "INR")}
                    </h2>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="card-financial border-border/50 bg-secondary/10 backdrop-blur-md hover:border-accent/30 transition-all duration-300">
              <CardContent className="pt-8 pb-8 px-8">
                <div className="flex items-center gap-6">
                  <div className={`w-14 h-14 rounded-2xl flex items-center justify-center border shadow-inner transition-colors duration-300 ${profitLoss >= 0 ? "bg-green-500/10 text-green-500 border-green-500/20 shadow-[0_0_20px_rgba(34,197,94,0.1)]" : "bg-red-500/10 text-red-500 border-red-500/20 shadow-[0_0_20px_rgba(239,68,68,0.1)]"}`}>
                    {profitLoss >= 0 ? <TrendingUp className="w-7 h-7" /> : <TrendingDown className="w-7 h-7" />}
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground uppercase font-bold tracking-widest mb-1">Overall Profit/Loss</p>
                    <div className="flex items-baseline gap-2">
                      <h2 className={`text-3xl font-mono font-bold tracking-tight ${profitLoss >= 0 ? "text-green-500" : "text-red-500"}`}>
                        {profitLoss >= 0 ? "+" : ""}{formatCurrency(profitLoss, "INR")}
                      </h2>
                      <span className={`text-sm font-bold opacity-80 ${profitLoss >= 0 ? "text-green-500" : "text-red-500"}`}>
                        {plPercent.toFixed(2)}%
                      </span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="grid lg:grid-cols-3 gap-8">
            {/* Holdings Table */}
            <div className="lg:col-span-2 space-y-8">
              <Card className="card-financial border-border/50 bg-secondary/5">
                <CardHeader className="border-b border-border/50 pb-4">
                  <CardTitle className="text-sm uppercase text-muted-foreground font-display flex items-center gap-3 tracking-widest">
                    <div className="p-2 bg-primary/10 rounded-lg">
                      <Briefcase className="w-4 h-4 text-primary" />
                    </div>
                    Current Holdings
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  {portfolio?.holdings.length === 0 ? (
                    <div className="text-center py-20 px-6">
                      <div className="w-16 h-16 bg-secondary/20 rounded-full flex items-center justify-center mx-auto mb-4">
                        <Briefcase className="w-8 h-8 text-muted-foreground/40" />
                      </div>
                      <p className="text-muted-foreground text-lg font-medium">No virtual holdings yet</p>
                      <p className="text-sm text-muted-foreground/60 mb-6">Start trading from the Stock Hub or search</p>
                      <button onClick={() => navigate("/dashboard")} className="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-primary/20 text-primary hover:bg-primary/30 h-10 px-4 py-2 border border-primary/20">
                        Explore Market Hub
                      </button>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse">
                        <thead className="bg-secondary/20 transition-colors">
                          <tr>
                            <th className="px-6 py-4 text-[10px] text-muted-foreground uppercase font-black tracking-tighter">Ticker</th>
                            <th className="px-6 py-4 text-[10px] text-muted-foreground uppercase font-black tracking-tighter text-right">Qty</th>
                            <th className="px-6 py-4 text-[10px] text-muted-foreground uppercase font-black tracking-tighter text-right">Avg Price</th>
                            <th className="px-6 py-4 text-[10px] text-muted-foreground uppercase font-black tracking-tighter text-right">Market Price</th>
                            <th className="px-6 py-4 text-[10px] text-muted-foreground uppercase font-black tracking-tighter text-right">Profit/Loss</th>
                          </tr>
                        </thead>
                        <tbody>
                          {portfolio?.holdings.map((h, i) => (
                            <tr key={h.ticker} className="border-b border-border/50 hover:bg-primary/5 transition-all duration-200 cursor-pointer group" onClick={() => navigate(`/results?symbol=${h.ticker}`)}>
                              <td className="px-6 py-5 font-bold text-primary text-lg group-hover:pl-8 transition-all">{h.ticker}</td>
                              <td className="px-6 py-5 text-right font-mono font-medium">{h.quantity}</td>
                              <td className="px-6 py-5 text-right font-mono text-muted-foreground/80">{formatCurrency(h.average_price, "INR")}</td>
                              <td className="px-6 py-5 text-right font-mono font-bold">{formatCurrency(h.current_price, "INR")}</td>
                              <td className={`px-6 py-5 text-right font-mono font-bold ${h.p_l >= 0 ? "text-green-500" : "text-red-500"}`}>
                                <div className="flex flex-col items-end">
                                  <span className="flex items-center gap-1">
                                    {h.p_l >= 0 ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                                    {formatCurrency(h.p_l, "INR")}
                                  </span>
                                  <span className="text-[10px] opacity-60 font-medium">({h.p_l >= 0 ? "+" : ""}{h.p_l_percent.toFixed(2)}%)</span>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Recent Transactions */}
              <Card className="card-financial border-border/50 bg-secondary/5">
                <CardHeader className="border-b border-border/50 pb-4">
                  <CardTitle className="text-sm uppercase text-muted-foreground font-display flex items-center gap-3 tracking-widest">
                    <div className="p-2 bg-accent/10 rounded-lg">
                      <History className="w-4 h-4 text-accent" />
                    </div>
                    Transaction History
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-6">
                  {history.length === 0 ? (
                    <div className="text-center py-12">
                      <p className="text-muted-foreground font-medium italic opacity-50">No transaction history found.</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {history.slice(0, 6).map((txn, i) => (
                        <div key={i} className="flex items-center justify-between p-4 bg-background/40 rounded-2xl border border-border/50 hover:border-primary/20 transition-all">
                          <div className="flex items-center gap-4">
                            <div className={`w-10 h-10 rounded-full flex items-center justify-center ${txn.type === 'BUY' ? 'bg-green-500/10 text-green-500' : 'bg-red-500/10 text-red-500'}`}>
                              {txn.type === 'BUY' ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownRight className="w-4 h-4" />}
                            </div>
                            <div>
                              <p className="font-bold text-base tracking-tight">{txn.type} {txn.ticker}</p>
                              <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground/70 font-medium">
                                <Clock className="w-3 h-3" />
                                {new Date(txn.timestamp).toLocaleString()}
                              </div>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="text-sm font-mono font-bold text-foreground">{txn.quantity} Shared @ {formatCurrency(txn.price, "INR")}</p>
                            <p className="text-[10px] text-primary uppercase font-black opacity-80 mt-0.5">Total: {formatCurrency(txn.price * txn.quantity, "INR")}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Allocation Chart */}
            <div className="space-y-8">
              <Card className="card-financial border-border/50 bg-secondary/5 backdrop-blur-sm shadow-xl">
                <CardHeader className="border-b border-border/50 pb-4">
                  <CardTitle className="text-sm uppercase text-muted-foreground font-display tracking-widest">Asset Allocation</CardTitle>
                </CardHeader>
                <CardContent className="pt-8">
                  {chartData.length > 0 ? (
                    <>
                      <div className="h-[280px]">
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie
                              data={chartData}
                              cx="50%"
                              cy="50%"
                              innerRadius={70}
                              outerRadius={100}
                              paddingAngle={8}
                              dataKey="value"
                              labelLine={false}
                            >
                              {chartData.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} className="outline-none hover:opacity-80 transition-opacity" />
                              ))}
                            </Pie>
                            <Tooltip
                              contentStyle={{
                                backgroundColor: 'hsl(var(--card))',
                                borderColor: 'hsl(var(--border))',
                                borderRadius: '16px',
                                boxShadow: '0 10px 30px rgba(0,0,0,0.3)'
                              }}
                              itemStyle={{ fontWeight: 'bold' }}
                            />
                          </PieChart>
                        </ResponsiveContainer>
                      </div>
                      <div className="mt-8 space-y-3">
                        {chartData.map((item, i) => (
                          <div key={item.name} className="flex items-center justify-between p-2 rounded-lg hover:bg-secondary/20 transition-colors">
                            <div className="flex items-center gap-3">
                              <div className="w-2.5 h-2.5 rounded-full shadow-sm" style={{ backgroundColor: COLORS[i % COLORS.length] }}></div>
                              <span className="font-bold text-xs uppercase tracking-wider">{item.name}</span>
                            </div>
                            <span className="font-mono text-xs text-muted-foreground">{formatCurrency(item.value, "INR")}</span>
                          </div>
                        ))}
                      </div>
                    </>
                  ) : (
                    <div className="h-[280px] flex flex-col items-center justify-center text-center px-4">
                      <div className="w-16 h-16 bg-secondary/20 rounded-full flex items-center justify-center mb-4 opacity-30">
                        <TrendingUp className="w-8 h-8" />
                      </div>
                      <p className="text-muted-foreground text-sm italic">No holdings detected for allocation visualization.</p>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Stats Card */}
              <Card className="card-financial border-border/50 bg-gradient-to-br from-primary/5 to-transparent">
                <CardContent className="pt-6">
                  <p className="text-xs uppercase text-primary font-bold tracking-widest mb-4">Investment Insights</p>
                  <div className="space-y-4">
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Portfolio Concentration</p>
                      <p className="text-sm font-bold">
                        {portfolio?.holdings.length || 0} Stocks in {new Set(portfolio?.holdings.map(h => h.ticker)).size} unique positions
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Most Successful Bet</p>
                      <p className="text-sm font-bold text-green-500">
                        {portfolio?.holdings.length ? (
                          portfolio.holdings.reduce((prev, current) => (prev.p_l > current.p_l) ? prev : current).ticker
                        ) : "None yet"}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Portfolio;
