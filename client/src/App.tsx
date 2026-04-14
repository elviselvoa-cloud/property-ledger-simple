import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import Home from "./pages/Home";
import Dashboard from "./pages/Dashboard";
import Properties from "./pages/Properties";
import Tenants from "./pages/Tenants";
import Leases from "./pages/Leases";
import Invoices from "./pages/Invoices";
import Payments from "./pages/Payments";
import Reports from "./pages/Reports";
import Subscription from "./pages/Subscription";
import Notifications from "./pages/Notifications";
import Documents from "./pages/Documents";
import Assistant from "./pages/Assistant";
import AdminPanel from "./pages/AdminPanel";
import Settings from "./pages/Settings";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/dashboard" component={Dashboard} />
      <Route path="/properties" component={Properties} />
      <Route path="/tenants" component={Tenants} />
      <Route path="/leases" component={Leases} />
      <Route path="/invoices" component={Invoices} />
      <Route path="/payments" component={Payments} />
      <Route path="/reports" component={Reports} />
      <Route path="/subscription" component={Subscription} />
      <Route path="/notifications" component={Notifications} />
      <Route path="/documents" component={Documents} />
      <Route path="/assistant" component={Assistant} />
      <Route path="/admin" component={AdminPanel} />
      <Route path="/settings" component={Settings} />
      <Route path="/404" component={NotFound} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light">
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
