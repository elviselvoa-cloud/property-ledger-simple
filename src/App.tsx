import { Toaster } from "@/components/ui/sonner";
import { useAuth } from "@/hooks/useAuth";
import { Route, Switch, Redirect } from "wouter";
import Index from "./pages/Index";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import CaretakerSetPassword from "./pages/CaretakerSetPassword";
import Properties from "./pages/Properties";
import Units from "./pages/Units";
import Tenants from "./pages/Tenants";
import Leases from "./pages/Leases";
import Invoices from "./pages/Invoices";
import Payments from "./pages/Payments";
import Settings from "./pages/Settings";
import Caretakers from "./pages/Caretakers";
import Reports from "./pages/Reports";
import Expenses from "./pages/Expenses";
import Communications from "./pages/Communications";
import Landing from "./pages/Landing";

// Tab-key → route-path mapping
const TAB_ROUTE_MAP: Record<string, string> = {
  properties: "/properties",
  units: "/units",
  tenants: "/tenants",
  leases: "/leases",
  payments: "/payments",
  invoices: "/invoices",
  expenses: "/expenses",
  communications: "/communications",
  caretakers: "/caretakers",
  reports: "/reports",
  settings: "/settings",
};

function ProtectedRoute({ component: Component }: { component: React.ComponentType }) {
  const { user, loading, caretaker } = useAuth();
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }
  if (!user) return <Redirect to="/login" />;
  if (caretaker) return <Component />;
  return <Component />;
}

function GuestRoute({ component: Component }: { component: React.ComponentType }) {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }
  if (user) return <Redirect to="/dashboard" />;
  return <Component />;
}

function Router() {
  return (
    <Switch>
      <Route path="/login">{() => <GuestRoute component={Login} />}</Route>
      <Route path="/signup">{() => <GuestRoute component={Signup} />}</Route>
      <Route path="/forgot-password">{() => <GuestRoute component={ForgotPassword} />}</Route>
      <Route path="/reset-password" component={ResetPassword} />
      <Route path="/caretaker-set-password" component={CaretakerSetPassword} />
      <Route path="/dashboard">{() => <ProtectedRoute component={Index} />}</Route>
      <Route path="/properties">{() => <ProtectedRoute component={Properties} />}</Route>
      <Route path="/units">{() => <ProtectedRoute component={Units} />}</Route>
      <Route path="/tenants">{() => <ProtectedRoute component={Tenants} />}</Route>
      <Route path="/leases">{() => <ProtectedRoute component={Leases} />}</Route>
      <Route path="/invoices">{() => <ProtectedRoute component={Invoices} />}</Route>
      <Route path="/payments">{() => <ProtectedRoute component={Payments} />}</Route>
      <Route path="/expenses">{() => <ProtectedRoute component={Expenses} />}</Route>
      <Route path="/communications">{() => <ProtectedRoute component={Communications} />}</Route>
      <Route path="/caretakers">{() => <ProtectedRoute component={Caretakers} />}</Route>
      <Route path="/reports">{() => <ProtectedRoute component={Reports} />}</Route>
      <Route path="/settings">{() => <ProtectedRoute component={Settings} />}</Route>
      <Route path="/">{() => <Landing />}</Route>
      <Route>
        <div className="min-h-screen flex items-center justify-center">
          <h1 className="text-2xl font-semibold text-muted-foreground">Page not found</h1>
        </div>
      </Route>
    </Switch>
  );
}

export default function App() {
  return (
    <>
      <Toaster />
      <Router />
    </>
  );
}
