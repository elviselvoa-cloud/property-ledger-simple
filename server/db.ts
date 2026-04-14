import { and, desc, eq, gte, lte, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import {
  InsertUser,
  auditLogs,
  documents,
  landlords,
  leases,
  notifications,
  payments,
  properties,
  rentInvoices,
  subscriptionPlans,
  subscriptions,
  tenants,
  units,
  users,
} from "../drizzle/schema";
import { ENV } from "./_core/env";

let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

// ─── Users ────────────────────────────────────────────────────────────────────
export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) throw new Error("User openId is required for upsert");
  const db = await getDb();
  if (!db) return;

  const values: InsertUser = { openId: user.openId };
  const updateSet: Record<string, unknown> = {};
  const textFields = ["name", "email", "loginMethod"] as const;
  type TextField = (typeof textFields)[number];
  const assignNullable = (field: TextField) => {
    const value = user[field];
    if (value === undefined) return;
    const normalized = value ?? null;
    values[field] = normalized;
    updateSet[field] = normalized;
  };
  textFields.forEach(assignNullable);
  if (user.lastSignedIn !== undefined) {
    values.lastSignedIn = user.lastSignedIn;
    updateSet.lastSignedIn = user.lastSignedIn;
  }
  if (user.role !== undefined) {
    values.role = user.role;
    updateSet.role = user.role;
  } else if (user.openId === ENV.ownerOpenId) {
    values.role = "admin";
    updateSet.role = "admin";
  }
  if (!values.lastSignedIn) values.lastSignedIn = new Date();
  if (Object.keys(updateSet).length === 0) updateSet.lastSignedIn = new Date();

  await db.insert(users).values(values).onDuplicateKeyUpdate({ set: updateSet });
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result[0];
}

// ─── Landlord Profiles ────────────────────────────────────────────────────────
export async function getLandlordByUserId(userId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(landlords).where(eq(landlords.userId, userId)).limit(1);
  return result[0];
}

export async function createLandlord(data: typeof landlords.$inferInsert) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  const result = await db.insert(landlords).values(data);
  const id = (result[0] as any).insertId as number;
  const rows = await db.select().from(landlords).where(eq(landlords.id, id)).limit(1);
  return rows[0];
}

export async function updateLandlord(id: number, data: Partial<typeof landlords.$inferInsert>) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  await db.update(landlords).set(data).where(eq(landlords.id, id));
  const rows = await db.select().from(landlords).where(eq(landlords.id, id)).limit(1);
  return rows[0];
}

export async function getAllLandlords() {
  const db = await getDb();
  if (!db) return [];
  return db
    .select({
      landlord: landlords,
      user: { id: users.id, name: users.name, email: users.email, createdAt: users.createdAt },
    })
    .from(landlords)
    .leftJoin(users, eq(landlords.userId, users.id))
    .orderBy(desc(landlords.createdAt));
}

// ─── Properties ───────────────────────────────────────────────────────────────
export async function getPropertiesByLandlord(landlordId: number) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(properties)
    .where(and(eq(properties.landlordId, landlordId), eq(properties.isActive, true)))
    .orderBy(desc(properties.createdAt));
}

export async function getPropertyById(id: number, landlordId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const rows = await db
    .select()
    .from(properties)
    .where(and(eq(properties.id, id), eq(properties.landlordId, landlordId)))
    .limit(1);
  return rows[0];
}

export async function createProperty(data: typeof properties.$inferInsert) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  const result = await db.insert(properties).values(data);
  const id = (result[0] as any).insertId as number;
  const rows = await db.select().from(properties).where(eq(properties.id, id)).limit(1);
  return rows[0];
}

export async function updateProperty(id: number, landlordId: number, data: Partial<typeof properties.$inferInsert>) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  await db.update(properties).set(data).where(and(eq(properties.id, id), eq(properties.landlordId, landlordId)));
  const rows = await db.select().from(properties).where(eq(properties.id, id)).limit(1);
  return rows[0];
}

export async function deleteProperty(id: number, landlordId: number) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  await db.update(properties).set({ isActive: false }).where(and(eq(properties.id, id), eq(properties.landlordId, landlordId)));
}

// ─── Units ────────────────────────────────────────────────────────────────────
export async function getUnitsByProperty(propertyId: number, landlordId: number) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(units)
    .where(and(eq(units.propertyId, propertyId), eq(units.landlordId, landlordId)))
    .orderBy(units.unitNumber);
}

export async function getUnitsByLandlord(landlordId: number) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select({ unit: units, property: { id: properties.id, name: properties.name } })
    .from(units)
    .leftJoin(properties, eq(units.propertyId, properties.id))
    .where(eq(units.landlordId, landlordId))
    .orderBy(units.unitNumber);
}

export async function getUnitById(id: number, landlordId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const rows = await db.select().from(units).where(and(eq(units.id, id), eq(units.landlordId, landlordId))).limit(1);
  return rows[0];
}

export async function createUnit(data: typeof units.$inferInsert) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  const result = await db.insert(units).values(data);
  const id = (result[0] as any).insertId as number;
  const rows = await db.select().from(units).where(eq(units.id, id)).limit(1);
  return rows[0];
}

export async function updateUnit(id: number, landlordId: number, data: Partial<typeof units.$inferInsert>) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  await db.update(units).set(data).where(and(eq(units.id, id), eq(units.landlordId, landlordId)));
  const rows = await db.select().from(units).where(eq(units.id, id)).limit(1);
  return rows[0];
}

export async function deleteUnit(id: number, landlordId: number) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  await db.delete(units).where(and(eq(units.id, id), eq(units.landlordId, landlordId)));
}

// ─── Tenants ──────────────────────────────────────────────────────────────────
export async function getTenantsByLandlord(landlordId: number) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(tenants)
    .where(and(eq(tenants.landlordId, landlordId), eq(tenants.isActive, true)))
    .orderBy(tenants.firstName);
}

export async function getTenantById(id: number, landlordId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const rows = await db.select().from(tenants).where(and(eq(tenants.id, id), eq(tenants.landlordId, landlordId))).limit(1);
  return rows[0];
}

export async function createTenant(data: typeof tenants.$inferInsert) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  const result = await db.insert(tenants).values(data);
  const id = (result[0] as any).insertId as number;
  const rows = await db.select().from(tenants).where(eq(tenants.id, id)).limit(1);
  return rows[0];
}

export async function updateTenant(id: number, landlordId: number, data: Partial<typeof tenants.$inferInsert>) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  await db.update(tenants).set(data).where(and(eq(tenants.id, id), eq(tenants.landlordId, landlordId)));
  const rows = await db.select().from(tenants).where(eq(tenants.id, id)).limit(1);
  return rows[0];
}

export async function deleteTenant(id: number, landlordId: number) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  await db.update(tenants).set({ isActive: false }).where(and(eq(tenants.id, id), eq(tenants.landlordId, landlordId)));
}

// ─── Leases ───────────────────────────────────────────────────────────────────
export async function getLeasesByLandlord(landlordId: number) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select({
      lease: leases,
      tenant: { id: tenants.id, firstName: tenants.firstName, lastName: tenants.lastName, phone: tenants.phone, email: tenants.email },
      unit: { id: units.id, unitNumber: units.unitNumber },
      property: { id: properties.id, name: properties.name },
    })
    .from(leases)
    .leftJoin(tenants, eq(leases.tenantId, tenants.id))
    .leftJoin(units, eq(leases.unitId, units.id))
    .leftJoin(properties, eq(units.propertyId, properties.id))
    .where(eq(leases.landlordId, landlordId))
    .orderBy(desc(leases.createdAt));
}

export async function getLeaseById(id: number, landlordId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const rows = await db
    .select({
      lease: leases,
      tenant: { id: tenants.id, firstName: tenants.firstName, lastName: tenants.lastName, phone: tenants.phone, email: tenants.email },
      unit: { id: units.id, unitNumber: units.unitNumber },
      property: { id: properties.id, name: properties.name },
    })
    .from(leases)
    .leftJoin(tenants, eq(leases.tenantId, tenants.id))
    .leftJoin(units, eq(leases.unitId, units.id))
    .leftJoin(properties, eq(units.propertyId, properties.id))
    .where(and(eq(leases.id, id), eq(leases.landlordId, landlordId)))
    .limit(1);
  return rows[0];
}

export async function createLease(data: typeof leases.$inferInsert) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  const result = await db.insert(leases).values(data);
  const id = (result[0] as any).insertId as number;
  // Mark unit as occupied
  await db.update(units).set({ status: "occupied" }).where(eq(units.id, data.unitId));
  const rows = await db.select().from(leases).where(eq(leases.id, id)).limit(1);
  return rows[0];
}

export async function updateLease(id: number, landlordId: number, data: Partial<typeof leases.$inferInsert>) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  await db.update(leases).set(data).where(and(eq(leases.id, id), eq(leases.landlordId, landlordId)));
  // If terminated/expired, mark unit as vacant
  if (data.status === "terminated" || data.status === "expired") {
    const rows = await db.select().from(leases).where(eq(leases.id, id)).limit(1);
    if (rows[0]) {
      await db.update(units).set({ status: "vacant" }).where(eq(units.id, rows[0].unitId));
    }
  }
  const rows = await db.select().from(leases).where(eq(leases.id, id)).limit(1);
  return rows[0];
}

// ─── Rent Invoices ────────────────────────────────────────────────────────────
export async function getInvoicesByLandlord(landlordId: number, filters?: { status?: string; month?: number; year?: number }) {
  const db = await getDb();
  if (!db) return [];
  const conditions = [eq(rentInvoices.landlordId, landlordId)];
  if (filters?.status) conditions.push(eq(rentInvoices.status, filters.status as any));
  if (filters?.month) conditions.push(eq(rentInvoices.periodMonth, filters.month));
  if (filters?.year) conditions.push(eq(rentInvoices.periodYear, filters.year));

  return db
    .select({
      invoice: rentInvoices,
      tenant: { id: tenants.id, firstName: tenants.firstName, lastName: tenants.lastName, phone: tenants.phone },
      unit: { id: units.id, unitNumber: units.unitNumber },
      property: { id: properties.id, name: properties.name },
    })
    .from(rentInvoices)
    .leftJoin(tenants, eq(rentInvoices.tenantId, tenants.id))
    .leftJoin(units, eq(rentInvoices.unitId, units.id))
    .leftJoin(properties, eq(units.propertyId, properties.id))
    .where(and(...conditions))
    .orderBy(desc(rentInvoices.dueDate));
}

export async function getInvoiceById(id: number, landlordId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const rows = await db
    .select({
      invoice: rentInvoices,
      tenant: { id: tenants.id, firstName: tenants.firstName, lastName: tenants.lastName, phone: tenants.phone, email: tenants.email },
      unit: { id: units.id, unitNumber: units.unitNumber },
      property: { id: properties.id, name: properties.name },
    })
    .from(rentInvoices)
    .leftJoin(tenants, eq(rentInvoices.tenantId, tenants.id))
    .leftJoin(units, eq(rentInvoices.unitId, units.id))
    .leftJoin(properties, eq(units.propertyId, properties.id))
    .where(and(eq(rentInvoices.id, id), eq(rentInvoices.landlordId, landlordId)))
    .limit(1);
  return rows[0];
}

export async function generateMonthlyInvoices(landlordId: number, month: number, year: number) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");

  const activeLeases = await db
    .select()
    .from(leases)
    .where(and(eq(leases.landlordId, landlordId), eq(leases.status, "active")));

  const created: number[] = [];
  for (const lease of activeLeases) {
    // Check if invoice already exists for this period
    const existing = await db
      .select()
      .from(rentInvoices)
      .where(and(eq(rentInvoices.leaseId, lease.id), eq(rentInvoices.periodMonth, month), eq(rentInvoices.periodYear, year)))
      .limit(1);
    if (existing.length > 0) continue;

    const dueDate = new Date(year, month - 1, lease.rentDueDay);
    const invoiceNumber = `INV-${landlordId}-${year}${String(month).padStart(2, "0")}-${lease.id}`;
    await db.insert(rentInvoices).values({
      landlordId,
      leaseId: lease.id,
      tenantId: lease.tenantId,
      unitId: lease.unitId,
      invoiceNumber,
      amount: lease.rentAmount,
      dueDate,
      periodMonth: month,
      periodYear: year,
      status: "pending",
    });
    created.push(lease.id);
  }
  return { created: created.length, total: activeLeases.length };
}

export async function updateInvoiceStatus(id: number, landlordId: number, status: string, paidAmount?: string) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  const updateData: Record<string, unknown> = { status };
  if (paidAmount) updateData.paidAmount = paidAmount;
  if (status === "paid") updateData.paidAt = new Date();
  await db.update(rentInvoices).set(updateData as any).where(and(eq(rentInvoices.id, id), eq(rentInvoices.landlordId, landlordId)));
  const rows = await db.select().from(rentInvoices).where(eq(rentInvoices.id, id)).limit(1);
  return rows[0];
}

// ─── Payments ─────────────────────────────────────────────────────────────────
export async function getPaymentsByLandlord(landlordId: number) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select({
      payment: payments,
      tenant: { id: tenants.id, firstName: tenants.firstName, lastName: tenants.lastName },
      invoice: { id: rentInvoices.id, invoiceNumber: rentInvoices.invoiceNumber, periodMonth: rentInvoices.periodMonth, periodYear: rentInvoices.periodYear },
    })
    .from(payments)
    .leftJoin(tenants, eq(payments.tenantId, tenants.id))
    .leftJoin(rentInvoices, eq(payments.invoiceId, rentInvoices.id))
    .where(eq(payments.landlordId, landlordId))
    .orderBy(desc(payments.paymentDate));
}

export async function createPayment(data: typeof payments.$inferInsert) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  const result = await db.insert(payments).values(data);
  const id = (result[0] as any).insertId as number;

  // Update invoice if linked
  if (data.invoiceId) {
    const invoiceRows = await db.select().from(rentInvoices).where(eq(rentInvoices.id, data.invoiceId)).limit(1);
    if (invoiceRows[0]) {
      const invoice = invoiceRows[0];
      const currentPaid = parseFloat(String(invoice.paidAmount || "0"));
      const newPaid = currentPaid + parseFloat(String(data.amount));
      const invoiceAmount = parseFloat(String(invoice.amount));
      const newStatus = newPaid >= invoiceAmount ? "paid" : newPaid > 0 ? "partial" : "pending";
      await db.update(rentInvoices).set({
        paidAmount: String(newPaid),
        status: newStatus as any,
        paidAt: newStatus === "paid" ? new Date() : undefined,
      }).where(eq(rentInvoices.id, data.invoiceId));
    }
  }

  const rows = await db.select().from(payments).where(eq(payments.id, id)).limit(1);
  return rows[0];
}

// ─── Financial Reports ────────────────────────────────────────────────────────
export async function getFinancialSummary(landlordId: number, year: number) {
  const db = await getDb();
  if (!db) return null;

  const allInvoices = await db
    .select()
    .from(rentInvoices)
    .where(and(eq(rentInvoices.landlordId, landlordId), eq(rentInvoices.periodYear, year)));

  const allPayments = await db
    .select()
    .from(payments)
    .where(eq(payments.landlordId, landlordId));

  const totalUnits = await db.select().from(units).where(eq(units.landlordId, landlordId));
  const occupiedUnits = totalUnits.filter((u) => u.status === "occupied").length;

  const monthlyData = Array.from({ length: 12 }, (_, i) => {
    const month = i + 1;
    const monthInvoices = allInvoices.filter((inv) => inv.periodMonth === month);
    const expected = monthInvoices.reduce((sum, inv) => sum + parseFloat(String(inv.amount)), 0);
    const collected = monthInvoices.reduce((sum, inv) => sum + parseFloat(String(inv.paidAmount || "0")), 0);
    return { month, expected, collected, outstanding: expected - collected };
  });

  const totalExpected = allInvoices.reduce((sum, inv) => sum + parseFloat(String(inv.amount)), 0);
  const totalCollected = allInvoices.reduce((sum, inv) => sum + parseFloat(String(inv.paidAmount || "0")), 0);
  const overdueInvoices = allInvoices.filter((inv) => inv.status === "overdue").length;

  return {
    totalExpected,
    totalCollected,
    totalOutstanding: totalExpected - totalCollected,
    overdueInvoices,
    totalUnits: totalUnits.length,
    occupiedUnits,
    vacantUnits: totalUnits.length - occupiedUnits,
    occupancyRate: totalUnits.length > 0 ? (occupiedUnits / totalUnits.length) * 100 : 0,
    monthlyData,
  };
}

export async function getArrears(landlordId: number) {
  const db = await getDb();
  if (!db) return [];

  const overdueRows = await db
    .select({
      invoice: rentInvoices,
      tenant: tenants,
      property: properties,
      unit: units,
    })
    .from(rentInvoices)
    .leftJoin(tenants, eq(rentInvoices.tenantId, tenants.id))
    .leftJoin(leases, eq(rentInvoices.leaseId, leases.id))
    .leftJoin(units, eq(leases.unitId, units.id))
    .leftJoin(properties, eq(units.propertyId, properties.id))
    .where(and(eq(rentInvoices.landlordId, landlordId), eq(rentInvoices.status, "overdue")));

  // Group by tenant
  const grouped: Record<number, { tenantName: string; propertyName: string; totalOverdue: number; overdueCount: number }> = {};
  for (const row of overdueRows) {
    if (!row.tenant) continue;
    const key = row.tenant.id;
    if (!grouped[key]) {
      grouped[key] = {
        tenantName: `${row.tenant.firstName} ${row.tenant.lastName}`,
        propertyName: row.property ? `${row.property.name} — Unit ${row.unit?.unitNumber}` : "Unknown",
        totalOverdue: 0,
        overdueCount: 0,
      };
    }
    grouped[key].totalOverdue += parseFloat(String(row.invoice.amount)) - parseFloat(String(row.invoice.paidAmount || "0"));
    grouped[key].overdueCount += 1;
  }
  return Object.values(grouped);
}

// ─── Notifications ────────────────────────────────────────────────────────────
export async function getNotificationsByLandlord(landlordId: number) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(notifications)
    .where(eq(notifications.landlordId, landlordId))
    .orderBy(desc(notifications.createdAt))
    .limit(50);
}

export async function createNotification(data: typeof notifications.$inferInsert) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  const result = await db.insert(notifications).values(data);
  const id = (result[0] as any).insertId as number;
  const rows = await db.select().from(notifications).where(eq(notifications.id, id)).limit(1);
  return rows[0];
}

export async function markNotificationRead(id: number, landlordId: number) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  await db.update(notifications).set({ status: "read", readAt: new Date() }).where(and(eq(notifications.id, id), eq(notifications.landlordId, landlordId)));
}

// ─── Documents ────────────────────────────────────────────────────────────────
export async function getDocumentsByLandlord(landlordId: number, tenantId?: number, leaseId?: number) {
  const db = await getDb();
  if (!db) return [];
  const conditions = [eq(documents.landlordId, landlordId)];
  if (tenantId) conditions.push(eq(documents.tenantId, tenantId));
  if (leaseId) conditions.push(eq(documents.leaseId, leaseId));
  return db.select().from(documents).where(and(...conditions)).orderBy(desc(documents.createdAt));
}

export async function createDocument(data: typeof documents.$inferInsert) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  const result = await db.insert(documents).values(data);
  const id = (result[0] as any).insertId as number;
  const rows = await db.select().from(documents).where(eq(documents.id, id)).limit(1);
  return rows[0];
}

export async function deleteDocument(id: number, landlordId: number) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  const rows = await db.select().from(documents).where(and(eq(documents.id, id), eq(documents.landlordId, landlordId))).limit(1);
  if (rows[0]) {
    await db.delete(documents).where(eq(documents.id, id));
    return rows[0].fileKey;
  }
  return null;
}

// ─── Subscriptions ────────────────────────────────────────────────────────────
export async function getSubscriptionPlans() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(subscriptionPlans).where(eq(subscriptionPlans.isActive, true));
}

export async function getSubscriptionByLandlord(landlordId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const rows = await db
    .select({ subscription: subscriptions, plan: subscriptionPlans })
    .from(subscriptions)
    .leftJoin(subscriptionPlans, eq(subscriptions.planId, subscriptionPlans.id))
    .where(and(eq(subscriptions.landlordId, landlordId), eq(subscriptions.status, "active")))
    .orderBy(desc(subscriptions.createdAt))
    .limit(1);
  return rows[0];
}

export async function createSubscription(data: typeof subscriptions.$inferInsert) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  const result = await db.insert(subscriptions).values(data);
  const id = (result[0] as any).insertId as number;
  // Update landlord plan
  const plan = await db.select().from(subscriptionPlans).where(eq(subscriptionPlans.id, data.planId)).limit(1);
  if (plan[0]) {
    await db.update(landlords).set({
      subscriptionPlan: plan[0].name,
      subscriptionStatus: "active",
      subscriptionExpiresAt: data.endDate,
    }).where(eq(landlords.id, data.landlordId));
  }
  const rows = await db.select().from(subscriptions).where(eq(subscriptions.id, id)).limit(1);
  return rows[0];
}

// ─── Admin ────────────────────────────────────────────────────────────────────
export async function getPlatformStats() {
  const db = await getDb();
  if (!db) return null;

  const totalLandlords = await db.select({ count: sql<number>`count(*)` }).from(landlords);
  const totalProperties = await db.select({ count: sql<number>`count(*)` }).from(properties).where(eq(properties.isActive, true));
  const totalUnitsCount = await db.select({ count: sql<number>`count(*)` }).from(units);
  const totalTenants = await db.select({ count: sql<number>`count(*)` }).from(tenants).where(eq(tenants.isActive, true));
  const totalPaymentsSum = await db.select({ sum: sql<string>`COALESCE(SUM(amount), 0)` }).from(payments);

  const planBreakdown = await db
    .select({ plan: landlords.subscriptionPlan, count: sql<number>`count(*)` })
    .from(landlords)
    .groupBy(landlords.subscriptionPlan);

  return {
    totalLandlords: Number(totalLandlords[0]?.count || 0),
    totalProperties: Number(totalProperties[0]?.count || 0),
    totalUnits: Number(totalUnitsCount[0]?.count || 0),
    totalTenants: Number(totalTenants[0]?.count || 0),
    totalRevenue: parseFloat(String(totalPaymentsSum[0]?.sum || "0")),
    planBreakdown,
  };
}

export async function getAuditLogs(landlordId?: number, limit = 50) {
  const db = await getDb();
  if (!db) return [];
  const conditions = landlordId ? [eq(auditLogs.landlordId, landlordId)] : [];
  return db
    .select()
    .from(auditLogs)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(auditLogs.createdAt))
    .limit(limit);
}

export async function createAuditLog(data: typeof auditLogs.$inferInsert) {
  const db = await getDb();
  if (!db) return;
  await db.insert(auditLogs).values(data);
}

export async function toggleLandlordStatus(landlordId: number, isActive: boolean) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  await db.update(landlords).set({ isActive }).where(eq(landlords.id, landlordId));
}
