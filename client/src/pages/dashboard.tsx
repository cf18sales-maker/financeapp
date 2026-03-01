import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { TrendingDown, TrendingUp, Wallet, Tag, ArrowLeftRight, AlertCircle } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from "recharts";
import type { Account, Category, Transaction } from "@shared/schema";
import { format, subMonths, startOfMonth, endOfMonth } from "date-fns";

const CHART_COLORS = [
  "hsl(var(--chart-1))", "hsl(var(--chart-2))", "hsl(var(--chart-3))",
  "hsl(var(--chart-4))", "hsl(var(--chart-5))",
];

function StatCard({ title, value, sub, icon: Icon, loading }: {
  title: string; value: string; sub?: string; icon: React.ElementType; loading?: boolean;
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
          <p className="text-2xl font-bold tracking-tight" data-testid={`stat-${title.toLowerCase().replace(/\s+/g, '-')}`}>{value}</p>
        )}
        {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
      </CardContent>
    </Card>
  );
}

function formatAmount(amount: number, currency = "USD") {
  return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(amount);
}

export default function Dashboard() {
  const { data: accounts = [], isLoading: accountsLoading } = useQuery<Account[]>({ queryKey: ["/api/accounts"] });
  const { data: categories = [] } = useQuery<Category[]>({ queryKey: ["/api/categories"] });
  const { data: transactions = [], isLoading: txLoading } = useQuery<Transaction[]>({ queryKey: ["/api/transactions"] });
  const { data: monthlySpending = [] } = useQuery<{ month: string; total: string }[]>({ queryKey: ["/api/stats/monthly-spending"] });
  const { data: spendingByCategory = [] } = useQuery<{ categoryId: string | null; total: string }[]>({ queryKey: ["/api/stats/spending-by-category"] });

  const totalTransactions = transactions.length;
  const totalSpend = transactions
    .filter(t => t.type === "debit")
    .reduce((sum, t) => sum + parseFloat(t.amount), 0);
  const totalIncome = transactions
    .filter(t => t.type === "credit")
    .reduce((sum, t) => sum + parseFloat(t.amount), 0);
  const uncategorized = transactions.filter(t => !t.categoryId).length;

  const categoryMap = Object.fromEntries(categories.map(c => [c.id, c]));

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
    month: format(new Date(m.month + "-01"), "MMM yyyy"),
    amount: parseFloat(m.total),
  }));

  const recentTxs = [...transactions].slice(0, 8);

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight" data-testid="heading-dashboard">Dashboard</h1>
        <p className="text-muted-foreground text-sm mt-1">Your financial overview at a glance</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total Spend"
          value={formatAmount(totalSpend)}
          sub="All time debits"
          icon={TrendingDown}
          loading={txLoading}
        />
        <StatCard
          title="Total Income"
          value={formatAmount(totalIncome)}
          sub="All time credits"
          icon={TrendingUp}
          loading={txLoading}
        />
        <StatCard
          title="Accounts"
          value={String(accounts.length)}
          sub="Connected sources"
          icon={Wallet}
          loading={accountsLoading}
        />
        <StatCard
          title="Uncategorized"
          value={String(uncategorized)}
          sub={`of ${totalTransactions} transactions`}
          icon={AlertCircle}
          loading={txLoading}
        />
      </div>

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

      <Card>
        <CardHeader>
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <ArrowLeftRight className="w-4 h-4" /> Recent Transactions
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {recentTxs.length === 0 ? (
            <div className="py-12 flex flex-col items-center justify-center text-muted-foreground gap-2">
              <ArrowLeftRight className="w-8 h-8 opacity-30" />
              <p className="text-sm">No transactions yet — import a statement to get started</p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {recentTxs.map(tx => {
                const cat = tx.categoryId ? categoryMap[tx.categoryId] : null;
                return (
                  <div key={tx.id} className="flex items-center justify-between px-6 py-3 gap-4"
                    data-testid={`row-transaction-${tx.id}`}>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{tx.description}</p>
                      <p className="text-xs text-muted-foreground">{tx.date}</p>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      {cat ? (
                        <Badge variant="secondary" style={{ backgroundColor: cat.color + "20", color: cat.color, borderColor: cat.color + "30" }}>
                          {cat.name}
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-muted-foreground">Uncategorized</Badge>
                      )}
                      <p className={`text-sm font-semibold tabular-nums ${tx.type === "credit" ? "text-chart-1" : "text-foreground"}`}>
                        {tx.type === "credit" ? "+" : "-"}{formatAmount(parseFloat(tx.amount))}
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
