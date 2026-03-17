import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { Button } from './ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from './ui/dropdown-menu';
import { Sun, Moon, User, LogOut, LayoutDashboard, PlusCircle, Receipt } from 'lucide-react';

export const Layout = ({ children }) => {
  const { user, logout, isAuthenticated } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  const isActive = (path) => location.pathname === path;

  return (
    <div className="min-h-screen bg-background">
      {/* Navigation */}
      <nav className="sticky top-0 z-50 glass border-b border-border/50">
        <div className="max-w-7xl mx-auto px-4 md:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <Link to="/" className="flex items-center gap-2 group" data-testid="logo-link">
              <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center">
                <Receipt className="w-5 h-5 text-primary-foreground" />
              </div>
              <span className="font-outfit font-bold text-xl tracking-tight">
                Calorie<span className="text-primary">Cost</span>
              </span>
            </Link>

            {/* Navigation Links */}
            <div className="flex items-center gap-4">
              {isAuthenticated ? (
                <>
                  <Link to="/dashboard" data-testid="nav-dashboard">
                    <Button 
                      variant={isActive('/dashboard') ? 'secondary' : 'ghost'} 
                      size="sm"
                      className="font-outfit"
                    >
                      <LayoutDashboard className="w-4 h-4 mr-2" />
                      Dashboard
                    </Button>
                  </Link>
                  <Link to="/analyze" data-testid="nav-analyze">
                    <Button 
                      variant={isActive('/analyze') ? 'secondary' : 'ghost'} 
                      size="sm"
                      className="font-outfit"
                    >
                      <PlusCircle className="w-4 h-4 mr-2" />
                      New Analysis
                    </Button>
                  </Link>
                </>
              ) : null}

              {/* Theme Toggle */}
              <Button
                variant="ghost"
                size="icon"
                onClick={toggleTheme}
                data-testid="theme-toggle"
                className="rounded-full"
              >
                {theme === 'dark' ? (
                  <Sun className="w-5 h-5" />
                ) : (
                  <Moon className="w-5 h-5" />
                )}
              </Button>

              {/* User Menu */}
              {isAuthenticated ? (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm" className="rounded-full" data-testid="user-menu-trigger">
                      <User className="w-4 h-4 mr-2" />
                      {user?.name?.split(' ')[0]}
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-48">
                    <div className="px-2 py-1.5">
                      <p className="font-medium font-outfit">{user?.name}</p>
                      <p className="text-xs text-muted-foreground">{user?.email}</p>
                    </div>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => navigate('/dashboard')} data-testid="menu-dashboard">
                      <LayoutDashboard className="w-4 h-4 mr-2" />
                      Dashboard
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={handleLogout} className="text-destructive" data-testid="menu-logout">
                      <LogOut className="w-4 h-4 mr-2" />
                      Logout
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              ) : (
                <div className="flex items-center gap-2">
                  <Link to="/login" data-testid="nav-login">
                    <Button variant="ghost" size="sm" className="font-outfit">
                      Login
                    </Button>
                  </Link>
                  <Link to="/register" data-testid="nav-register">
                    <Button size="sm" className="rounded-full font-outfit">
                      Get Started
                    </Button>
                  </Link>
                </div>
              )}
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main>{children}</main>

      {/* Footer */}
      <footer className="border-t border-border/50 py-8 mt-auto">
        <div className="max-w-7xl mx-auto px-4 md:px-8">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <Receipt className="w-5 h-5 text-primary" />
              <span className="font-outfit font-semibold">CalorieCost</span>
            </div>
            <p className="text-sm text-muted-foreground">
              Optimize your nutrition budget with smart analysis
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
};
