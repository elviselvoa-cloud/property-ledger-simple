import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useOnboarding } from "@/contexts/OnboardingContext";
import { Building2, TrendingUp, Users, FileText, CheckCircle2 } from "lucide-react";

export default function OnboardingWelcome() {
  const { setCurrentStep, setStatus } = useOnboarding();

  const features = [
    { icon: Building2, title: "Manage Properties", desc: "Add and organize your rental portfolio" },
    { icon: Users, title: "Tenant Management", desc: "Track tenant profiles and lease agreements" },
    { icon: FileText, title: "Automated Invoicing", desc: "Generate and track monthly rent invoices" },
    { icon: TrendingUp, title: "Financial Reports", desc: "Gain insights into your rental income" },
  ];

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-2xl">
        <CardContent className="p-6 sm:p-8">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-teal-100 rounded-full mb-4">
              <Building2 className="w-8 h-8 text-teal-600" />
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold text-foreground mb-2">Welcome to Property Ledger</h1>
            <p className="text-muted-foreground">Your all-in-one rental management platform. Let's get you set up in 5 minutes.</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
            {features.map((feature, i) => (
              <div key={i} className="flex gap-3 p-3 rounded-lg bg-muted/50">
                <feature.icon className="w-5 h-5 text-teal-600 shrink-0 mt-0.5" />
                <div className="text-left">
                  <p className="font-semibold text-sm text-foreground">{feature.title}</p>
                  <p className="text-xs text-muted-foreground">{feature.desc}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4 mb-6">
            <div className="flex gap-2">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-emerald-900">Quick Setup Included</p>
                <p className="text-xs text-emerald-800 mt-0.5">We'll guide you through adding your first property, tenant, and lease in just a few steps.</p>
              </div>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => {
                setStatus("skipped");
              }}
            >
              Skip for Now
            </Button>
            <Button
              className="flex-1 bg-teal-600 hover:bg-teal-700"
              onClick={() => {
                setStatus("in_progress");
                setCurrentStep("business_info");
              }}
            >
              Start Setup
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
