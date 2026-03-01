import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertCategorySchema, type Category, type InsertCategory } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Plus, Pencil, Trash2, Tag } from "lucide-react";
import type { z } from "zod";

const ICONS = [
  "tag", "shopping-cart", "utensils", "car", "home", "heart", "zap", "globe",
  "music", "book", "coffee", "plane", "briefcase", "dumbbell", "gift", "film",
];

const COLORS = [
  "#6366f1", "#0ea5e9", "#10b981", "#f59e0b", "#ef4444",
  "#8b5cf6", "#ec4899", "#14b8a6", "#f97316", "#84cc16",
  "#06b6d4", "#d946ef", "#fb923c", "#a3e635", "#34d399",
];

type FormData = z.infer<typeof insertCategorySchema>;

export default function Categories() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Category | null>(null);
  const [deleting, setDeleting] = useState<Category | null>(null);

  const { data: categories = [], isLoading } = useQuery<Category[]>({ queryKey: ["/api/categories"] });

  const form = useForm<FormData>({
    resolver: zodResolver(insertCategorySchema),
    defaultValues: { name: "", color: "#6366f1", icon: "tag" },
  });

  function openCreate() {
    setEditing(null);
    form.reset({ name: "", color: "#6366f1", icon: "tag" });
    setOpen(true);
  }

  function openEdit(cat: Category) {
    setEditing(cat);
    form.reset({ name: cat.name, color: cat.color, icon: cat.icon });
    setOpen(true);
  }

  const saveMutation = useMutation({
    mutationFn: async (data: FormData) => {
      const res = editing
        ? await apiRequest("PUT", `/api/categories/${editing.id}`, data)
        : await apiRequest("POST", "/api/categories", data);
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/categories"] });
      setOpen(false);
      toast({ title: editing ? "Category updated" : "Category created" });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/categories/${id}`);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/categories"] });
      setDeleting(null);
      toast({ title: "Category deleted" });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight" data-testid="heading-categories">Categories</h1>
          <p className="text-muted-foreground text-sm mt-1">Organize your spending into meaningful groups</p>
        </div>
        <Button onClick={openCreate} data-testid="button-create-category">
          <Plus className="w-4 h-4 mr-2" /> Add Category
        </Button>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {[...Array(6)].map((_, i) => (
            <Card key={i} className="animate-pulse"><CardContent className="h-20" /></Card>
          ))}
        </div>
      ) : categories.length === 0 ? (
        <div className="py-20 flex flex-col items-center justify-center text-muted-foreground gap-3">
          <Tag className="w-12 h-12 opacity-20" />
          <p className="text-sm font-medium">No categories yet</p>
          <p className="text-xs">Create categories to organize your transactions</p>
          <Button variant="outline" size="sm" onClick={openCreate}>Add Category</Button>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
          {categories.map(cat => (
            <Card key={cat.id} data-testid={`card-category-${cat.id}`}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-1 mb-3">
                  <div className="w-10 h-10 rounded-md flex items-center justify-center shrink-0"
                    style={{ backgroundColor: cat.color + "20", color: cat.color }}>
                    <Tag className="w-5 h-5" />
                  </div>
                  <div className="flex gap-0.5">
                    <Button size="icon" variant="ghost" onClick={() => openEdit(cat)}
                      data-testid={`button-edit-category-${cat.id}`}>
                      <Pencil className="w-3 h-3" />
                    </Button>
                    <Button size="icon" variant="ghost" onClick={() => setDeleting(cat)}
                      data-testid={`button-delete-category-${cat.id}`}>
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                </div>
                <p className="text-sm font-semibold leading-tight truncate" data-testid={`text-category-${cat.id}`}>{cat.name}</p>
                <div className="w-full h-1 rounded-full mt-2" style={{ backgroundColor: cat.color }} />
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Category" : "Add Category"}</DialogTitle>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(d => saveMutation.mutate(d))} className="space-y-4">
              <FormField control={form.control} name="name" render={({ field }) => (
                <FormItem>
                  <FormLabel>Category Name</FormLabel>
                  <FormControl><Input placeholder="e.g. Groceries" {...field} data-testid="input-category-name" /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="color" render={({ field }) => (
                <FormItem>
                  <FormLabel>Color</FormLabel>
                  <FormControl>
                    <div className="flex flex-wrap gap-2">
                      {COLORS.map(c => (
                        <button key={c} type="button"
                          onClick={() => field.onChange(c)}
                          className="w-7 h-7 rounded-md border-2 transition-transform hover:scale-110"
                          style={{
                            backgroundColor: c,
                            borderColor: field.value === c ? "hsl(var(--foreground))" : "transparent",
                          }}
                          data-testid={`color-pick-${c.replace("#", "")}`}
                        />
                      ))}
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                <Button type="submit" disabled={saveMutation.isPending} data-testid="button-save-category">
                  {saveMutation.isPending ? "Saving..." : editing ? "Save Changes" : "Add Category"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <Dialog open={!!deleting} onOpenChange={() => setDeleting(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete Category</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Delete <strong>{deleting?.name}</strong>? Transactions using this category will become uncategorized.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleting(null)}>Cancel</Button>
            <Button variant="destructive" disabled={deleteMutation.isPending}
              onClick={() => deleting && deleteMutation.mutate(deleting.id)}
              data-testid="button-confirm-delete-category">
              {deleteMutation.isPending ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
