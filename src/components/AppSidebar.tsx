import { useLocation } from 'react-router-dom';
import { 
  LayoutDashboard, 
  FolderKanban, 
  ClipboardList, 
  CheckCircle2, 
  Wallet,
  FileText,
  History
} from 'lucide-react';
import { NavLink } from '@/components/NavLink';
import formanLogo from '@/assets/forman-logo.png';
import { useHakedisStore } from '@/store/hakedisStore';
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarFooter,
  useSidebar,
} from '@/components/ui/sidebar';

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === 'collapsed';
  const location = useLocation();
  const { workEntries, subcontractorHakedisler } = useHakedisStore();

  const pendingApprovalsCount = 
    workEntries.filter(e => e.approvalStatus === 'onay_bekliyor').length +
    subcontractorHakedisler.filter(h => h.approvalStatus === 'onay_bekliyor').length;

  const unpaidPaymentsCount = 
    subcontractorHakedisler.filter(h => 
      h.approvalStatus === 'onaylandi' && h.paymentStatus !== 'odendi'
    ).length;

  const navigation = [
    { name: 'Dashboard', href: '/', icon: LayoutDashboard },
    { name: 'Projeler', href: '/projeler', icon: FolderKanban },
    { name: 'Altyüklenici Sözleşmeleri', href: '/yapilanisler', icon: ClipboardList },
    { name: 'Altyüklenici Hakedişleri', href: '/hakedisler', icon: FileText },
    { name: 'Onay Bekleyenler', href: '/onaylar', icon: CheckCircle2, badge: pendingApprovalsCount },
    { name: 'Ödemeler', href: '/odemeler', icon: Wallet, badge: unpaidPaymentsCount },
    { name: 'Hakediş Raporları', href: '/raporlar', icon: FileText },
  ];

  const bottomNavigation = [
    { name: 'İşlem Geçmişi', href: '/islem-gecmisi', icon: History },
  ];

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="border-b p-4">
        <div className="flex flex-col items-center gap-2">
          <img 
            src={formanLogo} 
            alt="Forman International" 
            className={collapsed ? "h-8 w-auto" : "h-12 w-auto"}
          />
          {!collapsed && (
            <span className="text-sm font-semibold text-foreground text-center leading-tight">
              FIM - HAKEDİŞ YÖNETİM SİSTEMİ
            </span>
          )}
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {navigation.map((item) => {
                const isActive = location.pathname === item.href;
                return (
                  <SidebarMenuItem key={item.name}>
                    <SidebarMenuButton 
                      asChild 
                      isActive={isActive}
                      tooltip={item.name}
                    >
                      <NavLink 
                        to={item.href} 
                        end 
                        className="flex items-center gap-3 px-3 py-2 rounded-lg transition-colors hover:bg-muted/50"
                        activeClassName="bg-primary/10 text-primary font-medium"
                      >
                        <item.icon className="h-5 w-5 shrink-0" />
                        {!collapsed && (
                          <span className="flex-1">{item.name}</span>
                        )}
                        {!collapsed && item.badge != null && item.badge > 0 && (
                          <span className="ml-auto text-xs font-semibold bg-primary text-primary-foreground rounded-full px-1.5 py-0.5 min-w-[1.25rem] text-center leading-none">
                            {item.badge}
                          </span>
                        )}
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-t">
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {bottomNavigation.map((item) => {
                const isActive = location.pathname === item.href;
                return (
                  <SidebarMenuItem key={item.name}>
                    <SidebarMenuButton 
                      asChild 
                      isActive={isActive}
                      tooltip={item.name}
                    >
                      <NavLink 
                        to={item.href} 
                        end 
                        className="flex items-center gap-3 px-3 py-2 rounded-lg transition-colors hover:bg-muted/50"
                        activeClassName="bg-primary/10 text-primary font-medium"
                      >
                        <item.icon className="h-5 w-5 shrink-0" />
                        {!collapsed && <span>{item.name}</span>}
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarFooter>
    </Sidebar>
  );
}
