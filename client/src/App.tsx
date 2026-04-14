import { Toaster } from "@/components/ui/sonner";
import { Route, Switch } from "wouter";
import Index from "./pages/Index";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Index} />
      <Route>
        <div className="min-h-screen flex items-center justify-center">
          <h1 className="text-2xl font-semibold text-muted-foreground">
            Page not found
          </h1>
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
