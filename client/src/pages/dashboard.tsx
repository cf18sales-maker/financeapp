import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { TrendingDown, TrendingUp, Wallet, AlertCircle, TrendingUp as SafeIcon, Info } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from "recharts";
import type { Account, Category, Transaction } from "@shared/schema";
import { format } from "date-fns";
import { Link } from "wouter";

const CHART_COLORS = [
  "hsl(var(--chart-1))", "hsl(var(--chart-2))", "hsl(var(--chart-3))",
  "hsl(var(--chart-4))", "hsl(var(--chart-5))",
];

const FV_OPTIONS = [
  { value: "fixed", label: "Fixed", color: "#6366f1" },
  { value: "variable", label: "Variable", color: "#f59e0b" },
  { value: "discretionary", label: "Disco", color: "#ec4899" },
] as const;

function formatAmount(amount: number, currency = "AUD") {
  return new Intl.NumberFormat("en-AU", { style: "currency", currency }).format(amount);
}

type SurplusData = {
  month: string;
  income: number;
  fixedCosts: number;
  variableSpend: number;
  untaggedSpend: number;
  untaggedCount: number;
  surplus: number;
  isComplete: boolean;
  currency: string;
};

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

function StatCard({ title, value, sub, icon: Icon, loading, testId }: {
  title: string; value: string; sub?: string; icon: React.ElementType; loading?: boolean; testId?: string;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        <Icon className="w-4 h-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        {loading ? (
          <Skeleton className="h-7 w-28" />
        ) : (
          <p className="text-2xl font-bold tracking-tight" data-testid={testId}>{value}</p>
        )}
        {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
      </CardContent>
    </Card>
  );
}

function SurplusBar({ label, amount, color, total }: {
  label: string; amount: number; color: string; total: number;
}) {
  const pct = total > 0 ? Math.min((amount / total) * 100, 100) : 0;
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-semibold tabular-nums">{formatAmount(amount)}</span>
      </div>
      <div className="h-2 rounded-full bg-muted overflow-hidden">
        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: color }} />
      </div>
    </div>
  );
}

export default function Dashboard() {
  const currentMonth = format(new Date(), "yyyy-MM");

  const { data: accounts = [], isLoading: accountsLoading } = useQuery<Account[]>({ queryKey: ["/api/accounts"] });
  const { data: categories = [] } = useQuery<Category[]>({ queryKey: ["/api/categories"] });
  const { data: transactions = [], isLoading: txLoading } = useQuery<Transaction[]>({ queryKey: ["/api/transactions"] });
  const { data: monthlySpending = [] } = useQuery<{ month: string; total: string }[]>({ queryKey: ["/api/stats/monthly-spending"] });
  const { data: spendingByCategory = [] } = useQuery<{ categoryId: string | null; total: string }[]>({ queryKey: ["/api/stats/spending-by-category"] });
  const { data: surplus, isLoading: surplusLoading } = useQuery<SurplusData>({
    queryKey: [`/api/stats/surplus/${currentMonth}`],
  });
  const { data: budgetSummary = [] } = useQuery<BudgetSummaryItem[]>({
    queryKey: [`/api/budgets/summary/${currentMonth}`],
  });

  const categoryMap = Object.fromEntries(categories.map(c => [c.id, c]));

  const mtdTransactions = transactions.filter(t => t.date.startsWith(currentMonth));
  const totalSpend = mtdTransactions.filter(t => t.type === "debit").reduce((sum, t) => sum + parseFloat(t.amount), 0);
  const totalIncome = mtdTransactions.filter(t => t.type === "credit").reduce((sum, t) => sum + parseFloat(t.amount), 0);
  const uncategorized = transactions.filter(t => !t.categoryId).length;

  const pieData = spendingByCategory
    .filter(s => s.categoryId && parseFloat(s.total) > 0)
    .map((s, i) => ({
      name: categoryMap[s.categoryId!]?.name || "Unknown",
      value: parseFloat(s.total),
      color: categoryMap[s.categoryId!]?.color || CHART_COLORS[i % CHART_COLORS.length],
    }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 8);

  const barData = monthlySpending.map(m => ({
    month: format(new Date(m.month + "-01"), "MMM"),
    amount: parseFloat(m.total),
  }));

  const recentTxs = [...transactions].slice(0, 8);
  const overBudgetCategories = budgetSummary.filter(b => b.isOverBudget);
  const nearLimitCategories = budgetSummary.filter(b => !b.isOverBudget && b.percentUsed !== null && b.percentUsed >= 80);

  const surplusIsPositive = (surplus?.surplus ?? 0) >= 0;
  const totalForBar = surplus?.income || 1;

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight" data-testid="heading-dashboard">Dashboard</h1>
        <p className="text-muted-foreground text-sm mt-1">{format(new Date(), "MMMM yyyy")} · AUD</p>
      </div>

      {/* ── Surplus / Command Center ────────────────────────────────────────── */}
      <Card className={surplusIsPositive ? "border-chart-1/30" : "border-destructive/40"}>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div>
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <SafeIcon className="w-4 h-4 text-chart-1" />
                Safe to Invest This Month
              </CardTitle>
              <p className="text-xs text-muted-foreground mt-0.5">
                Based on {format(new Date(), "MMMM")} income minus classified expenses
              </p>
            </div>
            {surplusLoading ? (
              <Skeleton className="h-10 w-36" />
            ) : (
              <div className="text-right">
                <p className={`text-3xl font-bold tabular-nums ${surplusIsPositive ? "text-chart-1" : "text-destructive"}`}
                  data-testid="stat-safe-to-invest">
                  {formatAmount(Math.abs(surplus?.surplus ?? 0))}
                </p>
                {!surplusIsPositive && <p className="text-xs text-destructive">Over budget</p>}
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {surplusLoading ? (
            <div className="space-y-3">
              {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-5" />)}
            </div>
          ) : surplus ? (
            <div className="space-y-3">
              <SurplusBar label="Income received" amount={surplus.income} color="hsl(var(--chart-1))" total={totalForBar} />
              <SurplusBar label="Fixed costs" amount={surplus.fixedCosts} color="hsl(var(--chart-4))" total={totalForBar} />
              <SurplusBar label="Variable spend" amount={surplus.variableSpend} color="hsl(var(--chart-2))" total={totalForBar} />
              {surplus.untaggedSpend > 0 && (
                <SurplusBar label={`Untagged spend (${surplus.untaggedCount} transactions)`} amount={surplus.untaggedSpend} color="hsl(var(--muted-foreground))" total={totalForBar} />
              )}
              <div className="pt-2 border-t border-border flex items-center justify-between text-sm">
                <span className="text-muted-foreground font-medium">Projected surplus</span>
                <span className={`font-bold tabular-nums ${surplusIsPositive ? "text-chart-1" : "text-destructive"}`}>
                  {surplusIsPositive ? "+" : "-"}{formatAmount(Math.abs(surplus.surplus))}
                </span>
              </div>
              {surplus.untaggedCount > 0 && (
                <div className="flex items-start gap-2 text-xs text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-md px-3 py-2">
                  <Info className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                  <span>
                    <strong>{surplus.untaggedCount} transactions</strong> are untagged — tag them as Fixed/Variable in{" "}
                    <Link href="/transactions" className="underline">Transactions</Link> to improve accuracy.
                  </span>
                </div>
              )}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No data for {format(new Date(), "MMMM")} yet — import transactions to see your surplus.</p>
          )}
        </CardContent>
      </Card>

      {/* ── MTD Stats ─────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Income (MTD)"
          value={formatAmount(totalIncome)}
          sub={format(new Date(), "MMMM")}
          icon={TrendingUp}
          loading={txLoading}
          testId="stat-income-mtd"
        />
        <StatCard
          title="Spend (MTD)"
          value={formatAmount(totalSpend)}
          sub={format(new Date(), "MMMM")}
          icon={TrendingDown}
          loading={txLoading}
          testId="stat-spend-mtd"
        />
        <StatCard
          title="Accounts"
          value={String(accounts.length)}
          sub="Connected"
          icon={Wallet}
          loading={accountsLoading}
          testId="stat-accounts"
        />
        <StatCard
          title="Uncategorized"
          value={String(uncategorized)}
          sub="Need attention"
          icon={AlertCircle}
          loading={txLoading}
          testId="stat-uncategorized"
        />
      </div>

      {/* ── Budget Alerts ──────────────────────────────────────────────────────── */}
      {(overBudgetCategories.length > 0 || nearLimitCategories.length > 0) && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {overBudgetCategories.map(b => (
            <div key={b.categoryId} className="flex items-center justify-between gap-3 px-4 py-3 rounded-lg border border-destructive/30 bg-destructive/5">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: b.categoryColor }} />
                <span className="text-sm font-medium">{b.categoryName}</span>
                <Badge variant="destructive" className="text-xs">Over</Badge>
              </div>
              <span className="text-sm tabular-nums text-destructive font-semibold">
                {formatAmount(Math.abs(b.remaining ?? 0))} over
              </span>
            </div>
          ))}
          {nearLimitCategories.map(b => (
            <div key={b.categoryId} className="flex items-center justify-between gap-3 px-4 py-3 rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/40">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: b.categoryColor }} />
                <span className="text-sm font-medium">{b.categoryName}</span>
                <Badge className="text-xs bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300 border-0">{b.percentUsed}%</Badge>
              </div>
              <span className="text-sm tabular-nums text-amber-700 dark:text-amber-400 font-semibold">
                {formatAmount(b.remaining ?? 0)} left
              </span>
            </div>
          ))}
        </div>
      )}

      {/* ── Charts ───────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-semibold">Monthly Spending</CardTitle>
          </CardHeader>
          <CardContent>
            {barData.length === 0 ? (
              <div className="h-48 flex items-center justify-center text-muted-foreground text-sm">
                No spending data yet — import some transactions
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={barData} margin={{ left: 0, right: 0, top: 4, bottom: 0 }}>
                  <XAxis dataKey="month" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                  <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false}
                    tickFormatter={v => `$${(v / 1000).toFixed(0)}k`} width={40} />
                  <Tooltip
                    formatter={(v: number) => [formatAmount(v), "Spent"]}
                    contentStyle={{ borderRadius: 8, fontSize: 13 }}
                  />
                  <Bar dataKey="amount" fill="hsl(var(--chart-1))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base font-semibold">Spending by Category</CardTitle>
          </CardHeader>
          <CardContent>
            {pieData.length === 0 ? (
              <div className="h-48 flex items-center justify-center text-muted-foreground text-sm">
                No categorized transactions yet
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie data={pieData} cx="50%" cy="50%" innerRadius={55} outerRadius={85}
                    dataKey="value" paddingAngle={2}>
                    {pieData.map((entry, i) => (
                      <Cell key={i} fill={entry.color} />
                    ))}
                  </Pie>
                  <Legend
                    formatter={(value) => <span style={{ fontSize: 12 }}>{value}</span>}
                    iconType="circle"
                    iconSize={8}
                  />
                  <Tooltip
                    formatter={(v: number) => [formatAmount(v), "Spent"]}
                    contentStyle={{ borderRadius: 8, fontSize: 13 }}
                  />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── Budget Progress ───────────────────────────────────────────────────── */}
      {budgetSummary.filter(b => b.limitAmount).length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-semibold">Budget Progress — {format(new Date(), "MMMM")}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {budgetSummary.filter(b => b.limitAmount).slice(0, 6).map(b => {
                const pct = b.percentUsed ?? 0;
                return (
                  <div key={b.categoryId} className="space-y-1.5">
                    <div className="flex justify-between text-xs">
                      <span className="font-medium" style={{ color: b.categoryColor }}>{b.categoryName}</span>
                      <span className="text-muted-foreground tabular-nums">
                        {formatAmount(parseFloat(b.spentAmount))} / {formatAmount(parseFloat(b.limitAmount!))}
                      </span>
                    </div>
                    <Progress value={Math.min(pct, 100)}
                      className="h-1.5"
                    />
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Recent Transactions ───────────────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            Recent Transactions
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {recentTxs.length === 0 ? (
            <div className="py-12 flex flex-col items-center justify-center text-muted-foreground gap-2">
              <p className="text-sm">No transactions yet — import a statement to get started</p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {recentTxs.map(tx => {
                const cat = tx.categoryId ? categoryMap[tx.categoryId] : null;
                const fvOpt = tx.fixedVariable ? FV_OPTIONS.find(o => o.value === tx.fixedVariable) : null;
                return (
                  <div key={tx.id} className="flex items-center justify-between px-6 py-3 gap-4"
                    data-testid={`row-recent-tx-${tx.id}`}>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{tx.description}</p>
                      <p className="text-xs text-muted-foreground">{tx.date}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {fvOpt && (
                        <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded"
                          style={{ backgroundColor: fvOpt.color + "20", color: fvOpt.color }}>
                          {fvOpt.label}
                        </span>
                      )}
                      {cat ? (
                        <Badge variant="secondary" style={{ backgroundColor: cat.color + "20", color: cat.color, borderColor: cat.color + "30" }}>
                          {cat.name}
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-muted-foreground">Uncategorized</Badge>
                      )}
                      <p className={`text-sm font-semibold tabular-nums min-w-20 text-right ${tx.type === "credit" ? "text-chart-1" : "text-foreground"}`}>
                        {tx.type === "credit" ? "+" : "-"}{formatAmount(parseFloat(tx.amount), tx.currency || "AUD")}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
