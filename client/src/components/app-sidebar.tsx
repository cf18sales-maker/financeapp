import { Link, useLocation } from "wouter";
import {
  LayoutDashboard, ArrowLeftRight, CreditCard, Tag, Zap, Upload, PiggyBank,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
} from "@/components/ui/sidebar";

const navItems = [
  { title: "Dashboard", url: "/", icon: LayoutDashboard },
  { title: "Transactions", url: "/transactions", icon: ArrowLeftRight },
  { title: "Budgets", url: "/budgets", icon: PiggyBank },
  { title: "Accounts", url: "/accounts", icon: CreditCard },
  { title: "Categories", url: "/categories", icon: Tag },
  { title: "Rules", url: "/rules", icon: Zap },
  { title: "Import", url: "/import", icon: Upload },
];

export function AppSidebar() {
  const [location] = useLocation();

  return (
    <Sidebar>
      <SidebarHeader className="px-4 py-5 border-b border-sidebar-border">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-md bg-primary flex items-center justify-center">
            <span className="text-primary-foreground font-bold text-sm">B</span>
          </div>
          <div>
            <p className="font-semibold text-sm leading-none text-sidebar-foreground">BudgetOS</p>
            <p className="text-xs text-muted-foreground mt-0.5">Capital Allocation OS</p>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent className="px-2 pt-3">
        <SidebarGroup>
          <SidebarGroupLabel className="px-2 mb-1 text-xs font-medium text-muted-foreground uppercase tracking-wider">
            Navigation
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) => {
                const isActive = item.url === "/"
                  ? location === "/"
                  : location.startsWith(item.url);
                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild data-active={isActive}>
                      <Link href={item.url} data-testid={`nav-${item.title.toLowerCase()}`}>
                        <item.icon className="w-4 h-4" />
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="px-4 py-3 border-t border-sidebar-border">
        <p className="text-xs text-muted-foreground">Phase 1 MVP · AUD</p>
      </SidebarFooter>
    </Sidebar>
  );
}
