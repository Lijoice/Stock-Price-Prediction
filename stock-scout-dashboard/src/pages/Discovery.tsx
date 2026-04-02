import { useState, useEffect } from "react";
import DashboardNavbar from "@/components/DashboardNavbar";
import StockTicker from "@/components/StockTicker";
import { apiGetDiscovery, DiscoverySector, DiscoveryStock } from "@/lib/api";
import {
    Sparkles,
    AlertCircle,
    TrendingUp,
    TrendingDown,
    ChevronRight,
    Search,
    Filter
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Globe, Flag } from "lucide-react";

const Discovery = () => {
    const [data, setData] = useState<DiscoverySector[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedMarket, setSelectedMarket] = useState("indian");
    const navigate = useNavigate();

    useEffect(() => {
        loadDiscovery();
    }, [selectedMarket]);

    const loadDiscovery = async () => {
        setLoading(true);
        try {
            const discovery = await apiGetDiscovery(selectedMarket);
            setData(discovery);
        } catch (err) {
            console.error("Failed to load discovery data", err);
            toast.error(`Failed to load ${selectedMarket === 'indian' ? 'Indian' : 'US'} market data`);
        } finally {
            setLoading(false);
        }
    };

    const handlePredict = (ticker: string) => {
        navigate(`/results?symbol=${ticker}`);
    };

    const formatPrice = (val: number) => {
        const symbol = selectedMarket === "indian" ? "₹" : "$";
        const locale = selectedMarket === "indian" ? "en-IN" : "en-US";
        return `${symbol}${val.toLocaleString(locale, { minimumFractionDigits: 2 })}`;
    };

    return (
        <div className="min-h-screen bg-[#0a0a0f] text-foreground pb-20">
            <DashboardNavbar />
            <StockTicker />

            <main className="container mx-auto px-4 pt-24">
                <header className="mb-12 flex flex-col md:flex-row md:items-end justify-between gap-6">
                    <div>
                        <div className="flex items-center gap-2 mb-2">
                            <Sparkles className="h-5 w-5 text-indigo-500 animate-pulse" />
                            <span className="text-sm font-semibold tracking-wider text-indigo-500 uppercase">AI Market Hub</span>
                        </div>
                        <h1 className="text-4xl font-bold tracking-tight mb-2">
                            {selectedMarket === "indian" ? "Indian Sector Analysis" : "US Market Analysis"}
                        </h1>
                        <p className="text-muted-foreground text-lg max-w-2xl">
                            Consolidated view of the best performing {selectedMarket === "indian" ? "Indian" : "US"} stocks categorized by sector.
                            AI-driven discovery based on prediction ROI and market sentiment.
                        </p>
                    </div>
                    <div className="flex flex-col items-end gap-3">
                        <Tabs defaultValue="indian" onValueChange={setSelectedMarket} className="w-[300px]">
                            <TabsList className="grid w-full grid-cols-2 bg-indigo-500/10 border border-indigo-500/20">
                                <TabsTrigger value="indian" className="data-[state=active]:bg-indigo-500">
                                    <Flag className="h-4 w-4 mr-2" />
                                    NSE/BSE
                                </TabsTrigger>
                                <TabsTrigger value="us" className="data-[state=active]:bg-indigo-500">
                                    <Globe className="h-4 w-4 mr-2" />
                                    US Market
                                </TabsTrigger>
                            </TabsList>
                        </Tabs>
                        <Badge variant="outline" className="px-4 py-1.5 border-indigo-500/30 bg-indigo-500/10 text-indigo-400 capitalize">
                            {selectedMarket === "indian" ? "NSE/BSE Specialization" : "Global Equities (US)"}
                        </Badge>
                    </div>
                </header>

                {loading ? (
                    <div className="space-y-12 animate-pulse">
                        {[1, 2].map(i => (
                            <div key={i} className="space-y-4">
                                <div className="h-8 w-48 bg-secondary/30 rounded-lg"></div>
                                <div className="h-64 bg-secondary/20 rounded-2xl border border-border"></div>
                            </div>
                        ))}
                    </div>
                ) : data.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-24 text-center bg-secondary/10 rounded-3xl border border-dashed border-border">
                        <AlertCircle className="h-12 w-12 text-muted-foreground mb-4" />
                        <h3 className="text-xl font-semibold">No Market Data Available</h3>
                        <p className="text-muted-foreground">The AI engine is currently indexing {selectedMarket === 'indian' ? 'Indian' : 'US'} market sectors. Please wait.</p>
                    </div>
                ) : (
                    <div className="space-y-16">
                        {data.map((sectorData, sIdx) => (
                            <section
                                key={sectorData.sector}
                                className="space-y-6"
                            >
                                <div className="flex items-center justify-between border-b border-border/50 pb-4">
                                    <div className="flex items-center gap-3">
                                        <div className="h-2 w-8 bg-indigo-500 rounded-full"></div>
                                        <h2 className="text-2xl font-bold tracking-tight">{sectorData.sector}</h2>
                                        <Badge className="ml-2 bg-indigo-500/20 text-indigo-400 hover:bg-indigo-500/30 border-none">
                                            {sectorData.mood}
                                        </Badge>
                                    </div>
                                    <div className="text-sm text-muted-foreground">
                                        Sector Avg ROI: <span className="text-green-400 font-bold">+{sectorData.avg_roi}%</span>
                                    </div>
                                </div>

                                <div className="overflow-x-auto rounded-2xl border border-border bg-[#12121e]/50 backdrop-blur-sm">
                                    <table className="w-full text-left border-collapse">
                                        <thead>
                                            <tr className="bg-[#1a1a2e]/80 text-[11px] font-bold text-muted-foreground uppercase tracking-widest border-b border-border/50">
                                                <th className="px-6 py-4">Name</th>
                                                <th className="px-6 py-4 text-right">Value</th>
                                                <th className="px-6 py-4 text-right">Change</th>
                                                <th className="px-6 py-4 text-right">% Change</th>
                                                <th className="px-6 py-4 text-right">Open</th>
                                                <th className="px-6 py-4 text-right">High</th>
                                                <th className="px-6 py-4 text-right">Low</th>
                                                <th className="px-6 py-4 text-right">Prev</th>
                                                <th className="px-6 py-4 text-center">Action</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-border/30">
                                            {sectorData.stocks.map((stock) => (
                                                <tr
                                                    key={stock.ticker}
                                                    className="group hover:bg-white/[0.03] active:bg-white/[0.05] transition-colors cursor-pointer"
                                                    onClick={() => handlePredict(stock.ticker)}
                                                >
                                                    <td className="px-6 py-5">
                                                        <div className="flex flex-col">
                                                            <span className="font-bold text-indigo-400 group-hover:text-indigo-300 transition-colors">
                                                                {stock.ticker}
                                                            </span>
                                                            <span className="text-xs text-muted-foreground font-medium truncate max-w-[180px]">
                                                                {stock.name}
                                                            </span>
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-5 text-right font-bold tabular-nums">
                                                        {formatPrice(stock.current_price)}
                                                    </td>
                                                    <td className={`px-6 py-5 text-right font-semibold tabular-nums ${stock.change >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                                                        {stock.change >= 0 ? '+' : ''}{stock.change.toFixed(2)}
                                                    </td>
                                                    <td className={`px-6 py-5 text-right tabular-nums font-semibold`}>
                                                        <div className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs ${stock.change_percent >= 0 ? 'bg-green-500/10 text-green-500' : 'bg-red-500/10 text-red-500'}`}>
                                                            {stock.change_percent >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                                                            {Math.abs(stock.change_percent).toFixed(2)}%
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-5 text-right text-muted-foreground font-medium tabular-nums">
                                                        {formatPrice(stock.open)}
                                                    </td>
                                                    <td className="px-6 py-5 text-right text-muted-foreground font-medium tabular-nums">
                                                        {formatPrice(stock.high)}
                                                    </td>
                                                    <td className="px-6 py-5 text-right text-muted-foreground font-medium tabular-nums">
                                                        {formatPrice(stock.low)}
                                                    </td>
                                                    <td className="px-6 py-5 text-right text-muted-foreground font-medium tabular-nums font-semibold">
                                                        {formatPrice(stock.prev_close)}
                                                    </td>
                                                    <td className="px-6 py-5 text-center">
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            className="rounded-full hover:bg-indigo-500/20 text-muted-foreground hover:text-indigo-400"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                handlePredict(stock.ticker);
                                                            }}
                                                        >
                                                            <ChevronRight className="h-5 w-5" />
                                                        </Button>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </section>
                        ))}
                    </div>
                )}
            </main>
        </div>
    );
};

export default Discovery;
