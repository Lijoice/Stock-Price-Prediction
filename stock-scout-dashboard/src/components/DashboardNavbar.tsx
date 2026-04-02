import { Link, useLocation, useNavigate } from "react-router-dom";
import Logo from "./Logo";
import { Button } from "./ui/button";
import { LogOut, User, Sun, Moon, ChevronDown } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { toast } from "sonner";
import { useTheme } from "next-themes";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar";

const DashboardNavbar = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { logout, userEmail } = useAuth();
  const { theme, setTheme } = useTheme();

  const handleLogout = () => {
    logout();
    toast.success("Signed out successfully");
    navigate("/");
  };

  const username = userEmail ? userEmail.split('@')[0] : "User";
  const initials = username.substring(0, 2).toUpperCase();

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-background/95 backdrop-blur-md border-b border-border">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          <Logo />

          <div className="flex items-center gap-6">
            <Link
              to="/dashboard"
              className={`nav-link text-sm whitespace-nowrap ${location.pathname === "/dashboard" ? "nav-link-active" : ""}`}
            >
              Dashboard
            </Link>

            <Link
              to="/discovery"
              className={`nav-link text-sm whitespace-nowrap ${location.pathname === "/discovery" ? "nav-link-active" : ""}`}
            >
              Market Hub
            </Link>




            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="relative h-10 w-full flex items-center gap-2 px-2 hover:bg-primary/10">
                  <Avatar className="h-8 w-8 border border-border">
                    <AvatarImage src="" alt={username} />
                    <AvatarFallback className="bg-primary/20 text-primary text-xs">{initials}</AvatarFallback>
                  </Avatar>
                  <div className="hidden md:flex flex-col items-start">
                    <span className="text-sm font-medium leading-none">{username}</span>
                  </div>
                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-56" align="end" forceMount>
                <DropdownMenuLabel className="font-normal">
                  <div className="flex flex-col space-y-1">
                    <p className="text-sm font-medium leading-none">{username}</p>
                    <p className="text-xs leading-none text-muted-foreground">
                      {userEmail}
                    </p>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleLogout} className="text-destructive focus:text-destructive cursor-pointer">
                  <LogOut className="mr-2 h-4 w-4" />
                  <span>Log out</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <Button
              variant="ghost"
              size="icon"
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              className="text-muted-foreground hover:text-foreground"
            >
              {theme === "dark" ? (
                <Sun className="h-[1.2rem] w-[1.2rem]" />
              ) : (
                <Moon className="h-[1.2rem] w-[1.2rem]" />
              )}
              <span className="sr-only">Toggle theme</span>
            </Button>
          </div>
        </div>
      </div>
    </nav>
  );
};

export default DashboardNavbar;

