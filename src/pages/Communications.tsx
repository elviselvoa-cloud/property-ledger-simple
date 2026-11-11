import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import DashboardLayout from "@/components/DashboardLayout";
import {
  MessageSquare,
  Send,
  Phone,
  Users,
  AlertCircle,
  CheckCircle2,
  Loader2,
  RefreshCw,
} from "lucide-react";
import type { SmsLog, SmsMessageType, Property, Tenant, Landlord } from "@/integrations/supabase/client";
import { sanitizeKenyanPhone, calculateSmsSegments, TEMPLATE_RENT_DUE, TEMPLATE_OVERDUE, TEMPLATE_ESTATE_BROADCAST } from "@/lib/sms";

const MESSAGE_TYPES: { value: SmsMessageType; label: string }[] = [
  { value: "rent_reminder", label: "Rent Due Reminder" },
  { value: "overdue_notice", label: "Overdue Notice" },
  { value: "estate_broadcast", label: "Estate Broadcast" },
  { value: "custom", label: "Custom Message" },
];

const STATUS_STYLE: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-800",
  sent: "bg-blue-100 text-blue-800",
  delivered: "bg-green-100 text-green-800",
  failed: "bg-red-100 text-red-800",
};

export default function Communications() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [properties, setProperties] = useState<Property[]>([]);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [landlord, setLandlord] = useState<Landlord | null>(null);
  const [smsLogs, setSmsLogs] = useState<SmsLog[]>([]);
  const [searchTerm, setSearchTerm] = useState("");

  const [selectedPropertyId, setSelectedPropertyId] = useState("");
  const [recipientFilter, setRecipientFilter] = useState<"all" | "overdue" | "manual">("all");
  const [selectedTenantIds, setSelectedTenantIds] = useState<number[]>([]);
  const [templateType, setTemplateType] = useState<SmsMessageType>("custom");
  const [messageBody, setMessageBody] = useState("");
  const [validRecipients, setValidRecipients] = useState<Array<{ phone: string; name: string; tenantId?: number; propertyId?: number }>>([]);
  const [sending, setSending] = useState(false);
  const [autoReminders, setAutoReminders] = useState(false);
  const [reminderDaysBefore, setReminderDaysBefore] = useState(2);
  const [reminderDaysAfterOverdue, setReminderDaysAfterOverdue] = useState(3);
  const [resendingLogId, setResendingLogId] = useState<number | null>(null);

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    if (!user) return;
    try {
      setLoading(true);
      const { data: landlords } = await supabase.from("landlords").select("*").eq("user_id", user.id).maybeSingle();
      if (landlords) setLandlord(landlords as Landlord);
      const { data: props } = await supabase.from("properties").select("*").order("name");
      if (props) setProperties(props as Property[]);
      const { data: tens } = await supabase.from("tenants").select("*").order("first_name");
      if (tens) setTenants(tens as Tenant[]);
      const { data: logs } = await supabase.from("sms_logs").select("*").order("created_at", { ascending: false });
      if (logs) setSmsLogs(logs as SmsLog[]);
      if (landlords) {
        const lr: any = landlords;
        setAutoReminders(lr.auto_rent_reminders ?? false);
        setReminderDaysBefore(lr.reminder_days_before ?? 2);
        setReminderDaysAfterOverdue(lr.reminder_days_after_overdue ?? 3);
      }
    } catch (e: any) {
      toast.error(e.message || "Failed to load data");
    } finally {
      setLoading(false);
    }
  };

  const filteredLogs = smsLogs.filter(
    (l) => !searchTerm || l.recipient_name.toLowerCase().includes(searchTerm.toLowerCase()) || l.recipient_phone.includes(searchTerm)
  );

  const getEligibleRecipients = (): Array<{ phone: string; name: string; tenantId?: number }> => {
    let filtered = tenants.filter((t) => t.is_active && t.phone);
    if (recipientFilter === "manual") {
      filtered = tenants.filter((t) => selectedTenantIds.includes(t.id));
    }
    return filtered.map((t) => ({ phone: t.phone!, name: `${t.first_name} ${t.last_name}`, tenantId: t.id }));
  };

  const handlePreviewRecipients = () => {
    const recipients = getEligibleRecipients();
    const valid = recipients.map((r) => ({ ...r, phone: sanitizeKenyanPhone(r.phone) ?? r.phone }))
      .filter((r) => r.phone.startsWith("+"));
    setValidRecipients(valid);
  };

  const handleTemplateChange = (type: SmsMessageType) => {
    setTemplateType(type);
    if (type === "rent_reminder") setMessageBody(TEMPLATE_RENT_DUE);
    else if (type === "overdue_notice") setMessageBody(TEMPLATE_OVERDUE);
    else if (type === "estate_broadcast") setMessageBody(TEMPLATE_ESTATE_BROADCAST);
    else setMessageBody("");
  };

  const toggleTenant = (tenantId: number) => {
    setSelectedTenantIds((prev) => prev.includes(tenantId) ? prev.filter((id) => id !== tenantId) : [...prev, tenantId]);
  };

  const handleSendMessage = async () => {
    if (validRecipients.length === 0) { toast.error("No valid recipients"); return; }
    if (!messageBody.trim()) { toast.error("Message cannot be empty"); return; }
    setSending(true);
    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL ?? "";
      if (!supabaseUrl) { toast.error("Supabase URL not configured"); return; }
      const response = await fetch(`${supabaseUrl}/functions/v1/send-sms`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${localStorage.getItem("sb-token")}` },
        body: JSON.stringify({ landlordId: landlord?.id, recipients: validRecipients, message: messageBody, messageType: templateType, smsUsername: (landlord as any)?.sms_username, smsApiKey: (landlord as any)?.sms_api_key, smsSenderId: (landlord as any)?.sms_sender_id }),
      });
      const result = await response.json();
      if (result.success) {
        toast.success(`Sent to ${result.totalSent} recipient(s)`);
        setMessageBody(""); setValidRecipients([]);
        loadData();
      } else { toast.error(result.error || "Failed to send SMS"); }
    } catch (e: any) {
      toast.error(e.message || "Network error sending SMS");
    } finally { setSending(false); }
  };

  const handleResendFailed = async (log: SmsLog) => {
    setResendingLogId(log.id);
    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL ?? "";
      const response = await fetch(`${supabaseUrl}/functions/v1/send-sms`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${localStorage.getItem("sb-token")}` },
        body: JSON.stringify({ landlordId: log.landlord_id, recipients: [{ phone: log.recipient_phone, name: log.recipient_name, tenantId: log.tenant_id }], message: log.message_body, messageType: log.message_type }),
      });
      const result = await response.json();
      if (result.success) { toast.success("Message resent successfully"); loadData(); }
      else { toast.error(result.error || "Failed to resend"); }
    } catch (e: any) { toast.error("Network error"); }
    finally { setResendingLogId(null); }
  };

  const saveAutoReminders = async () => {
    if (!landlord) return;
    try {
      const { error } = await supabase.from("landlords").update({ auto_rent_reminders: autoReminders, reminder_days_before: reminderDaysBefore, reminder_days_after_overdue: reminderDaysAfterOverdue }).eq("id", landlord.id);
      if (error) throw error;
      toast.success("Auto-reminders settings saved");
    } catch (e: any) { toast.error("Failed to save settings"); }
  };

  if (loading) {
    return <div className="flex items-center justify-center h-full"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <MessageSquare className="h-7 w-7 text-primary" />
          <div>
            <h1 className="text-2xl font-bold">SMS Communications</h1>
            <p className="text-muted-foreground">Send rent reminders, estate broadcasts, and manage your SMS integration.</p>
          </div>
        </div>

        <Tabs defaultValue="send" className="space-y-4">
          <TabsList>
            <TabsTrigger value="send">Send SMS</TabsTrigger>
            <TabsTrigger value="auto">Auto-Reminders</TabsTrigger>
            <TabsTrigger value="logs">SMS Log</TabsTrigger>
          </TabsList>

          <TabsContent value="send" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base"><Users className="h-5 w-5 text-primary" /> Recipients</CardTitle>
                <CardDescription>Select who receives the message.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="grid gap-2">
                    <Label htmlFor="property-select">Property (Optional)</Label>
                    <Select value={selectedPropertyId} onValueChange={setSelectedPropertyId}>
                      <SelectTrigger id="property-select"><SelectValue placeholder="All Properties" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">All Properties</SelectItem>
                        {properties.map((p) => (<SelectItem key={p.id} value={p.id.toString()}>{p.name}</SelectItem>))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="filter-type">Filter Tenants</Label>
                    <Select value={recipientFilter} onValueChange={(v) => setRecipientFilter(v as any)}>
                      <SelectTrigger id="filter-type"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Active Tenants</SelectItem>
                        <SelectItem value="overdue">Only Overdue</SelectItem>
                        <SelectItem value="manual">Manual Selection</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                {recipientFilter === "manual" && (
                  <div className="max-h-40 overflow-y-auto border rounded-md p-2 space-y-1">
                    {tenants.filter((t) => t.is_active).map((t) => (
                      <label key={t.id} className="flex items-center gap-2 text-sm cursor-pointer">
                        <input type="checkbox" checked={selectedTenantIds.includes(t.id)} onChange={() => toggleTenant(t.id)} className="rounded" />
                        <span>{`${t.first_name} ${t.last_name}`}</span>
                        <span className="text-muted-foreground text-xs">{t.phone}</span>
                      </label>
                    ))}
                  </div>
                )}
                <Button variant="outline" size="sm" onClick={handlePreviewRecipients}>
                  <CheckCircle2 className="h-4 w-4 mr-2" />
                  Preview Recipients ({getEligibleRecipients().length})
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base"><MessageSquare className="h-5 w-5 text-primary" /> Message Composer</CardTitle>
                <CardDescription>Choose a template or write your own.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-2">
                  <Label htmlFor="template-select">Template</Label>
                  <Select value={templateType} onValueChange={(v) => handleTemplateChange(v as SmsMessageType)}>
                    <SelectTrigger id="template-select"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {MESSAGE_TYPES.map((mt) => (<SelectItem key={mt.value} value={mt.value}>{mt.label}</SelectItem>))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="message-body">
                    Message
                    <span className="ml-2 text-xs text-muted-foreground">
                      ({messageBody.length} chars, {calculateSmsSegments(messageBody).segments} segment{calculateSmsSegments(messageBody).segments !== 1 ? "s" : ""})
                    </span>
                  </Label>
                  <Textarea id="message-body" value={messageBody} onChange={(e) => setMessageBody(e.target.value)} placeholder="Your SMS message here..." rows={6} />
                </div>
                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                  <span>Valid recipients: {validRecipients.length}</span>
                  <span>Total segments: {validRecipients.length > 0 ? calculateSmsSegments(messageBody).segments * validRecipients.length : 0}</span>
                </div>
              </CardContent>
            </Card>

            {validRecipients.length > 0 && (
              <Card>
                <CardHeader><CardTitle>Review & Send</CardTitle></CardHeader>
                <CardContent>
                  <div className="max-h-48 overflow-y-auto space-y-1 mb-4">
                    {validRecipients.slice(0, 10).map((r, i) => (
                      <div key={i} className="flex items-center gap-2 text-sm">
                        <Phone className="h-3 w-3 text-muted-foreground" />
                        <span className="font-medium">{r.name}</span>
                        <span className="text-muted-foreground">{r.phone}</span>
                      </div>
                    ))}
                    {validRecipients.length > 10 && <p className="text-sm text-muted-foreground">...and {validRecipients.length - 10} more</p>}
                  </div>
                  <div className="flex gap-2">
                    <Button onClick={handleSendMessage} disabled={sending || !messageBody.trim()}>
                      {sending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Send className="h-4 w-4 mr-2" />}
                      Send SMS Broadcast
                    </Button>
                    <Button variant="outline" onClick={() => { setValidRecipients([]); setMessageBody(""); }}>Clear</Button>
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="auto" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base"><AlertCircle className="h-5 w-5 text-primary" /> Automated SMS Reminders</CardTitle>
                <CardDescription>Configure automatic SMS reminders for rent payments.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <Label htmlFor="auto-toggle" className="text-base font-medium">Enable Auto-Reminders</Label>
                    <p className="text-sm text-muted-foreground">Automatically send SMS before due dates and overdue notices.</p>
                  </div>
                  <Switch id="auto-toggle" checked={autoReminders} onCheckedChange={setAutoReminders} />
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="grid gap-2">
                    <Label htmlFor="days-before">Days Before Due Date</Label>
                    <Input id="days-before" type="number" min="0" max="30" value={reminderDaysBefore} onChange={(e) => setReminderDaysBefore(Number(e.target.value))} disabled={!autoReminders} />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="days-overdue">Days After Overdue</Label>
                    <Input id="days-overdue" type="number" min="1" max="30" value={reminderDaysAfterOverdue} onChange={(e) => setReminderDaysAfterOverdue(Number(e.target.value))} disabled={!autoReminders} />
                  </div>
                </div>
                <div className="space-y-3 pt-4 border-t">
                  <h4 className="font-medium">Message Templates</h4>
                  <div className="space-y-2">
                    <Label>Rent Due Reminder</Label>
                    <Textarea readOnly value={TEMPLATE_RENT_DUE} className="font-mono text-sm bg-muted" rows={2} />
                  </div>
                  <div className="space-y-2">
                    <Label>Overdue Notice</Label>
                    <Textarea readOnly value={TEMPLATE_OVERDUE} className="font-mono text-sm bg-muted" rows={2} />
                  </div>
                </div>
                <Button onClick={saveAutoReminders}>Save Reminder Settings</Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="logs" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>SMS Delivery Log</CardTitle>
                <CardDescription>View all sent, delivered, and failed messages.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex gap-2 mb-4">
                  <Input placeholder="Search by name or phone..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="max-w-sm" />
                  <Button variant="outline" size="icon" onClick={loadData}><RefreshCw className="h-4 w-4" /></Button>
                </div>
                <div className="rounded-md border">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-muted/50">
                        <th className="px-3 py-2 text-left font-medium">Date</th>
                        <th className="px-3 py-2 text-left font-medium">Recipient</th>
                        <th className="px-3 py-2 text-left font-medium">Phone</th>
                        <th className="px-3 py-2 text-left font-medium">Type</th>
                        <th className="px-3 py-2 text-left font-medium w-1/3">Message</th>
                        <th className="px-3 py-2 text-left font-medium">Status</th>
                        <th className="px-3 py-2 text-right font-medium">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredLogs.length === 0 ? (
                        <tr><td colSpan={7} className="text-center py-8 text-muted-foreground">No SMS messages sent yet</td></tr>
                      ) : (
                        filteredLogs.map((log) => (
                          <tr key={log.id} className="border-b last:border-0 hover:bg-muted/50">
                            <td className="px-3 py-2 whitespace-nowrap text-muted-foreground">{new Date(log.created_at).toLocaleDateString()}</td>
                            <td className="px-3 py-2 font-medium">{log.recipient_name}</td>
                            <td className="px-3 py-2 text-muted-foreground">{log.recipient_phone}</td>
                            <td className="px-3 py-2"><Badge variant="secondary" className="capitalize">{log.message_type.replace(/_/g, " ")}</Badge></td>
                            <td className="px-3 py-2 max-w-xs truncate text-muted-foreground">{log.message_body}</td>
                            <td className="px-3 py-2"><span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_STYLE[log.status] || "bg-gray-100"}`}>{log.status}</span></td>
                            <td className="px-3 py-2 text-right">
                              {log.status === "failed" && resendingLogId !== log.id ? (
                                <Button variant="ghost" size="sm" onClick={() => handleResendFailed(log)}><RefreshCw className="h-3 w-3 mr-1" />Resend</Button>
                              ) : log.status === "failed" ? (
                                <Loader2 className="h-3 w-3 animate-spin mx-auto" />
                              ) : null}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
