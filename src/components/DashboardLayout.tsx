import { ReactNode, useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import {
  LayoutDashboard,
  Building2,
  DoorOpen,
  Users,
  FileText,
  Receipt,
  Wallet,
  PiggyBank,
  MessageSquare,
  Settings,
  HardHat,
  BarChart3,
  LogOut,
  Menu,
  X,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { signOut } from "@/lib/supabase-auth";
import { toast } from "sonner";

// Tab definitions: key matches caretaker_permissions.tab_key
const NAV_ITEMS = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard, caretaker: false },
  { to: "/properties", label: "Properties", icon: Building2, caretaker: true },
  { to: "/units", label: "Units", icon: DoorOpen, caretaker: true },
  { to: "/tenants", label: "Tenants", icon: Users, caretaker: true },
  { to: "/leases", label: "Leases", icon: FileText, caretaker: true },
  { to: "/payments", label: "Payments", icon: Wallet, caretaker: false },
  { to: "/expenses", label: "Expenses", icon: PiggyBank, caretaker: false },
  { to: "/communications", label: "Communications", icon: MessageSquare, caretaker: false },
  { to: "/caretakers", label: "Caretakers", icon: HardHat, caretaker: false },
  { to: "/reports", label: "Reports", icon: BarChart3, caretaker: false },
  { to: "/settings", label: "Settings", icon: Settings, caretaker: false },
];

interface NavItemDef {
  to: string;
  label: string;
  icon: typeof LayoutDashboard;
  caretaker: boolean;
}

export default function DashboardLayout({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  const { user, caretaker } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [permissionsLoading, setPermissionsLoading] = useState(true);
  const [enabledTabs, setEnabledTabs] = useState<string[]>([]);

  // Fetch caretaker permissions when on a caretaker account
  useEffect(() => {
    if (!caretaker) return;
    (async () => {
      const { data, error } = await supabase
        .from("caretaker_permissions")
        .select("tab_key, enabled")
        .eq("caretaker_id", caretaker.id)
        .eq("enabled", true);
      if (!error) {
        setEnabledTabs((data ?? []).map((p: any) => p.tab_key));
      }
      setPermissionsLoading(false);
    })();
  }, [caretaker]);

  const handleLogout = async () => {
    const { error } = await signOut();
    if (error) toast.error(error.message);
    else window.location.href = "/login";
  };

  // Filter nav items based on whether user is a caretaker
  const getVisibleNavItems = () => {
    if (!caretaker || permissionsLoading) return NAV_ITEMS;
    // For caretakers, only show tabs they have permission for
    const visible = NAV_ITEMS.filter(
      (item) => !item.caretaker || enabledTabs.includes(item.to.replace("/", ""))
    );
    // Always include dashboard for caretakers
    return [{ ...NAV_ITEMS[0], to: "/" } as NavItemDef, ...visible];
  };

  const visibleItems = getVisibleNavItems();

  const NavList = () => (
    <nav className="flex-1 px-3 py-4 space-y-1">
      {visibleItems.map(({ to, label, icon: Icon }) => {
        const isActive = location === to || (to !== "/" && location.startsWith(to));
        return (
          <Link
            key={to}
            href={to}
            onClick={() => setMobileOpen(false)}
            className={cn(
              "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
              isActive
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
          >
            <Icon className="h-4 w-4" />
            {label}
          </Link>
        );
      })}
    </nav>
  );

  const SidebarInner = () => (
    <div className="flex h-full flex-col">
      <div className="px-6 py-5 border-b border-border">
        <h1 className="text-lg font-bold tracking-tight">Property Ledger</h1>
        <p className="text-xs text-muted-foreground mt-0.5">
          {caretaker ? "Caretaker Portal" : "Landlord Console"}
        </p>
      </div>
      <NavList />
      <div className="border-t border-border p-3 space-y-2">
        <div className="px-3 py-2 text-xs text-muted-foreground truncate">
          {user?.email}
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start gap-2"
          onClick={handleLogout}
        >
          <LogOut className="h-4 w-4" />
          Sign Out
        </Button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen flex w-full bg-background">
      {/* Desktop sidebar */}
      <aside className="hidden md:flex w-64 border-r border-border bg-card flex-col fixed inset-y-0 left-0">
        <SidebarInner />
      </aside>

      {/* Mobile sidebar */}
      {mobileOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex">
          <div
            className="fixed inset-0 bg-black/50"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="relative w-64 bg-card border-r border-border">
            <SidebarInner />
          </aside>
        </div>
      )}

      <div className="flex-1 md:ml-64 flex flex-col min-w-0">
        <header className="h-14 border-b border-border bg-card flex items-center px-4 gap-3 sticky top-0 z-30">
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden"
            onClick={() => setMobileOpen((v) => !v)}
          >
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </Button>
          <div className="font-semibold">
            {visibleItems.find((n) => n.to === location || (n.to !== "/" && location.startsWith(n.to)))?.label ?? "Dashboard"}
          </div>
        </header>
        <main className="flex-1 p-4 md:p-6">{children}</main>
      </div>
    </div>
  );
}
