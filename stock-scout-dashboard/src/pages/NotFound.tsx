import { useLocation, Link } from "react-router-dom";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Home } from "lucide-react";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="text-center animate-fade-in">
        <h1 className="font-display text-8xl font-black text-gradient-gold mb-4">404</h1>
        <p className="text-xl text-muted-foreground mb-8">
          This page doesn't exist
        </p>
        <Link to="/">
          <Button className="bg-primary text-primary-foreground hover:bg-primary/90 glow-gold">
            <Home className="w-4 h-4 mr-2" />
            Back to Home
          </Button>
        </Link>
      </div>
    </div>
  );
};

export default NotFound;
