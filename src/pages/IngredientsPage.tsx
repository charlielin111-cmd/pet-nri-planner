import React, { useState, useMemo } from 'react';
import { useAppContext } from '@/contexts/AppContext';
import { Ingredient, PriceUnit } from '@/lib/types';
import { NUTRIENT_CATEGORY_LABELS } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Checkbox } from '@/components/ui/checkbox';
import { Plus, Trash2, Pencil, ChevronDown, Search, Settings2, Save, Download } from 'lucide-react';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';

const PRICE_UNIT_LABELS: Record<PriceUnit, string> = {
  per_gram: '每公克',
  per_kg: '每公斤',
  custom: '其他',
};

const IngredientsPage: React.FC = () => {
  const { ingredients, nutrients, saveIngredient, deleteIngredient } = useAppContext();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Ingredient | null>(null);
  const [form, setForm] = useState({ materialCode: '', name: '', priceRaw: 0, caloriesPer100g: 0 });
  const [priceUnit, setPriceUnit] = useState<PriceUnit>('per_gram');
  const [customUnitLabel, setCustomUnitLabel] = useState('');
  const [vitaminEType, setVitaminEType] = useState<'natural' | 'synthetic'>('synthetic');
  const [nutrientValues, setNutrientValues] = useState<Record<string, string>>({});
  const [searchQuery, setSearchQuery] = useState('');
  const [visibleColumns, setVisibleColumns] = useState<Set<string>>(new Set(['materialCode', 'name', 'pricePerGram']));
  const [viewIngredient, setViewIngredient] = useState<Ingredient | null>(null);

  const nutrientColumnOptions = useMemo(() => 
    nutrients.map(n => ({ id: n.id, label: `${n.name} (${n.unit})` })), 
    [nutrients]
  );

  const filteredIngredients = useMemo(() => {
    if (!searchQuery.trim()) return ingredients;
    const q = searchQuery.toLowerCase();
    return ingredients.filter(i =>
      i.materialCode.toLowerCase().includes(q) ||
      i.name.toLowerCase().includes(q)
    );
  }, [ingredients, searchQuery]);

  const openNew = () => {
    setEditing(null);
    setForm({ materialCode: '', name: '', priceRaw: 0, caloriesPer100g: 0 });
    setPriceUnit('per_gram');
    setCustomUnitLabel('');
    setVitaminEType('synthetic');
    setNutrientValues({});
    setDialogOpen(true);
  };

  const openEdit = (ing: Ingredient) => {
    setEditing(ing);
    const unit = ing.priceUnit || 'per_gram';
    setForm({
      materialCode: ing.materialCode,
      name: ing.name,
      priceRaw: ing.priceRaw ?? ing.pricePerGram,
      caloriesPer100g: ing.caloriesPer100g || 0,
    });
    setPriceUnit(unit);
    setCustomUnitLabel(ing.priceUnitLabel || '');
    setVitaminEType(ing.vitaminEType || 'synthetic');
    const nv: Record<string, string> = {};
    nutrients.forEach(n => {
      const val = ing.nutrients[n.id];
      nv[n.id] = val === 'ND' ? 'ND' : val !== undefined ? String(val) : '';
    });
    setNutrientValues(nv);
    setDialogOpen(true);
  };

  const computePricePerGram = (rawPrice: number, unit: PriceUnit): number => {
    if (unit === 'per_kg') return rawPrice / 1000;
    return rawPrice; // per_gram or custom (custom stores as-is, user manages)
  };

  const handleSave = async () => {
    const parsedNutrients: Record<string, number | 'ND'> = {};
    nutrients.forEach(n => {
      const raw = nutrientValues[n.id]?.trim();
      if (!raw || raw.toUpperCase() === 'ND') parsedNutrients[n.id] = 'ND';
      else parsedNutrients[n.id] = parseFloat(raw) || 0;
    });

    const pricePerGram = computePricePerGram(form.priceRaw, priceUnit);

    const item: Ingredient = {
      id: editing?.id || crypto.randomUUID(),
      materialCode: form.materialCode.trim(),
      name: form.name.trim(),
      pricePerGram,
      priceUnit,
      priceUnitLabel: priceUnit === 'custom' ? customUnitLabel.trim() : undefined,
      priceRaw: form.priceRaw,
      caloriesPer100g: form.caloriesPer100g || 0,
      vitaminEType,
      nutrients: parsedNutrients,
      updatedAt: new Date().toISOString(),
    };
    await saveIngredient(item);
    setDialogOpen(false);
    toast.success(editing ? '原料已更新' : '原料已新增');
  };

  const handleExportIngredients = () => {
    const rows = ingredients.map(ing => {
      const row: Record<string, any> = {
        物料編號: ing.materialCode,
        品名: ing.name,
        價格單位: PRICE_UNIT_LABELS[ing.priceUnit || 'per_gram'],
        價格: ing.priceRaw ?? ing.pricePerGram,
        每公克價格: ing.pricePerGram,
        '每100g熱量(kcal)': ing.caloriesPer100g || 0,
      };
      nutrients.forEach(n => {
        row[n.name] = ing.nutrients[n.id] === 'ND' ? 'ND' : ing.nutrients[n.id] ?? 'ND';
      });
      return row;
    });
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(rows);
    XLSX.utils.book_append_sheet(wb, ws, '原料設定');
    XLSX.writeFile(wb, '原料設定.xlsx');
    toast.success('原料資料已匯出');
  };

  const toggleColumn = (col: string) => {
    setVisibleColumns(prev => {
      const next = new Set(prev);
      if (next.has(col)) next.delete(col);
      else next.add(col);
      return next;
    });
  };

  const visibleNutrientCols = nutrients.filter(n => visibleColumns.has(n.id));
  const categories = Object.entries(NUTRIENT_CATEGORY_LABELS);

  const getPriceDisplay = (ing: Ingredient) => {
    const unit = ing.priceUnit || 'per_gram';
    const raw = ing.priceRaw ?? ing.pricePerGram;
    if (unit === 'per_kg') return `$${raw}/kg`;
    if (unit === 'custom') return `$${raw}/${ing.priceUnitLabel || '?'}`;
    return `$${raw}/g`;
  };

  const handleSaveToLocal = () => {
    try {
      localStorage.setItem('app_ingredients', JSON.stringify(ingredients));
      toast.success('原料資料已儲存');
    } catch {
      toast.error('儲存失敗');
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-bold">原料設定</h1>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleSaveToLocal} className="gap-1.5">
            <Save className="h-4 w-4" /> 儲存
          </Button>
          <Button variant="outline" size="sm" onClick={handleExportIngredients} className="gap-1.5">
            <Download className="h-4 w-4" /> 匯出
          </Button>
          <Button onClick={openNew} className="gap-1.5"><Plus className="h-4 w-4" /> 新增原料</Button>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="搜尋原料（編號或名稱）..."
            className="pl-9"
          />
        </div>
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="icon" title="顯示項目設定">
              <Settings2 className="h-4 w-4" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-64 max-h-80 overflow-y-auto scrollbar-thin" align="end">
            <h4 className="text-sm font-medium mb-2">顯示欄位</h4>
            <div className="space-y-1">
              {nutrientColumnOptions.map(opt => (
                <label key={opt.id} className="flex items-center gap-2 text-xs cursor-pointer py-0.5">
                  <Checkbox
                    checked={visibleColumns.has(opt.id)}
                    onCheckedChange={() => toggleColumn(opt.id)}
                  />
                  {opt.label}
                </label>
              ))}
            </div>
          </PopoverContent>
        </Popover>
      </div>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto scrollbar-thin">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="text-left px-4 py-3 font-medium whitespace-nowrap">物料編號</th>
                <th className="text-left px-4 py-3 font-medium whitespace-nowrap">品名</th>
                <th className="text-right px-4 py-3 font-medium whitespace-nowrap">價格</th>
                {visibleNutrientCols.map(n => (
                  <th key={n.id} className="text-right px-3 py-3 font-medium whitespace-nowrap text-xs">
                    {n.name}<br /><span className="text-muted-foreground font-normal">({n.unit})</span>
                  </th>
                ))}
                <th className="text-right px-4 py-3 font-medium">操作</th>
              </tr>
            </thead>
            <tbody>
              {filteredIngredients.length === 0 && (
                <tr><td colSpan={4 + visibleNutrientCols.length} className="text-center py-8 text-muted-foreground">
                  {searchQuery ? '無符合搜尋結果' : '尚無原料，請新增'}
                </td></tr>
              )}
              {filteredIngredients.map(ing => (
                <tr key={ing.id} className="border-b hover:bg-muted/30">
                  <td className="px-4 py-3 font-mono">{ing.materialCode}</td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => setViewIngredient(ing)}
                      className="text-left hover:text-primary hover:underline"
                      title="檢視原料詳情"
                    >
                      {ing.name}
                    </button>
                  </td>
                  <td className="px-4 py-3 text-right">{getPriceDisplay(ing)}</td>
                  {visibleNutrientCols.map(n => (
                    <td key={n.id} className="px-3 py-3 text-right font-mono text-xs">
                      {ing.nutrients[n.id] === 'ND' ? <span className="text-muted-foreground">ND</span> : (ing.nutrients[n.id] ?? <span className="text-muted-foreground">ND</span>)}
                    </td>
                  ))}
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button variant="ghost" size="icon" onClick={() => openEdit(ing)}><Pencil className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="icon" onClick={() => deleteIngredient(ing.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto scrollbar-thin">
          <DialogHeader>
            <DialogTitle>{editing ? '編輯原料' : '新增原料'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">物料編號</label>
                <Input value={form.materialCode} onChange={e => setForm(p => ({ ...p, materialCode: e.target.value }))} />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">品名</label>
                <Input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3 items-end">
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">價格單位</label>
                <Select value={priceUnit} onValueChange={(v: PriceUnit) => setPriceUnit(v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="per_gram">每公克</SelectItem>
                    <SelectItem value="per_kg">每公斤</SelectItem>
                    <SelectItem value="custom">其他</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {priceUnit === 'custom' && (
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">自訂單位名稱</label>
                  <Input value={customUnitLabel} onChange={e => setCustomUnitLabel(e.target.value)} placeholder="例：每包、每磅..." />
                </div>
              )}
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">
                  價格 ({priceUnit === 'per_kg' ? '元/kg' : priceUnit === 'custom' ? `元/${customUnitLabel || '?'}` : '元/g'})
                </label>
                <Input type="number" value={form.priceRaw} onChange={e => setForm(p => ({ ...p, priceRaw: Number(e.target.value) || 0 }))} min={0} step={0.01} />
              </div>
            </div>

            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">每 100g 熱量 (kcal)</label>
              <Input type="number" value={form.caloriesPer100g} onChange={e => setForm(p => ({ ...p, caloriesPer100g: Number(e.target.value) || 0 }))} className="w-40" min={0} step={0.01} />
            </div>

            <p className="text-xs text-muted-foreground">營養成分（每 100g 含量），輸入 ND 代表未設定</p>

            {categories.map(([cat, label]) => {
              const catNutrients = nutrients.filter(n => n.category === cat);
              if (catNutrients.length === 0) return null;
              return (
                <Collapsible key={cat} defaultOpen>
                  <CollapsibleTrigger className="flex items-center gap-1.5 text-sm font-medium w-full py-1.5 hover:text-primary">
                    <ChevronDown className="h-4 w-4" />
                    {label}
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <div className="grid grid-cols-2 gap-2 mt-1">
                      {catNutrients.map(n => (
                        <div key={n.id} className="flex items-center gap-2">
                          <label className="text-xs flex-1 min-w-0 truncate" title={`${n.name} (${n.nameEn})`}>
                            {n.name} <span className="text-muted-foreground">({n.unit})</span>
                          </label>
                          {n.id === 'vitamin_e' && (
                            <Select value={vitaminEType} onValueChange={(v: 'natural' | 'synthetic') => setVitaminEType(v)}>
                              <SelectTrigger className="h-7 w-24 text-xs">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="synthetic">合成型</SelectItem>
                                <SelectItem value="natural">天然型</SelectItem>
                              </SelectContent>
                            </Select>
                          )}
                          <Input
                            value={nutrientValues[n.id] || ''}
                            onChange={e => setNutrientValues(p => ({ ...p, [n.id]: e.target.value }))}
                            placeholder="ND"
                            className="w-24 h-7 text-xs"
                          />
                        </div>
                      ))}
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              );
            })}

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="secondary" onClick={() => setDialogOpen(false)}>取消</Button>
              <Button onClick={handleSave} className="gap-1.5"><Save className="h-4 w-4" /> 儲存</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* View ingredient detail dialog — mirrors edit form layout */}
      <Dialog open={!!viewIngredient} onOpenChange={(o) => !o && setViewIngredient(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto scrollbar-thin">
          <DialogHeader>
            <DialogTitle>
              原料詳情 — <span className="font-mono text-base">{viewIngredient?.materialCode}</span> {viewIngredient?.name}
            </DialogTitle>
          </DialogHeader>
          {viewIngredient && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">物料編號</label>
                  <div className="text-sm font-mono px-3 py-2 border rounded bg-muted/30">{viewIngredient.materialCode}</div>
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">品名</label>
                  <div className="text-sm px-3 py-2 border rounded bg-muted/30">{viewIngredient.name}</div>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">價格單位</label>
                  <div className="text-sm px-3 py-2 border rounded bg-muted/30">{PRICE_UNIT_LABELS[viewIngredient.priceUnit || 'per_gram']}</div>
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">價格</label>
                  <div className="text-sm font-mono px-3 py-2 border rounded bg-muted/30">{getPriceDisplay(viewIngredient)}</div>
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">每公克價格</label>
                  <div className="text-sm font-mono px-3 py-2 border rounded bg-muted/30">${viewIngredient.pricePerGram}/g</div>
                </div>
              </div>

              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">每 100g 熱量 (kcal)</label>
                <div className="text-sm font-mono px-3 py-2 border rounded bg-muted/30 w-40">{viewIngredient.caloriesPer100g || 0}</div>
              </div>

              <p className="text-xs text-muted-foreground">營養成分（每 100g 含量），ND 代表未設定</p>

              {categories.map(([cat, label]) => {
                const catNutrients = nutrients.filter(n => n.category === cat);
                if (catNutrients.length === 0) return null;
                return (
                  <Collapsible key={cat} defaultOpen>
                    <CollapsibleTrigger className="flex items-center gap-1.5 text-sm font-medium w-full py-1.5 hover:text-primary">
                      <ChevronDown className="h-4 w-4" />
                      {label}
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <div className="grid grid-cols-2 gap-2 mt-1">
                        {catNutrients.map(n => {
                          const val = viewIngredient.nutrients[n.id];
                          const display = val === undefined || val === 'ND' ? 'ND' : String(val);
                          return (
                            <div key={n.id} className="flex items-center gap-2">
                              <label className="text-xs flex-1 min-w-0 truncate" title={`${n.name} (${n.nameEn})`}>
                                {n.name} <span className="text-muted-foreground">({n.unit})</span>
                              </label>
                              {n.id === 'vitamin_e' && (
                                <span className="h-7 px-2 text-xs border rounded bg-muted/30 flex items-center w-24 justify-center">
                                  {viewIngredient.vitaminEType === 'natural' ? '天然型' : '合成型'}
                                </span>
                              )}
                              <div className={`w-24 h-7 px-2 text-xs border rounded bg-muted/30 flex items-center justify-end font-mono ${display === 'ND' ? 'text-muted-foreground' : ''}`}>
                                {display}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </CollapsibleContent>
                  </Collapsible>
                );
              })}

              <div className="text-xs text-muted-foreground pt-2 border-t">
                最後更新：{new Date(viewIngredient.updatedAt).toLocaleString('zh-TW', { timeZone: 'Asia/Taipei' })}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default IngredientsPage;
