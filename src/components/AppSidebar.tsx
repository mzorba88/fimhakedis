import { useLocation } from 'react-router-dom';
import { 
  LayoutDashboard, 
  FolderKanban, 
  ClipboardList, 
  CheckCircle2, 
  Wallet,
  FileText
} from 'lucide-react';
import { NavLink } from '@/components/NavLink';
import formanLogo from '@/assets/forman-logo.png';
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from '@/components/ui/sidebar';

const navigation = [
  { name: 'Dashboard', href: '/', icon: LayoutDashboard },
  { name: 'Projeler', href: '/projeler', icon: FolderKanban },
  { name: 'Altyüklenici Sözleşmeleri', href: '/yapilanisler', icon: ClipboardList },
  { name: 'Altyüklenici Hakedişleri', href: '/hakedisler', icon: FileText },
  { name: 'Onay Bekleyenler', href: '/onaylar', icon: CheckCircle2 },
  { name: 'Ödemeler', href: '/odemeler', icon: Wallet },
  { name: 'Hakediş Raporları', href: '/raporlar', icon: FileText },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === 'collapsed';
  const location = useLocation();

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="border-b p-4">
        <div className="flex items-center gap-3">
          <img 
            src={formanLogo} 
            alt="Forman International" 
            className={collapsed ? "h-8 w-auto" : "h-10 w-auto"}
          />
          {!collapsed && (
            <span className="text-lg font-semibold text-foreground whitespace-nowrap">
              FIM-Hakedişler
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
                        {!collapsed && <span>{item.name}</span>}
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
