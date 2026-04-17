import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Building2, DoorOpen, Users, Receipt, TrendingUp, AlertCircle } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

const stats = [
  { label: "Properties", value: "0", icon: Building2, accent: "text-blue-500" },
  { label: "Total Units", value: "0", icon: DoorOpen, accent: "text-emerald-500" },
  { label: "Active Tenants", value: "0", icon: Users, accent: "text-violet-500" },
  { label: "Pending Invoices", value: "0", icon: Receipt, accent: "text-amber-500" },
];

export default function Index() {
  const { user } = useAuth();
  const name = user?.user_metadata?.full_name || user?.email?.split("@")[0] || "there";

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">
            Welcome back, {name} 👋
          </h2>
          <p className="text-muted-foreground text-sm">
            Here's an overview of your property portfolio.
          </p>
        </div>

        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
          {stats.map(({ label, value, icon: Icon, accent }) => (
            <Card key={label}>
              <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {label}
                </CardTitle>
                <Icon className={`h-4 w-4 ${accent}`} />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{value}</div>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <TrendingUp className="h-4 w-4 text-emerald-500" />
                Monthly Revenue
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">KES 0</div>
              <p className="text-xs text-muted-foreground mt-1">
                No payments recorded yet.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <AlertCircle className="h-4 w-4 text-amber-500" />
                Recent Activity
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                No activity yet. Add a property to get started.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
}
