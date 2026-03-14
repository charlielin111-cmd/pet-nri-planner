import React, { useRef } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useAppContext } from '@/contexts/AppContext';
import { FlaskConical, Package, ShieldCheck, FileText, Undo2, Download, Upload, Scale } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

const navItems = [
  { to: '/', label: '配方', icon: FileText },
  { to: '/editor', label: '配方組成', icon: FlaskConical },
  { to: '/batch', label: '核配', icon: Scale },
  { to: '/ingredients', label: '原料設定', icon: Package },
  { to: '/channels', label: '規範限值', icon: ShieldCheck },
];

const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { lastUpdate, canUndo, undoCount, undo, exportAllData, importAllData } = useAppContext();
  const location = useLocation();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleExport = async () => {
    const json = await exportAllData();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `PetNutri_backup_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('資料已匯出');
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      await importAllData(text);
      toast.success('資料已匯入');
    } catch {
      toast.error('匯入失敗，請確認檔案格式');
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleUndo = async () => {
    await undo();
    toast.success('已復原');
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
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
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" onClick={handleUndo} disabled={!canUndo} title={`復原 (${undoCount})`}>
              <Undo2 className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" onClick={handleExport} title="匯出全部資料">
              <Download className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" onClick={() => fileInputRef.current?.click()} title="匯入資料">
              <Upload className="h-4 w-4" />
            </Button>
            <input ref={fileInputRef} type="file" accept=".json" className="hidden" onChange={handleImport} />
            {lastUpdate && (
              <div className="text-xs text-muted-foreground hidden md:block ml-2">
                Latest Update: {lastUpdate}
              </div>
            )}
          </div>
        </div>
      </header>
      <main className="flex-1 max-w-[1600px] w-full mx-auto px-4 py-6">
        {children}
      </main>
    </div>
  );
};

export default Layout;
