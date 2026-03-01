import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useRef, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import type { Account, ImportBatch } from "@shared/schema";
import { Upload, FileText, Trash2, CheckCircle2, AlertCircle, ChevronDown, ChevronUp } from "lucide-react";
import { format } from "date-fns";

type ParsedRow = {
  date: string;
  description: string;
  amount: string;
  type: "debit" | "credit";
};

type ColumnMap = {
  date: number;
  description: number;
  amount: number;
  type: number | null;
  hasTypeCol: boolean;
};

function parseCSV(text: string): string[][] {
  const lines = text.trim().split(/\r?\n/);
  return lines.map(line => {
    const cells: string[] = [];
    let inQuote = false;
    let current = "";
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') { inQuote = !inQuote; continue; }
      if (ch === "," && !inQuote) { cells.push(current.trim()); current = ""; continue; }
      current += ch;
    }
    cells.push(current.trim());
    return cells;
  });
}

function guessColumnMap(headers: string[]): Partial<ColumnMap> {
  const h = headers.map(h => h.toLowerCase().replace(/[^a-z]/g, ""));
  const find = (...terms: string[]) => h.findIndex(col => terms.some(t => col.includes(t)));
  return {
    date: find("date", "transdate", "posteddate") ?? 0,
    description: find("description", "memo", "payee", "name", "narrative") ?? 1,
    amount: find("amount", "debit", "credit", "sum", "value") ?? 2,
    type: find("type", "category", "creditdebit") !== -1 ? find("type", "category", "creditdebit") : null,
  };
}

export default function Import() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [selectedAccount, setSelectedAccount] = useState("");
  const [csvRows, setCsvRows] = useState<string[][]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [fileName, setFileName] = useState("");
  const [colMap, setColMap] = useState<Partial<ColumnMap>>({});
  const [step, setStep] = useState<"upload" | "map" | "preview" | "done">("upload");
  const [previewRows, setPreviewRows] = useState<ParsedRow[]>([]);
  const [importedBatch, setImportedBatch] = useState<any>(null);
  const [deletingBatch, setDeletingBatch] = useState<ImportBatch | null>(null);
  const [expandedBatch, setExpandedBatch] = useState<string | null>(null);

  const { data: accounts = [] } = useQuery<Account[]>({ queryKey: ["/api/accounts"] });
  const { data: batches = [] } = useQuery<ImportBatch[]>({ queryKey: ["/api/import-batches"] });

  const accountMap = Object.fromEntries(accounts.map(a => [a.id, a]));

  function handleFile(file: File) {
    if (!file.name.endsWith(".csv") && file.type !== "text/csv") {
      toast({ title: "Invalid file", description: "Please upload a CSV file", variant: "destructive" });
      return;
    }
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const rows = parseCSV(text);
      if (rows.length < 2) {
        toast({ title: "Empty file", description: "CSV must have headers and at least one row", variant: "destructive" });
        return;
      }
      const hdrs = rows[0];
      const dataRows = rows.slice(1).filter(r => r.some(c => c));
      setHeaders(hdrs);
      setCsvRows(dataRows);
      setColMap(guessColumnMap(hdrs));
      setStep("map");
    };
    reader.readAsText(file);
  }

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }, []);

  function buildPreview(): ParsedRow[] {
    const { date: dc, description: dsc, amount: ac, type: tc } = colMap;
    if (dc === undefined || dsc === undefined || ac === undefined) return [];
    return csvRows.slice(0, 200).map(row => {
      const rawAmount = row[ac] || "0";
      const cleanAmount = rawAmount.replace(/[^0-9.\-]/g, "");
      const numAmount = parseFloat(cleanAmount);
      let txType: "debit" | "credit" = numAmount < 0 ? "credit" : "debit";
      const absAmount = Math.abs(numAmount).toFixed(2);
      if (tc !== null && tc !== undefined && row[tc]) {
        const t = row[tc].toLowerCase();
        if (t.includes("credit") || t.includes("deposit") || t.includes("payment received")) txType = "credit";
        if (t.includes("debit") || t.includes("withdrawal") || t.includes("purchase")) txType = "debit";
      }
      return {
        date: row[dc] || "",
        description: row[dsc] || "",
        amount: absAmount,
        type: txType,
      };
    }).filter(r => r.date && r.description);
  }

  function goToPreview() {
    if (!selectedAccount) {
      toast({ title: "Select an account", description: "Choose which account to import into", variant: "destructive" });
      return;
    }
    const rows = buildPreview();
    if (rows.length === 0) {
      toast({ title: "No valid rows", description: "Check your column mapping", variant: "destructive" });
      return;
    }
    setPreviewRows(rows);
    setStep("preview");
  }

  const importMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/import", {
        accountId: selectedAccount,
        fileName,
        rows: previewRows,
      });
      return res.json();
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["/api/transactions"] });
      qc.invalidateQueries({ queryKey: ["/api/import-batches"] });
      qc.invalidateQueries({ queryKey: ["/api/stats/spending-by-category"] });
      qc.invalidateQueries({ queryKey: ["/api/stats/monthly-spending"] });
      setImportedBatch(data.batch);
      setStep("done");
      toast({ title: "Import complete", description: `${data.transactions.length} transactions imported` });
    },
    onError: (e: Error) => toast({ title: "Import failed", description: e.message, variant: "destructive" }),
  });

  const deleteBatchMutation = useMutation({
    mutationFn: async (id: string) => { await apiRequest("DELETE", `/api/import-batches/${id}`); },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/import-batches"] });
      qc.invalidateQueries({ queryKey: ["/api/transactions"] });
      setDeletingBatch(null);
      toast({ title: "Import deleted" });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  function resetUpload() {
    setCsvRows([]); setHeaders([]); setFileName("");
    setColMap({}); setStep("upload"); setPreviewRows([]); setImportedBatch(null);
    if (fileRef.current) fileRef.current.value = "";
  }

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight" data-testid="heading-import">Import Statements</h1>
        <p className="text-muted-foreground text-sm mt-1">Upload CSV files from your bank or credit card</p>
      </div>

      {step === "upload" && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-semibold">Upload CSV</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="space-y-3">
              <label className="text-sm font-medium">Target Account</label>
              <Select value={selectedAccount} onValueChange={setSelectedAccount}>
                <SelectTrigger className="w-full max-w-sm" data-testid="select-import-account">
                  <SelectValue placeholder="Select an account" />
                </SelectTrigger>
                <SelectContent>
                  {accounts.map(a => <SelectItem key={a.id} value={a.id}>{a.name} — {a.institution}</SelectItem>)}
                </SelectContent>
              </Select>
              {accounts.length === 0 && (
                <p className="text-xs text-muted-foreground">No accounts yet — add one in the Accounts section first</p>
              )}
            </div>

            <div
              className={`border-2 border-dashed rounded-md p-12 text-center transition-colors cursor-pointer ${
                dragging ? "border-primary bg-accent" : "border-border"
              }`}
              onDragOver={e => { e.preventDefault(); setDragging(true); }}
              onDragLeave={() => setDragging(false)}
              onDrop={onDrop}
              onClick={() => fileRef.current?.click()}
              data-testid="dropzone-csv"
            >
              <input ref={fileRef} type="file" accept=".csv,text/csv" className="hidden"
                onChange={e => e.target.files?.[0] && handleFile(e.target.files[0])}
                data-testid="input-csv-file"
              />
              <Upload className="w-10 h-10 mx-auto text-muted-foreground mb-3 opacity-50" />
              <p className="text-sm font-medium">Drop your CSV here or click to browse</p>
              <p className="text-xs text-muted-foreground mt-1">
                Supports exports from most banks — Chase, Bank of America, Wells Fargo, Amex, etc.
              </p>
            </div>

            <div className="bg-muted/40 rounded-md p-4 text-xs text-muted-foreground space-y-1">
              <p className="font-medium text-foreground">Expected CSV format:</p>
              <p>Your file should have columns for: <strong>Date</strong>, <strong>Description</strong>, and <strong>Amount</strong>.</p>
              <p>Column names will be detected automatically, and you can adjust the mapping in the next step.</p>
            </div>
          </CardContent>
        </Card>
      )}

      {step === "map" && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-semibold">Map Columns</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <p className="text-sm text-muted-foreground">
              We detected <strong>{csvRows.length}</strong> rows in <strong>{fileName}</strong>. Confirm the column mapping below.
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {(["date", "description", "amount", "type"] as const).map(field => (
                <div key={field} className="space-y-1.5">
                  <label className="text-sm font-medium capitalize">{field === "type" ? "Debit/Credit" : field}</label>
                  <Select
                    value={String(colMap[field] ?? "none")}
                    onValueChange={(v) => setColMap(p => ({ ...p, [field]: v === "none" ? null : parseInt(v) }))}
                  >
                    <SelectTrigger data-testid={`select-col-${field}`}><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">— not mapped —</SelectItem>
                      {headers.map((h, i) => (
                        <SelectItem key={i} value={String(i)}>{h || `Column ${i + 1}`}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ))}
            </div>

            <div>
              <p className="text-xs font-medium text-muted-foreground mb-2">Preview (first 3 rows)</p>
              <div className="overflow-auto border rounded-md">
                <Table>
                  <TableHeader>
                    <TableRow>
                      {headers.map((h, i) => (
                        <TableHead key={i} className="text-xs whitespace-nowrap">{h || `Col ${i + 1}`}</TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {csvRows.slice(0, 3).map((row, i) => (
                      <TableRow key={i}>
                        {row.map((cell, j) => (
                          <TableCell key={j} className="text-xs max-w-32 truncate">{cell}</TableCell>
                        ))}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>

            <div className="flex gap-3">
              <Button variant="outline" onClick={resetUpload}>Back</Button>
              <Button onClick={goToPreview} data-testid="button-go-preview">Review Import</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {step === "preview" && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              Review {previewRows.length} Transactions
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-4 text-sm">
              <span className="text-muted-foreground">
                Debits: <strong>{previewRows.filter(r => r.type === "debit").length}</strong>
              </span>
              <span className="text-muted-foreground">
                Credits: <strong>{previewRows.filter(r => r.type === "credit").length}</strong>
              </span>
              <span className="text-muted-foreground">
                Account: <strong>{accountMap[selectedAccount]?.name}</strong>
              </span>
            </div>
            <div className="overflow-auto border rounded-md max-h-96">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {previewRows.map((row, i) => (
                    <TableRow key={i} data-testid={`row-preview-${i}`}>
                      <TableCell className="text-xs">{row.date}</TableCell>
                      <TableCell className="text-xs max-w-xs truncate">{row.description}</TableCell>
                      <TableCell>
                        <Badge variant={row.type === "credit" ? "default" : "secondary"} className="text-xs">
                          {row.type}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right text-xs tabular-nums font-medium">
                        {row.type === "credit" ? "+" : "-"}${row.amount}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <div className="flex gap-3">
              <Button variant="outline" onClick={() => setStep("map")}>Back</Button>
              <Button onClick={() => importMutation.mutate()} disabled={importMutation.isPending}
                data-testid="button-confirm-import">
                {importMutation.isPending ? "Importing..." : `Import ${previewRows.length} Transactions`}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {step === "done" && (
        <Card>
          <CardContent className="py-10 flex flex-col items-center gap-4">
            <CheckCircle2 className="w-14 h-14 text-chart-1" />
            <div className="text-center">
              <p className="text-lg font-semibold">Import Complete</p>
              <p className="text-sm text-muted-foreground mt-1">
                {importedBatch?.rowCount} transactions imported from {fileName}
              </p>
            </div>
            <div className="flex gap-3">
              <Button variant="outline" onClick={resetUpload} data-testid="button-import-another">Import Another</Button>
              <Button asChild><a href="/transactions">View Transactions</a></Button>
            </div>
          </CardContent>
        </Card>
      )}

      {batches.length > 0 && (
        <div className="space-y-3">
          <Separator />
          <h2 className="text-base font-semibold">Import History</h2>
          <div className="space-y-2">
            {batches.map(batch => {
              const account = accountMap[batch.accountId];
              return (
                <Card key={batch.id} data-testid={`card-batch-${batch.id}`}>
                  <CardContent className="py-3 px-5">
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex items-center gap-3 min-w-0">
                        <FileText className="w-4 h-4 text-muted-foreground shrink-0" />
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">{batch.fileName}</p>
                          <p className="text-xs text-muted-foreground">
                            {batch.rowCount} rows &bull; {account?.name || "Unknown account"} &bull;{" "}
                            {format(new Date(batch.importedAt), "MMM d, yyyy h:mm a")}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <Button size="icon" variant="ghost" onClick={() => setDeletingBatch(batch)}
                          data-testid={`button-delete-batch-${batch.id}`}>
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      <Dialog open={!!deletingBatch} onOpenChange={() => setDeletingBatch(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle>Delete Import</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">
            This will permanently delete all <strong>{deletingBatch?.rowCount}</strong> transactions from this import.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeletingBatch(null)}>Cancel</Button>
            <Button variant="destructive" disabled={deleteBatchMutation.isPending}
              onClick={() => deletingBatch && deleteBatchMutation.mutate(deletingBatch.id)}
              data-testid="button-confirm-delete-batch">
              {deleteBatchMutation.isPending ? "Deleting..." : "Delete Import"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
