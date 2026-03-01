import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertCategoryRuleSchema, type CategoryRule, type Category } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Plus, Pencil, Trash2, Zap, Play } from "lucide-react";
import type { z } from "zod";

const FIELD_LABELS: Record<string, string> = {
  description: "Description",
  amount: "Amount",
  type: "Type",
};

const OPERATOR_OPTIONS: Record<string, { value: string; label: string }[]> = {
  description: [
    { value: "contains", label: "contains" },
    { value: "starts_with", label: "starts with" },
    { value: "ends_with", label: "ends with" },
    { value: "equals", label: "equals" },
    { value: "regex", label: "matches regex" },
  ],
  amount: [
    { value: "gt", label: "greater than" },
    { value: "lt", label: "less than" },
    { value: "gte", label: "greater or equal" },
    { value: "lte", label: "less or equal" },
    { value: "equals", label: "equals" },
  ],
  type: [
    { value: "equals", label: "equals" },
  ],
};

type FormData = z.infer<typeof insertCategoryRuleSchema>;

export default function Rules() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<CategoryRule | null>(null);
  const [deleting, setDeleting] = useState<CategoryRule | null>(null);

  const { data: rules = [], isLoading } = useQuery<CategoryRule[]>({ queryKey: ["/api/rules"] });
  const { data: categories = [] } = useQuery<Category[]>({ queryKey: ["/api/categories"] });

  const categoryMap = Object.fromEntries(categories.map(c => [c.id, c]));

  const form = useForm<FormData>({
    resolver: zodResolver(insertCategoryRuleSchema),
    defaultValues: {
      name: "", categoryId: "", field: "description",
      operator: "contains", value: "", priority: 0, isActive: true,
    },
  });

  const selectedField = form.watch("field");

  function openCreate() {
    setEditing(null);
    form.reset({ name: "", categoryId: "", field: "description", operator: "contains", value: "", priority: 0, isActive: true });
    setOpen(true);
  }

  function openEdit(rule: CategoryRule) {
    setEditing(rule);
    form.reset({
      name: rule.name, categoryId: rule.categoryId, field: rule.field as any,
      operator: rule.operator as any, value: rule.value,
      priority: rule.priority, isActive: rule.isActive,
    });
    setOpen(true);
  }

  const saveMutation = useMutation({
    mutationFn: async (data: FormData) => {
      const res = editing
        ? await apiRequest("PUT", `/api/rules/${editing.id}`, data)
        : await apiRequest("POST", "/api/rules", data);
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/rules"] });
      setOpen(false);
      toast({ title: editing ? "Rule updated" : "Rule created" });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      const res = await apiRequest("PUT", `/api/rules/${id}`, { isActive });
      return res.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["/api/rules"] }),
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => { await apiRequest("DELETE", `/api/rules/${id}`); },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/rules"] });
      setDeleting(null);
      toast({ title: "Rule deleted" });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const applyRulesMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/apply-rules", {});
      return res.json();
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["/api/transactions"] });
      toast({ title: "Rules applied", description: `${data.updated} transaction(s) updated` });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight" data-testid="heading-rules">Rules</h1>
          <p className="text-muted-foreground text-sm mt-1">Auto-categorize transactions based on patterns</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => applyRulesMutation.mutate()}
            disabled={applyRulesMutation.isPending} data-testid="button-apply-rules">
            <Play className="w-4 h-4 mr-2" />
            {applyRulesMutation.isPending ? "Applying..." : "Apply All Rules"}
          </Button>
          <Button onClick={openCreate} data-testid="button-create-rule">
            <Plus className="w-4 h-4 mr-2" /> Add Rule
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <Card key={i} className="animate-pulse"><CardContent className="h-20" /></Card>
          ))}
        </div>
      ) : rules.length === 0 ? (
        <div className="py-20 flex flex-col items-center justify-center text-muted-foreground gap-3">
          <Zap className="w-12 h-12 opacity-20" />
          <p className="text-sm font-medium">No rules yet</p>
          <p className="text-xs">Create rules to automatically categorize imported transactions</p>
          <Button variant="outline" size="sm" onClick={openCreate}>Add Rule</Button>
        </div>
      ) : (
        <div className="space-y-3">
          {rules.map(rule => {
            const cat = categoryMap[rule.categoryId];
            return (
              <Card key={rule.id} data-testid={`card-rule-${rule.id}`}
                className={!rule.isActive ? "opacity-60" : ""}>
                <CardContent className="py-4 px-5">
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-4 flex-1 min-w-0">
                      <Switch
                        checked={rule.isActive}
                        onCheckedChange={(v) => toggleMutation.mutate({ id: rule.id, isActive: v })}
                        data-testid={`switch-rule-${rule.id}`}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-semibold text-sm">{rule.name}</p>
                          {!rule.isActive && <Badge variant="outline" className="text-xs">Disabled</Badge>}
                          {rule.priority > 0 && (
                            <Badge variant="secondary" className="text-xs">Priority {rule.priority}</Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          When <span className="font-medium text-foreground">{FIELD_LABELS[rule.field]}</span>{" "}
                          <span className="text-muted-foreground">{rule.operator.replace(/_/g, " ")}</span>{" "}
                          <span className="font-medium text-foreground">"{rule.value}"</span>
                          {cat && (
                            <> → assign <span className="font-medium" style={{ color: cat.color }}>{cat.name}</span></>
                          )}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      {cat && (
                        <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: cat.color }} />
                      )}
                      <Button size="icon" variant="ghost" onClick={() => openEdit(rule)}
                        data-testid={`button-edit-rule-${rule.id}`}>
                        <Pencil className="w-3.5 h-3.5" />
                      </Button>
                      <Button size="icon" variant="ghost" onClick={() => setDeleting(rule)}
                        data-testid={`button-delete-rule-${rule.id}`}>
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Rule" : "Add Rule"}</DialogTitle>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(d => saveMutation.mutate(d))} className="space-y-4">
              <FormField control={form.control} name="name" render={({ field }) => (
                <FormItem>
                  <FormLabel>Rule Name</FormLabel>
                  <FormControl><Input placeholder="e.g. Whole Foods → Groceries" {...field} data-testid="input-rule-name" /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              <div className="grid grid-cols-2 gap-4">
                <FormField control={form.control} name="field" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Match on Field</FormLabel>
                    <Select onValueChange={(v) => { field.onChange(v); form.setValue("operator", "contains"); }} value={field.value}>
                      <FormControl><SelectTrigger data-testid="select-rule-field"><SelectValue /></SelectTrigger></FormControl>
                      <SelectContent>
                        <SelectItem value="description">Description</SelectItem>
                        <SelectItem value="amount">Amount</SelectItem>
                        <SelectItem value="type">Type</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />

                <FormField control={form.control} name="operator" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Operator</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl><SelectTrigger data-testid="select-rule-operator"><SelectValue /></SelectTrigger></FormControl>
                      <SelectContent>
                        {(OPERATOR_OPTIONS[selectedField] || OPERATOR_OPTIONS.description).map(op => (
                          <SelectItem key={op.value} value={op.value}>{op.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>

              <FormField control={form.control} name="value" render={({ field }) => (
                <FormItem>
                  <FormLabel>Match Value</FormLabel>
                  <FormControl>
                    <Input placeholder={selectedField === "amount" ? "e.g. 50.00" : "e.g. WHOLE FOODS"} {...field} data-testid="input-rule-value" />
                  </FormControl>
                  <FormDescription className="text-xs">
                    {selectedField === "description" ? "Case-insensitive text to match in the transaction description" :
                     selectedField === "amount" ? "Numeric value to compare the transaction amount against" :
                     "Use 'debit' or 'credit'"}
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )} />

              <div className="grid grid-cols-2 gap-4">
                <FormField control={form.control} name="categoryId" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Assign Category</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl><SelectTrigger data-testid="select-rule-category"><SelectValue placeholder="Select category" /></SelectTrigger></FormControl>
                      <SelectContent>
                        {categories.map(c => (
                          <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />

                <FormField control={form.control} name="priority" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Priority</FormLabel>
                    <FormControl>
                      <Input type="number" min={0} max={100} {...field}
                        onChange={e => field.onChange(parseInt(e.target.value) || 0)}
                        data-testid="input-rule-priority" />
                    </FormControl>
                    <FormDescription className="text-xs">Higher = applied first</FormDescription>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                <Button type="submit" disabled={saveMutation.isPending} data-testid="button-save-rule">
                  {saveMutation.isPending ? "Saving..." : editing ? "Save Changes" : "Add Rule"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <Dialog open={!!deleting} onOpenChange={() => setDeleting(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle>Delete Rule</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">Delete rule <strong>{deleting?.name}</strong>?</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleting(null)}>Cancel</Button>
            <Button variant="destructive" disabled={deleteMutation.isPending}
              onClick={() => deleting && deleteMutation.mutate(deleting.id)}
              data-testid="button-confirm-delete-rule">
              {deleteMutation.isPending ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
