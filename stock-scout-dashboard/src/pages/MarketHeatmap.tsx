import { useState, useEffect } from "react";
import DashboardNavbar from "@/components/DashboardNavbar";
import StockTicker from "@/components/StockTicker";
import { apiGetDiscovery, DiscoverySector } from "@/lib/api";
import { useNavigate } from "react-router-dom";
import { 
    TrendingUp, 
    TrendingDown, 
    Minus, 
    Info, 
    ArrowUpRight,
    Map
} from "lucide-react";
import { 
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip";
import { Badge } from "@/components/ui/badge";

const MarketHeatmap = () => {
    const [data, setData] = useState<DiscoverySector[]>([]);
    const [loading, setLoading] = useState(true);
    const navigate = useNavigate();

    useEffect(() => {
        loadHeatmap();
    }, []);

    const loadHeatmap = async () => {
        setLoading(true);
        try {
            const discovery = await apiGetDiscovery();
            setData(discovery);
        } catch (err) {
            console.error("Failed to load heatmap", err);
        } finally {
            setLoading(false);
        }
    };

    const getMoodColor = (score: number) => {
        if (score >= 1.0) return "bg-green-600 hover:bg-green-500 shadow-lg shadow-green-900/20";
        if (score >= 0.5) return "bg-green-500/60 hover:bg-green-500/80 shadow-md shadow-green-900/10";
        if (score <= -1.0) return "bg-red-600 hover:bg-red-500 shadow-lg shadow-red-900/20";
        if (score <= -0.5) return "bg-red-500/60 hover:bg-red-500/80 shadow-md shadow-red-900/10";
        return "bg-secondary hover:bg-secondary/80 border border-border";
    };

    const getMoodIcon = (mood: string) => {
        if (mood.includes("Very Bullish")) return <ArrowUpRight className="h-6 w-6 text-white" />;
        if (mood.includes("Bullish")) return <TrendingUp className="h-5 w-5 text-white/90" />;
        if (mood.includes("Very Bearish")) return <TrendingDown className="h-6 w-6 text-white" />;
        if (mood.includes("Bearish")) return <TrendingDown className="h-5 w-5 text-white/90" />;
        return <Minus className="h-5 w-5 text-muted-foreground" />;
    };

    return (
        <div className="min-h-screen bg-background text-foreground pb-20">
            <DashboardNavbar />
            <StockTicker />

            <main className="container mx-auto px-4 pt-24">
                <header className="mb-12">
                    <div className="flex items-center gap-2 mb-2">
                        <Map className="h-5 w-5 text-primary" />
                        <span className="text-sm font-semibold tracking-wider text-primary uppercase">Market Mood Heatmap</span>
                    </div>
                    <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                        <div>
                            <h1 className="text-4xl font-bold tracking-tight mb-2">Indian Sector Performance</h1>
                            <p className="text-muted-foreground max-w-xl">
                                Real-time AI sentiment and ROI aggregation across all Indian market sectors (.NS). 
                                Deep green indicates strong bullish momentum.
                            </p>
                        </div>
                        <div className="flex items-center gap-4 text-xs font-medium bg-secondary/30 p-3 rounded-2xl border border-border">
                            <div className="flex items-center gap-1.5"><div className="w-3 h-3 bg-green-600 rounded-sm"></div>Very Bullish</div>
                            <div className="flex items-center gap-1.5"><div className="w-3 h-3 bg-secondary rounded-sm border border-border"></div>Neutral</div>
                            <div className="flex items-center gap-1.5"><div className="w-3 h-3 bg-red-600 rounded-sm"></div>Very Bearish</div>
                        </div>
                    </div>
                </header>

                {loading ? (
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 animate-pulse">
                        {[1, 2, 3, 4, 5, 6, 7, 8].map(i => (
                            <div key={i} className="aspect-video bg-secondary/30 rounded-3xl border border-border"></div>
                        ))}
                    </div>
                ) : (
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                        {data.map((item) => (
                            <TooltipProvider key={item.sector}>
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <div 
                                            className={`${getMoodColor(item.mood_score)} aspect-video p-5 rounded-3xl transition-all duration-300 cursor-pointer group relative overflow-hidden flex flex-col justify-between`}
                                            onClick={() => navigate('/discovery')}
                                        >
                                            <div className="flex justify-between items-start">
                                                <h3 className="font-bold text-lg lg:text-xl text-white group-hover:scale-105 transition-transform origin-left drop-shadow-md">
                                                    {item.sector}
                                                </h3>
                                                <div className="p-1 bg-white/10 rounded-lg backdrop-blur-sm group-hover:bg-white/20 transition-colors">
                                                    {getMoodIcon(item.mood)}
                                                </div>
                                            </div>
                                            
                                            <div className="flex items-end justify-between">
                                                <div className="text-white/90">
                                                    <p className="text-[10px] font-bold uppercase tracking-wider opacity-70">Avg. ROI</p>
                                                    <p className="text-xl font-black">{item.avg_roi > 0 ? '+' : ''}{item.avg_roi}%</p>
                                                </div>
                                                <Badge variant="secondary" className="bg-white/10 hover:bg-white/20 border-none text-[10px] text-white backdrop-blur-sm">
                                                    {item.stocks.length} Stocks
                                                </Badge>
                                            </div>

                                            {/* Decorative Background Element */}
                                            <div className="absolute -bottom-4 -right-4 h-16 w-16 bg-white/10 blur-2xl group-hover:scale-150 transition-transform duration-500"></div>
                                        </div>
                                    </TooltipTrigger>
                                    <TooltipContent className="p-4 rounded-xl border-border bg-popover/90 backdrop-blur-md shadow-xl w-64">
                                        <div className="space-y-3">
                                            <div className="flex justify-between items-center">
                                                <p className="font-bold uppercase text-[10px] tracking-widest text-muted-foreground">Top Pick</p>
                                                <span className="text-green-500 font-bold text-xs">{item.top_pick?.roi}% ROI</span>
                                            </div>
                                            <div>
                                                <p className="font-bold text-sm">{item.top_pick?.name}</p>
                                                <p className="text-[10px] text-muted-foreground">{item.top_pick?.ticker}</p>
                                            </div>
                                            <div className="pt-2 border-t border-border flex items-center gap-2 text-[10px] text-muted-foreground italic">
                                                <Info className="h-3 w-3" />
                                                Click to view all {item.sector} stocks
                                            </div>
                                        </div>
                                    </TooltipContent>
                                </Tooltip>
                            </TooltipProvider>
                        ))}
                    </div>
                )}
            </main>
        </div>
    );
};

export default MarketHeatmap;
