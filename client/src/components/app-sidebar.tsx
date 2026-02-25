import { Link, useLocation } from "wouter";
import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
} from "@/components/ui/sidebar";
import {
  LayoutDashboard,
  Share2,
  Cpu,
  LogOut,
  Zap,
} from "lucide-react";
import { clearToken } from "@/lib/auth";
import { Button } from "@/components/ui/button";

const navItems = [
  { title: "Mission Board", url: "/", icon: LayoutDashboard },
  { title: "Social Media", url: "/social", icon: Share2 },
  { title: "AI Usage", url: "/ai-usage", icon: Cpu },
];

export function AppSidebar() {
  const [location] = useLocation();

  const handleLogout = () => {
    clearToken();
    window.location.href = "/login";
  };

  return (
    <Sidebar>
      <SidebarHeader className="px-4 py-5 border-b border-sidebar-border">
        <div className="flex items-center gap-2.5">
          <div className="flex items-center justify-center w-8 h-8 rounded-md bg-primary">
            <Zap className="w-4 h-4 text-primary-foreground" />
          </div>
          <div>
            <p className="text-sm font-bold tracking-tight text-sidebar-foreground leading-none">Bright Stack Labs</p>
            <p className="text-xs text-muted-foreground mt-0.5 leading-none">Mission Control</p>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent className="pt-3">
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) => {
                const isActive = item.url === "/" ? location === "/" : location.startsWith(item.url);
                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton
                      asChild
                      data-active={isActive}
                      className="data-[active=true]:bg-sidebar-accent data-[active=true]:text-sidebar-accent-foreground"
                    >
                      <Link href={item.url} data-testid={`nav-${item.title.toLowerCase().replace(/ /g, "-")}`}>
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

      <SidebarFooter className="border-t border-sidebar-border p-3">
        <Button
          variant="ghost"
          size="sm"
          onClick={handleLogout}
          data-testid="button-logout"
          className="w-full justify-start gap-2 text-muted-foreground"
        >
          <LogOut className="w-4 h-4" />
          Sign Out
        </Button>
      </SidebarFooter>
    </Sidebar>
  );
}
