import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useOnboarding } from "@/contexts/OnboardingContext";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { useState } from "react";
import { ChevronRight, ChevronLeft, CheckCircle2 } from "lucide-react";

const STEPS = [
  { id: "business_info", title: "Business Information", icon: "🏢" },
  { id: "first_property", title: "Add Your First Property", icon: "🏠" },
  { id: "first_tenant", title: "Add Your First Tenant", icon: "👤" },
  { id: "first_lease", title: "Create Your First Lease", icon: "📋" },
  { id: "tour", title: "Feature Tour", icon: "🎯" },
];

export default function OnboardingSetupWizard() {
  const { currentStep, setCurrentStep, markStepComplete, completeOnboarding } = useOnboarding();
  const [businessName, setBusinessName] = useState("");
  const [phone, setPhone] = useState("");
  const [propertyName, setPropertyName] = useState("");
  const [propertyAddress, setPropertyAddress] = useState("");
  const [tenantFirstName, setTenantFirstName] = useState("");
  const [tenantLastName, setTenantLastName] = useState("");
  const [tenantEmail, setTenantEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const utils = trpc.useUtils();
  const updateLandlordMutation = trpc.landlord.update.useMutation();
  const createPropertyMutation = trpc.properties.create.useMutation();
  const createTenantMutation = trpc.tenants.create.useMutation();

  const currentStepIndex = STEPS.findIndex((s) => s.id === currentStep);

  const handleNext = async () => {
    setIsLoading(true);
    try {
      if (currentStep === "business_info") {
        if (!businessName.trim()) {
          toast.error("Please enter your business name");
          setIsLoading(false);
          return;
        }
        await updateLandlordMutation.mutateAsync({
          businessName: businessName.trim(),
          phone: phone.trim() || undefined,
        });
        markStepComplete("business_info");
        setCurrentStep("first_property");
      } else if (currentStep === "first_property") {
        if (!propertyName.trim() || !propertyAddress.trim()) {
          toast.error("Please enter property name and address");
          setIsLoading(false);
          return;
        }
        await createPropertyMutation.mutateAsync({
          name: propertyName.trim(),
          address: propertyAddress.trim(),
          city: "Nairobi",
          propertyType: "residential",
          totalUnits: 1,
        });
        markStepComplete("first_property");
        setCurrentStep("first_tenant");
      } else if (currentStep === "first_tenant") {
        if (!tenantFirstName.trim() || !tenantLastName.trim()) {
          toast.error("Please enter tenant first and last name");
          setIsLoading(false);
          return;
        }
        await createTenantMutation.mutateAsync({
          firstName: tenantFirstName.trim(),
          lastName: tenantLastName.trim(),
          email: tenantEmail.trim() || undefined,
        });
        markStepComplete("first_tenant");
        setCurrentStep("first_lease");
      } else if (currentStep === "first_lease") {
        markStepComplete("first_lease");
        setCurrentStep("tour");
      } else if (currentStep === "tour") {
        markStepComplete("tour");
        completeOnboarding();
        utils.landlord.profile.invalidate();
        toast.success("Onboarding complete! Welcome to Property Ledger.");
      }
    } catch (error: any) {
      toast.error(error.message || "Something went wrong");
    } finally {
      setIsLoading(false);
    }
  };

  const handleBack = () => {
    if (currentStepIndex > 0) {
      setCurrentStep(STEPS[currentStepIndex - 1].id as any);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-2xl">
        <CardHeader className="border-b">
          <div className="flex items-center justify-between mb-4">
            <CardTitle className="text-xl">Setup Wizard</CardTitle>
            <span className="text-sm text-muted-foreground">
              Step {currentStepIndex + 1} of {STEPS.length}
            </span>
          </div>
          <div className="flex gap-2">
            {STEPS.map((step, i) => (
              <div
                key={step.id}
                className={`flex-1 h-1 rounded-full transition-colors ${
                  i <= currentStepIndex ? "bg-teal-600" : "bg-muted"
                }`}
              />
            ))}
          </div>
        </CardHeader>

        <CardContent className="p-6 sm:p-8">
          <div className="mb-6">
            <h2 className="text-2xl font-bold text-foreground mb-1">
              {STEPS[currentStepIndex].icon} {STEPS[currentStepIndex].title}
            </h2>
            <p className="text-sm text-muted-foreground">Fill in the details to get started</p>
          </div>

          <div className="space-y-4 mb-8">
            {currentStep === "business_info" && (
              <>
                <div className="space-y-1.5">
                  <Label>Business Name</Label>
                  <Input
                    placeholder="e.g., John's Properties"
                    value={businessName}
                    onChange={(e) => setBusinessName(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Phone Number (Optional)</Label>
                  <Input
                    placeholder="+254712345678"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                  />
                </div>
              </>
            )}

            {currentStep === "first_property" && (
              <>
                <div className="space-y-1.5">
                  <Label>Property Name</Label>
                  <Input
                    placeholder="e.g., Westlands Apartments"
                    value={propertyName}
                    onChange={(e) => setPropertyName(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Address</Label>
                  <Input
                    placeholder="e.g., 123 Main Street, Nairobi"
                    value={propertyAddress}
                    onChange={(e) => setPropertyAddress(e.target.value)}
                  />
                </div>
              </>
            )}

            {currentStep === "first_tenant" && (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>First Name</Label>
                    <Input
                      placeholder="John"
                      value={tenantFirstName}
                      onChange={(e) => setTenantFirstName(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Last Name</Label>
                    <Input
                      placeholder="Doe"
                      value={tenantLastName}
                      onChange={(e) => setTenantLastName(e.target.value)}
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label>Email (Optional)</Label>
                  <Input
                    type="email"
                    placeholder="john@example.com"
                    value={tenantEmail}
                    onChange={(e) => setTenantEmail(e.target.value)}
                  />
                </div>
              </>
            )}

            {currentStep === "first_lease" && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <p className="text-sm text-blue-900">
                  You'll create your first lease from the <strong>Leases</strong> page. For now, you have your property and tenant ready.
                </p>
              </div>
            )}

            {currentStep === "tour" && (
              <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4 space-y-3">
                <div className="flex gap-2">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold text-sm text-emerald-900">Business info saved</p>
                    <p className="text-xs text-emerald-800">Your business name and contact details are ready</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold text-sm text-emerald-900">First property added</p>
                    <p className="text-xs text-emerald-800">You can now add units and manage this property</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold text-sm text-emerald-900">First tenant added</p>
                    <p className="text-xs text-emerald-800">Ready to create a lease agreement</p>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            <Button
              variant="outline"
              className="flex-1"
              disabled={currentStepIndex === 0 || isLoading}
              onClick={handleBack}
            >
              <ChevronLeft className="w-4 h-4 mr-1" /> Back
            </Button>
            <Button
              className="flex-1 bg-teal-600 hover:bg-teal-700"
              disabled={isLoading}
              onClick={handleNext}
            >
              {currentStepIndex === STEPS.length - 1 ? "Complete" : "Next"} <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
