import { describe, expect, it, vi, beforeEach } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

// ─── Mock DB helpers ──────────────────────────────────────────────────────────
vi.mock("./db", () => ({
  requireLandlord: vi.fn().mockResolvedValue({ id: 1, userId: 1, subscriptionPlan: "basic", isActive: true }),
  getLandlordByUserId: vi.fn().mockResolvedValue({ id: 1, userId: 1, subscriptionPlan: "basic", isActive: true }),
  getPropertiesByLandlord: vi.fn().mockResolvedValue([
    { id: 1, landlordId: 1, name: "Sunrise Apartments", address: "Westlands, Nairobi", propertyType: "residential", totalUnits: 10, isActive: true, createdAt: new Date(), updatedAt: new Date() },
  ]),
  createProperty: vi.fn().mockResolvedValue({ id: 2, landlordId: 1, name: "New Block", address: "Kilimani", propertyType: "residential", totalUnits: 5, isActive: true, createdAt: new Date(), updatedAt: new Date() }),
  updateProperty: vi.fn().mockResolvedValue({ id: 1, landlordId: 1, name: "Updated Name", address: "Westlands", propertyType: "residential", totalUnits: 10, isActive: true, createdAt: new Date(), updatedAt: new Date() }),
  deleteProperty: vi.fn().mockResolvedValue(undefined),
  getPropertyById: vi.fn().mockResolvedValue({ id: 1, landlordId: 1, name: "Sunrise Apartments", address: "Westlands", propertyType: "residential", totalUnits: 10, isActive: true, createdAt: new Date(), updatedAt: new Date() }),
  getUnitsByProperty: vi.fn().mockResolvedValue([]),
  getUnitsByLandlord: vi.fn().mockResolvedValue([]),
  createUnit: vi.fn().mockResolvedValue({ id: 1, landlordId: 1, propertyId: 1, unitNumber: "A1", bedrooms: 2, bathrooms: 1, rentAmount: "25000", status: "vacant", createdAt: new Date(), updatedAt: new Date() }),
  updateUnit: vi.fn().mockResolvedValue({ id: 1 }),
  deleteUnit: vi.fn().mockResolvedValue(undefined),
  getUnitById: vi.fn().mockResolvedValue({ id: 1, landlordId: 1, propertyId: 1, unitNumber: "A1", bedrooms: 2, bathrooms: 1, rentAmount: "25000", status: "vacant" }),
  getTenantsByLandlord: vi.fn().mockResolvedValue([
    { id: 1, landlordId: 1, firstName: "John", lastName: "Doe", email: "john@example.com", phone: "+254700000000", isActive: true, createdAt: new Date(), updatedAt: new Date() },
  ]),
  createTenant: vi.fn().mockResolvedValue({ id: 2, landlordId: 1, firstName: "Jane", lastName: "Smith", email: "jane@example.com", phone: "+254711111111", isActive: true, createdAt: new Date(), updatedAt: new Date() }),
  updateTenant: vi.fn().mockResolvedValue({ id: 1 }),
  deleteTenant: vi.fn().mockResolvedValue(undefined),
  getTenantById: vi.fn().mockResolvedValue({ id: 1, landlordId: 1, firstName: "John", lastName: "Doe", email: "john@example.com", phone: "+254700000000", isActive: true }),
  getLeasesByLandlord: vi.fn().mockResolvedValue([]),
  createLease: vi.fn().mockResolvedValue({ id: 1, landlordId: 1, tenantId: 1, unitId: 1, startDate: new Date(), endDate: new Date(), rentAmount: "25000", depositAmount: "50000", status: "active", createdAt: new Date(), updatedAt: new Date() }),
  updateLease: vi.fn().mockResolvedValue({ id: 1 }),
  getLeaseById: vi.fn().mockResolvedValue({ id: 1, landlordId: 1, tenantId: 1, unitId: 1, startDate: new Date(), endDate: new Date(), rentAmount: "25000", depositAmount: "50000", status: "active" }),
  getInvoicesByLandlord: vi.fn().mockResolvedValue([]),
  getInvoiceById: vi.fn().mockResolvedValue(null),
  generateMonthlyInvoices: vi.fn().mockResolvedValue({ created: 5, total: 5 }),
  updateInvoiceStatus: vi.fn().mockResolvedValue({ id: 1, status: "paid" }),
  getPaymentsByLandlord: vi.fn().mockResolvedValue([]),
  createPayment: vi.fn().mockResolvedValue({ id: 1, landlordId: 1, tenantId: 1, amount: "25000", paymentMethod: "mpesa", paymentDate: new Date(), createdAt: new Date() }),
  getNotificationsByLandlord: vi.fn().mockResolvedValue([]),
  createNotification: vi.fn().mockResolvedValue({ id: 1, landlordId: 1, type: "rent_reminder", title: "Rent Reminder", message: "Your rent is due", status: "sent", createdAt: new Date() }),
  markNotificationRead: vi.fn().mockResolvedValue(undefined),
  getDocumentsByLandlord: vi.fn().mockResolvedValue([]),
  createDocument: vi.fn().mockResolvedValue({ id: 1, landlordId: 1, name: "Test Doc", fileUrl: "https://example.com/doc.pdf", documentType: "other", createdAt: new Date() }),
  deleteDocument: vi.fn().mockResolvedValue(undefined),
  getFinancialSummary: vi.fn().mockResolvedValue({ totalExpected: 100000, totalCollected: 80000, totalOutstanding: 20000, overdueInvoices: 2, totalUnits: 10, occupiedUnits: 8, vacantUnits: 2, occupancyRate: 80, monthlyData: [] }),
  getArrears: vi.fn().mockResolvedValue([]),
  getSubscriptionPlans: vi.fn().mockResolvedValue([
    { id: 1, name: "free", displayName: "Free", price: "0", billingCycle: "monthly", maxProperties: 2, maxUnits: 5, features: "[]", isActive: true, createdAt: new Date() },
    { id: 2, name: "basic", displayName: "Basic", price: "2500", billingCycle: "monthly", maxProperties: 10, maxUnits: 25, features: "[]", isActive: true, createdAt: new Date() },
    { id: 3, name: "pro", displayName: "Pro", price: "6500", billingCycle: "monthly", maxProperties: -1, maxUnits: -1, features: "[]", isActive: true, createdAt: new Date() },
  ]),
  getSubscriptionByLandlord: vi.fn().mockResolvedValue({ subscription: { id: 1, landlordId: 1, planId: 1, status: "active", startDate: new Date(), endDate: null, amount: "0", paymentMethod: null, mpesaTransactionId: null, createdAt: new Date(), updatedAt: new Date() }, plan: null }),
  createSubscription: vi.fn().mockResolvedValue({ id: 2 }),
  updateLandlord: vi.fn().mockResolvedValue({ id: 1 }),
  createLandlord: vi.fn().mockResolvedValue({ id: 1 }),
  getAllLandlords: vi.fn().mockResolvedValue([]),
  getPlatformStats: vi.fn().mockResolvedValue({ totalLandlords: 5, totalProperties: 12, totalUnits: 48, totalTenants: 35, totalRevenue: 500000, planBreakdown: [] }),
  getAuditLogs: vi.fn().mockResolvedValue([]),
  createAuditLog: vi.fn().mockResolvedValue(undefined),
  toggleLandlordStatus: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("./storage", () => ({
  storagePut: vi.fn().mockResolvedValue({ url: "https://cdn.example.com/doc.pdf", key: "test/doc.pdf" }),
}));

vi.mock("./_core/llm", () => ({
  invokeLLM: vi.fn().mockResolvedValue({ choices: [{ message: { content: "Here is your portfolio summary..." } }] }),
}));

// ─── Test helpers ─────────────────────────────────────────────────────────────
function makeCtx(overrides: Partial<TrpcContext> = {}): TrpcContext {
  return {
    user: {
      id: 1,
      openId: "test-user-openid",
      email: "landlord@example.com",
      name: "Test Landlord",
      loginMethod: "manus",
      role: "user",
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    },
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: vi.fn() } as unknown as TrpcContext["res"],
    ...overrides,
  };
}

function makeAdminCtx(): TrpcContext {
  return makeCtx({ user: { ...makeCtx().user!, role: "admin" } });
}

// ─── Auth tests ───────────────────────────────────────────────────────────────
describe("auth", () => {
  it("me returns null for unauthenticated context", async () => {
    const ctx = makeCtx({ user: null });
    const caller = appRouter.createCaller(ctx);
    const result = await caller.auth.me();
    expect(result).toBeNull();
  });

  it("me returns user for authenticated context", async () => {
    const ctx = makeCtx();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.auth.me();
    expect(result).not.toBeNull();
    expect(result?.email).toBe("landlord@example.com");
  });

  it("logout clears session cookie", async () => {
    const ctx = makeCtx();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.auth.logout();
    expect(result.success).toBe(true);
  });
});

// ─── Properties tests ─────────────────────────────────────────────────────────
describe("properties", () => {
  it("list returns properties for authenticated landlord", async () => {
    const ctx = makeCtx();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.properties.list();
    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBeGreaterThan(0);
    expect(result[0].name).toBe("Sunrise Apartments");
  });

  it("create adds a new property", async () => {
    const ctx = makeCtx();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.properties.create({
      name: "New Block",
      address: "Kilimani, Nairobi",
      propertyType: "residential",
      totalUnits: 5,
    });
    expect(result).toBeDefined();
    expect(result.name).toBe("New Block");
  });

  it("create requires authentication", async () => {
    const ctx = makeCtx({ user: null });
    const caller = appRouter.createCaller(ctx);
    await expect(caller.properties.create({ name: "Test", address: "Test", propertyType: "residential", totalUnits: 1 }))
      .rejects.toThrow();
  });
});

// ─── Tenants tests ────────────────────────────────────────────────────────────
describe("tenants", () => {
  it("list returns tenants", async () => {
    const ctx = makeCtx();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.tenants.list();
    expect(Array.isArray(result)).toBe(true);
    expect(result[0].firstName).toBe("John");
  });

  it("create adds a new tenant", async () => {
    const ctx = makeCtx();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.tenants.create({
      firstName: "Jane",
      lastName: "Smith",
      email: "jane@example.com",
      phone: "+254711111111",
    });
    expect(result).toBeDefined();
    expect(result.firstName).toBe("Jane");
  });
});

// ─── Invoices tests ───────────────────────────────────────────────────────────
describe("invoices", () => {
  it("generate creates monthly invoices", async () => {
    const ctx = makeCtx();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.invoices.generate({ month: 4, year: 2026 });
    expect(result).toBeDefined();
    expect(result.created).toBe(5);
  });

  it("updateStatus marks invoice as paid", async () => {
    const ctx = makeCtx();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.invoices.updateStatus({ id: 1, status: "paid" });
    expect(result).toBeDefined();
  });
});

// ─── Payments tests ───────────────────────────────────────────────────────────
describe("payments", () => {
  it("list returns payment records", async () => {
    const ctx = makeCtx();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.payments.list();
    expect(Array.isArray(result)).toBe(true);
  });

  it("record creates a new payment with M-Pesa method", async () => {
    const ctx = makeCtx();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.payments.record({
      tenantId: 1,
      amount: "25000",
      paymentMethod: "mpesa",
      mpesaTransactionId: "QK7ABC123",
      paymentDate: "2026-04-01",
    });
    expect(result).toBeDefined();
  });

  it("record supports bank_transfer payment method", async () => {
    const ctx = makeCtx();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.payments.record({
      tenantId: 1,
      amount: "30000",
      paymentMethod: "bank_transfer",
      bankReference: "TXN-20260401",
      paymentDate: "2026-04-01",
    });
    expect(result).toBeDefined();
  });

  it("record supports cash payment method", async () => {
    const ctx = makeCtx();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.payments.record({
      tenantId: 1,
      amount: "15000",
      paymentMethod: "cash",
      receiptNumber: "RCP-001",
      paymentDate: "2026-04-01",
    });
    expect(result).toBeDefined();
  });
});

// ─── Notifications tests ──────────────────────────────────────────────────────
describe("notifications", () => {
  it("list returns notifications", async () => {
    const ctx = makeCtx();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.notifications.list();
    expect(Array.isArray(result)).toBe(true);
  });

  it("sendReminder creates a notification for a tenant", async () => {
    const ctx = makeCtx();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.notifications.sendReminder({ tenantId: 1, type: "rent_reminder" });
    expect(result).toBeDefined();
  });
});

// ─── Reports tests ────────────────────────────────────────────────────────────
describe("reports", () => {
  it("financial returns summary with occupancy data", async () => {
    const ctx = makeCtx();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.reports.financial({ year: 2026 });
    expect(result).not.toBeNull();
    expect(result?.occupancyRate).toBe(80);
    expect(result?.totalCollected).toBe(80000);
  });

  it("arrears returns overdue tenant list", async () => {
    const ctx = makeCtx();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.reports.arrears();
    expect(Array.isArray(result)).toBe(true);
  });
});

// ─── Subscriptions tests ──────────────────────────────────────────────────────
describe("subscriptions", () => {
  it("plans returns all subscription tiers", async () => {
    const ctx = makeCtx();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.subscriptions.plans();
    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBe(3);
    const names = result.map((p) => p.name);
    expect(names).toContain("free");
    expect(names).toContain("basic");
    expect(names).toContain("pro");
  });

  it("current returns active subscription", async () => {
    const ctx = makeCtx();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.subscriptions.current();
    expect(result).not.toBeNull();
    expect(result?.subscription.status).toBe("active");
  });
});

// ─── Documents tests ──────────────────────────────────────────────────────────
describe("documents", () => {
  it("list returns documents", async () => {
    const ctx = makeCtx();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.documents.list({});
    expect(Array.isArray(result)).toBe(true);
  });

  it("upload stores document and returns record", async () => {
    const ctx = makeCtx();
    const caller = appRouter.createCaller(ctx);
    const fakeBase64 = Buffer.from("fake pdf content").toString("base64");
    const result = await caller.documents.upload({
      name: "Lease Agreement",
      fileData: fakeBase64,
      mimeType: "application/pdf",
      fileSize: 1024,
      documentType: "lease_agreement",
      tenantId: 1,
    });
    expect(result).toBeDefined();
    expect(result.name).toBe("Test Doc");
  });
});

// ─── Admin tests ──────────────────────────────────────────────────────────────
describe("admin", () => {
  it("stats requires admin role", async () => {
    const ctx = makeCtx(); // regular user
    const caller = appRouter.createCaller(ctx);
    await expect(caller.admin.stats()).rejects.toThrow();
  });

  it("stats returns platform statistics for admin", async () => {
    const ctx = makeAdminCtx();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.admin.stats();
    expect(result).not.toBeNull();
    expect(result?.totalLandlords).toBe(5);
    expect(result?.totalProperties).toBe(12);
  });

  it("landlords returns all landlord accounts for admin", async () => {
    const ctx = makeAdminCtx();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.admin.landlords();
    expect(Array.isArray(result)).toBe(true);
  });
});

// ─── AI Assistant tests ───────────────────────────────────────────────────────
describe("assistant", () => {
  it("chat responds to portfolio_qa mode", async () => {
    const ctx = makeCtx();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.assistant.chat({ mode: "portfolio_qa", message: "How many units do I have?" });
    expect(result).toBeDefined();
    expect(typeof result.reply).toBe("string");
    expect(result.mode).toBe("portfolio_qa");
  });

  it("chat responds to rent_pricing mode", async () => {
    const ctx = makeCtx();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.assistant.chat({ mode: "rent_pricing", message: "What should I charge for a 2-bed unit?" });
    expect(result.mode).toBe("rent_pricing");
  });

  it("chat responds to lease_draft mode", async () => {
    const ctx = makeCtx();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.assistant.chat({ mode: "lease_draft", message: "Draft a rent increase notice" });
    expect(result.mode).toBe("lease_draft");
  });
});
