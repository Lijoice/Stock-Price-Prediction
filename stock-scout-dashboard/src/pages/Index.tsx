import Navbar from "@/components/Navbar";
import StockTicker from "@/components/StockTicker";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import heroBg from "@/assets/hero-bg.jpg";
import { ArrowRight, BarChart3, Shield, Zap } from "lucide-react";

const Index = () => {
  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      {/* Hero Section */}
      <section
        className="relative min-h-screen flex items-center justify-center"
        style={{
          backgroundImage: `url(${heroBg})`,
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      >
        <div className="absolute inset-0 hero-overlay" />

        <div className="relative z-10 text-center px-4 animate-fade-in">
          <div className="inline-block mb-6 px-4 py-1.5 rounded-full border border-primary/30 bg-primary/10 backdrop-blur-sm">
            <span className="text-primary text-sm font-medium tracking-wide">
              AI-Powered Analytics
            </span>
          </div>
          <h1 className="font-display font-black text-4xl sm:text-5xl md:text-7xl lg:text-8xl mb-6 text-gradient-gold tracking-wider leading-tight">
            STOCK MARKET
            <br />
            PREDICTION
          </h1>
          <p className="text-lg md:text-2xl text-foreground/80 mb-12 max-w-2xl mx-auto font-light">
            Welcome to the future of investing — data-driven insights at your fingertips.
          </p>
          <Link to="/auth">
            <Button
              size="lg"
              className="bg-primary text-primary-foreground hover:bg-primary/90 font-semibold text-lg px-10 py-7 glow-gold group transition-all duration-300"
            >
              Get Started
              <ArrowRight className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform" />
            </Button>
          </Link>
        </div>

        {/* Scroll indicator */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 animate-bounce">
          <div className="w-6 h-10 rounded-full border-2 border-foreground/30 flex items-start justify-center p-1.5">
            <div className="w-1.5 h-2.5 rounded-full bg-primary" />
          </div>
        </div>
      </section>

      {/* Stock Ticker */}
      <StockTicker />

      {/* Features Section */}
      <section className="py-20 px-4">
        <div className="container mx-auto max-w-5xl">
          <h2 className="font-display text-2xl md:text-3xl text-center mb-4 text-gradient-gold">
            WHY STOCKVISION?
          </h2>
          <p className="text-center text-muted-foreground mb-16 max-w-xl mx-auto">
            Leverage cutting-edge machine learning models for smarter investment decisions.
          </p>
          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                icon: BarChart3,
                title: "ML Predictions",
                desc: "ARIMA, LSTM & Linear Regression models for accurate price forecasting.",
              },
              {
                icon: Shield,
                title: "Sentiment Analysis",
                desc: "Real-time social media sentiment tracking to gauge market mood.",
              },
              {
                icon: Zap,
                title: "Real-Time Data",
                desc: "Live stock prices and instant updates across global markets.",
              },
            ].map((feature) => (
              <div
                key={feature.title}
                className="card-financial p-6 text-center hover:border-primary/40 transition-colors duration-300 group"
              >
                <div className="w-14 h-14 rounded-xl bg-primary/10 flex items-center justify-center mx-auto mb-5 group-hover:bg-primary/20 transition-colors">
                  <feature.icon className="w-7 h-7 text-primary" />
                </div>
                <h3 className="font-display text-lg mb-3 text-foreground">{feature.title}</h3>
                <p className="text-muted-foreground text-sm leading-relaxed">{feature.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
};

export default Index;
