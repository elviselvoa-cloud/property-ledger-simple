import {
  boolean,
  decimal,
  int,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  varchar,
  index,
  bigint,
} from "drizzle-orm/mysql-core";

// ─── Users (auth base) ────────────────────────────────────────────────────────
export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

// ─── Landlord Profiles ────────────────────────────────────────────────────────
export const landlords = mysqlTable("landlords", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().references(() => users.id),
  businessName: varchar("businessName", { length: 255 }),
  phone: varchar("phone", { length: 30 }),
  address: text("address"),
  city: varchar("city", { length: 100 }),
  country: varchar("country", { length: 100 }).default("Kenya"),
  subscriptionPlan: mysqlEnum("subscriptionPlan", ["free", "basic", "pro"]).default("free").notNull(),
  subscriptionStatus: mysqlEnum("subscriptionStatus", ["active", "expired", "cancelled"]).default("active").notNull(),
  subscriptionExpiresAt: timestamp("subscriptionExpiresAt"),
  trialEndsAt: timestamp("trialEndsAt"),
  isActive: boolean("isActive").default(true).notNull(),
  onboardingStatus: mysqlEnum("onboardingStatus", ["not_started", "in_progress", "completed", "skipped"]).default("not_started").notNull(),
  onboardingCompletedAt: timestamp("onboardingCompletedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (t) => [
  index("landlords_userId_idx").on(t.userId),
]);

export type Landlord = typeof landlords.$inferSelect;
export type InsertLandlord = typeof landlords.$inferInsert;

// ─── Properties ───────────────────────────────────────────────────────────────
export const properties = mysqlTable("properties", {
  id: int("id").autoincrement().primaryKey(),
  landlordId: int("landlordId").notNull().references(() => landlords.id),
  name: varchar("name", { length: 255 }).notNull(),
  address: text("address").notNull(),
  city: varchar("city", { length: 100 }),
  propertyType: mysqlEnum("propertyType", ["residential", "commercial", "mixed"]).default("residential").notNull(),
  totalUnits: int("totalUnits").default(1).notNull(),
  description: text("description"),
  isActive: boolean("isActive").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (t) => [
  index("properties_landlordId_idx").on(t.landlordId),
]);

export type Property = typeof properties.$inferSelect;
export type InsertProperty = typeof properties.$inferInsert;

// ─── Units ────────────────────────────────────────────────────────────────────
export const units = mysqlTable("units", {
  id: int("id").autoincrement().primaryKey(),
  propertyId: int("propertyId").notNull().references(() => properties.id),
  landlordId: int("landlordId").notNull().references(() => landlords.id),
  unitNumber: varchar("unitNumber", { length: 50 }).notNull(),
  floor: varchar("floor", { length: 20 }),
  bedrooms: int("bedrooms").default(1),
  bathrooms: int("bathrooms").default(1),
  size: decimal("size", { precision: 10, scale: 2 }),
  rentAmount: decimal("rentAmount", { precision: 12, scale: 2 }).notNull(),
  depositAmount: decimal("depositAmount", { precision: 12, scale: 2 }),
  status: mysqlEnum("status", ["vacant", "occupied", "maintenance"]).default("vacant").notNull(),
  description: text("description"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (t) => [
  index("units_propertyId_idx").on(t.propertyId),
  index("units_landlordId_idx").on(t.landlordId),
]);

export type Unit = typeof units.$inferSelect;
export type InsertUnit = typeof units.$inferInsert;

// ─── Tenants ──────────────────────────────────────────────────────────────────
export const tenants = mysqlTable("tenants", {
  id: int("id").autoincrement().primaryKey(),
  landlordId: int("landlordId").notNull().references(() => landlords.id),
  firstName: varchar("firstName", { length: 100 }).notNull(),
  lastName: varchar("lastName", { length: 100 }).notNull(),
  email: varchar("email", { length: 320 }),
  phone: varchar("phone", { length: 30 }),
  nationalId: varchar("nationalId", { length: 50 }),
  emergencyContact: varchar("emergencyContact", { length: 100 }),
  emergencyPhone: varchar("emergencyPhone", { length: 30 }),
  notes: text("notes"),
  isActive: boolean("isActive").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (t) => [
  index("tenants_landlordId_idx").on(t.landlordId),
]);

export type Tenant = typeof tenants.$inferSelect;
export type InsertTenant = typeof tenants.$inferInsert;

// ─── Leases ───────────────────────────────────────────────────────────────────
export const leases = mysqlTable("leases", {
  id: int("id").autoincrement().primaryKey(),
  landlordId: int("landlordId").notNull().references(() => landlords.id),
  tenantId: int("tenantId").notNull().references(() => tenants.id),
  unitId: int("unitId").notNull().references(() => units.id),
  startDate: timestamp("startDate").notNull(),
  endDate: timestamp("endDate"),
  rentAmount: decimal("rentAmount", { precision: 12, scale: 2 }).notNull(),
  depositAmount: decimal("depositAmount", { precision: 12, scale: 2 }),
  depositPaid: boolean("depositPaid").default(false).notNull(),
  rentDueDay: int("rentDueDay").default(1).notNull(),
  status: mysqlEnum("status", ["active", "expired", "terminated", "pending"]).default("active").notNull(),
  notes: text("notes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (t) => [
  index("leases_landlordId_idx").on(t.landlordId),
  index("leases_tenantId_idx").on(t.tenantId),
  index("leases_unitId_idx").on(t.unitId),
]);

export type Lease = typeof leases.$inferSelect;
export type InsertLease = typeof leases.$inferInsert;

// ─── Rent Invoices ────────────────────────────────────────────────────────────
export const rentInvoices = mysqlTable("rent_invoices", {
  id: int("id").autoincrement().primaryKey(),
  landlordId: int("landlordId").notNull().references(() => landlords.id),
  leaseId: int("leaseId").notNull().references(() => leases.id),
  tenantId: int("tenantId").notNull().references(() => tenants.id),
  unitId: int("unitId").notNull().references(() => units.id),
  invoiceNumber: varchar("invoiceNumber", { length: 50 }).notNull().unique(),
  amount: decimal("amount", { precision: 12, scale: 2 }).notNull(),
  dueDate: timestamp("dueDate").notNull(),
  periodMonth: int("periodMonth").notNull(),
  periodYear: int("periodYear").notNull(),
  status: mysqlEnum("status", ["pending", "paid", "overdue", "partial", "cancelled"]).default("pending").notNull(),
  paidAmount: decimal("paidAmount", { precision: 12, scale: 2 }).default("0"),
  paidAt: timestamp("paidAt"),
  notes: text("notes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (t) => [
  index("invoices_landlordId_idx").on(t.landlordId),
  index("invoices_leaseId_idx").on(t.leaseId),
  index("invoices_tenantId_idx").on(t.tenantId),
  index("invoices_status_idx").on(t.status),
]);

export type RentInvoice = typeof rentInvoices.$inferSelect;
export type InsertRentInvoice = typeof rentInvoices.$inferInsert;

// ─── Payments ─────────────────────────────────────────────────────────────────
export const payments = mysqlTable("payments", {
  id: int("id").autoincrement().primaryKey(),
  landlordId: int("landlordId").notNull().references(() => landlords.id),
  invoiceId: int("invoiceId").references(() => rentInvoices.id),
  tenantId: int("tenantId").notNull().references(() => tenants.id),
  amount: decimal("amount", { precision: 12, scale: 2 }).notNull(),
  paymentMethod: mysqlEnum("paymentMethod", ["mpesa", "bank_transfer", "cash", "other"]).notNull(),
  mpesaTransactionId: varchar("mpesaTransactionId", { length: 100 }),
  bankReference: varchar("bankReference", { length: 100 }),
  receiptNumber: varchar("receiptNumber", { length: 100 }),
  paymentDate: timestamp("paymentDate").notNull(),
  notes: text("notes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (t) => [
  index("payments_landlordId_idx").on(t.landlordId),
  index("payments_invoiceId_idx").on(t.invoiceId),
  index("payments_tenantId_idx").on(t.tenantId),
]);

export type Payment = typeof payments.$inferSelect;
export type InsertPayment = typeof payments.$inferInsert;

// ─── Subscription Plans ───────────────────────────────────────────────────────
export const subscriptionPlans = mysqlTable("subscription_plans", {
  id: int("id").autoincrement().primaryKey(),
  name: mysqlEnum("name", ["free", "basic", "pro"]).notNull().unique(),
  displayName: varchar("displayName", { length: 100 }).notNull(),
  price: decimal("price", { precision: 10, scale: 2 }).notNull(),
  billingCycle: mysqlEnum("billingCycle", ["monthly", "yearly"]).default("monthly").notNull(),
  maxUnits: int("maxUnits"),
  maxProperties: int("maxProperties"),
  features: text("features"),
  isActive: boolean("isActive").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type SubscriptionPlan = typeof subscriptionPlans.$inferSelect;

// ─── Subscriptions ────────────────────────────────────────────────────────────
export const subscriptions = mysqlTable("subscriptions", {
  id: int("id").autoincrement().primaryKey(),
  landlordId: int("landlordId").notNull().references(() => landlords.id),
  planId: int("planId").notNull().references(() => subscriptionPlans.id),
  status: mysqlEnum("status", ["active", "cancelled", "expired", "past_due"]).default("active").notNull(),
  startDate: timestamp("startDate").notNull(),
  endDate: timestamp("endDate"),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  paymentMethod: varchar("paymentMethod", { length: 50 }),
  mpesaTransactionId: varchar("mpesaTransactionId", { length: 100 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (t) => [
  index("subscriptions_landlordId_idx").on(t.landlordId),
]);

export type Subscription = typeof subscriptions.$inferSelect;

// ─── Notifications ────────────────────────────────────────────────────────────
export const notifications = mysqlTable("notifications", {
  id: int("id").autoincrement().primaryKey(),
  landlordId: int("landlordId").notNull().references(() => landlords.id),
  tenantId: int("tenantId").references(() => tenants.id),
  type: mysqlEnum("type", ["rent_reminder", "payment_confirmation", "payment_request", "payment_received", "overdue_alert", "subscription_expiry", "general"]).notNull(),
  channel: mysqlEnum("channel", ["sms", "email", "in_app"]).notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  message: text("message").notNull(),
  status: mysqlEnum("status", ["pending", "sent", "failed", "read"]).default("pending").notNull(),
  sentAt: timestamp("sentAt"),
  readAt: timestamp("readAt"),
  metadata: text("metadata"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (t) => [
  index("notifications_landlordId_idx").on(t.landlordId),
  index("notifications_tenantId_idx").on(t.tenantId),
]);

export type Notification = typeof notifications.$inferSelect;
export type InsertNotification = typeof notifications.$inferInsert;

// ─── Documents ────────────────────────────────────────────────────────────────
export const documents = mysqlTable("documents", {
  id: int("id").autoincrement().primaryKey(),
  landlordId: int("landlordId").notNull().references(() => landlords.id),
  tenantId: int("tenantId").references(() => tenants.id),
  leaseId: int("leaseId").references(() => leases.id),
  paymentId: int("paymentId").references(() => payments.id),
  name: varchar("name", { length: 255 }).notNull(),
  fileKey: varchar("fileKey", { length: 500 }).notNull(),
  fileUrl: text("fileUrl").notNull(),
  mimeType: varchar("mimeType", { length: 100 }),
  fileSize: bigint("fileSize", { mode: "number" }),
  documentType: mysqlEnum("documentType", ["lease_agreement", "tenant_id", "payment_receipt", "property_photo", "other"]).default("other").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (t) => [
  index("documents_landlordId_idx").on(t.landlordId),
  index("documents_tenantId_idx").on(t.tenantId),
  index("documents_leaseId_idx").on(t.leaseId),
]);

export type Document = typeof documents.$inferSelect;
export type InsertDocument = typeof documents.$inferInsert;

// ─── Audit Logs ───────────────────────────────────────────────────────────────
export const auditLogs = mysqlTable("audit_logs", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").references(() => users.id),
  landlordId: int("landlordId").references(() => landlords.id),
  action: varchar("action", { length: 100 }).notNull(),
  entity: varchar("entity", { length: 100 }),
  entityId: int("entityId"),
  details: text("details"),
  ipAddress: varchar("ipAddress", { length: 45 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (t) => [
  index("audit_logs_userId_idx").on(t.userId),
  index("audit_logs_landlordId_idx").on(t.landlordId),
]);

export type AuditLog = typeof auditLogs.$inferSelect;
