const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:8000";

// --- Auth ---
export async function apiLogin(email: string, password: string) {
    const formData = new FormData();
    formData.append("username", email);
    formData.append("password", password);

    const res = await fetch(`${API_BASE}/auth/token`, {
        method: "POST",
        body: formData,
    });

    if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || "Login failed");
    }
    return res.json() as Promise<{ access_token: string; token_type: string }>;
}

export async function apiRegister(email: string, password: string) {
    const res = await fetch(`${API_BASE}/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
    });

    if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || "Registration failed");
    }
    return res.json() as Promise<{ message: string }>;
}

export async function apiVerifyEmail(email: string, code: string) {
    const res = await fetch(`${API_BASE}/auth/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, code }),
    });

    if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || "Verification failed");
    }
    return res.json() as Promise<{ message: string }>;
}

// --- Stock Data ---
export interface PredictionResponse {
    ticker: string;
    recommendation: "BUY" | "SELL" | "NEUTRAL";
    current_price: number;
    predictions: {
        arima: number[];
        lr: number[];
        lstm: number[];
        trans: number[];
        ensemble: number[];
        dates: string[];
        metrics?: {
            arima_rmse?: number;
            lstm_rmse?: number;
            lr_rmse?: number;
            trans_rmse?: number;
        };
    };
    pros_cons?: {
        pros: string[];
        cons: string[];
    };
}

export interface HistoryEntry {
    date: string;
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
}

export interface SentimentEntry {
    date: string;
    source: string;
    score: number;
    magnitude: number;
    text?: string;
    url?: string;
}

export async function fetchPrediction(ticker: string, force: boolean = false): Promise<PredictionResponse> {
    const res = await fetch(`${API_BASE}/predict/${ticker}${force ? "?force=true" : ""}`);
    if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || "Prediction failed");
    }
    return res.json();
}

export async function fetchHistory(ticker: string, days: number = 365): Promise<HistoryEntry[]> {
    const res = await fetch(`${API_BASE}/history/${ticker}?days=${days}`);
    if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || "Failed to fetch history");
    }
    return res.json();
}

export async function apiGetQuotes(symbols: string[]): Promise<any[]> {
    if (symbols.length === 0) return [];
    const tickerStr = symbols.join(",");
    const res = await fetch(`${API_BASE}/quotes?symbols=${tickerStr}`);
    if (!res.ok) {
        throw new Error("Failed to fetch quotes");
    }
    return res.json();
}

export interface SentimentResponse {
    summary: string;
    impact: string;
    feed: SentimentEntry[];
}

export async function fetchSentiment(ticker: string, force: boolean = false): Promise<SentimentResponse> {
    const res = await fetch(`${API_BASE}/sentiment/${ticker}${force ? "?force=true" : ""}`);
    if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || "Failed to fetch sentiment");
    }
    return res.json();
}

export async function triggerDataUpdate(ticker: string) {
    const res = await fetch(`${API_BASE}/update-data/${ticker}`, { method: "POST" });
    if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || "Update failed");
    }
    return res.json();
}

// --- Watchlist Data ---
function getAuthHeader() {
    // Assuming token is stored in localStorage by the AuthContext
    const token = localStorage.getItem("auth_token");
    return token ? { "Authorization": `Bearer ${token}` } : {};
}

export interface WatchlistEntry {
    ticker: string;
    added_date: string;
}

export async function apiGetWatchlist(): Promise<WatchlistEntry[]> {
    const res = await fetch(`${API_BASE}/watchlist`, {
        headers: getAuthHeader()
    });
    if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || "Failed to fetch watchlist");
    }
    return res.json();
}

export async function apiAddToWatchlist(ticker: string): Promise<{ message: string }> {
    const res = await fetch(`${API_BASE}/watchlist`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            ...getAuthHeader()
        },
        body: JSON.stringify({ ticker: ticker.toUpperCase() })
    });

    if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || "Failed to add to watchlist");
    }

    return res.json();
}

export async function apiRemoveFromWatchlist(ticker: string): Promise<{ message: string }> {
    const res = await fetch(`${API_BASE}/watchlist/${ticker.toUpperCase()}`, {
        method: "DELETE",
        headers: getAuthHeader()
    });
    if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || "Failed to remove from watchlist");
    }
    return res.json();
}

// --- Discovery Hub ---
export interface DiscoveryStock {
    ticker: string;
    name: string;
    industry: string;
    current_price: number;
    predicted_price: number;
    roi: number;
    impact: string;
    open: number;
    high: number;
    low: number;
    prev_close: number;
    change: number;
    change_percent: number;
}

export interface DiscoverySector {
    sector: string;
    stocks: DiscoveryStock[];
    top_pick: DiscoveryStock | null;
    avg_roi: number;
    mood: string;
    mood_score: number;
}

export async function apiGetDiscovery(market: string = "indian"): Promise<DiscoverySector[]> {
    const res = await fetch(`${API_BASE}/stocks/discovery?market=${market}`);
    if (!res.ok) {
        throw new Error("Failed to fetch discovery data");
    }
    return res.json();
}
