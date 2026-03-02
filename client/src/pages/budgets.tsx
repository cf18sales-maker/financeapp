import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertBudgetSchema, type Category } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Plus, Pencil, Trash2, TrendingUp, AlertTriangle, CheckCircle2, ChevronLeft, ChevronRight } from "lucide-react";
import { format, addMonths, subMonths, parse } from "date-fns";
import type { z } from "zod";

type BudgetSummaryItem = {
  budgetId: string | null;
  categoryId: string;
  categoryName: string;
  categoryColor: string;
  limitAmount: string | null;
  spentAmount: string;
  currency: string;
  month: string;
  percentUsed: number | null;
  remaining: number | null;
  isOverBudget: boolean;
};

function formatAmount(amount: number, currency = "AUD") {
  return new Intl.NumberFormat("en-AU", { style: "currency", currency }).format(amount);
}

function getMonthLabel(month: string) {
  return format(parse(month, "yyyy-MM", new Date()), "MMMM yyyy");
}

type FormData = z.infer<typeof insertBudgetSchema>;

export default function Budgets() {
  const qc = useQueryClient();
  const { toast } = useToast();

  const [month, setMonth] = useState(() => format(new Date(), "yyyy-MM"));
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deletingItem, setDeletingItem] = useState<BudgetSummaryItem | null>(null);

  const summaryKey = `/api/budgets/summary/${month}`;
  const { data: summary = [], isLoading } = useQuery<BudgetSummaryItem[]>({ queryKey: [summaryKey] });
  const { data: categories = [] } = useQuery<Category[]>({ queryKey: ["/api/categories"] });

  const totalBudgeted = summary
    .filter((s) => s.limitAmount)
    .reduce((sum, s) => sum + parseFloat(s.limitAmount!), 0);
  const totalSpent = summary.reduce((sum, s) => sum + parseFloat(s.spentAmount), 0);
  const totalRemaining = totalBudgeted - totalSpent;
  const overBudgetCount = summary.filter((s) => s.isOverBudget).length;

  // Only show categories that don't have a budget yet in the "Add" dropdown
  const budgetedCategoryIds = new Set(summary.filter((s) => s.budgetId).map((s) => s.categoryId));
  const unbugdetedCategories = categories.filter((c) => !budgetedCategoryIds.has(c.id));

  const form = useForm<FormData>({
    resolver: zodResolver(insertBudgetSchema),
    defaultValues: { categoryId: "", month, limitAmount: "", currency: "AUD" },
  });

  function openCreate() {
    setEditingId(null);
    form.reset({ categoryId: "", month, limitAmount: "", currency: "AUD" });
    setOpen(true);
  }

  function openEdit(item: BudgetSummaryItem) {
    setEditingId(item.budgetId);
    form.reset({
      categoryId: item.categoryId,
      month: item.month,
      limitAmount: item.limitAmount || "",
      currency: item.currency,
    });
    setOpen(true);
  }

  const saveMutation = useMutation({
    mutationFn: async (data: FormData) => {
      if (editingId) {
        const res = await apiRequest("PUT", `/api/budgets/${editingId}`, data);
        return res.json();
      }
      const res = await apiRequest("POST", "/api/budgets", data);
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [summaryKey] });
      setOpen(false);
      toast({ title: editingId ? "Budget updated" : "Budget set" });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => { await apiRequest("DELETE", `/api/budgets/${id}`); },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [summaryKey] });
      setDeletingItem(null);
      toast({ title: "Budget removed" });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  function prevMonth() { setMonth(format(subMonths(parse(month, "yyyy-MM", new Date()), 1), "yyyy-MM")); }
  function nextMonth() { setMonth(format(addMonths(parse(month, "yyyy-MM", new Date()), 1), "yyyy-MM")); }
  const isCurrentMonth = month === format(new Date(), "yyyy-MM");

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold tracking-tight" data-testid="heading-budgets">Budgets</h1>
          <p className="text-muted-foreground text-sm mt-1">Set monthly limits and track spend vs budget</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1">
            <Button size="icon" variant="outline" onClick={prevMonth} data-testid="button-prev-month">
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <span className="text-sm font-medium px-3 min-w-36 text-center" data-testid="text-month">
              {getMonthLabel(month)}
            </span>
            <Button size="icon" variant="outline" onClick={nextMonth} disabled={isCurrentMonth}
              data-testid="button-next-month">
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
          <Button onClick={openCreate} data-testid="button-add-budget">
            <Plus className="w-4 h-4 mr-2" /> Set Budget
          </Button>
        </div>
      </div>

      {/* Summary bar */}
      {summary.length > 0 && totalBudgeted > 0 && (
        <div className="grid grid-cols-3 gap-4">
          <Card>
            <CardContent className="py-4 px-5">
              <p className="text-xs text-muted-foreground mb-1">Total Budgeted</p>
              <p className="text-xl font-bold tabular-nums" data-testid="stat-total-budgeted">
                {formatAmount(totalBudgeted)}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="py-4 px-5">
              <p className="text-xs text-muted-foreground mb-1">Total Spent (MTD)</p>
              <p className={`text-xl font-bold tabular-nums ${totalSpent > totalBudgeted ? "text-destructive" : ""}`}
                data-testid="stat-total-spent">
                {formatAmount(totalSpent)}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="py-4 px-5">
              <p className="text-xs text-muted-foreground mb-1">
                {totalRemaining >= 0 ? "Remaining" : "Over Budget"}
              </p>
              <p className={`text-xl font-bold tabular-nums ${totalRemaining < 0 ? "text-destructive" : "text-chart-1"}`}
                data-testid="stat-remaining">
                {formatAmount(Math.abs(totalRemaining))}
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {isLoading ? (
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <Card key={i} className="animate-pulse"><CardContent className="h-24" /></Card>
          ))}
        </div>
      ) : summary.length === 0 ? (
        <div className="py-20 flex flex-col items-center justify-center text-muted-foreground gap-3">
          <TrendingUp className="w-12 h-12 opacity-20" />
          <p className="text-sm font-medium">No budgets or spending for {getMonthLabel(month)}</p>
          <p className="text-xs text-center max-w-xs">
            Set monthly limits per category to track spend and project your safe-to-invest surplus
          </p>
          <Button variant="outline" size="sm" onClick={openCreate}>Set Your First Budget</Button>
        </div>
      ) : (
        <div className="space-y-3">
          {summary.map((item) => {
            const spent = parseFloat(item.spentAmount);
            const limit = item.limitAmount ? parseFloat(item.limitAmount) : null;
            const pct = item.percentUsed ?? 0;
            const isOver = item.isOverBudget;
            const hasLimit = limit !== null;

            return (
              <Card key={item.categoryId} data-testid={`card-budget-${item.categoryId}`}
                className={isOver ? "border-destructive/40" : ""}>
                <CardContent className="py-4 px-5">
                  <div className="flex items-start gap-4">
                    <div className="w-10 h-10 rounded-md flex items-center justify-center shrink-0 mt-0.5"
                      style={{ backgroundColor: item.categoryColor + "20", color: item.categoryColor }}>
                      {isOver
                        ? <AlertTriangle className="w-4 h-4" />
                        : hasLimit && pct >= 80
                        ? <AlertTriangle className="w-4 h-4" />
                        : <CheckCircle2 className="w-4 h-4" />
                      }
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2 mb-2 flex-wrap">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-sm">{item.categoryName}</span>
                          {isOver && <Badge variant="destructive" className="text-xs">Over budget</Badge>}
                          {!hasLimit && <Badge variant="outline" className="text-xs text-muted-foreground">No limit set</Badge>}
                        </div>
                        <div className="flex items-center gap-3 text-sm">
                          <span className="tabular-nums font-semibold">
                            {formatAmount(spent, item.currency)}
                          </span>
                          {hasLimit && (
                            <span className="text-muted-foreground tabular-nums">
                              / {formatAmount(limit!, item.currency)}
                            </span>
                          )}
                          <div className="flex gap-1">
                            <Button size="icon" variant="ghost" onClick={() => openEdit(item)}
                              data-testid={`button-edit-budget-${item.categoryId}`}>
                              <Pencil className="w-3.5 h-3.5" />
                            </Button>
                            {item.budgetId && (
                              <Button size="icon" variant="ghost" onClick={() => setDeletingItem(item)}
                                data-testid={`button-delete-budget-${item.categoryId}`}>
                                <Trash2 className="w-3.5 h-3.5" />
                              </Button>
                            )}
                          </div>
                        </div>
                      </div>

                      {hasLimit && (
                        <div className="space-y-1">
                          <Progress
                            value={Math.min(pct, 100)}
                            className="h-2"
                            style={{
                              ["--progress-color" as any]: isOver
                                ? "hsl(var(--destructive))"
                                : pct >= 80
                                ? "hsl(var(--chart-4))"
                                : item.categoryColor,
                            }}
                          />
                          <div className="flex justify-between text-xs text-muted-foreground">
                            <span>{pct}% used</span>
                            {item.remaining !== null && (
                              <span className={item.remaining < 0 ? "text-destructive" : "text-chart-1"}>
                                {item.remaining < 0
                                  ? `${formatAmount(Math.abs(item.remaining), item.currency)} over`
                                  : `${formatAmount(item.remaining, item.currency)} left`}
                              </span>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Add/Edit Budget Dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{editingId ? "Edit Budget" : "Set Budget"}</DialogTitle>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit((d) => saveMutation.mutate(d))} className="space-y-4">
              <FormField control={form.control} name="categoryId" render={({ field }) => (
                <FormItem>
                  <FormLabel>Category</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value} disabled={!!editingId}>
                    <FormControl>
                      <SelectTrigger data-testid="select-budget-category"><SelectValue placeholder="Select category" /></SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {(editingId ? categories : unbugdetedCategories).map((c) => (
                        <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />

              <FormField control={form.control} name="limitAmount" render={({ field }) => (
                <FormItem>
                  <FormLabel>Monthly Limit</FormLabel>
                  <FormControl>
                    <Input type="number" min="0" step="0.01" placeholder="e.g. 500.00"
                      {...field} value={field.value ?? ""}
                      data-testid="input-budget-limit" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              <FormField control={form.control} name="currency" render={({ field }) => (
                <FormItem>
                  <FormLabel>Currency</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger data-testid="select-budget-currency"><SelectValue /></SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {["AUD", "USD", "EUR", "GBP"].map((c) => (
                        <SelectItem key={c} value={c}>{c}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                <Button type="submit" disabled={saveMutation.isPending} data-testid="button-save-budget">
                  {saveMutation.isPending ? "Saving..." : editingId ? "Update" : "Set Budget"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <Dialog open={!!deletingItem} onOpenChange={() => setDeletingItem(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle>Remove Budget</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">
            Remove the budget limit for <strong>{deletingItem?.categoryName}</strong> in {getMonthLabel(month)}?
            Your transactions won't be affected.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeletingItem(null)}>Cancel</Button>
            <Button variant="destructive" disabled={deleteMutation.isPending}
              onClick={() => deletingItem?.budgetId && deleteMutation.mutate(deletingItem.budgetId)}
              data-testid="button-confirm-delete-budget">
              {deleteMutation.isPending ? "Removing..." : "Remove"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
