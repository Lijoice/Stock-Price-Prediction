import { TrendingUp } from "lucide-react";
import { Link } from "react-router-dom";

interface LogoProps {
  className?: string;
}

const Logo = ({ className = "" }: LogoProps) => {
  return (
    <Link to="/" className={`flex items-center gap-2 ${className}`}>
      <div className="relative">
        <div className="w-10 h-10 bg-primary rounded-lg flex items-center justify-center glow-gold">
          <TrendingUp className="w-6 h-6 text-primary-foreground" />
        </div>
      </div>
      <span className="font-display font-bold text-xl text-gradient-gold">
        StockVision
      </span>
    </Link>
  );
};

export default Logo;
