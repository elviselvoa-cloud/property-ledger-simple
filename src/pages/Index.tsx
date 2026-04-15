import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { signOut } from "@/lib/supabase-auth";
import { useLocation } from "wouter";
import { toast } from "sonner";

export default function Index() {
  const { user } = useAuth();
  const [, navigate] = useLocation();

  const handleLogout = async () => {
    const { error } = await signOut();
    if (error) {
      toast.error(error.message);
    } else {
      navigate("/login");
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background">
      <h1 className="text-4xl font-bold tracking-tight text-foreground mb-2">
        Property Ledger
      </h1>
      <p className="text-muted-foreground mb-6">
        Welcome, {user?.email}
      </p>
      <Button variant="outline" onClick={handleLogout}>
        Sign Out
      </Button>
    </div>
  );
}
