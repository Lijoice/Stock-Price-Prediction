export interface Stock {
  symbol: string;
  name: string;
  value: number;
  change: number;
  changePercent: number;
  open: number;
  high: number;
  low: number;
  prev: number;
}

export const mockStocks: Stock[] = [
  { symbol: "AAPL", name: "Apple Inc.", value: 353.63, change: -11.21, changePercent: -3.07, open: 364.41, high: 365.32, low: 353.02, prev: 364.84 },
  { symbol: "GOOGL", name: "Alphabet Inc.", value: 1362.54, change: -78.56, changePercent: -5.45, open: 1432.63, high: 1437.02, low: 1355.00, prev: 1441.10 },
  { symbol: "AMZN", name: "Amazon.com Inc.", value: 2692.87, change: -61.71, changePercent: -2.24, open: 2775.06, high: 2782.57, low: 2688.00, prev: 2754.58 },
  { symbol: "HDFCBANK.NS", name: "HDFC Bank Ltd.", value: 1055.60, change: 26.65, changePercent: 2.59, open: 1040.00, high: 1062.50, low: 1027.65, prev: 1028.95 },
  { symbol: "ICICIBANK.NS", name: "ICICI Bank Ltd.", value: 349.00, change: -2.15, changePercent: -0.61, open: 356.40, high: 358.40, low: 346.10, prev: 351.15 },
  { symbol: "MSFT", name: "Microsoft Corporation", value: 196.33, change: -4.01, changePercent: -2.00, open: 199.73, high: 199.89, low: 194.88, prev: 200.34 },
  { symbol: "JPM", name: "JPMorgan Chase & Co.", value: 92.59, change: -5.37, changePercent: -5.48, open: 95.11, high: 95.37, low: 92.00, prev: 97.96 },
  { symbol: "FB", name: "Meta Platforms Inc.", value: 216.08, change: -19.60, changePercent: -8.32, open: 232.64, high: 233.09, low: 215.40, prev: 235.68 },
  { symbol: "TWTR", name: "Twitter Inc.", value: 29.05, change: -2.32, changePercent: -7.40, open: 31.12, high: 31.32, low: 28.75, prev: 31.37 },
  { symbol: "ZEEL.NS", name: "Zee Entertainment", value: 176.20, change: 3.95, changePercent: 2.29, open: 174.95, high: 180.70, low: 174.20, prev: 172.25 },
  { symbol: "NTPC.NS", name: "NTPC Limited", value: 97.05, change: 0.85, changePercent: 0.88, open: 96.50, high: 97.40, low: 95.65, prev: 96.20 },
  { symbol: "COALINDIA.NS", name: "Coal India Limited", value: 141.95, change: 1.15, changePercent: 0.82, open: 140.80, high: 143.00, low: 139.60, prev: 140.80 },
  { symbol: "YESBANK.NS", name: "Yes Bank Ltd.", value: 26.75, change: -0.25, changePercent: -0.93, open: 27.05, high: 27.25, low: 26.60, prev: 27.00 },
];
