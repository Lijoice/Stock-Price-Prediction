/**
 * Utility to determine the currency symbol based on the stock ticker.
 * Indian stocks typically end with .NS (NSE) or .BO (BSE).
 */
export const getCurrencySymbol = (symbol: string): string => {
    if (!symbol) return "$";
    const upperSymbol = symbol.toUpperCase();
    if (upperSymbol.endsWith(".NS") || upperSymbol.endsWith(".BO") || upperSymbol === "INR" || upperSymbol === "₹") {
        return "₹";
    }
    return "$";
};

/**
 * Formats a numeric value with the appropriate currency symbol.
 */
export const formatCurrency = (value: number, symbol: string): string => {
    const currencySymbol = getCurrencySymbol(symbol);
    return `${currencySymbol}${value.toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    })}`;
};
