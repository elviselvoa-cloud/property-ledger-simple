import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useOnboarding } from "@/contexts/OnboardingContext";
import { X, ArrowRight, BarChart3, Bell, FileText, Users, Home } from "lucide-react";

const TOUR_STEPS = [
  {
    title: "Dashboard Overview",
    description: "Your dashboard shows key metrics: total collected rent, outstanding payments, overdue invoices, and occupancy rates.",
    icon: BarChart3,
    highlight: "dashboard-stats",
  },
  {
    title: "Manage Properties",
    description: "Add, edit, and organize your rental properties. Track units, rent amounts, and occupancy status.",
    icon: Home,
    highlight: "properties-nav",
  },
  {
    title: "Tenant Management",
    description: "Maintain detailed tenant profiles with contact info, lease agreements, and payment history.",
    icon: Users,
    highlight: "tenants-nav",
  },
  {
    title: "Automated Invoicing",
    description: "Generate monthly invoices automatically. Track payment status and send reminders to tenants.",
    icon: FileText,
    highlight: "invoices-nav",
  },
  {
    title: "Stay Updated",
    description: "Receive notifications for rent reminders, payment confirmations, and overdue alerts.",
    icon: Bell,
    highlight: "notifications-nav",
  },
];

export default function OnboardingTour() {
  const { completeOnboarding, setVisible } = useOnboarding();
  const [currentTourStep, setCurrentTourStep] = React.useState(0);

  const current = TOUR_STEPS[currentTourStep];
  const CurrentIcon = current.icon;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-md">
        <CardContent className="p-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2">
              <div className="w-10 h-10 rounded-full bg-teal-100 flex items-center justify-center">
                <CurrentIcon className="w-5 h-5 text-teal-600" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Feature {currentTourStep + 1} of {TOUR_STEPS.length}</p>
                <h3 className="font-semibold text-foreground">{current.title}</h3>
              </div>
            </div>
            <button
              onClick={() => {
                completeOnboarding();
                setVisible(false);
              }}
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <p className="text-sm text-muted-foreground mb-6">{current.description}</p>

          <div className="flex gap-2 mb-4">
            {TOUR_STEPS.map((_, i) => (
              <div
                key={i}
                className={`h-1 flex-1 rounded-full transition-colors ${
                  i <= currentTourStep ? "bg-teal-600" : "bg-muted"
                }`}
              />
            ))}
          </div>

          <div className="flex gap-2">
            <Button
              variant="outline"
              className="flex-1"
              disabled={currentTourStep === 0}
              onClick={() => setCurrentTourStep(Math.max(0, currentTourStep - 1))}
            >
              Back
            </Button>
            {currentTourStep < TOUR_STEPS.length - 1 ? (
              <Button
                className="flex-1 bg-teal-600 hover:bg-teal-700"
                onClick={() => setCurrentTourStep(currentTourStep + 1)}
              >
                Next <ArrowRight className="w-4 h-4 ml-1" />
              </Button>
            ) : (
              <Button
                className="flex-1 bg-emerald-600 hover:bg-emerald-700"
                onClick={() => {
                  completeOnboarding();
                  setVisible(false);
                }}
              >
                Get Started
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

import React from "react";
