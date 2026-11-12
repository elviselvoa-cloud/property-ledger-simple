import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { signUp } from "@/lib/supabase-auth";
import { normalizePhone } from "@/lib/phone";
import { useState } from "react";
import { Link } from "wouter";
import { toast } from "sonner";

export default function Signup() {
  const [fullName, setFullName] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }
    if (password.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }
    const trimmedFullName = fullName.trim() || undefined;
    const trimmedEmail = email.trim().toLowerCase();
    const trimmedBusinessName = businessName.trim() || undefined;
    const normalizedPhone = normalizePhone(phone) || undefined;
    setLoading(true);
    const metadata = {
      full_name: trimmedFullName,
      business_name: trimmedBusinessName,
      phone: normalizedPhone,
    };
    const { error } = await signUp(trimmedEmail, password, metadata);
    setLoading(false);
    if (error) {
      toast.error(error.message);
    } else {
      setSent(true);
    }
  };

  const handleResend = async () => {
    setLoading(true);
    const trimmedEmail = email.trim().toLowerCase();
    const normalizedPhone = normalizePhone(phone) || undefined;
    const metadata = {
      full_name: fullName.trim() || undefined,
      business_name: businessName.trim() || undefined,
      phone: normalizedPhone,
    };
    const { error } = await signUp(trimmedEmail, password, metadata);
    setLoading(false);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Confirmation email resent!");
    }
  };

  if (sent) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4">
        <Card className="w-full max-w-md text-center">
          <CardHeader>
            <CardTitle>Check your email</CardTitle>
            <CardDescription>We sent a confirmation link to <strong>{email}</strong>. Click the link to activate your account.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3 pt-4">
            <Button variant="outline" onClick={handleResend} disabled={loading}>
              {loading ? "Sending..." : "Resend confirmation"}
            </Button>
            <Link href="/login" className="text-sm text-primary hover:underline">Back to login</Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold">Create Account</CardTitle>
          <CardDescription>Sign up for Property Ledger</CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="fullName">Full Name</Label>
              <Input id="fullName" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="John Doe" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="businessName">Business / Agency Name</Label>
              <Input id="businessName" value={businessName} onChange={(e) => setBusinessName(e.target.value)} placeholder="e.g. Sunrise Properties" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required placeholder="you@example.com" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Phone Number</Label>
              <Input id="phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="0712 345 678" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required placeholder="Password" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirm Password</Label>
              <Input id="confirmPassword" type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required placeholder="Confirm password" />
            </div>
          </CardContent>
          <CardFooter className="flex flex-col gap-3">
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Creating account..." : "Sign Up"}
            </Button>
            <Link href="/login" className="text-sm text-primary hover:underline">Already have an account? Sign in</Link>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
