import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.warn(
    "Supabase credentials missing. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY environment variables."
  );
}

export const supabase = createClient(
  SUPABASE_URL || "",
  SUPABASE_ANON_KEY || ""
);

// ─── TypeScript types matching the PostgreSQL schema ──────────
export type User = {
  id: number;
  auth_id: string;
  open_id: string | null;
  name: string | null;
  email: string | null;
  login_method: string | null;
  role: "user" | "admin";
  created_at: string;
  updated_at: string;
  last_signed_in: string;
};

export type Landlord = {
  id: number;
  user_id: number;
  business_name: string | null;
  phone: string | null;
  address: string | null;
  city: string | null;
  country: string | null;
  mpesa_paybill?: string | null;
  payment_instructions?: string | null;
  subscription_plan: "free" | "basic" | "pro";
  subscription_status: "active" | "expired" | "cancelled" | "past_due";
  subscription_expires_at: string | null;
  trial_ends_at: string | null;
  is_active: boolean;
  onboarding_status: "not_started" | "in_progress" | "completed" | "skipped";
  onboarding_completed_at: string | null;
  // WhatsApp integration
  whatsapp_mode?: "shared" | "custom" | "disabled";
  whatsapp_phone_number_id?: string | null;
  whatsapp_access_token?: string | null;
  whatsapp_verify_token?: string | null;
  // M-Pesa Daraja credentials
  mpesa_environment?: "sandbox" | "production";
  mpesa_shortcode?: string | null;
  mpesa_passkey?: string | null;
  mpesa_consumer_key?: string | null;
  mpesa_consumer_secret?: string | null;
  created_at: string;
  updated_at: string;
};

export type Property = {
  id: number;
  landlord_id: number;
  name: string;
  address: string;
  city: string | null;
  property_type: "residential" | "commercial" | "mixed";
  total_units: number;
  description: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type Unit = {
  id: number;
  property_id: number;
  landlord_id: number;
  unit_number: string;
  floor: string | null;
  bedrooms: number;
  bathrooms: number;
  size: number | null;
  rent_amount: number;
  deposit_amount: number | null;
  status: "vacant" | "occupied" | "maintenance";
  description: string | null;
  created_at: string;
  updated_at: string;
};

export type Tenant = {
  id: number;
  landlord_id: number;
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
  national_id: string | null;
  emergency_contact: string | null;
  emergency_phone: string | null;
  notes: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type RoommateEntry = { tenant_id: number; share: number | null };

export type Lease = {
  id: number;
  landlord_id: number;
  tenant_id: number;
  unit_id: number;
  start_date: string;
  end_date: string | null;
  rent_amount: number;
  deposit_amount: number | null;
  deposit_paid: boolean;
  rent_due_day: number;
  is_roommate: boolean;
  billing_mode: "shared" | "separate";
  roommates: RoommateEntry[] | null;
  status: "active" | "expired" | "terminated" | "pending";
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type RentInvoice = {
  id: number;
  landlord_id: number;
  lease_id: number;
  tenant_id: number;
  unit_id: number;
  invoice_number: string;
  amount: number;
  due_date: string;
  period_month: number;
  period_year: number;
  status: "pending" | "paid" | "overdue" | "partial" | "cancelled";
  paid_amount: number;
  paid_at: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type Payment = {
  id: number;
  landlord_id: number;
  invoice_id: number | null;
  tenant_id: number;
  amount: number;
  payment_method: "mpesa" | "bank_transfer" | "cash" | "other";
  mpesa_transaction_id: string | null;
  bank_reference: string | null;
  receipt_number: string | null;
  payment_date: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type Caretaker = {
  id: number;
  landlord_id: number;
  name: string;
  phone: string | null;
  email: string | null;
  national_id: string | null;
  notes: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type Expense = {
  id: number;
  landlord_id: number;
  property_id: number | null;
  category:
    | "repairs_maintenance"
    | "utilities_water"
    | "utilities_electricity"
    | "caretaker_salary"
    | "garbage_collection"
    | "security"
    | "taxes_rates"
    | "management_fee"
    | "other";
  amount: number;
  expense_date: string;
  payee: string | null;
  payment_method: string;
  reference_number: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type SmsMessageType =
  | "rent_reminder"
  | "payment_receipt"
  | "estate_broadcast"
  | "custom"
  | "overdue_notice";

export type SmsStatus = "pending" | "sent" | "delivered" | "failed";

export type SmsLog = {
  id: number;
  landlord_id: number;
  tenant_id: number | null;
  property_id: number | null;
  recipient_name: string;
  recipient_phone: string;
  message_type: SmsMessageType;
  message_body: string;
  segments_count: number;
  status: SmsStatus;
  provider_message_id: string | null;
  cost_kes: number;
  error_message: string | null;
  sent_at: string | null;
  created_at: string;
  updated_at: string;
};
