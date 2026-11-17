import { useState, useEffect } from "react";
import { useSearchParams, Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { CheckCircle2, AlertCircle, Loader2 } from "lucide-react";

function getTokenFromUrl(): string | null {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");
  return token;
}

export default function CaretakerSetPassword() {
  const token = getTokenFromUrl();
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      setError("Invalid or missing invitation token.");
      return;
    }
    try {
      const decodedToken = decodeURIComponent(token);
      localStorage.setItem("caretaker_invite_token", decodedToken);
    } catch {
      setError("Invalid invitation link.");
    }
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) {
      setError("Missing invitation token.");
      return;
    }
    if (password.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }
    if (password !== confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }
    if (!email || !fullName.trim()) {
      toast.error("Email and name are required");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Step 1: Create auth user with the invited email
      const { data: authData, error: signUpErr } = await supabase.auth.signUp({
        email: email.toLowerCase(),
        password,
        options: {
          data: { full_name: fullName.trim(), role: "caretaker" },
          emailRedirectTo: `${window.location.origin}/caretaker-set-password?token=${encodeURIComponent(token)}`,
        },
      });

      if (signUpErr) throw signUpErr;

      // Step 2: Verify the invite token links to this email
      const storedToken = localStorage.getItem("caretaker_invite_token");
      if (!storedToken) {
        throw new Error("Invitation could not be verified. Please try again.");
      }

      // Fallback: manually verify by checking if caretaker has matching email
      const { data: caretaker } = await supabase
        .from("caretakers")
        .select("id, auth_user_id")
        .eq("email", email.toLowerCase())
        .eq("invite_token", storedToken)
        .maybeSingle();

      if (!caretaker) {
        throw new Error("Invitation could not be verified. Please check your email.");
      }

      // Link the newly created auth user to the caretaker
      await supabase
        .from("caretakers")
        .update({
          auth_user_id: authData.user?.id,
          account_created_at: new Date().toISOString(),
          invite_token: null,
        })
        .eq("email", email.toLowerCase());

      setSuccess(true);
    } catch (e: any) {
      setError(e.message ?? "Failed to complete setup.");
      toast.error(e.message ?? "Something went wrong.");
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4">
        <Card className="w-full max-w-md text-center">
          <CardHeader>
            <CheckCircle2 className="h-12 w-12 text-green-500 mx-auto mb-3" />
            <CardTitle>Account Created!</CardTitle>
            <CardDescription>
              Your caretaker account has been set up successfully. You can now sign in.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/login" className="text-sm text-primary hover:underline">
              Go to Sign In
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold">Set Up Your Account</CardTitle>
          <CardDescription>Complete your caretaker registration</CardDescription>
        </CardHeader>
        {error && (
          <div className="mx-6 mb-4 p-3 rounded-lg bg-destructive/10 text-destructive text-sm flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0" />
            {error}
          </div>
        )}
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="fullName">Full Name</Label>
              <Input
                id="fullName"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="John Kamau"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email Address</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="john@example.com"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="At least 6 characters"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirm Password</Label>
              <Input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirm your password"
                required
              />
            </div>
          </CardContent>
          <CardFooter className="flex flex-col gap-3">
            <Button type="submit" className="w-full" disabled={loading}>
              {loading && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
              {loading ? "Creating Account..." : "Create Account"}
            </Button>
            <Link href="/login" className="text-sm text-primary hover:underline text-center">
              Already have an account? Sign in
            </Link>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}