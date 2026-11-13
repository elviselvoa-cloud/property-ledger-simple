import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Building2,
  DoorOpen,
  Users,
  Receipt,
  TrendingUp,
  AlertCircle,
  CheckCircle2,
  Smartphone,
  Split,
  Hammer,
  ChevronDown,
  Menu,
  X,
  LayoutGrid,
  Layers,
  CreditCard,
  HelpCircle,
  User,
  LogIn,
  UserCircle,
} from "lucide-react";
import { Link } from "wouter";
import { useState } from "react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

const kes = (n: number | null) => {
  if (n == null || n === 0) return "Free";
  return `KES ${n.toLocaleString("en-KE", { maximumFractionDigits: 0 })}`;
};

const scrollTo = (id: string) => {
  document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
};

/* ─── Navigation ───────────────────────────────────────── */

function Nav() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);

  const links = [
    { label: "Features", href: "features", icon: LayoutGrid },
    { label: "How It Works", href: "how-it-works", icon: Layers },
    { label: "Pricing", href: "pricing", icon: CreditCard },
    { label: "FAQ", href: "faqs", icon: HelpCircle },
  ];

  return (
    <nav className="fixed top-0 inset-x-0 z-50 bg-background/80 backdrop-blur-md border-b border-border">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Brand */}
          <Link href="/" className="flex items-center gap-2 font-bold text-lg">
            <Building2 className="size-6 text-primary" />
            <span>Property Ledger</span>
          </Link>

          {/* Desktop links */}
          <div className="hidden md:flex items-center gap-8">
            {links.map((l) => (
              <button
                key={l.href}
                onClick={() => scrollTo(l.href)}
                className="text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                {l.label}
              </button>
            ))}
            {user ? (
              <Link href="/dashboard">
                <Button size="sm">Go to Dashboard</Button>
              </Link>
            ) : (
              <div className="flex items-center gap-2">
                <Link href="/login">
                  <Button variant="ghost" size="sm">
                    Sign In
                  </Button>
                </Link>
                <Link href="/signup">
                  <Button size="sm">Get Started</Button>
                </Link>
              </div>
            )}
          </div>

          {/* Mobile toggle */}
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger
              asChild
              className="md:hidden p-2"
              aria-label="Toggle menu"
            >
              <button>
                {open ? <X className="size-5" /> : <Menu className="size-5" />}
              </button>
            </SheetTrigger>
            <SheetContent
              side="left"
              className="w-[280px] sm:w-[300px] max-w-[85vw] rounded-r-3xl bg-card border-r border-border p-0 shadow-2xl backdrop-blur-sm"
            >
              <div className="flex flex-col h-full">
                {/* Header */}
                <SheetHeader className="flex-row items-center gap-3 border-b border-border px-4 py-4">
                  <div className="flex size-10 items-center justify-center rounded-xl bg-primary/10">
                    <Building2 className="size-5 text-primary" />
                  </div>
                  <SheetTitle className="text-base font-bold tracking-tight p-0">
                    Property Ledger
                  </SheetTitle>
                </SheetHeader>

                {/* Navigation list */}
                <div className="flex-1 overflow-y-auto px-2 py-3">
                  <div className="flex flex-col gap-1">
                    {links.map((l) => {
                      const Icon = l.icon;
                      return (
                        <button
                          key={l.href}
                          onClick={() => {
                            scrollTo(l.href);
                            setOpen(false);
                          }}
                          className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                        >
                          <Icon className="size-4 shrink-0" />
                          <span>{l.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Footer section */}
                <div className="mt-auto border-t border-border p-4 flex flex-col gap-3">
                  {user ? (
                    <>
                      <div className="flex items-center gap-3">
                        <div className="flex size-9 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
                          {(user.email ?? "U").charAt(0).toUpperCase()}
                        </div>
                        <div className="flex flex-col min-w-0">
                          <span className="text-sm font-medium truncate">
                            {user.email ?? "Account"}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            Signed in
                          </span>
                        </div>
                      </div>
                      <Link href="/dashboard" className="w-full" onClick={() => setOpen(false)}>
                        <Button className="w-full gap-2">
                          <UserCircle className="size-4" />
                          Go to Dashboard
                        </Button>
                      </Link>
                    </>
                  ) : (
                    <div className="flex flex-col gap-2">
                      <Link href="/login" className="w-full" onClick={() => setOpen(false)}>
                        <Button variant="outline" className="w-full gap-2">
                          <LogIn className="size-4" />
                          Sign In
                        </Button>
                      </Link>
                      <Link href="/signup" className="w-full" onClick={() => setOpen(false)}>
                        <Button className="w-full gap-2">
                          <User className="size-4" />
                          Get Started
                        </Button>
                      </Link>
                    </div>
                  )}
                </div>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </nav>
  );
}

/* ─── Hero ──────────────────────────────────────────────── */

function Hero() {
  const { user } = useAuth();
  return (
    <section className="pt-32 pb-20 px-4">
      <div className="max-w-4xl mx-auto text-center">
        <Badge variant="secondary" className="mb-6 text-xs">
          Professional Property Management
        </Badge>
        <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight">
          Property &amp; tenancy management,{" "}
          <span className="text-primary">built for landlords</span>
        </h1>
        <p className="mt-6 text-lg text-muted-foreground max-w-2xl mx-auto leading-relaxed">
          Track payments, send automated receipts, manage arrears, and streamline your property business in one intuitive dashboard.
        </p>
        <div className="mt-10 flex flex-wrap justify-center gap-4">
          <Link href={user ? "/dashboard" : "/signup"}>
            <Button size="lg" className="gap-2">
              Get Started
              <ChevronDown className="size-4 rotate-[-90deg]" />
            </Button>
          </Link>
        </div>

        {/* Highlights */}
        <div className="mt-16 grid grid-cols-2 sm:grid-cols-4 gap-6 text-center">
          {[
            { icon: Receipt, label: "Payment Tracking" },
            { icon: Smartphone, label: "Automated Receipts" },
            { icon: TrendingUp, label: "Arrears Management" },
            { icon: Split, label: "Invoicing" },
          ].map(({ icon: Icon, label }) => (
            <div key={label} className="flex flex-col items-center gap-2">
              <div className="p-3 rounded-full bg-accent">
                <Icon className="size-5 text-primary" />
              </div>
              <span className="text-xs text-muted-foreground">{label}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ─── Features ──────────────────────────────────────────── */

const FEATURES = [
  {
    icon: Receipt,
    title: "M-Pesa Payments & WhatsApp Receipts",
    desc: "Record Paybill/Till transactions instantly, print branded receipts, and dispatch them directly to tenants via WhatsApp.",
  },
  {
    icon: TrendingUp,
    title: "Expense Tracking & Cash Flow",
    desc: "Record property expenses and compare them with rent collections to understand cash flow across your portfolio.",
  },
  {
    icon: DoorOpen,
    title: "Flexible Bulk Unit Generator",
    desc: "Build units with ranges (A1–A10), floor-based patterns, or paste freeform lists with automatic duplicate detection.",
  },
  {
    icon: Hammer,
    title: "Caretaker Delegation",
    desc: "Assign caretakers to specific buildings with restricted operational access — no financial visibility needed.",
  },
  {
    icon: AlertCircle,
    title: "Arrears Aging & Tenant Statements",
    desc: "See debtor buckets at a glance (Current, 1–29, 30–59, 60–89, 90+ days) and export CSV reports for accounting.",
  },
  {
    icon: Users,
    title: "Tenant Portal & Communication",
    desc: "Tenants receive automated receipts and notices. Keep every message and payment log in one place.",
  },
];

function Features() {
  return (
    <section id="features" className="py-20 px-4 bg-accent/40">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold tracking-tight">Core Features</h2>
          <p className="mt-3 text-muted-foreground">
            Everything you need to run your properties professionally.
          </p>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {FEATURES.map(({ icon: Icon, title, desc }) => (
            <Card key={title}>
              <CardContent className="pt-6 flex flex-col gap-4">
                <div className="p-3 rounded-lg w-fit bg-primary/10">
                  <Icon className="size-6 text-primary" />
                </div>
                <h3 className="font-semibold">{title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {desc}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ─── How It Works ──────────────────────────────────────── */

const STEPS = [
  {
    n: "1",
    title: "Set Up Properties & Units",
    desc: "Add your buildings and generate units in bulk — by range, floor pattern, or freeform paste with duplicate detection.",
  },
  {
    n: "2",
    title: "Onboard Tenants & Leases",
    desc: "Register tenants, configure lease terms and deposits, and set billing preferences—including shared or split rent when needed.",
  },
  {
    n: "3",
    title: "Collect, Receipt & Manage Arrears",
    desc: "Track monthly collections, issue branded receipts via WhatsApp, and keep arrears aging clean with exportable reports.",
  },
];

function HowItWorks() {
  return (
    <section id="how-it-works" className="py-20 px-4">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold tracking-tight">How It Works</h2>
          <p className="mt-3 text-muted-foreground">
            Up and running in three simple steps.
          </p>
        </div>
        <div className="grid md:grid-cols-3 gap-8">
          {STEPS.map(({ n, title, desc }) => (
            <div key={n} className="relative text-center">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-primary text-primary-foreground font-bold text-lg mb-4">
                {n}
              </div>
              <h3 className="font-semibold mb-2">{title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {desc}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ─── Pricing ───────────────────────────────────────────── */

interface Plan {
  name: string;
  monthly: number | null;
  annual: number | null;
  desc: string;
  features: string[];
  cta: string;
  highlighted?: boolean;
}

const PLANS: Plan[] = [
  {
    name: "Starter",
    monthly: 0,
    annual: 0,
    desc: "Perfect for landlords with a small portfolio.",
    features: [
      "Up to 10 units",
      "1 property",
      "Basic invoicing",
      "Rent receipts",
    ],
    cta: "Start for Free",
  },
  {
    name: "Growth",
    monthly: 2500,
    annual: 25000,
    desc: "For growing portfolios that need automation.",
    features: [
      "Up to 50 units",
      "Multiple properties",
      "WhatsApp receipts",
      "Expense tracking & cash flow",
      "Caretaker assignments",
      "Exportable arrears reports",
    ],
    cta: "Start 14-Day Free Trial",
    highlighted: true,
  },
  {
    name: "Commercial / Agency",
    monthly: 6000,
    annual: 60000,
    desc: "Unlimited scale for agencies and large portfolios.",
    features: [
      "Unlimited units & properties",
      "Unlimited caretakers",
      "Advanced aging analytics",
      "Priority support",
      "Everything in Growth",
    ],
    cta: "Get Started",
  },
];

function Pricing() {
  const [annual, setAnnual] = useState(true);

  return (
    <section id="pricing" className="py-20 px-4 bg-accent/40">
      <div className="max-w-5xl mx-auto">
        <div className="text-center mb-10">
          <h2 className="text-3xl font-bold tracking-tight">Simple Pricing</h2>
          <p className="mt-3 text-muted-foreground">
            Pick the plan that fits your portfolio.
          </p>

          {/* Toggle */}
          <div className="mt-8 inline-flex items-center gap-3 bg-card rounded-full border border-border p-1">
            <button
              onClick={() => setAnnual(false)}
              className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all ${
                !annual
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground"
              }`}
            >
              Monthly
            </button>
            <button
              onClick={() => setAnnual(true)}
              className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all ${
                annual
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground"
              }`}
            >
              Annual{" "}
              <span className="text-[10px] bg-green-500/20 text-green-700 dark:text-green-400 px-1.5 py-0.5 rounded-full ml-1">
                ~17% off
              </span>
            </button>
          </div>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          {PLANS.map((plan) => {
            const price = annual ? plan.annual : plan.monthly;
            return (
              <Card
                key={plan.name}
                className={[
                  "flex flex-col",
                  plan.highlighted ? "border-primary shadow-lg relative" : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
              >
                {plan.highlighted && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <Badge className="bg-primary text-primary-foreground text-xs">
                      Most Popular
                    </Badge>
                  </div>
                )}
                <CardContent className="pt-8 flex flex-col flex-1">
                  <h3 className="font-semibold text-lg">{plan.name}</h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    {plan.desc}
                  </p>
                  <div className="mt-6 mb-6">
                    {price === 0 ? (
                      <span className="text-4xl font-bold">Free</span>
                    ) : (
                      <div className="flex items-baseline gap-1">
                        <span className="text-3xl font-bold">
                          {kes(price)}
                        </span>
                        <span className="text-sm text-muted-foreground">
                          /{annual ? "yr" : "mo"}
                        </span>
                      </div>
                    )}
                  </div>
                  <ul className="space-y-2 flex-1">
                    {plan.features.map((f) => (
                      <li key={f} className="flex items-start gap-2 text-sm">
                        <CheckCircle2 className="size-4 text-primary shrink-0 mt-0.5" />
                        <span className="text-muted-foreground">{f}</span>
                      </li>
                    ))}
                  </ul>
                  <Link href="/signup" className="mt-8">
                    <Button
                      className="w-full"
                      variant={plan.highlighted ? "default" : "outline"}
                    >
                      {plan.cta}
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </section>
  );
}

/* ─── FAQ ───────────────────────────────────────────────── */

const FAQS = [
  {
    q: "Does Property Ledger support M-Pesa Paybill and Till numbers?",
    a: "Yes. You can register your Paybill or Till number in the app settings and match incoming payments automatically. All transaction records are stored with full audit history.",
  },
  {
    q: "Can caretakers see financial data?",
    a: "No. Caretakers are assigned to specific buildings with restricted operational access. They cannot view payment records, arrears reports, or any financial information.",
  },
  {
    q: "Can I track property expenses and cash flow?",
    a: "Yes. Record expenses by property and review them alongside rent collections in your cash flow reports.",
  },
  {
    q: "Can I export reports for tax or accounting purposes?",
    a: "Absolutely. Arrears aging reports, payment histories, and tenant statements can be exported as CSV files for your accountant or tax preparation.",
  },
];

function FAQSection() {
  return (
    <section id="faqs" className="py-20 px-4">
      <div className="max-w-2xl mx-auto">
        <div className="text-center mb-10">
          <h2 className="text-3xl font-bold tracking-tight">
            Frequently Asked Questions
          </h2>
        </div>
        <Accordion type="single" collapsible className="w-full">
          {FAQS.map(({ q, a }) => (
            <AccordionItem key={q} value={q}>
              <AccordionTrigger>{q}</AccordionTrigger>
              <AccordionContent>
                <p className="leading-relaxed">{a}</p>
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </section>
  );
}

/* ─── Footer ────────────────────────────────────────────── */

function Footer() {
  return (
    <footer className="py-12 px-4 border-t border-border">
      <div className="max-w-6xl mx-auto grid sm:grid-cols-2 lg:grid-cols-3 gap-8">
        {/* Brand */}
        <div className="sm:col-span-2 lg:col-span-1">
          <div className="flex items-center gap-2 font-bold text-lg mb-3">
            <Building2 className="size-5 text-primary" />
            Property Ledger
          </div>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Property and tenancy management for independent landlords, estates,
            and property agencies.
          </p>
        </div>

        {/* Quick links */}
        <div>
          <h4 className="font-semibold text-sm mb-3">Quick Links</h4>
          <ul className="space-y-2 text-sm text-muted-foreground">
            {["features", "how-it-works", "pricing", "faqs"].map((href) => {
              const label =
                href.charAt(0).toUpperCase() +
                href.replace(/-/g, " ").slice(1);
              return (
                <li key={href}>
                  <button
                    onClick={() => scrollTo(href)}
                    className="hover:text-foreground transition-colors"
                  >
                    {label}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>

        {/* Legal */}
        <div>
          <h4 className="font-semibold text-sm mb-3">Legal</h4>
          <ul className="space-y-2 text-sm text-muted-foreground">
            {["Privacy Policy", "Terms of Service"].map((label) => (
              <li key={label}>
                <span className="cursor-default">{label}</span>
              </li>
            ))}
          </ul>
        </div>

      </div>
      <div className="mt-12 text-center text-xs text-muted-foreground">
        © {new Date().getFullYear()} Property Ledger. All rights reserved.
      </div>
    </footer>
  );
}

/* ─── Page ──────────────────────────────────────────────── */

export default function Landing() {
  return (
    <div className="min-h-screen bg-background">
      <Nav />
      <Hero />
      <Features />
      <HowItWorks />
      <Pricing />
      <FAQSection />
      <Footer />
    </div>
  );
}
