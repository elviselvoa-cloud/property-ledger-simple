import { COOKIE_NAME } from "@shared/const";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { protectedProcedure, publicProcedure, router } from "./_core/trpc";
import {
  createAuditLog,
  createDocument,
  createLandlord,
  createLease,
  createNotification,
  createPayment,
  createProperty,
  createSubscription,
  createTenant,
  createUnit,
  deleteDocument,
  deleteProperty,
  deleteTenant,
  deleteUnit,
  generateMonthlyInvoices,
  getAllLandlords,
  getAuditLogs,
  getDocumentsByLandlord,
  getArrears,
  getFinancialSummary,
  getInvoiceById,
  getInvoicesByLandlord,
  getLandlordByUserId,
  getLeaseById,
  getLeasesByLandlord,
  getNotificationsByLandlord,
  getPaymentsByLandlord,
  getPlatformStats,
  getPropertiesByLandlord,
  getPropertyById,
  getSubscriptionByLandlord,
  getSubscriptionPlans,
  getTenantById,
  getTenantsByLandlord,
  getUnitById,
  getUnitsByLandlord,
  getUnitsByProperty,
  markNotificationRead,
  toggleLandlordStatus,
  updateInvoiceStatus,
  updateLandlord,
  updateLease,
  updateProperty,
  updateTenant,
  updateUnit,
} from "./db";
import { invokeLLM } from "./_core/llm";
import { storagePut } from "./storage";
import { nanoid } from "nanoid";

// ─── Helpers ──────────────────────────────────────────────────────────────────
const adminProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN", message: "Admin access required" });
  return next({ ctx });
});

async function requireLandlord(userId: number) {
  const landlord = await getLandlordByUserId(userId);
  if (!landlord) throw new TRPCError({ code: "NOT_FOUND", message: "Landlord profile not found. Please complete your profile setup." });
  if (!landlord.isActive) throw new TRPCError({ code: "FORBIDDEN", message: "Your account has been suspended." });
  return landlord;
}

// ─── App Router ───────────────────────────────────────────────────────────────
export const appRouter = router({
  system: systemRouter,

  auth: router({
    me: publicProcedure.query((opts) => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),

  // ─── Landlord Profile ─────────────────────────────────────────────────────
  landlord: router({
    profile: protectedProcedure.query(async ({ ctx }) => {
      return getLandlordByUserId(ctx.user.id);
    }),

    setup: protectedProcedure
      .input(z.object({
        businessName: z.string().optional(),
        phone: z.string().optional(),
        address: z.string().optional(),
        city: z.string().optional(),
        country: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const existing = await getLandlordByUserId(ctx.user.id);
        if (existing) {
          return updateLandlord(existing.id, input);
        }
        const trialEndsAt = new Date();
        trialEndsAt.setDate(trialEndsAt.getDate() + 60);
        return createLandlord({
          userId: ctx.user.id,
          ...input,
          trialEndsAt,
          subscriptionPlan: "free",
          subscriptionStatus: "active",
        });
      }),

    update: protectedProcedure
      .input(z.object({
        businessName: z.string().optional(),
        phone: z.string().optional(),
        address: z.string().optional(),
        city: z.string().optional(),
        country: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const landlord = await requireLandlord(ctx.user.id);
        return updateLandlord(landlord.id, input);
      }),

    completeOnboarding: protectedProcedure
      .mutation(async ({ ctx }) => {
        const landlord = await requireLandlord(ctx.user.id);
        return updateLandlord(landlord.id, {
          onboardingStatus: "completed",
          onboardingCompletedAt: new Date(),
        });
      }),

    skipOnboarding: protectedProcedure
      .mutation(async ({ ctx }) => {
        const landlord = await requireLandlord(ctx.user.id);
        return updateLandlord(landlord.id, {
          onboardingStatus: "skipped",
        });
      }),
  }),

  // ─── Properties ───────────────────────────────────────────────────────────
  properties: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      const landlord = await requireLandlord(ctx.user.id);
      return getPropertiesByLandlord(landlord.id);
    }),

    get: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ ctx, input }) => {
        const landlord = await requireLandlord(ctx.user.id);
        return getPropertyById(input.id, landlord.id);
      }),

    create: protectedProcedure
      .input(z.object({
        name: z.string().min(1),
        address: z.string().min(1),
        city: z.string().optional(),
        propertyType: z.enum(["residential", "commercial", "mixed"]).default("residential"),
        totalUnits: z.number().min(1).default(1),
        description: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const landlord = await requireLandlord(ctx.user.id);
        const property = await createProperty({ ...input, landlordId: landlord.id });
        await createAuditLog({ userId: ctx.user.id, landlordId: landlord.id, action: "create_property", entity: "property", entityId: property?.id, details: JSON.stringify({ name: input.name }) });
        return property;
      }),

    update: protectedProcedure
      .input(z.object({
        id: z.number(),
        name: z.string().min(1).optional(),
        address: z.string().optional(),
        city: z.string().optional(),
        propertyType: z.enum(["residential", "commercial", "mixed"]).optional(),
        totalUnits: z.number().min(1).optional(),
        description: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const landlord = await requireLandlord(ctx.user.id);
        const { id, ...data } = input;
        return updateProperty(id, landlord.id, data);
      }),

    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const landlord = await requireLandlord(ctx.user.id);
        await deleteProperty(input.id, landlord.id);
        return { success: true };
      }),

    units: protectedProcedure
      .input(z.object({ propertyId: z.number() }))
      .query(async ({ ctx, input }) => {
        const landlord = await requireLandlord(ctx.user.id);
        return getUnitsByProperty(input.propertyId, landlord.id);
      }),
  }),

  // ─── Units ────────────────────────────────────────────────────────────────
  units: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      const landlord = await requireLandlord(ctx.user.id);
      return getUnitsByLandlord(landlord.id);
    }),

    get: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ ctx, input }) => {
        const landlord = await requireLandlord(ctx.user.id);
        return getUnitById(input.id, landlord.id);
      }),

    create: protectedProcedure
      .input(z.object({
        propertyId: z.number(),
        unitNumber: z.string().min(1),
        floor: z.string().optional(),
        bedrooms: z.number().min(0).default(1),
        bathrooms: z.number().min(0).default(1),
        size: z.string().optional(),
        rentAmount: z.string(),
        depositAmount: z.string().optional(),
        description: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const landlord = await requireLandlord(ctx.user.id);
        return createUnit({ ...input, landlordId: landlord.id, status: "vacant" });
      }),

    update: protectedProcedure
      .input(z.object({
        id: z.number(),
        unitNumber: z.string().optional(),
        floor: z.string().optional(),
        bedrooms: z.number().optional(),
        bathrooms: z.number().optional(),
        size: z.string().optional(),
        rentAmount: z.string().optional(),
        depositAmount: z.string().optional(),
        status: z.enum(["vacant", "occupied", "maintenance"]).optional(),
        description: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const landlord = await requireLandlord(ctx.user.id);
        const { id, ...data } = input;
        return updateUnit(id, landlord.id, data);
      }),

    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const landlord = await requireLandlord(ctx.user.id);
        await deleteUnit(input.id, landlord.id);
        return { success: true };
      }),
  }),

  // ─── Tenants ──────────────────────────────────────────────────────────────
  tenants: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      const landlord = await requireLandlord(ctx.user.id);
      return getTenantsByLandlord(landlord.id);
    }),

    get: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ ctx, input }) => {
        const landlord = await requireLandlord(ctx.user.id);
        return getTenantById(input.id, landlord.id);
      }),

    create: protectedProcedure
      .input(z.object({
        firstName: z.string().min(1),
        lastName: z.string().min(1),
        email: z.string().email().optional().or(z.literal("")),
        phone: z.string().optional(),
        nationalId: z.string().optional(),
        emergencyContact: z.string().optional(),
        emergencyPhone: z.string().optional(),
        notes: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const landlord = await requireLandlord(ctx.user.id);
        const tenant = await createTenant({ ...input, landlordId: landlord.id });
        await createAuditLog({ userId: ctx.user.id, landlordId: landlord.id, action: "create_tenant", entity: "tenant", entityId: tenant?.id });
        return tenant;
      }),

    update: protectedProcedure
      .input(z.object({
        id: z.number(),
        firstName: z.string().optional(),
        lastName: z.string().optional(),
        email: z.string().email().optional().or(z.literal("")),
        phone: z.string().optional(),
        nationalId: z.string().optional(),
        emergencyContact: z.string().optional(),
        emergencyPhone: z.string().optional(),
        notes: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const landlord = await requireLandlord(ctx.user.id);
        const { id, ...data } = input;
        return updateTenant(id, landlord.id, data);
      }),

    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const landlord = await requireLandlord(ctx.user.id);
        await deleteTenant(input.id, landlord.id);
        return { success: true };
      }),
  }),

  // ─── Leases ───────────────────────────────────────────────────────────────
  leases: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      const landlord = await requireLandlord(ctx.user.id);
      return getLeasesByLandlord(landlord.id);
    }),

    get: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ ctx, input }) => {
        const landlord = await requireLandlord(ctx.user.id);
        return getLeaseById(input.id, landlord.id);
      }),

    create: protectedProcedure
      .input(z.object({
        tenantId: z.number(),
        unitId: z.number(),
        startDate: z.string(),
        endDate: z.string().optional(),
        rentAmount: z.string(),
        depositAmount: z.string().optional(),
        depositPaid: z.boolean().default(false),
        rentDueDay: z.number().min(1).max(28).default(1),
        notes: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const landlord = await requireLandlord(ctx.user.id);
        const lease = await createLease({
          ...input,
          landlordId: landlord.id,
          startDate: new Date(input.startDate),
          endDate: input.endDate ? new Date(input.endDate) : undefined,
          status: "active",
        });
        await createAuditLog({ userId: ctx.user.id, landlordId: landlord.id, action: "create_lease", entity: "lease", entityId: lease?.id });
        return lease;
      }),

    update: protectedProcedure
      .input(z.object({
        id: z.number(),
        startDate: z.string().optional(),
        endDate: z.string().optional(),
        rentAmount: z.string().optional(),
        depositAmount: z.string().optional(),
        depositPaid: z.boolean().optional(),
        rentDueDay: z.number().min(1).max(28).optional(),
        status: z.enum(["active", "expired", "terminated", "pending"]).optional(),
        notes: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const landlord = await requireLandlord(ctx.user.id);
        const { id, startDate, endDate, ...rest } = input;
        return updateLease(id, landlord.id, {
          ...rest,
          ...(startDate ? { startDate: new Date(startDate) } : {}),
          ...(endDate ? { endDate: new Date(endDate) } : {}),
        });
      }),
  }),

  // ─── Invoices ─────────────────────────────────────────────────────────────
  invoices: router({
    list: protectedProcedure
      .input(z.object({
        status: z.string().optional(),
        month: z.number().optional(),
        year: z.number().optional(),
      }).optional())
      .query(async ({ ctx, input }) => {
        const landlord = await requireLandlord(ctx.user.id);
        return getInvoicesByLandlord(landlord.id, input);
      }),

    get: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ ctx, input }) => {
        const landlord = await requireLandlord(ctx.user.id);
        return getInvoiceById(input.id, landlord.id);
      }),

    generate: protectedProcedure
      .input(z.object({ month: z.number().min(1).max(12), year: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const landlord = await requireLandlord(ctx.user.id);
        const result = await generateMonthlyInvoices(landlord.id, input.month, input.year);
        await createAuditLog({ userId: ctx.user.id, landlordId: landlord.id, action: "generate_invoices", details: JSON.stringify(result) });
        return result;
      }),

    updateStatus: protectedProcedure
      .input(z.object({
        id: z.number(),
        status: z.enum(["pending", "paid", "overdue", "partial", "cancelled"]),
        paidAmount: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const landlord = await requireLandlord(ctx.user.id);
        return updateInvoiceStatus(input.id, landlord.id, input.status, input.paidAmount);
      }),
  }),

  // ─── Payments ─────────────────────────────────────────────────────────────
  payments: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      const landlord = await requireLandlord(ctx.user.id);
      return getPaymentsByLandlord(landlord.id);
    }),

    initiateSTKPush: protectedProcedure
      .input(z.object({
        invoiceId: z.number(),
        tenantId: z.number(),
        phoneNumber: z.string(),
        amount: z.number(),
      }))
      .mutation(async ({ ctx, input }) => {
        const landlord = await requireLandlord(ctx.user.id);
        const invoice = await getInvoiceById(input.invoiceId, landlord.id);
        if (!invoice) throw new TRPCError({ code: "NOT_FOUND", message: "Invoice not found" });

        // Import M-Pesa module
        const { initiateSTKPush } = await import("./mpesa");

        // Initiate STK Push
        const response = await initiateSTKPush({
          phoneNumber: input.phoneNumber,
          amount: input.amount,
          accountReference: `INV-${input.invoiceId}`,
          transactionDesc: `Rent payment for invoice ${input.invoiceId}`,
        });

        if (!response.success) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: response.responseDescription,
          });
        }

        // Create notification for tenant
        await createNotification({
          landlordId: landlord.id,
          tenantId: input.tenantId,
          type: "payment_request",
          channel: "in_app",
          title: "M-Pesa Payment Request",
          message: response.customerMessage,
          status: "sent",
          sentAt: new Date(),
        });

        // Log audit
        await createAuditLog({
          userId: ctx.user.id,
          landlordId: landlord.id,
          action: "initiate_mpesa_payment",
          entity: "invoice",
          entityId: input.invoiceId,
          details: JSON.stringify({ checkoutRequestId: response.checkoutRequestId, amount: input.amount }),
        });

        return {
          success: true,
          checkoutRequestId: response.checkoutRequestId,
          customerMessage: response.customerMessage,
        };
      }),

    confirmMpesaPayment: protectedProcedure
      .input(z.object({
        invoiceId: z.number(),
        tenantId: z.number(),
        checkoutRequestId: z.string(),
        mpesaReceiptNumber: z.string(),
        amount: z.number(),
        phoneNumber: z.string(),
      }))
      .mutation(async ({ ctx, input }) => {
        const landlord = await requireLandlord(ctx.user.id);
        const invoice = await getInvoiceById(input.invoiceId, landlord.id);
        if (!invoice) throw new TRPCError({ code: "NOT_FOUND", message: "Invoice not found" });

        // Record payment
        const payment = await createPayment({
          invoiceId: input.invoiceId,
          tenantId: input.tenantId,
          amount: String(input.amount),
          paymentMethod: "mpesa",
          mpesaTransactionId: input.mpesaReceiptNumber,
          paymentDate: new Date(),
          landlordId: landlord.id,
        });

        // Update invoice status
        await updateInvoiceStatus(input.invoiceId, landlord.id, "paid", String(input.amount));

        // Create notifications
        await createNotification({
          landlordId: landlord.id,
          tenantId: input.tenantId,
          type: "payment_confirmation",
          channel: "in_app",
          title: "Payment Confirmed",
          message: `Payment of KES ${input.amount} confirmed. Receipt: ${input.mpesaReceiptNumber}`,
          status: "sent",
          sentAt: new Date(),
        });

        await createNotification({
          landlordId: landlord.id,
          type: "payment_received",
          channel: "in_app",
          title: "Payment Received",
          message: `Received KES ${input.amount} from tenant for invoice ${input.invoiceId}`,
          status: "sent",
          sentAt: new Date(),
        });

        // Log audit
        await createAuditLog({
          userId: ctx.user.id,
          landlordId: landlord.id,
          action: "confirm_mpesa_payment",
          entity: "payment",
          entityId: payment?.id,
          details: JSON.stringify({ mpesaReceipt: input.mpesaReceiptNumber, amount: input.amount }),
        });

        return {
          success: true,
          paymentId: payment?.id,
          message: "Payment confirmed and invoice marked as paid",
        };
      }),

    record: protectedProcedure
      .input(z.object({
        invoiceId: z.number().optional(),
        tenantId: z.number(),
        amount: z.string(),
        paymentMethod: z.enum(["mpesa", "bank_transfer", "cash", "other"]),
        mpesaTransactionId: z.string().optional(),
        bankReference: z.string().optional(),
        receiptNumber: z.string().optional(),
        paymentDate: z.string(),
        notes: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const landlord = await requireLandlord(ctx.user.id);
        const payment = await createPayment({
          ...input,
          landlordId: landlord.id,
          paymentDate: new Date(input.paymentDate),
        });
        // Create in-app notification
        await createNotification({
          landlordId: landlord.id,
          tenantId: input.tenantId,
          type: "payment_confirmation",
          channel: "in_app",
          title: "Payment Recorded",
          message: `Payment of KES ${input.amount} recorded via ${input.paymentMethod.replace("_", " ")}.`,
          status: "sent",
          sentAt: new Date(),
        });
        await createAuditLog({ userId: ctx.user.id, landlordId: landlord.id, action: "record_payment", entity: "payment", entityId: payment?.id, details: JSON.stringify({ amount: input.amount, method: input.paymentMethod }) });
        return payment;
      }),
  }),

  // ─── Reports ──────────────────────────────────────────────────────────────
  reports: router({
    financial: protectedProcedure
      .input(z.object({ year: z.number().default(new Date().getFullYear()) }))
      .query(async ({ ctx, input }) => {
        const landlord = await requireLandlord(ctx.user.id);
        return getFinancialSummary(landlord.id, input.year);
      }),

    arrears: protectedProcedure.query(async ({ ctx }) => {
      const landlord = await requireLandlord(ctx.user.id);
      return getArrears(landlord.id);
    }),
  }),

  // ─── Notifications ────────────────────────────────────────────────────────
  notifications: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      const landlord = await requireLandlord(ctx.user.id);
      return getNotificationsByLandlord(landlord.id);
    }),

    markRead: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const landlord = await requireLandlord(ctx.user.id);
        await markNotificationRead(input.id, landlord.id);
        return { success: true };
      }),

    sendReminder: protectedProcedure
      .input(z.object({
        tenantId: z.number(),
        type: z.enum(["rent_reminder", "overdue_alert", "general"]),
        message: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const landlord = await requireLandlord(ctx.user.id);
        const tenant = await getTenantById(input.tenantId, landlord.id);
        if (!tenant) throw new TRPCError({ code: "NOT_FOUND" });

        const defaultMessages: Record<string, string> = {
          rent_reminder: `Dear ${tenant.firstName}, this is a reminder that your rent is due soon. Please ensure timely payment.`,
          overdue_alert: `Dear ${tenant.firstName}, your rent payment is overdue. Please contact your landlord immediately.`,
          general: input.message || "Message from your landlord.",
        };

        const notification = await createNotification({
          landlordId: landlord.id,
          tenantId: input.tenantId,
          type: input.type,
          channel: "in_app",
          title: input.type === "rent_reminder" ? "Rent Reminder" : input.type === "overdue_alert" ? "Overdue Alert" : "Message",
          message: input.message || defaultMessages[input.type],
          status: "sent",
          sentAt: new Date(),
        });
        return notification;
      }),
  }),

  // ─── Documents ────────────────────────────────────────────────────────────
  documents: router({
    list: protectedProcedure
      .input(z.object({ tenantId: z.number().optional(), leaseId: z.number().optional() }).optional())
      .query(async ({ ctx, input }) => {
        const landlord = await requireLandlord(ctx.user.id);
        return getDocumentsByLandlord(landlord.id, input?.tenantId, input?.leaseId);
      }),

    upload: protectedProcedure
      .input(z.object({
        name: z.string().min(1),
        fileData: z.string(), // base64
        mimeType: z.string(),
        fileSize: z.number(),
        documentType: z.enum(["lease_agreement", "tenant_id", "payment_receipt", "property_photo", "other"]),
        tenantId: z.number().optional(),
        leaseId: z.number().optional(),
        paymentId: z.number().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const landlord = await requireLandlord(ctx.user.id);
        const buffer = Buffer.from(input.fileData, "base64");
        const ext = input.mimeType.split("/")[1] || "bin";
        const fileKey = `landlord-${landlord.id}/docs/${nanoid()}.${ext}`;
        const { url } = await storagePut(fileKey, buffer, input.mimeType);
        const doc = await createDocument({
          landlordId: landlord.id,
          tenantId: input.tenantId,
          leaseId: input.leaseId,
          paymentId: input.paymentId,
          name: input.name,
          fileKey,
          fileUrl: url,
          mimeType: input.mimeType,
          fileSize: input.fileSize,
          documentType: input.documentType,
        });
        return doc;
      }),

    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const landlord = await requireLandlord(ctx.user.id);
        await deleteDocument(input.id, landlord.id);
        return { success: true };
      }),
  }),

  // ─── Subscriptions ────────────────────────────────────────────────────────
  subscriptions: router({
    plans: publicProcedure.query(async () => {
      return getSubscriptionPlans();
    }),

    current: protectedProcedure.query(async ({ ctx }) => {
      const landlord = await getLandlordByUserId(ctx.user.id);
      if (!landlord) return null;
      return getSubscriptionByLandlord(landlord.id);
    }),

    upgrade: protectedProcedure
      .input(z.object({
        planId: z.number(),
        paymentMethod: z.string().optional(),
        mpesaTransactionId: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const landlord = await requireLandlord(ctx.user.id);
        const plans = await getSubscriptionPlans();
        const plan = plans.find((p) => p.id === input.planId);
        if (!plan) throw new TRPCError({ code: "NOT_FOUND", message: "Plan not found" });

        const startDate = new Date();
        const endDate = new Date();
        endDate.setMonth(endDate.getMonth() + 1);

        const sub = await createSubscription({
          landlordId: landlord.id,
          planId: input.planId,
          status: "active",
          startDate,
          endDate,
          amount: plan.price,
          paymentMethod: input.paymentMethod,
          mpesaTransactionId: input.mpesaTransactionId,
        });
        await createAuditLog({ userId: ctx.user.id, landlordId: landlord.id, action: "upgrade_subscription", details: JSON.stringify({ plan: plan.name }) });
        return sub;
      }),
  }),

  // ─── LLM Assistant ────────────────────────────────────────────────────────
  assistant: router({
    chat: protectedProcedure
      .input(z.object({
        mode: z.enum(["portfolio_qa", "rent_pricing", "lease_draft"]),
        message: z.string().min(1),
        context: z.record(z.string(), z.any()).optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const landlord = await requireLandlord(ctx.user.id);

        // Gather portfolio context
        const [propertiesList, tenantsList, invoicesList] = await Promise.all([
          getPropertiesByLandlord(landlord.id),
          getTenantsByLandlord(landlord.id),
          getInvoicesByLandlord(landlord.id, { status: "overdue" }),
        ]);

        const portfolioContext = `
Landlord: ${landlord.businessName || "Property Owner"}
Properties: ${propertiesList.length} properties
Tenants: ${tenantsList.length} active tenants
Overdue invoices: ${invoicesList.length}
Country: ${landlord.country || "Kenya"}
        `.trim();

        const systemPrompts: Record<string, string> = {
          portfolio_qa: `You are a helpful property management assistant for a landlord in ${landlord.country || "Kenya"}. 
You have access to their portfolio data: ${portfolioContext}
Answer questions about their rental portfolio, occupancy, finances, and tenants accurately and concisely.`,

          rent_pricing: `You are a real estate pricing expert for ${landlord.country || "Kenya"}.
Portfolio context: ${portfolioContext}
Help the landlord determine competitive rent prices based on property details, location, market trends, and their existing portfolio data.
Provide specific KES amounts and reasoning.`,

          lease_draft: `You are a professional property management assistant specializing in Kenyan rental law and lease agreements.
Portfolio context: ${portfolioContext}
Help draft lease summaries, tenant communication letters, rent increase notices, or other property-related documents.
Be professional, clear, and compliant with Kenyan rental regulations.`,
        };

        const response = await invokeLLM({
          messages: [
            { role: "system", content: systemPrompts[input.mode] },
            { role: "user", content: input.message },
          ],
        });

        return {
          reply: response.choices[0]?.message?.content || "I could not generate a response. Please try again.",
          mode: input.mode,
        };
      }),
  }),

  // ─── Admin ────────────────────────────────────────────────────────────────
  admin: router({
    stats: adminProcedure.query(async () => {
      return getPlatformStats();
    }),

    landlords: adminProcedure.query(async () => {
      return getAllLandlords();
    }),

    toggleUser: adminProcedure
      .input(z.object({ landlordId: z.number(), isActive: z.boolean() }))
      .mutation(async ({ ctx, input }) => {
        await toggleLandlordStatus(input.landlordId, input.isActive);
        await createAuditLog({ userId: ctx.user.id, action: input.isActive ? "activate_user" : "suspend_user", entity: "landlord", entityId: input.landlordId });
        return { success: true };
      }),

    auditLogs: adminProcedure
      .input(z.object({ landlordId: z.number().optional() }).optional())
      .query(async ({ input }) => {
        return getAuditLogs(input?.landlordId, 100);
      }),
  }),
});

export type AppRouter = typeof appRouter;
