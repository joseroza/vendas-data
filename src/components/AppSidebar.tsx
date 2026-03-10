import {
  LayoutDashboard, Users, Droplets, Smartphone, AlertTriangle,
  Settings, ChevronDown, List, Package, Shield
} from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useLocation } from "react-router-dom";
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarGroupLabel,
  SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarHeader, useSidebar,
} from "@/components/ui/sidebar";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

const mainItems = [
  { title: "Dashboard",  url: "/",          icon: LayoutDashboard },
  { title: "Clientes",   url: "/clientes",  icon: Users },
  { title: "Cobranças",  url: "/cobrancas", icon: AlertTriangle },
];

const perfumeItems = [
  { title: "Vendas",     url: "/perfumes/vendas",     icon: List },
  { title: "Estoque",    url: "/perfumes/catalogo",   icon: Package },
];

const eletronicosItems = [
  { title: "Vendas",     url: "/eletronicos/vendas",     icon: List },
  { title: "Estoque",    url: "/eletronicos/catalogo",   icon: Package },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const location  = useLocation();
  const path      = location.pathname;

  const isPerfumeActive     = perfumeItems.some((i)     => path.startsWith(i.url));
  const isEletronicosActive = eletronicosItems.some((i) => path.startsWith(i.url));

  const link   = "flex items-center gap-3 px-3 py-2 rounded-lg text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors text-sm";
  const active = "bg-sidebar-accent text-primary font-medium";

  function NavItem({ url, icon: Icon, title }: { url: string; icon: React.ElementType; title: string }) {
    return (
      <SidebarMenuItem>
        <SidebarMenuButton asChild>
          <NavLink to={url} end className={link} activeClassName={active}>
            <Icon className="h-4 w-4 shrink-0" />
            {!collapsed && <span>{title}</span>}
          </NavLink>
        </SidebarMenuButton>
      </SidebarMenuItem>
    );
  }

  function CollapseGroup({
    label, icon: Icon, items, defaultOpen,
  }: { label: string; icon: React.ElementType; items: typeof perfumeItems; defaultOpen: boolean }) {
    if (collapsed) {
      return (
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton asChild>
                  <NavLink to={items[0].url} className={link} activeClassName={active}>
                    <Icon className="h-4 w-4 shrink-0" />
                  </NavLink>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      );
    }
    return (
      <Collapsible defaultOpen={defaultOpen} className="group/collapsible">
        <SidebarGroup>
          <CollapsibleTrigger className="flex items-center justify-between w-full px-3 py-1.5 text-xs uppercase tracking-wider text-sidebar-foreground/50 hover:text-sidebar-foreground/80 transition-colors">
            <div className="flex items-center gap-2">
              <Icon className="h-3.5 w-3.5" />
              <span>{label}</span>
            </div>
            <ChevronDown className="h-3.5 w-3.5 transition-transform group-data-[state=open]/collapsible:rotate-180" />
          </CollapsibleTrigger>
          <CollapsibleContent>
            <SidebarGroupContent>
              <SidebarMenu>
                {items.map((item) => (
                  <NavItem key={item.url} url={item.url} icon={item.icon} title={item.title} />
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </CollapsibleContent>
        </SidebarGroup>
      </Collapsible>
    );
  }

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="p-4 border-b border-sidebar-border">
        {collapsed ? (
          <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center mx-auto">
            <span className="text-primary-foreground font-bold text-sm">SV</span>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
              <span className="text-primary-foreground font-bold text-sm">SV</span>
            </div>
            <span className="font-bold text-sidebar-accent-foreground">Sales View</span>
          </div>
        )}
      </SidebarHeader>

      <SidebarContent className="py-2 overflow-y-auto">
        {/* Principal */}
        <SidebarGroup>
          {!collapsed && (
            <SidebarGroupLabel className="text-xs uppercase tracking-wider text-sidebar-foreground/50 px-3">
              Principal
            </SidebarGroupLabel>
          )}
          <SidebarGroupContent>
            <SidebarMenu>
              {mainItems.map((item) => (
                <NavItem key={item.url} url={item.url} icon={item.icon} title={item.title} />
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <CollapseGroup label="Perfumes"    icon={Droplets}    items={perfumeItems}     defaultOpen={isPerfumeActive} />
        <CollapseGroup label="Eletrônicos" icon={Smartphone}  items={eletronicosItems} defaultOpen={isEletronicosActive} />

        {/* Rodapé: Admin + Configurações */}
        <SidebarGroup className="mt-auto">
          <SidebarGroupContent>
            <SidebarMenu>
              <NavItem url="/admin"         icon={Shield}   title="Painel Admin" />
              <NavItem url="/configuracoes" icon={Settings} title="Configurações" />
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}