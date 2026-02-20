import { ReactNode, useState, useEffect } from 'react';
import { useHakedisStore } from '@/store/hakedisStore';
import { useSupabaseData } from '@/hooks/useSupabaseData';
import { roleLabels, UserRole } from '@/types/hakedis';
import { Menu, Loader2 } from 'lucide-react';
import { AppSidebar } from '@/components/AppSidebar';
import {
  SidebarProvider,
  SidebarTrigger,
  SidebarInset,
} from '@/components/ui/sidebar';
import { LoginModal } from '@/components/LoginModal';
import { RolePasswordDialog } from '@/components/RolePasswordDialog';

interface MainLayoutProps {
  children: ReactNode;
}

export function MainLayout({ children }: MainLayoutProps) {
  const { currentUser, setCurrentUserByRole, users } = useHakedisStore();
  const { isLoading, error } = useSupabaseData();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [showRoleDialog, setShowRoleDialog] = useState(false);
  const [pendingRole, setPendingRole] = useState<UserRole | null>(null);

  // Check session storage for authentication on mount
  useEffect(() => {
    const authenticated = sessionStorage.getItem('isAuthenticated');
    if (authenticated === 'true') {
      setIsAuthenticated(true);
    }
  }, []);

  // Show login modal if not authenticated
  if (!isAuthenticated) {
    return <LoginModal isOpen={true} onLogin={(role) => {
      setCurrentUserByRole(role);
      setIsAuthenticated(true);
      sessionStorage.setItem('isAuthenticated', 'true');
    }} />;
  }

  // Show loading state while fetching data
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-muted-foreground">Veriler yükleniyor...</p>
        </div>
      </div>
    );
  }

  // Show error state if data fetch failed
  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4 text-center">
          <p className="text-destructive font-medium">Hata: {error}</p>
          <button 
            onClick={() => window.location.reload()} 
            className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90"
          >
            Yeniden Dene
          </button>
        </div>
      </div>
    );
  }

  const handleRoleChange = (newRole: UserRole) => {
    if (newRole !== currentUser.role) {
      setPendingRole(newRole);
      setShowRoleDialog(true);
    }
  };

  const handleRoleConfirm = () => {
    if (pendingRole) {
      setCurrentUserByRole(pendingRole);
      setPendingRole(null);
      setShowRoleDialog(false);
    }
  };

  const handleRoleCancel = () => {
    setPendingRole(null);
    setShowRoleDialog(false);
  };

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <AppSidebar />
        
        <SidebarInset className="flex-1 min-w-0 overflow-x-hidden">
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
                  onChange={(e) => handleRoleChange(e.target.value as UserRole)}
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

      {/* Role Change Password Dialog */}
      <RolePasswordDialog
        isOpen={showRoleDialog}
        targetRole={pendingRole}
        onConfirm={handleRoleConfirm}
        onCancel={handleRoleCancel}
      />
    </SidebarProvider>
  );
}
