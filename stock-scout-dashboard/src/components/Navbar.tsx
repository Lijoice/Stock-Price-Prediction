import { Link, useLocation } from "react-router-dom";
import Logo from "./Logo";
import { Button } from "./ui/button";

const Navbar = () => {
  const location = useLocation();

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-md border-b border-border">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          <Logo />

          <div className="flex items-center gap-8">
            <Link
              to="/"
              className={`nav-link ${location.pathname === "/" ? "nav-link-active" : ""}`}
            >
              Home
            </Link>

            <Link to="/auth">
              <Button variant="outline" className="border-primary text-primary hover:bg-primary hover:text-primary-foreground">
                Register / Login
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
