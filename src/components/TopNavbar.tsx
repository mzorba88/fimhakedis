import { useState } from 'react';
import { useLocation } from 'react-router-dom';
import { 
  LayoutDashboard, 
  FolderKanban, 
  ClipboardList, 
  CheckCircle2, 
  Wallet,
  FileText,
  History,
  Users,
  Menu,
  X
} from 'lucide-react';
import { NavLink } from '@/components/NavLink';
import formanLogo from '@/assets/forman-logo.png';
import { useHakedisStore } from '@/store/hakedisStore';
import { cn } from '@/lib/utils';

export function TopNavbar() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();
  const { subcontractorHakedisler } = useHakedisStore();

  const pendingApprovalsCount = 
    subcontractorHakedisler.filter(h => h.approvalStatus === 'onay_bekliyor').length;

  const unpaidPaymentsCount = 
    subcontractorHakedisler.filter(h => 
      h.approvalStatus === 'onaylandi' && h.paymentStatus !== 'odendi'
    ).length;

  const navigation = [
    { name: 'Dashboard', href: '/', icon: LayoutDashboard },
    { name: 'Projeler', href: '/projeler', icon: FolderKanban },
    { name: 'Sözleşmeler', href: '/yapilanisler', icon: ClipboardList },
    { name: 'Hakedişler', href: '/hakedisler', icon: FileText },
    { name: 'Altyükleniciler', href: '/altyukleniciler', icon: Users },
    { name: 'Onaylar', href: '/onaylar', icon: CheckCircle2, badge: pendingApprovalsCount },
    { name: 'Ödemeler', href: '/odemeler', icon: Wallet, badge: unpaidPaymentsCount },
    { name: 'Raporlar', href: '/raporlar', icon: FileText },
    { name: 'Geçmiş', href: '/islem-gecmisi', icon: History },
  ];

  return (
    <>
      <nav className="sticky top-0 z-50 border-b bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80">
        <div className="mx-auto max-w-7xl px-4">
          <div className="flex h-14 items-center gap-4">
            {/* Logo & Brand */}
            <NavLink to="/" end className="flex items-center gap-2 shrink-0" activeClassName="">
              <img src={formanLogo} alt="Forman International" className="h-8 w-auto" />
              <span className="hidden lg:inline text-sm font-semibold text-foreground whitespace-nowrap">
                FIM - HAKEDİŞ YÖNETİM SİSTEMİ
              </span>
            </NavLink>

            {/* Desktop Nav Links */}
            <div className="hidden md:flex items-center gap-1 flex-1 min-w-0 overflow-x-auto">
              {navigation.map((item) => (
                <NavLink
                  key={item.name}
                  to={item.href}
                  end
                  className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground whitespace-nowrap shrink-0"
                  activeClassName="bg-primary/10 text-primary"
                >
                  <item.icon className="h-4 w-4 shrink-0" />
                  <span>{item.name}</span>
                  {item.badge != null && item.badge > 0 && (
                    <span className="text-xs font-semibold bg-primary text-primary-foreground rounded-full px-1.5 py-0.5 min-w-[1.25rem] text-center leading-none">
                      {item.badge}
                    </span>
                  )}
                </NavLink>
              ))}
            </div>

            {/* Mobile hamburger */}
            <button
              className="md:hidden ml-auto p-2 hover:bg-muted rounded-lg"
              onClick={() => setMobileOpen(!mobileOpen)}
            >
              {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>

        {/* Mobile dropdown */}
        {mobileOpen && (
          <div className="md:hidden border-t bg-card animate-fade-in">
            <div className="px-4 py-2 space-y-1">
              {navigation.map((item) => (
                <NavLink
                  key={item.name}
                  to={item.href}
                  end
                  className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                  activeClassName="bg-primary/10 text-primary"
                  onClick={() => setMobileOpen(false)}
                >
                  <item.icon className="h-5 w-5 shrink-0" />
                  <span className="flex-1">{item.name}</span>
                  {item.badge != null && item.badge > 0 && (
                    <span className="text-xs font-semibold bg-primary text-primary-foreground rounded-full px-1.5 py-0.5 min-w-[1.25rem] text-center leading-none">
                      {item.badge}
                    </span>
                  )}
                </NavLink>
              ))}
            </div>
          </div>
        )}
      </nav>
    </>
  );
}
