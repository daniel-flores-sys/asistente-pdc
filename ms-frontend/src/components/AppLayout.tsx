import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { BookOpen, Coins, History, LayoutDashboard, LogOut, Settings } from 'lucide-react';
import { useAppStore } from '@/store/useAppStore';
import { cn } from '@/lib/utils';

const navItems = [
  { to: '/generar', label: 'Generar PDC', icon: LayoutDashboard },
  { to: '/historial', label: 'Historial', icon: History },
];

export default function AppLayout() {
  const { user, logout } = useAppStore();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-muted/30 flex flex-col">
      {/* Top nav */}
      <header className="bg-background border-b sticky top-0 z-40">
        <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between gap-4">
          {/* Logo */}
          <div className="flex items-center gap-2 shrink-0">
            <div className="w-7 h-7 rounded-md bg-primary flex items-center justify-center">
              <BookOpen className="w-4 h-4 text-primary-foreground" />
            </div>
            <span className="font-bold text-sm hidden sm:block">PDC Bolivia</span>
          </div>

          {/* Navigation */}
          <nav className="flex items-center gap-1">
            {navItems.map(({ to, label, icon: Icon }) => (
              <NavLink
                key={to}
                to={to}
                className={({ isActive }) =>
                  cn(
                    'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors',
                    isActive
                      ? 'bg-primary/10 text-primary'
                      : 'text-muted-foreground hover:text-foreground hover:bg-accent',
                  )
                }
              >
                <Icon className="w-4 h-4" />
                <span className="hidden sm:block">{label}</span>
              </NavLink>
            ))}
          </nav>

          {/* User menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="flex items-center gap-2 h-9 px-2">
                <Badge variant="secondary" className="hidden sm:flex items-center gap-1 text-xs">
                  <Coins className="w-3 h-3" />
                  {user?.creditos ?? 0}
                </Badge>
                <Avatar className="w-7 h-7">
                  <AvatarFallback className="text-xs bg-primary text-primary-foreground">
                    {user?.nombre?.slice(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuLabel className="font-normal">
                <p className="font-medium text-sm truncate">{user?.nombre}</p>
                <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              {user?.rol === 'admin' && (
                <>
                  <DropdownMenuItem onClick={() => navigate('/admin/documentos')}>
                    <Settings className="w-4 h-4 mr-2" />
                    Panel Admin
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                </>
              )}
              <DropdownMenuItem onClick={handleLogout} className="text-destructive focus:text-destructive">
                <LogOut className="w-4 h-4 mr-2" />
                Cerrar sesión
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      {/* Main */}
      <main className="flex-1 max-w-5xl mx-auto w-full px-4 py-6">
        <Outlet />
      </main>
    </div>
  );
}
