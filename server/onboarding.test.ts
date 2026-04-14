import { describe, it, expect } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createAuthContext(userId: number = 1): TrpcContext {
  const user: AuthenticatedUser = {
    id: userId,
    openId: `user-${userId}`,
    email: `user${userId}@example.com`,
    name: `User ${userId}`,
    loginMethod: "manus",
    role: "user",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };

  return {
    user,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

describe("Onboarding System", () => {
  describe("landlord.completeOnboarding", () => {
    it("should mark onboarding as completed", async () => {
      const ctx = createAuthContext();
      const caller = appRouter.createCaller(ctx);

      // Setup landlord first
      await caller.landlord.setup({
        businessName: "Test Business",
        phone: "+254712345678",
      });

      // Complete onboarding
      const result = await caller.landlord.completeOnboarding();

      expect(result).toBeDefined();
      expect(result.onboardingStatus).toBe("completed");
      expect(result.onboardingCompletedAt).toBeDefined();
    });

    it("should update onboarding status in database", async () => {
      const ctx = createAuthContext(2);
      const caller = appRouter.createCaller(ctx);

      await caller.landlord.setup({
        businessName: "Another Business",
      });

      await caller.landlord.completeOnboarding();

      const profile = await caller.landlord.profile();
      expect(profile?.onboardingStatus).toBe("completed");
    });
  });

  describe("landlord.skipOnboarding", () => {
    it("should mark onboarding as skipped", async () => {
      const ctx = createAuthContext(3);
      const caller = appRouter.createCaller(ctx);

      await caller.landlord.setup({
        businessName: "Skip Test Business",
      });

      const result = await caller.landlord.skipOnboarding();

      expect(result).toBeDefined();
      expect(result.onboardingStatus).toBe("skipped");
    });

    it("should not set onboardingCompletedAt when skipped", async () => {
      const ctx = createAuthContext(4);
      const caller = appRouter.createCaller(ctx);

      await caller.landlord.setup({
        businessName: "Skip Test Business 2",
      });

      await caller.landlord.skipOnboarding();

      const profile = await caller.landlord.profile();
      expect(profile?.onboardingStatus).toBe("skipped");
      expect(profile?.onboardingCompletedAt).toBeNull();
    });
  });

  describe("Onboarding Workflow", () => {
    it("should complete full onboarding workflow", async () => {
      const ctx = createAuthContext(5);
      const caller = appRouter.createCaller(ctx);

      // Step 1: Setup business info
      const setup = await caller.landlord.setup({
        businessName: "Full Workflow Business",
        phone: "+254798765432",
        city: "Nairobi",
      });

      expect(setup.businessName).toBe("Full Workflow Business");
      expect(setup.onboardingStatus).toBe("not_started");

      // Step 2: Add first property
      const property = await caller.properties.create({
        name: "Westlands Apartments",
        address: "123 Main Street",
        city: "Nairobi",
        propertyType: "residential",
        totalUnits: 5,
      });

      expect(property).toBeDefined();

      // Step 3: Add first tenant
      const tenant = await caller.tenants.create({
        firstName: "John",
        lastName: "Doe",
        email: "john@example.com",
      });

      expect(tenant).toBeDefined();

      // Step 4: Complete onboarding
      const completed = await caller.landlord.completeOnboarding();

      expect(completed.onboardingStatus).toBe("completed");
      expect(completed.onboardingCompletedAt).toBeDefined();
    });

    it("should allow skipping onboarding at any point", async () => {
      const ctx = createAuthContext(6);
      const caller = appRouter.createCaller(ctx);

      await caller.landlord.setup({
        businessName: "Skip Anytime Business",
      });

      // Skip without completing setup
      const skipped = await caller.landlord.skipOnboarding();

      expect(skipped.onboardingStatus).toBe("skipped");
    });
  });

  describe("Onboarding Status Transitions", () => {
    it("should start with not_started status", async () => {
      const ctx = createAuthContext(7);
      const caller = appRouter.createCaller(ctx);

      const setup = await caller.landlord.setup({
        businessName: "Status Test Business",
      });

      expect(setup.onboardingStatus).toBe("not_started");
    });

    it("should transition from not_started to completed", async () => {
      const ctx = createAuthContext(8);
      const caller = appRouter.createCaller(ctx);

      const setup = await caller.landlord.setup({
        businessName: "Transition Test Business",
      });

      expect(setup.onboardingStatus).toBe("not_started");

      const completed = await caller.landlord.completeOnboarding();

      expect(completed.onboardingStatus).toBe("completed");
      expect(completed.onboardingCompletedAt).not.toBeNull();
    });

    it("should allow transition from not_started to skipped", async () => {
      const ctx = createAuthContext(9);
      const caller = appRouter.createCaller(ctx);

      await caller.landlord.setup({
        businessName: "Skip Transition Business",
      });

      const skipped = await caller.landlord.skipOnboarding();

      expect(skipped.onboardingStatus).toBe("skipped");
    });
  });
});
