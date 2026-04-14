# Property Ledger - TODO

## Phase 1: Database Schema & Design System
- [x] Design system: color palette, typography, global CSS (deep teal + warm slate, Inter font)
- [x] Database schema: landlords, properties, units, tenants, leases tables
- [x] Database schema: rent_invoices, payments, subscriptions, plans tables
- [x] Database schema: notifications, audit_logs, documents tables
- [x] Run migrations and verify schema

## Phase 2: Backend Core APIs
- [x] Auth: RBAC with landlord and admin roles (protectedProcedure + adminProcedure)
- [x] Properties CRUD API (scoped per landlord)
- [x] Units CRUD API (per property)
- [x] Tenants CRUD API (scoped per landlord)
- [x] Leases CRUD API with status management
- [x] Rent invoices: auto-generate monthly invoices per lease
- [x] Payments: log M-Pesa, bank transfer, cash payments; mark invoices paid

## Phase 3: Backend Advanced APIs
- [x] In-app notifications: rent reminders, payment confirmations, overdue alerts
- [x] Subscription plans: free, basic, pro with feature gating
- [x] Subscription management API (upgrade/downgrade)
- [x] Admin panel APIs: all landlords, platform stats, user management, audit logs
- [x] Document upload and storage (S3) associated to tenant/lease
- [x] LLM assistant: portfolio Q&A, rent pricing suggestions, lease/communication drafts
- [x] Financial reports API: monthly income, occupancy, arrears

## Phase 4: Frontend Core
- [x] Landing page with hero, features, pricing sections
- [x] Auth flow (login/signup via Manus OAuth)
- [x] Dashboard layout with sidebar navigation (deep teal sidebar)
- [x] Landlord dashboard: overview stats, occupancy, income charts
- [x] Properties management UI (list, add, edit, delete)
- [x] Units management UI per property
- [x] Tenants management UI (list, add, edit, delete)

## Phase 5: Frontend Rent & Finance
- [x] Leases management UI (create, edit, view)
- [x] Rent invoices UI: list, status badges, generate monthly
- [x] Payments recording UI: log payment with method (M-Pesa/bank/cash)
- [x] Financial reports: income summary, arrears, occupancy charts (recharts)
- [x] Subscription page: plan comparison, upgrade/downgrade
- [x] Notifications page: list, mark read, send reminders

## Phase 6: Frontend Advanced
- [x] Admin panel: landlord list, platform stats, user management (admin-only)
- [x] LLM assistant chat UI with three modes (portfolio Q&A, rent pricing, lease draft)
- [x] Document storage UI: upload, list, download per tenant/lease
- [x] Settings page: business profile, country, notifications preferences
- [x] Mobile responsive polish across all pages

## Phase 7: Quality & Delivery
- [x] Vitest unit tests: 29 tests across auth, properties, tenants, invoices, payments, notifications, reports, subscriptions, documents, admin, assistant
- [x] Final checkpoint and delivery


## Mobile Responsiveness Audit
- [x] Dashboard: responsive grid, optimized chart heights, mobile-first padding
- [x] Properties: single column grid on mobile, full-width buttons and cards
- [x] Invoices: responsive card layout, stacked headers, and optimized text sizing
- [x] Tenants: mobile-optimized cards with responsive grid, full-width buttons
- [x] Leases: responsive form layout, mobile-optimized card view
- [x] Payments: responsive form layout, mobile-first padding, full-width buttons
- [x] Reports: responsive KPI cards, optimized chart heights, mobile table
- [x] Subscription: single column plan cards, responsive pricing, mobile-friendly buttons
- [x] Documents: responsive grid, mobile-friendly file upload, optimized dialogs
- [x] Assistant: optimized chat UI for mobile, full-width input, responsive mode selector
- [x] Admin Panel: responsive landlord table, mobile-friendly stats, hidden columns on mobile
- [x] Settings: single column form, touch-friendly inputs, responsive cards
- [x] AppLayout: sidebar collapse tested, top nav responsive


## M-Pesa STK Push Integration
- [x] Create M-Pesa sandbox helper module with mock payment flow (initiateSTKPush, parseCallback, generateMockCallback)
- [x] Update notification types in schema to support payment_request and payment_received
- [x] Build M-Pesa STK Push procedures in backend (initiateSTKPush, confirmMpesaPayment)
- [x] Add M-Pesa payment button to Invoices UI with phone input dialog
- [x] Add M-Pesa confirmation dialog for receipt entry and payment confirmation
- [x] Write and pass 10 vitest tests for M-Pesa integration


## Admin Onboarding System
- [ ] Apply database migration: ALTER TABLE landlords ADD onboardingStatus and onboardingCompletedAt columns
- [x] Create onboarding context and hooks for state management
- [x] Build OnboardingWelcome component with intro and CTA
- [x] Build OnboardingSetupWizard component with 5-step guided setup
- [x] Build OnboardingTour component with feature highlights
- [x] Integrate onboarding into Dashboard with conditional rendering
- [x] Add skip/complete onboarding mutations to backend (completeOnboarding, skipOnboarding)
- [x] Write tests for onboarding flow (9 tests, ready to pass after migration)
