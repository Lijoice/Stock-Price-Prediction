import { useState } from "react";
import { useNavigate, Navigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { apiLogin, apiRegister, apiVerifyEmail } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import Logo from "@/components/Logo";
import { z } from "zod";
import { Lock, Mail, ShieldCheck } from "lucide-react";

const emailSchema = z.string().email("Please enter a valid email address");
const passwordSchema = z.string().min(6, "Password must be at least 6 characters");

const Auth = () => {
  const navigate = useNavigate();
  const { login, isAuthenticated } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);
  const [showVerify, setShowVerify] = useState(false);
  const [verifyEmail, setVerifyEmail] = useState("");

  // Redirect if already logged in
  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }

  const validateInputs = () => {
    try {
      emailSchema.parse(email);
      passwordSchema.parse(password);
      return true;
    } catch (error) {
      if (error instanceof z.ZodError) {
        toast.error(error.errors[0].message);
      }
      return false;
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateInputs()) return;

    setLoading(true);
    try {
      await apiRegister(email, password);
      toast.success("Account created! Check the backend console for your verification code.");
      setVerifyEmail(email);
      setShowVerify(true);
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateInputs()) return;

    setLoading(true);
    try {
      const data = await apiLogin(email, password);
      login(data.access_token, email);
      toast.success("Welcome back!");
      navigate("/dashboard");
    } catch (error: any) {
      if (error.message.includes("not verified")) {
        toast.error("Email not verified. Please verify first.");
        setVerifyEmail(email);
        setShowVerify(true);
      } else {
        toast.error(error.message);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!otp.trim()) {
      toast.error("Please enter the verification code");
      return;
    }

    setLoading(true);
    try {
      await apiVerifyEmail(verifyEmail, otp);
      toast.success("Email verified! You can now sign in.");
      setShowVerify(false);
      setOtp("");
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  // OTP Verification View
  if (showVerify) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-4 relative overflow-hidden">
        <div className="absolute top-1/4 -left-32 w-64 h-64 bg-primary/5 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 -right-32 w-64 h-64 bg-accent/5 rounded-full blur-3xl" />

        <div className="w-full max-w-md relative z-10 animate-fade-in">
          <div className="flex justify-center mb-10">
            <Logo />
          </div>

          <Card className="card-financial border-border/50 backdrop-blur-sm">
            <CardHeader className="text-center pb-2">
              <div className="mx-auto mb-3 w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                <ShieldCheck className="w-6 h-6 text-primary" />
              </div>
              <CardTitle className="font-display text-2xl text-gradient-gold">Verify Email</CardTitle>
              <CardDescription className="text-muted-foreground">
                Enter the code sent to <span className="text-primary font-mono">{verifyEmail}</span>
                <br />
                <span className="text-xs opacity-70">(Check backend console for code)</span>
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-4">
              <form onSubmit={handleVerify} className="space-y-5">
                <div className="space-y-2">
                  <Label htmlFor="otp" className="text-sm text-muted-foreground">Verification Code</Label>
                  <Input
                    id="otp"
                    type="text"
                    placeholder="Enter 6-digit code"
                    value={otp}
                    onChange={(e) => setOtp(e.target.value)}
                    maxLength={6}
                    className="bg-secondary/50 border-border text-center text-2xl tracking-[0.5em] font-mono focus:border-primary"
                  />
                </div>
                <Button
                  type="submit"
                  className="w-full bg-primary text-primary-foreground hover:bg-primary/90 glow-gold h-11 font-semibold"
                  disabled={loading}
                >
                  {loading ? "Verifying..." : "Verify Email"}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  className="w-full text-muted-foreground"
                  onClick={() => setShowVerify(false)}
                >
                  Back to Sign In
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // Sign In / Sign Up View
  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4 relative overflow-hidden">
      <div className="absolute top-1/4 -left-32 w-64 h-64 bg-primary/5 rounded-full blur-3xl" />
      <div className="absolute bottom-1/4 -right-32 w-64 h-64 bg-accent/5 rounded-full blur-3xl" />

      <div className="w-full max-w-md relative z-10 animate-fade-in">
        <div className="flex justify-center mb-10">
          <Logo />
        </div>

        <Card className="card-financial border-border/50 backdrop-blur-sm">
          <CardHeader className="text-center pb-2">
            <CardTitle className="font-display text-2xl text-gradient-gold">Welcome</CardTitle>
            <CardDescription className="text-muted-foreground">
              Sign in to access your dashboard
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-4">
            <Tabs defaultValue="signin" className="w-full">
              <TabsList className="grid w-full grid-cols-2 mb-6 bg-secondary/50">
                <TabsTrigger value="signin" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">Sign In</TabsTrigger>
                <TabsTrigger value="signup" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">Sign Up</TabsTrigger>
              </TabsList>

              <TabsContent value="signin">
                <form onSubmit={handleSignIn} className="space-y-5">
                  <div className="space-y-2">
                    <Label htmlFor="signin-email" className="text-sm text-muted-foreground">Email</Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input
                        id="signin-email"
                        type="email"
                        placeholder="you@example.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                        className="bg-secondary/50 border-border pl-10 focus:border-primary"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="signin-password" className="text-sm text-muted-foreground">Password</Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input
                        id="signin-password"
                        type="password"
                        placeholder="••••••••"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        className="bg-secondary/50 border-border pl-10 focus:border-primary"
                      />
                    </div>
                  </div>
                  <Button
                    type="submit"
                    className="w-full bg-primary text-primary-foreground hover:bg-primary/90 glow-gold h-11 font-semibold"
                    disabled={loading}
                  >
                    {loading ? "Signing in..." : "Sign In"}
                  </Button>
                </form>
              </TabsContent>

              <TabsContent value="signup">
                <form onSubmit={handleSignUp} className="space-y-5">
                  <div className="space-y-2">
                    <Label htmlFor="signup-email" className="text-sm text-muted-foreground">Email</Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input
                        id="signup-email"
                        type="email"
                        placeholder="you@example.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                        className="bg-secondary/50 border-border pl-10 focus:border-primary"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="signup-password" className="text-sm text-muted-foreground">Password</Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input
                        id="signup-password"
                        type="password"
                        placeholder="Min 6 characters"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        className="bg-secondary/50 border-border pl-10 focus:border-primary"
                      />
                    </div>
                  </div>
                  <Button
                    type="submit"
                    className="w-full bg-primary text-primary-foreground hover:bg-primary/90 glow-gold h-11 font-semibold"
                    disabled={loading}
                  >
                    {loading ? "Creating account..." : "Create Account"}
                  </Button>
                </form>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Auth;
