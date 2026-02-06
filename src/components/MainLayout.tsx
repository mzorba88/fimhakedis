import { ReactNode, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { 
  LayoutDashboard, 
  FolderKanban, 
  ClipboardList, 
  CheckCircle2, 
  Wallet,
  FileText,
  Menu,
  X
} from 'lucide-react';
import { useHakedisStore } from '@/store/hakedisStore';
import { roleLabels, UserRole } from '@/types/hakedis';
import { motion, AnimatePresence } from 'framer-motion';
import formanLogo from '@/assets/forman-logo.png';

interface MainLayoutProps {
  children: ReactNode;
}

const navigation = [
  { name: 'Dashboard', href: '/', icon: LayoutDashboard },
  { name: 'Projeler', href: '/projeler', icon: FolderKanban },
  { name: 'Altyüklenici Sözleşmeleri', href: '/yapilanisler', icon: ClipboardList },
  { name: 'Altyüklenici Hakedişleri', href: '/hakedisler', icon: FileText },
  { name: 'Onay Bekleyenler', href: '/onaylar', icon: CheckCircle2 },
  { name: 'Ödemeler', href: '/odemeler', icon: Wallet },
  { name: 'Hakediş Raporları', href: '/raporlar', icon: FileText },
];

export function MainLayout({ children }: MainLayoutProps) {
  const location = useLocation();
  const { currentUser, setCurrentUserByRole, users } = useHakedisStore();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <div className="min-h-screen bg-muted/30">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          {/* Logo */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="rounded-lg p-2 text-muted-foreground hover:bg-muted lg:hidden"
            >
              {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
            <Link to="/" className="flex items-center gap-3">
              <img src={formanLogo} alt="Forman International" className="h-10 w-auto" />
              <span className="hidden text-lg font-semibold text-foreground sm:block">
                FIM-Hakedişler
              </span>
            </Link>
          </div>

          {/* Desktop Navigation */}
          <nav className="hidden lg:flex lg:items-center lg:gap-1">
            {navigation.map((item) => {
              const isActive = location.pathname === item.href;
              return (
                <Link
                  key={item.name}
                  to={item.href}
                  className={cn(
                    'nav-link',
                    isActive ? 'nav-link-active' : 'nav-link-inactive'
                  )}
                >
                  <item.icon className="h-4 w-4" />
                  {item.name}
                </Link>
              );
            })}
          </nav>

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
            <div className="hidden h-8 w-8 items-center justify-center rounded-full bg-primary text-sm font-medium text-primary-foreground sm:flex">
              {currentUser.name.charAt(0)}
            </div>
          </div>
        </div>
      </header>

      {/* Mobile Navigation */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="border-b bg-card lg:hidden"
          >
            <nav className="mx-auto max-w-7xl space-y-1 px-4 py-3">
              {navigation.map((item) => {
                const isActive = location.pathname === item.href;
                return (
                  <Link
                    key={item.name}
                    to={item.href}
                    onClick={() => setMobileMenuOpen(false)}
                    className={cn(
                      'nav-link w-full',
                      isActive ? 'nav-link-active' : 'nav-link-inactive'
                    )}
                  >
                    <item.icon className="h-5 w-5" />
                    {item.name}
                  </Link>
                );
              })}
            </nav>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Content */}
      <main className="page-container animate-fade-in">
        {children}
      </main>
    </div>
  );
}
