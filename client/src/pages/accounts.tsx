import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertAccountSchema, type Account, type InsertAccount } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Plus, Pencil, Trash2, CreditCard, Building2, Wallet, TrendingUp } from "lucide-react";
import type { z } from "zod";

const ACCOUNT_TYPE_LABELS: Record<string, string> = {
  checking: "Checking",
  savings: "Savings",
  credit_card: "Credit Card",
  investment: "Investment",
  loan: "Loan",
  other: "Other",
};

const ACCOUNT_COLORS = [
  "#6366f1", "#0ea5e9", "#10b981", "#f59e0b", "#ef4444",
  "#8b5cf6", "#ec4899", "#14b8a6", "#f97316", "#84cc16",
];

function AccountTypeIcon({ type }: { type: string }) {
  if (type === "credit_card") return <CreditCard className="w-5 h-5" />;
  if (type === "savings") return <Building2 className="w-5 h-5" />;
  if (type === "investment") return <TrendingUp className="w-5 h-5" />;
  return <Wallet className="w-5 h-5" />;
}

type FormData = z.infer<typeof insertAccountSchema>;

export default function Accounts() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Account | null>(null);
  const [deleting, setDeleting] = useState<Account | null>(null);

  const { data: accounts = [], isLoading } = useQuery<Account[]>({ queryKey: ["/api/accounts"] });

  const form = useForm<FormData>({
    resolver: zodResolver(insertAccountSchema),
    defaultValues: { name: "", institution: "", type: "checking", color: "#6366f1", currency: "USD", description: "" },
  });

  function openCreate() {
    setEditing(null);
    form.reset({ name: "", institution: "", type: "checking", color: "#6366f1", currency: "USD", description: "" });
    setOpen(true);
  }

  function openEdit(acc: Account) {
    setEditing(acc);
    form.reset({
      name: acc.name, institution: acc.institution, type: acc.type as any,
      color: acc.color, currency: acc.currency, description: acc.description || "",
    });
    setOpen(true);
  }

  const saveMutation = useMutation({
    mutationFn: async (data: FormData) => {
      const res = editing
        ? await apiRequest("PUT", `/api/accounts/${editing.id}`, data)
        : await apiRequest("POST", "/api/accounts", data);
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/accounts"] });
      setOpen(false);
      toast({ title: editing ? "Account updated" : "Account created" });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/accounts/${id}`);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/accounts"] });
      setDeleting(null);
      toast({ title: "Account deleted" });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight" data-testid="heading-accounts">Accounts</h1>
          <p className="text-muted-foreground text-sm mt-1">Manage your banks, cards, and statement sources</p>
        </div>
        <Button onClick={openCreate} data-testid="button-create-account">
          <Plus className="w-4 h-4 mr-2" /> Add Account
        </Button>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => (
            <Card key={i} className="animate-pulse"><CardContent className="h-32" /></Card>
          ))}
        </div>
      ) : accounts.length === 0 ? (
        <div className="py-20 flex flex-col items-center justify-center text-muted-foreground gap-3">
          <CreditCard className="w-12 h-12 opacity-20" />
          <p className="text-sm font-medium">No accounts yet</p>
          <p className="text-xs">Add your first bank or card to start importing statements</p>
          <Button variant="outline" size="sm" onClick={openCreate}>Add Account</Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {accounts.map(acc => (
            <Card key={acc.id} data-testid={`card-account-${acc.id}`}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-md flex items-center justify-center shrink-0"
                      style={{ backgroundColor: acc.color + "20", color: acc.color }}>
                      <AccountTypeIcon type={acc.type} />
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold text-sm leading-tight truncate">{acc.name}</p>
                      <p className="text-xs text-muted-foreground truncate">{acc.institution}</p>
                    </div>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <Button size="icon" variant="ghost" onClick={() => openEdit(acc)}
                      data-testid={`button-edit-account-${acc.id}`}>
                      <Pencil className="w-3.5 h-3.5" />
                    </Button>
                    <Button size="icon" variant="ghost" onClick={() => setDeleting(acc)}
                      data-testid={`button-delete-account-${acc.id}`}>
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-0 flex items-center gap-2 flex-wrap">
                <Badge variant="secondary">{ACCOUNT_TYPE_LABELS[acc.type] || acc.type}</Badge>
                <Badge variant="outline">{acc.currency}</Badge>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Account" : "Add Account"}</DialogTitle>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(d => saveMutation.mutate(d))} className="space-y-4">
              <FormField control={form.control} name="name" render={({ field }) => (
                <FormItem>
                  <FormLabel>Account Name</FormLabel>
                  <FormControl><Input placeholder="e.g. Chase Freedom" {...field} data-testid="input-account-name" /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="institution" render={({ field }) => (
                <FormItem>
                  <FormLabel>Institution</FormLabel>
                  <FormControl><Input placeholder="e.g. Chase Bank" {...field} data-testid="input-account-institution" /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <div className="grid grid-cols-2 gap-4">
                <FormField control={form.control} name="type" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Type</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-account-type">
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {Object.entries(ACCOUNT_TYPE_LABELS).map(([v, l]) => (
                          <SelectItem key={v} value={v}>{l}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="currency" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Currency</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-account-currency">
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {["USD", "EUR", "GBP", "CAD", "AUD", "JPY"].map(c => (
                          <SelectItem key={c} value={c}>{c}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>
              <FormField control={form.control} name="color" render={({ field }) => (
                <FormItem>
                  <FormLabel>Color</FormLabel>
                  <FormControl>
                    <div className="flex flex-wrap gap-2">
                      {ACCOUNT_COLORS.map(c => (
                        <button key={c} type="button"
                          onClick={() => field.onChange(c)}
                          className="w-7 h-7 rounded-md border-2 transition-transform hover:scale-110"
                          style={{
                            backgroundColor: c,
                            borderColor: field.value === c ? "hsl(var(--foreground))" : "transparent",
                          }}
                          data-testid={`color-${c.replace("#", "")}`}
                        />
                      ))}
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="description" render={({ field }) => (
                <FormItem>
                  <FormLabel>Description <span className="text-muted-foreground">(optional)</span></FormLabel>
                  <FormControl><Textarea placeholder="Any notes about this account" {...field} value={field.value ?? ""} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                <Button type="submit" disabled={saveMutation.isPending} data-testid="button-save-account">
                  {saveMutation.isPending ? "Saving..." : editing ? "Save Changes" : "Add Account"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <Dialog open={!!deleting} onOpenChange={() => setDeleting(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete Account</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Are you sure you want to delete <strong>{deleting?.name}</strong>? This will not delete transactions.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleting(null)}>Cancel</Button>
            <Button variant="destructive" disabled={deleteMutation.isPending}
              onClick={() => deleting && deleteMutation.mutate(deleting.id)}
              data-testid="button-confirm-delete-account">
              {deleteMutation.isPending ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
