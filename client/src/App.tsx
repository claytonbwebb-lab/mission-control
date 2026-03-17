import { Switch, Route, useLocation } from "wouter";
import { useEffect } from "react";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { ThemeProvider, useTheme } from "@/components/theme-provider";
import { Sun, Moon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { isAuthenticated } from "@/lib/auth";
import LoginPage from "@/pages/login";
import MissionBoard from "@/pages/mission-board";
import SocialMediaPage from "@/pages/social-media";
import AiUsagePage from "@/pages/ai-usage";
import CronJobsPage from "@/pages/cron-jobs";
import ArchitecturePage from "@/pages/architecture";
import RecoveryPage from "@/pages/recovery";
import TradingPage from "@/pages/trading";
import NotFound from "@/pages/not-found";

function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  return (
    <Button
      size="icon"
      variant="ghost"
      onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
      data-testid="button-theme-toggle"
    >
      {theme === "dark" ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
    </Button>
  );
}

function ProtectedLayout() {
  const [, setLocation] = useLocation();
  const authed = isAuthenticated();

  useEffect(() => {
    if (!authed) setLocation("/login");
  }, [authed, setLocation]);

  if (!authed) return null;

  const style = {
    "--sidebar-width": "14rem",
    "--sidebar-width-icon": "3.5rem",
  };

  return (
    <SidebarProvider style={style as React.CSSProperties}>
      <div className="flex h-screen w-full overflow-hidden">
        <AppSidebar />
        <div className="flex flex-col flex-1 min-w-0">
          <header className="flex items-center justify-between px-3 py-2 border-b border-border bg-background flex-shrink-0 h-11">
            <SidebarTrigger data-testid="button-sidebar-toggle" />
            <ThemeToggle />
          </header>
          <main className="flex-1 overflow-hidden">
            <Switch>
              <Route path="/" component={MissionBoard} />
              <Route path="/social" component={SocialMediaPage} />
              <Route path="/ai-usage" component={AiUsagePage} />
              <Route path="/cron" component={CronJobsPage} />
              <Route path="/architecture" component={ArchitecturePage} />
              <Route path="/recovery" component={RecoveryPage} />
              <Route path="/trading" component={TradingPage} />
              <Route component={NotFound} />
            </Switch>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}

function Router() {
  return (
    <Switch>
      <Route path="/login" component={LoginPage} />
      <Route component={ProtectedLayout} />
    </Switch>
  );
}

function App() {
  return (
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}

export default App;
