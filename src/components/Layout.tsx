import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useAppContext } from '@/contexts/AppContext';
import { FlaskConical, Package, ShieldCheck, FileText } from 'lucide-react';

const navItems = [
  { to: '/', label: '配方', icon: FileText },
  { to: '/editor', label: '配方組成', icon: FlaskConical },
  { to: '/ingredients', label: '原料設定', icon: Package },
  { to: '/channels', label: '規範限值', icon: ShieldCheck },
];

const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { lastUpdate } = useAppContext();
  const location = useLocation();

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Top bar */}
      <header className="sticky top-0 z-50 border-b bg-card/80 backdrop-blur-sm">
        <div className="max-w-[1600px] mx-auto px-4 flex items-center justify-between h-14">
          <div className="flex items-center gap-1">
            <FlaskConical className="h-5 w-5 text-primary" />
            <span className="font-semibold text-lg tracking-tight">PetNutri</span>
          </div>
          <nav className="flex items-center gap-1">
            {navItems.map(item => (
              <NavLink
                key={item.to}
                to={item.to}
                className={() => {
                  const isActive = item.to === '/' ? location.pathname === '/' : location.pathname.startsWith(item.to);
                  return `flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:text-foreground hover:bg-secondary'
                  }`;
                }}
              >
                <item.icon className="h-4 w-4" />
                <span className="hidden sm:inline">{item.label}</span>
              </NavLink>
            ))}
          </nav>
          {lastUpdate && (
            <div className="text-xs text-muted-foreground hidden md:block">
              Latest Update: {lastUpdate}
            </div>
          )}
        </div>
      </header>
      {/* Content */}
      <main className="flex-1 max-w-[1600px] w-full mx-auto px-4 py-6">
        {children}
      </main>
    </div>
  );
};

export default Layout;
