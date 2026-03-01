import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import type { Transaction, Account, Category } from "@shared/schema";
import { Search, ArrowLeftRight, Trash2, Tag, X, Filter } from "lucide-react";

function formatAmount(amount: number, currency = "USD") {
  return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(amount);
}

export default function Transactions() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [filterAccount, setFilterAccount] = useState("__all__");
  const [filterCategory, setFilterCategory] = useState("__all__");
  const [showUncategorized, setShowUncategorized] = useState(false);
  const [assigningTx, setAssigningTx] = useState<Transaction | null>(null);
  const [deletingTx, setDeletingTx] = useState<Transaction | null>(null);

  const params = new URLSearchParams();
  if (search) params.set("search", search);
  if (filterAccount !== "__all__") params.set("accountId", filterAccount);
  if (filterCategory !== "__all__") params.set("categoryId", filterCategory);
  if (showUncategorized) params.set("uncategorized", "true");
  const queryStr = params.toString();

  const { data: transactions = [], isLoading } = useQuery<Transaction[]>({
    queryKey: [`/api/transactions${queryStr ? "?" + queryStr : ""}`],
  });
  const { data: accounts = [] } = useQuery<Account[]>({ queryKey: ["/api/accounts"] });
  const { data: categories = [] } = useQuery<Category[]>({ queryKey: ["/api/categories"] });

  const accountMap = Object.fromEntries(accounts.map(a => [a.id, a]));
  const categoryMap = Object.fromEntries(categories.map(c => [c.id, c]));

  const assignMutation = useMutation({
    mutationFn: async ({ id, categoryId }: { id: string; categoryId: string | null }) => {
      const res = await apiRequest("PUT", `/api/transactions/${id}`, {
        categoryId, isManualCategory: true,
      });
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/transactions"] });
      qc.invalidateQueries({ queryKey: ["/api/stats/spending-by-category"] });
      setAssigningTx(null);
      toast({ title: "Category assigned" });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => { await apiRequest("DELETE", `/api/transactions/${id}`); },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/transactions"] });
      qc.invalidateQueries({ queryKey: ["/api/stats/spending-by-category"] });
      qc.invalidateQueries({ queryKey: ["/api/stats/monthly-spending"] });
      setDeletingTx(null);
      toast({ title: "Transaction deleted" });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const hasFilters = search || filterAccount !== "__all__" || filterCategory !== "__all__" || showUncategorized;

  function clearFilters() {
    setSearch("");
    setFilterAccount("__all__");
    setFilterCategory("__all__");
    setShowUncategorized(false);
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-5">
      <div>
        <h1 className="text-2xl font-bold tracking-tight" data-testid="heading-transactions">Transactions</h1>
        <p className="text-muted-foreground text-sm mt-1">{transactions.length} transaction{transactions.length !== 1 ? "s" : ""} found</p>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
          <Input
            placeholder="Search transactions..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9"
            data-testid="input-search-transactions"
          />
        </div>

        <Select value={filterAccount} onValueChange={setFilterAccount}>
          <SelectTrigger className="w-44" data-testid="select-filter-account">
            <SelectValue placeholder="All Accounts" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">All Accounts</SelectItem>
            {accounts.map(a => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
          </SelectContent>
        </Select>

        <Select value={filterCategory} onValueChange={setFilterCategory}>
          <SelectTrigger className="w-44" data-testid="select-filter-category">
            <SelectValue placeholder="All Categories" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">All Categories</SelectItem>
            {categories.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
          </SelectContent>
        </Select>

        <Button
          variant={showUncategorized ? "default" : "outline"}
          size="sm"
          onClick={() => setShowUncategorized(!showUncategorized)}
          data-testid="button-filter-uncategorized"
        >
          <Filter className="w-3.5 h-3.5 mr-1.5" />
          Uncategorized
        </Button>

        {hasFilters && (
          <Button variant="ghost" size="sm" onClick={clearFilters} data-testid="button-clear-filters">
            <X className="w-3.5 h-3.5 mr-1.5" /> Clear
          </Button>
        )}
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="divide-y divide-border">
              {[...Array(8)].map((_, i) => (
                <div key={i} className="flex items-center gap-4 px-6 py-4">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-4 flex-1" />
                  <Skeleton className="h-5 w-20" />
                  <Skeleton className="h-4 w-16" />
                </div>
              ))}
            </div>
          ) : transactions.length === 0 ? (
            <div className="py-16 flex flex-col items-center justify-center text-muted-foreground gap-3">
              <ArrowLeftRight className="w-10 h-10 opacity-20" />
              <p className="text-sm font-medium">{hasFilters ? "No transactions match your filters" : "No transactions yet"}</p>
              {!hasFilters && <p className="text-xs">Import a statement to see transactions here</p>}
            </div>
          ) : (
            <div className="overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-28">Date</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Account</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead className="text-right w-32">Amount</TableHead>
                    <TableHead className="w-20" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {transactions.map(tx => {
                    const account = accountMap[tx.accountId];
                    const cat = tx.categoryId ? categoryMap[tx.categoryId] : null;
                    return (
                      <TableRow key={tx.id} data-testid={`row-transaction-${tx.id}`}>
                        <TableCell className="text-sm tabular-nums text-muted-foreground whitespace-nowrap">
                          {tx.date}
                        </TableCell>
                        <TableCell>
                          <p className="text-sm font-medium max-w-xs truncate">{tx.description}</p>
                          {tx.notes && <p className="text-xs text-muted-foreground truncate">{tx.notes}</p>}
                        </TableCell>
                        <TableCell>
                          {account && (
                            <div className="flex items-center gap-1.5">
                              <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: account.color }} />
                              <span className="text-sm text-muted-foreground truncate max-w-32">{account.name}</span>
                            </div>
                          )}
                        </TableCell>
                        <TableCell>
                          {cat ? (
                            <Badge variant="secondary"
                              style={{ backgroundColor: cat.color + "20", color: cat.color, borderColor: cat.color + "30" }}
                              className="cursor-pointer"
                              onClick={() => setAssigningTx(tx)}
                              data-testid={`badge-category-${tx.id}`}>
                              {cat.name}
                              {tx.isManualCategory && <span className="ml-1 text-[10px] opacity-60">M</span>}
                            </Badge>
                          ) : (
                            <Button variant="ghost" size="sm"
                              className="h-auto py-0.5 px-2 text-xs text-muted-foreground"
                              onClick={() => setAssigningTx(tx)}
                              data-testid={`button-assign-category-${tx.id}`}>
                              <Tag className="w-3 h-3 mr-1" /> Assign
                            </Button>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <span className={`text-sm font-semibold tabular-nums ${tx.type === "credit" ? "text-chart-1" : ""}`}>
                            {tx.type === "credit" ? "+" : "-"}{formatAmount(parseFloat(tx.amount))}
                          </span>
                        </TableCell>
                        <TableCell>
                          <Button size="icon" variant="ghost"
                            onClick={() => setDeletingTx(tx)}
                            data-testid={`button-delete-tx-${tx.id}`}>
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!assigningTx} onOpenChange={() => setAssigningTx(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Assign Category</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground truncate mb-2">{assigningTx?.description}</p>
          <div className="space-y-1.5 max-h-72 overflow-y-auto">
            {categories.map(cat => (
              <button key={cat.id}
                onClick={() => assigningTx && assignMutation.mutate({ id: assigningTx.id, categoryId: cat.id })}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-md text-left hover-elevate"
                data-testid={`option-category-${cat.id}`}>
                <div className="w-6 h-6 rounded flex items-center justify-center shrink-0"
                  style={{ backgroundColor: cat.color + "20", color: cat.color }}>
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: cat.color }} />
                </div>
                <span className="text-sm font-medium">{cat.name}</span>
                {assigningTx?.categoryId === cat.id && (
                  <Badge variant="secondary" className="ml-auto text-xs">Current</Badge>
                )}
              </button>
            ))}
          </div>
          {assigningTx?.categoryId && (
            <Button variant="outline" size="sm"
              onClick={() => assigningTx && assignMutation.mutate({ id: assigningTx.id, categoryId: null })}
              data-testid="button-remove-category">
              <X className="w-3.5 h-3.5 mr-1.5" /> Remove Category
            </Button>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!deletingTx} onOpenChange={() => setDeletingTx(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle>Delete Transaction</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">Delete <strong className="line-clamp-1">{deletingTx?.description}</strong>?</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeletingTx(null)}>Cancel</Button>
            <Button variant="destructive" disabled={deleteMutation.isPending}
              onClick={() => deletingTx && deleteMutation.mutate(deletingTx.id)}
              data-testid="button-confirm-delete-tx">
              {deleteMutation.isPending ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
