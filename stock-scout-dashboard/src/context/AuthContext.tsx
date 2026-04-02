import { createContext, useContext, useState, useEffect, ReactNode } from "react";

interface AuthContextType {
    token: string | null;
    userEmail: string | null;
    isAuthenticated: boolean;
    login: (token: string, email: string) => void;
    logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
    const [token, setToken] = useState<string | null>(() =>
        localStorage.getItem("auth_token")
    );
    const [userEmail, setUserEmail] = useState<string | null>(() =>
        localStorage.getItem("user_email")
    );

    const isAuthenticated = !!token;

    const login = (newToken: string, email: string) => {
        localStorage.setItem("auth_token", newToken);
        localStorage.setItem("user_email", email);
        setToken(newToken);
        setUserEmail(email);
    };

    const logout = () => {
        localStorage.removeItem("auth_token");
        localStorage.removeItem("user_email");
        setToken(null);
        setUserEmail(null);
    };

    return (
        <AuthContext.Provider value={{ token, userEmail, isAuthenticated, login, logout }}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const ctx = useContext(AuthContext);
    if (!ctx) throw new Error("useAuth must be used within AuthProvider");
    return ctx;
}
