import { ReactNode } from 'react';
import { useHakedisStore } from '@/store/hakedisStore';
import { roleLabels, UserRole } from '@/types/hakedis';
import { Menu } from 'lucide-react';
import { AppSidebar } from '@/components/AppSidebar';
import {
  SidebarProvider,
  SidebarTrigger,
  SidebarInset,
} from '@/components/ui/sidebar';

interface MainLayoutProps {
  children: ReactNode;
}

export function MainLayout({ children }: MainLayoutProps) {
  const { currentUser, setCurrentUserByRole, users } = useHakedisStore();

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <AppSidebar />
        
        <SidebarInset className="flex-1">
          {/* Header */}
          <header className="sticky top-0 z-50 border-b bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80">
            <div className="flex h-14 items-center justify-between px-4">
              {/* Mobile menu trigger */}
              <SidebarTrigger className="p-2 hover:bg-muted rounded-lg">
                <Menu className="h-5 w-5" />
              </SidebarTrigger>

              {/* User Role Selector */}
              <div className="flex items-center gap-3">
                <select
                  value={currentUser.role}
                  onChange={(e) => setCurrentUserByRole(e.target.value as UserRole)}
                  className="rounded-lg border bg-background px-3 py-1.5 text-sm font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
                >
                  {users.map((user) => (
                    <option key={user.id} value={user.role}>
                      {roleLabels[user.role]}
                    </option>
                  ))}
                </select>
                <div className="h-8 w-8 flex items-center justify-center rounded-full bg-primary text-sm font-medium text-primary-foreground">
                  {currentUser.name.charAt(0)}
                </div>
              </div>
            </div>
          </header>

          {/* Main Content */}
          <main className="p-4 sm:p-6 lg:p-8 animate-fade-in">
            {children}
          </main>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}
