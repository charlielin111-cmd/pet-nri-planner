import React, { useRef, useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useAppContext } from '@/contexts/AppContext';
import { ImportDiff, ImportDiffItem } from '@/contexts/AppContext';
import { FlaskConical, Package, ShieldCheck, FileText, Undo2, Download, Upload, Scale, Plus, RefreshCw, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';

const navItems = [
  { to: '/', label: '配方', icon: FileText },
  { to: '/editor', label: '配方組成', icon: FlaskConical },
  { to: '/batch', label: '核配', icon: Scale },
  { to: '/ingredients', label: '原料設定', icon: Package },
  { to: '/channels', label: '規範限值', icon: ShieldCheck },
];

const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { lastUpdate, canUndo, undoCount, undo, exportAllData, importAllData, previewImportDiff, importSelective } = useAppContext();
  const location = useLocation();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [importMode, setImportMode] = useState<'overwrite' | 'update'>('update');
  const [pendingFile, setPendingFile] = useState<string | null>(null);

  // Selective import state
  const [diffPreview, setDiffPreview] = useState<ImportDiff | null>(null);
  const [selectedKeys, setSelectedKeys] = useState<{ ingredients: string[]; channels: string[]; formulas: string[]; nutrients: string[] }>({
    ingredients: [], channels: [], formulas: [], nutrients: [],
  });
  const [showPreview, setShowPreview] = useState(false);

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

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      setPendingFile(text);
      setImportMode('update');
      setShowPreview(false);
      setDiffPreview(null);
      setImportDialogOpen(true);
    } catch {
      toast.error('讀取檔案失敗');
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleModeSelect = async () => {
    if (importMode === 'overwrite') {
      // Directly confirm overwrite
      handleConfirmImport();
    } else {
      // Show preview for update mode
      if (!pendingFile) return;
      try {
        const diff = await previewImportDiff(pendingFile);
        setDiffPreview(diff);
        // Select all by default
        setSelectedKeys({
          ingredients: diff.ingredients.map(d => d.key),
          channels: diff.channels.map(d => d.key),
          formulas: diff.formulas.map(d => d.key),
          nutrients: diff.nutrients.map(d => d.key),
        });
        setShowPreview(true);
      } catch {
        toast.error('解析檔案失敗');
      }
    }
  };

  const handleConfirmImport = async () => {
    if (!pendingFile) return;
    try {
      await importAllData(pendingFile, importMode);
      toast.success(importMode === 'overwrite' ? '資料已覆蓋匯入' : '資料已更新匯入');
    } catch {
      toast.error('匯入失敗，請確認檔案格式');
    }
    resetImportState();
  };

  const handleConfirmSelective = async () => {
    if (!pendingFile) return;
    try {
      await importSelective(pendingFile, selectedKeys);
      const total = selectedKeys.ingredients.length + selectedKeys.channels.length + selectedKeys.formulas.length + selectedKeys.nutrients.length;
      toast.success(`已選擇性匯入 ${total} 筆資料`);
    } catch {
      toast.error('匯入失敗，請確認檔案格式');
    }
    resetImportState();
  };

  const resetImportState = () => {
    setPendingFile(null);
    setImportDialogOpen(false);
    setShowPreview(false);
    setDiffPreview(null);
    setSelectedKeys({ ingredients: [], channels: [], formulas: [], nutrients: [] });
  };

  const toggleKey = (category: keyof typeof selectedKeys, key: string) => {
    setSelectedKeys(prev => ({
      ...prev,
      [category]: prev[category].includes(key)
        ? prev[category].filter(k => k !== key)
        : [...prev[category], key],
    }));
  };

  const toggleAllInCategory = (category: keyof typeof selectedKeys, items: ImportDiffItem[]) => {
    const allKeys = items.map(d => d.key);
    const allSelected = allKeys.every(k => selectedKeys[category].includes(k));
    setSelectedKeys(prev => ({
      ...prev,
      [category]: allSelected ? [] : allKeys,
    }));
  };

  const handleUndo = async () => {
    await undo();
    toast.success('已復原');
  };

  const totalSelected = selectedKeys.ingredients.length + selectedKeys.channels.length + selectedKeys.formulas.length + selectedKeys.nutrients.length;

  const renderDiffSection = (title: string, category: keyof typeof selectedKeys, items: ImportDiffItem[]) => {
    if (items.length === 0) return null;
    const newItems = items.filter(i => i.type === 'new');
    const updateItems = items.filter(i => i.type === 'update');
    const allSelected = items.every(i => selectedKeys[category].includes(i.key));

    return (
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Checkbox
              checked={allSelected}
              onCheckedChange={() => toggleAllInCategory(category, items)}
            />
            <span className="text-sm font-semibold">{title}</span>
            <Badge variant="secondary" className="text-xs">{items.length}</Badge>
          </div>
          <div className="flex gap-1.5">
            {newItems.length > 0 && (
              <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-200 text-xs">
                <Plus className="h-3 w-3 mr-0.5" /> 新增 {newItems.length}
              </Badge>
            )}
            {updateItems.length > 0 && (
              <Badge className="bg-blue-500/10 text-blue-600 border-blue-200 text-xs">
                <RefreshCw className="h-3 w-3 mr-0.5" /> 更新 {updateItems.length}
              </Badge>
            )}
          </div>
        </div>
        <div className="ml-6 space-y-1">
          {items.map(item => (
            <label key={item.key} className="flex items-center gap-2 py-1 px-2 rounded hover:bg-secondary/50 cursor-pointer text-sm">
              <Checkbox
                checked={selectedKeys[category].includes(item.key)}
                onCheckedChange={() => toggleKey(category, item.key)}
              />
              <span className="flex-1 truncate">{item.label}</span>
              {item.type === 'new' ? (
                <Badge variant="outline" className="text-emerald-600 border-emerald-300 text-xs shrink-0">新增</Badge>
              ) : (
                <Badge variant="outline" className="text-blue-600 border-blue-300 text-xs shrink-0">更新</Badge>
              )}
            </label>
          ))}
        </div>
      </div>
    );
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
            <input ref={fileInputRef} type="file" accept=".json" className="hidden" onChange={handleFileSelect} />
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

      <Dialog open={importDialogOpen} onOpenChange={(open) => { if (!open) resetImportState(); }}>
        <DialogContent className="sm:max-w-lg max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>{showPreview ? '選擇要匯入的項目' : '選擇匯入方式'}</DialogTitle>
            <DialogDescription>
              {showPreview
                ? '勾選需要新增或更新的資料項目'
                : '請選擇要如何處理上傳的 JSON 資料'}
            </DialogDescription>
          </DialogHeader>

          {!showPreview ? (
            <>
              <RadioGroup value={importMode} onValueChange={(v) => setImportMode(v as 'overwrite' | 'update')} className="gap-4 py-4">
                <div className="flex items-start gap-3 p-3 rounded-lg border hover:bg-secondary/50 cursor-pointer" onClick={() => setImportMode('update')}>
                  <RadioGroupItem value="update" id="mode-update" className="mt-0.5" />
                  <Label htmlFor="mode-update" className="cursor-pointer flex-1">
                    <div className="font-medium">更新模式</div>
                    <div className="text-sm text-muted-foreground mt-1">依照配方編號、原料編號、通路名稱比對，可選擇要更新或新增的項目</div>
                  </Label>
                </div>
                <div className="flex items-start gap-3 p-3 rounded-lg border hover:bg-secondary/50 cursor-pointer" onClick={() => setImportMode('overwrite')}>
                  <RadioGroupItem value="overwrite" id="mode-overwrite" className="mt-0.5" />
                  <Label htmlFor="mode-overwrite" className="cursor-pointer flex-1">
                    <div className="font-medium">覆蓋模式</div>
                    <div className="text-sm text-muted-foreground mt-1">完全清除現有資料，以上傳的 JSON 檔案內容取代</div>
                  </Label>
                </div>
              </RadioGroup>
              <DialogFooter>
                <Button variant="outline" onClick={resetImportState}>取消</Button>
                <Button onClick={handleModeSelect}>
                  {importMode === 'overwrite' ? '確認覆蓋' : '下一步'}
                </Button>
              </DialogFooter>
            </>
          ) : diffPreview && (
            <>
              <ScrollArea className="flex-1 min-h-0 max-h-[50vh] pr-3">
                <div className="space-y-4">
                  {renderDiffSection('原料設定', 'ingredients', diffPreview.ingredients)}
                  {renderDiffSection('配方', 'formulas', diffPreview.formulas)}
                  {renderDiffSection('規範限值（通路）', 'channels', diffPreview.channels)}
                  {renderDiffSection('營養素定義', 'nutrients', diffPreview.nutrients)}
                  {diffPreview.ingredients.length === 0 && diffPreview.formulas.length === 0 &&
                   diffPreview.channels.length === 0 && diffPreview.nutrients.length === 0 && (
                    <div className="text-center text-muted-foreground py-6 text-sm">
                      上傳的 JSON 檔案中沒有可匯入的資料
                    </div>
                  )}
                </div>
              </ScrollArea>
              <DialogFooter className="flex items-center justify-between sm:justify-between">
                <Button variant="outline" onClick={() => setShowPreview(false)}>上一步</Button>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">已選 {totalSelected} 項</span>
                  <Button onClick={handleConfirmSelective} disabled={totalSelected === 0}>
                    確認匯入
                  </Button>
                </div>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Layout;
