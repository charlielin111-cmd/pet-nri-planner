import React, { useState, useMemo, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAppContext } from '@/contexts/AppContext';
import { FormulaIngredient, FormulaSummaryItem, ValidationResult, NUTRIENT_CATEGORY_LABELS, FormulaVersion } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Search, Trash2, GripVertical, Save, AlertTriangle, Settings2, Plus, X, Percent, Weight, Download, Info, History, RotateCcw } from 'lucide-react';
import { Toggle } from '@/components/ui/toggle';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy, useSortable, arrayMove } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';
import { computeNutrientGramTotals } from '@/lib/nutrientConversion';
import { FormulaCombobox } from '@/components/FormulaCombobox';

const PIE_COLORS = [
  'hsl(210, 90%, 50%)', 'hsl(170, 60%, 45%)', 'hsl(38, 92%, 50%)',
  'hsl(0, 72%, 55%)', 'hsl(270, 60%, 55%)', 'hsl(140, 50%, 45%)',
  'hsl(30, 80%, 55%)', 'hsl(200, 70%, 50%)', 'hsl(320, 60%, 50%)',
];

const DEFAULT_SUMMARY_ITEMS = [
  { id: 'crude_protein', label: '粗蛋白質' },
  { id: 'crude_fat', label: '粗脂肪' },
  { id: 'carbohydrate', label: '碳水化合物' },
  { id: 'ca_ph_ratio', label: '鈣磷比' },
];

interface SortableItemProps {
  fi: FormulaIngredient;
  index: number;
  ingredientName: string;
  materialCode: string;
  onAmountChange: (idx: number, val: number) => void;
  onPercentChange: (idx: number, pct: number) => void;
  onRemove: (idx: number) => void;
  usePercent: boolean;
   totalWeight: number;
   servingSize: number;
   nutrientPopover: React.ReactNode;
}

const SortableIngredientRow: React.FC<SortableItemProps> = ({ fi, index, ingredientName, materialCode, onAmountChange, onPercentChange, onRemove, usePercent, totalWeight, servingSize, nutrientPopover }) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: fi.ingredientId + '-' + index });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 50 : undefined,
  };

  const pct = servingSize > 0 ? (fi.amount / servingSize) * 100 : 0;

  return (
    <div ref={setNodeRef} style={style} className="flex items-center gap-2 py-2 px-2 border-b bg-card rounded-md mb-1">
      <button {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground p-1">
        <GripVertical className="h-4 w-4" />
      </button>
      <span className="text-xs font-mono text-muted-foreground w-16 shrink-0">{materialCode}</span>
      <span className="text-sm font-medium flex-1 min-w-0 truncate flex items-center gap-1">
        {ingredientName}
        {nutrientPopover}
      </span>
      <div className="flex items-center gap-2 shrink-0">
        {usePercent ? (
          <>
            <Slider
              value={[pct]}
              onValueChange={([v]) => onPercentChange(index, parseFloat(v.toFixed(3)))}
              max={100}
              step={0.001}
              className="w-24"
            />
            <Input
              type="number"
              value={parseFloat(pct.toFixed(3))}
              onChange={e => onPercentChange(index, Number(e.target.value) || 0)}
              className="w-24 text-right text-sm h-8"
              min={0}
              max={100}
              step={0.001}
            />
            <span className="text-xs text-muted-foreground">%</span>
          </>
        ) : (
          <>
            <Slider
              value={[fi.amount]}
              onValueChange={([v]) => onAmountChange(index, parseFloat(v.toFixed(3)))}
              max={500}
              step={0.001}
              className="w-24"
            />
            <Input
              type="number"
              value={fi.amount}
              onChange={e => onAmountChange(index, Number(e.target.value) || 0)}
              className="w-24 text-right text-sm h-8"
              min={0}
              step={0.001}
            />
            <span className="text-xs text-muted-foreground">g</span>
          </>
        )}
      </div>
      <button onClick={() => onRemove(index)} className="text-muted-foreground hover:text-destructive p-1">
        <Trash2 className="h-4 w-4" />
      </button>
    </div>
  );
};

const FormulaEditorPage: React.FC = () => {
  const { ingredients, channels, formulas, nutrients, saveFormula, getFormulaVersions, restoreFormulaVersion } = useAppContext();
  const [searchParams] = useSearchParams();
  const formulaId = searchParams.get('formula');

  const [selectedFormulaId, setSelectedFormulaId] = useState(formulaId || '');
  const [formulaIngredients, setFormulaIngredients] = useState<FormulaIngredient[]>([]);
  const [search, setSearch] = useState('');
  const [selectedChannelId, setSelectedChannelId] = useState('');
  const [summaryItems, setSummaryItems] = useState<FormulaSummaryItem[]>(DEFAULT_SUMMARY_ITEMS);
  const [summaryEditOpen, setSummaryEditOpen] = useState(false);
  const [usePercent, setUsePercent] = useState(false);

  // Version control state
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [patchNotes, setPatchNotes] = useState('');
  const [versionHistoryOpen, setVersionHistoryOpen] = useState(false);
  const [versions, setVersions] = useState<FormulaVersion[]>([]);
  const [currentVersion, setCurrentVersion] = useState<number | null>(null);

  const selectedFormula = formulas.find(f => f.id === selectedFormulaId);

  // Load current version number when formula changes
  useEffect(() => {
    if (selectedFormulaId) {
      getFormulaVersions(selectedFormulaId).then(v => {
        if (v.length > 0) {
          setCurrentVersion(Math.max(...v.map(ver => ver.version)));
        } else {
          setCurrentVersion(null);
        }
      });
    } else {
      setCurrentVersion(null);
    }
  }, [selectedFormulaId, formulas, getFormulaVersions]);

  useEffect(() => {
    if (selectedFormula) {
      setFormulaIngredients([...selectedFormula.ingredients]);
      setSelectedChannelId(selectedFormula.channelId || '');
      setSummaryItems(selectedFormula.summaryItems && selectedFormula.summaryItems.length > 0 ? selectedFormula.summaryItems : DEFAULT_SUMMARY_ITEMS);
    }
  }, [selectedFormula]);

  useEffect(() => {
    if (formulaId) setSelectedFormulaId(formulaId);
  }, [formulaId]);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const filteredIngredients = useMemo(() => {
    if (!search.trim()) return ingredients;
    const q = search.toLowerCase();
    return ingredients.filter(i => i.name.toLowerCase().includes(q) || i.materialCode.toLowerCase().includes(q));
  }, [ingredients, search]);

  const addIngredient = (ingId: string) => {
    if (formulaIngredients.some(fi => fi.ingredientId === ingId)) return;
    setFormulaIngredients(prev => [...prev, { ingredientId: ingId, amount: 0.01 }]);
  };

  const updateAmount = (idx: number, val: number) => {
    setFormulaIngredients(prev => prev.map((fi, i) => i === idx ? { ...fi, amount: val } : fi));
  };

  const updatePercent = (idx: number, newPct: number) => {
    const baseWeight = selectedFormula?.servingSize || formulaIngredients.reduce((s, fi) => s + fi.amount, 0);
    if (baseWeight <= 0) return;
    const clampedPct = Math.max(0, newPct);
    const newAmount = (clampedPct / 100) * baseWeight;
    setFormulaIngredients(prev => prev.map((fi, i) =>
      i === idx ? { ...fi, amount: parseFloat(newAmount.toFixed(3)) } : fi
    ));
  };

  const removeIngredient = (idx: number) => {
    setFormulaIngredients(prev => prev.filter((_, i) => i !== idx));
  };

  const handleDragEnd = (event: any) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIdx = formulaIngredients.findIndex((fi, i) => fi.ingredientId + '-' + i === active.id);
    const newIdx = formulaIngredients.findIndex((fi, i) => fi.ingredientId + '-' + i === over.id);
    if (oldIdx !== -1 && newIdx !== -1) {
      setFormulaIngredients(prev => arrayMove(prev, oldIdx, newIdx));
    }
  };

  const totals = useMemo(() => {
    const result: Record<string, number> = {};
    formulaIngredients.forEach(fi => {
      const ing = ingredients.find(i => i.id === fi.ingredientId);
      if (!ing) return;
      nutrients.forEach(n => {
        const val = ing.nutrients[n.id];
        if (val !== 'ND' && typeof val === 'number') {
          result[n.id] = (result[n.id] || 0) + (val / 100) * fi.amount;
        }
      });
    });
    return result;
  }, [formulaIngredients, ingredients, nutrients]);

  const totalCalories = useMemo(() => {
    return formulaIngredients.reduce((sum, fi) => {
      const ing = ingredients.find(i => i.id === fi.ingredientId);
      if (!ing) return sum;
      return sum + ((ing.caloriesPer100g || 0) / 100) * fi.amount;
    }, 0);
  }, [formulaIngredients, ingredients]);

  const calcium = totals['calcium'] || 0;
  const phosphorus = totals['phosphorus'] || 0;
  const caPhRatio = phosphorus > 0 ? (calcium / phosphorus).toFixed(2) : 'N/A';

  const getSummaryValue = (id: string) => {
    if (id === 'ca_ph_ratio') return caPhRatio;
    const val = totals[id];
    if (val === undefined) return 'N/A';
    const n = nutrients.find(nt => nt.id === id);
    return `${val.toFixed(2)} ${n?.unit || ''}`;
  };

  const availableForSummary = useMemo(() => {
    const special = [{ id: 'ca_ph_ratio', label: '鈣磷比 (鈣/磷)' }];
    const fromNutrients = nutrients.map(n => ({ id: n.id, label: `${n.name} (${n.unit})` }));
    return [...special, ...fromNutrients];
  }, [nutrients]);

  const toggleSummaryItem = (id: string, label: string) => {
    setSummaryItems(prev => {
      if (prev.some(s => s.id === id)) return prev.filter(s => s.id !== id);
      return [...prev, { id, label: label.split(' (')[0] }];
    });
  };

  // Pie chart: denominator is the formula's serving size (g). Each category's gram total
  // is divided by serving size so percentages reflect "per serving" composition.
  const pieData = useMemo(() => {
    const gramTotals = computeNutrientGramTotals(formulaIngredients, ingredients, nutrients);
    const categories: Record<string, number> = {};
    nutrients.forEach(n => {
      const g = gramTotals[n.id];
      if (g && g > 0) {
        const catLabel = NUTRIENT_CATEGORY_LABELS[n.category];
        categories[catLabel] = (categories[catLabel] || 0) + g;
      }
    });
    return Object.entries(categories)
      .filter(([, v]) => v > 0)
      .map(([name, value]) => ({ name, value: parseFloat(value.toFixed(6)) }));
  }, [formulaIngredients, ingredients, nutrients]);

  // Denominator for percentage display = formula serving size in grams (fallback to total weight)
  const pieDenominator = selectedFormula?.servingSize && selectedFormula.servingSize > 0
    ? selectedFormula.servingSize
    : formulaIngredients.reduce((s, fi) => s + fi.amount, 0);

  const ingredientPieData = useMemo(() => {
    return formulaIngredients
      .filter(fi => fi.amount > 0)
      .map(fi => {
        const ing = ingredients.find(i => i.id === fi.ingredientId);
        return { name: ing?.name || '未知', value: fi.amount };
      });
  }, [formulaIngredients, ingredients]);

  const totalWeight = ingredientPieData.reduce((s, d) => s + d.value, 0);


  const selectedChannel = channels.find(c => c.id === selectedChannelId);
  const validationResults: ValidationResult[] = useMemo(() => {
    if (!selectedChannel) return [];
    if (totalCalories <= 0) return [];
    return nutrients
      .filter(n => selectedChannel.limits[n.id])
      .map(n => {
        const limit = selectedChannel.limits[n.id];
        const rawValue = totals[n.id] || 0;
        const value = (rawValue / totalCalories) * 1000;
        let passed = true;
        if (limit.type === 'min' && limit.min !== undefined) passed = value >= limit.min;
        else if (limit.type === 'max' && limit.max !== undefined) passed = value <= limit.max;
        else if (limit.type === 'range') {
          if (limit.min !== undefined && value < limit.min) passed = false;
          if (limit.max !== undefined && value > limit.max) passed = false;
        }
        return { nutrientId: n.id, nutrientName: n.name, value, unit: n.unit, limit, passed };
      });
  }, [selectedChannel, nutrients, totals, totalCalories]);

  const failures = validationResults.filter(r => !r.passed);

  // Save with version control
  const handleSaveClick = () => {
    if (!selectedFormula) return;
    setSaveDialogOpen(true);
    setPatchNotes('');
  };

  const handleUpdateCurrentVersion = async () => {
    if (!selectedFormula) return;
    await saveFormula({
      ...selectedFormula,
      ingredients: formulaIngredients,
      channelId: selectedChannelId,
      summaryItems,
      updatedAt: new Date().toISOString(),
    }, patchNotes, true);
    setSaveDialogOpen(false);
    toast.success('已更新目前版次');
  };

  const handleCreateNewVersion = async () => {
    if (!selectedFormula) return;
    await saveFormula({
      ...selectedFormula,
      ingredients: formulaIngredients,
      channelId: selectedChannelId,
      summaryItems,
      updatedAt: new Date().toISOString(),
    }, patchNotes, false);
    setSaveDialogOpen(false);
    toast.success('配方已儲存（新版次已建立）');
  };

  const handleShowVersions = async () => {
    if (!selectedFormulaId) return;
    const v = await getFormulaVersions(selectedFormulaId);
    setVersions(v);
    setVersionHistoryOpen(true);
  };

  const handleRestoreVersion = async (version: FormulaVersion) => {
    await restoreFormulaVersion(version);
    setVersionHistoryOpen(false);
    toast.success(`已還原至版本 v${version.version}`);
  };

  const handleExport = () => {
    if (!selectedFormula || formulaIngredients.length === 0) return;
    const ingRows = formulaIngredients.map(fi => {
      const ing = ingredients.find(i => i.id === fi.ingredientId);
      return {
        '編號': ing?.materialCode || '',
        '原料名稱': ing?.name || '未知',
        '用量 (g)': fi.amount,
        '佔比 (%)': (() => { const base = selectedFormula?.servingSize || totalWeight; return base > 0 ? parseFloat(((fi.amount / base) * 100).toFixed(3)) : 0; })(),
      };
    });
    ingRows.push({
      '編號': '',
      '原料名稱': '合計',
      '用量 (g)': parseFloat(totalWeight.toFixed(3)),
      '佔比 (%)': 100,
    });

    const nutRows = nutrients.map(n => ({
      '營養素': n.name,
      '單位': n.unit,
      '含量': totals[n.id] !== undefined ? parseFloat(totals[n.id].toFixed(4)) : 'ND',
    }));

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(ingRows), '配方原料');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(nutRows), '營養成分');
    XLSX.writeFile(wb, `配方組成_${selectedFormula.code}_${selectedFormula.name}.xlsx`);
    toast.success('已匯出 Excel');
  };


  const renderNutrientPopover = (ingredientId: string) => {
    const ing = ingredients.find(i => i.id === ingredientId);
    if (!ing) return null;
    return (
      <Popover>
        <PopoverTrigger asChild>
          <button className="text-muted-foreground hover:text-primary p-0.5 shrink-0" title="檢視營養成分">
            <Info className="h-3.5 w-3.5" />
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-72 max-h-80 overflow-y-auto scrollbar-thin p-3" side="right" align="start">
          <div className="text-sm font-medium mb-2">{ing.name} — 每 100g 營養成分</div>
          {ing.caloriesPer100g !== undefined && ing.caloriesPer100g > 0 && (
            <div className="flex justify-between text-xs py-0.5 border-b mb-1">
              <span className="font-medium">熱量</span>
              <span className="font-mono">{ing.caloriesPer100g} kcal</span>
            </div>
          )}
          {Object.entries(NUTRIENT_CATEGORY_LABELS).map(([cat, label]) => {
            const catNutrients = nutrients.filter(n => n.category === cat);
            const hasValues = catNutrients.some(n => ing.nutrients[n.id] !== undefined && ing.nutrients[n.id] !== 'ND');
            if (!hasValues) return null;
            return (
              <div key={cat} className="mb-2">
                <div className="text-xs font-medium text-muted-foreground mb-0.5">{label}</div>
                {catNutrients.map(n => {
                  const val = ing.nutrients[n.id];
                  if (val === undefined || val === 'ND') return null;
                  return (
                    <div key={n.id} className="flex justify-between text-xs py-0.5">
                      <span>{n.name}</span>
                      <span className="font-mono">{typeof val === 'number' ? val : val} {n.unit}</span>
                    </div>
                  );
                })}
              </div>
            );
          })}
        </PopoverContent>
      </Popover>
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold">
            配方組成
            {selectedFormula && (
              <span className="text-lg font-normal text-muted-foreground ml-2">
                — {selectedFormula.name}
                {currentVersion !== null && (
                  <span className="ml-1.5 text-sm font-mono bg-muted px-1.5 py-0.5 rounded">v{currentVersion}</span>
                )}
              </span>
            )}
          </h1>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <FormulaCombobox
            formulas={formulas}
            value={selectedFormulaId}
            onChange={setSelectedFormulaId}
            className="w-60"
          />
          <Select value={selectedChannelId} onValueChange={setSelectedChannelId}>
            <SelectTrigger className="w-44"><SelectValue placeholder="審查通路" /></SelectTrigger>
            <SelectContent>
              {channels.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={handleShowVersions} disabled={!selectedFormulaId} className="gap-1.5">
            <History className="h-4 w-4" /> 版本
          </Button>
          <Button variant="outline" size="sm" onClick={handleExport} disabled={!selectedFormula || formulaIngredients.length === 0} className="gap-1.5">
            <Download className="h-4 w-4" /> Excel
          </Button>
          <Button onClick={handleSaveClick} disabled={!selectedFormula} className="gap-1.5">
            <Save className="h-4 w-4" /> 儲存
          </Button>
        </div>
      </div>

      {/* Save dialog with patch notes */}
      <Dialog open={saveDialogOpen} onOpenChange={setSaveDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>儲存配方並建立版本</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-sm font-medium">變更紀錄（選填）</label>
              <Textarea
                value={patchNotes}
                onChange={e => setPatchNotes(e.target.value)}
                placeholder="例如：調整雞肉粉比例至35%，替換魚油為亞麻籽油..."
                className="mt-1"
                rows={3}
              />
            </div>
          </div>
          <DialogFooter className="flex gap-2">
            <Button variant="outline" onClick={() => setSaveDialogOpen(false)}>取消</Button>
            <Button variant="secondary" onClick={handleUpdateCurrentVersion} className="gap-1.5"><Save className="h-4 w-4" /> 更新目前版次</Button>
            <Button onClick={handleCreateNewVersion} className="gap-1.5"><Plus className="h-4 w-4" /> 建立新版次</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Version history dialog */}
      <Dialog open={versionHistoryOpen} onOpenChange={setVersionHistoryOpen}>
        <DialogContent className="max-w-lg max-h-[80vh]">
          <DialogHeader>
            <DialogTitle>版本歷程 — {selectedFormula?.code} {selectedFormula?.name}</DialogTitle>
          </DialogHeader>
          <ScrollArea className="max-h-[60vh]">
            {versions.length === 0 ? (
              <p className="text-sm text-muted-foreground py-8 text-center">尚無版本紀錄</p>
            ) : (
              <div className="space-y-2 pr-2">
                {versions.map(v => (
                  <Card key={v.id} className="p-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="font-mono font-bold text-sm">v{v.version}</span>
                        <span className="text-xs text-muted-foreground ml-2">
                          {new Date(v.createdAt).toLocaleString('zh-TW', { timeZone: 'Asia/Taipei' })}
                        </span>
                      </div>
                      <Button variant="outline" size="sm" onClick={() => handleRestoreVersion(v)} className="gap-1 text-xs h-7">
                        <RotateCcw className="h-3 w-3" /> 還原
                      </Button>
                    </div>
                    {v.patchNotes && (
                      <p className="text-xs text-muted-foreground mt-1 bg-muted/50 rounded px-2 py-1">{v.patchNotes}</p>
                    )}
                    <div className="text-xs text-muted-foreground mt-1">
                      原料數: {v.snapshot.ingredients.length}
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </ScrollArea>
        </DialogContent>
      </Dialog>

      {/* Summary bar - editable */}
      <Card className="p-4">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-xs font-medium text-muted-foreground">快速摘要</h3>
          <Button variant="ghost" size="sm" onClick={() => setSummaryEditOpen(true)} className="h-6 px-2 gap-1 text-xs">
            <Settings2 className="h-3 w-3" /> 編輯
          </Button>
        </div>
        <div className="flex gap-4 items-start">
          <div className="shrink-0 w-48">
            <div className="text-xs text-muted-foreground mb-1 text-center">原料佔比</div>
            {ingredientPieData.length > 0 ? (
              <ResponsiveContainer width="100%" height={160}>
                <PieChart>
                  <Pie data={ingredientPieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={65} innerRadius={30}>
                    {ingredientPieData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                  </Pie>
                  <Tooltip formatter={(value: number, name: string) => { const base = selectedFormula?.servingSize || totalWeight; return [`${value.toFixed(3)}g (${base > 0 ? ((value / base) * 100).toFixed(3) : 0}%)`, name]; }} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[160px] flex items-center justify-center text-xs text-muted-foreground">尚無原料</div>
            )}
          </div>
          <div className="flex-1 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {summaryItems.map(item => (
              <div key={item.id} className="bg-muted/50 rounded-lg px-3 py-2.5 text-center">
                <div className="text-xs text-muted-foreground mb-0.5">{item.label}</div>
                <div className="text-lg font-bold tracking-tight">{getSummaryValue(item.id)}</div>
              </div>
            ))}
          </div>
        </div>
      </Card>

      {/* Summary edit dialog */}
      <Dialog open={summaryEditOpen} onOpenChange={setSummaryEditOpen}>
        <DialogContent className="max-w-md max-h-[70vh] overflow-y-auto scrollbar-thin">
          <DialogHeader>
            <DialogTitle>編輯快速摘要項目</DialogTitle>
          </DialogHeader>
          <div className="space-y-1">
            {availableForSummary.map(opt => (
              <label key={opt.id} className="flex items-center gap-2 text-sm py-1 cursor-pointer">
                <Checkbox
                  checked={summaryItems.some(s => s.id === opt.id)}
                  onCheckedChange={() => toggleSummaryItem(opt.id, opt.label)}
                />
                {opt.label}
              </label>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="搜尋原料（編號或名稱）..."
              className="pl-9"
            />
          </div>
          {search && filteredIngredients.length > 0 && (
            <Card className="max-h-48 overflow-y-auto scrollbar-thin p-1">
              {filteredIngredients.map(ing => (
                <button
                  key={ing.id}
                  onClick={() => { addIngredient(ing.id); setSearch(''); }}
                  className="w-full text-left px-3 py-2 text-sm rounded hover:bg-muted flex justify-between"
                >
                  <span>{ing.materialCode} - {ing.name}</span>
                  <span className="text-muted-foreground">${ing.pricePerGram}/g</span>
                </button>
              ))}
            </Card>
          )}

          <Card className="p-3">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-medium text-muted-foreground">配方原料</h3>
              <div className="flex items-center gap-1 text-xs">
                <button
                  onClick={() => setUsePercent(false)}
                  className={`px-2 py-1 rounded-l-md border transition-colors ${!usePercent ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-muted/80'}`}
                >
                  公克 (g)
                </button>
                <button
                  onClick={() => setUsePercent(true)}
                  className={`px-2 py-1 rounded-r-md border transition-colors ${usePercent ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-muted/80'}`}
                >
                  百分比 (%)
                </button>
              </div>
            </div>
            {formulaIngredients.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">搜尋並選取原料加入配方</p>
            ) : (
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                <div className="flex items-center justify-between px-3 py-2 mb-2 rounded-md bg-muted/60 border">
                  <span className="text-sm font-semibold text-foreground">
                    成分加總 {selectedFormula?.servingSize ? <span className="text-xs font-normal text-muted-foreground">(每份規格: {selectedFormula.servingSize}g)</span> : null}
                  </span>
                  <div className="flex items-center gap-3 text-sm font-mono font-semibold">
                    <span>{parseFloat(totalWeight.toFixed(3))} g</span>
                    <span className="text-muted-foreground">/</span>
                    {(() => {
                      const base = selectedFormula?.servingSize || totalWeight;
                      const totalPct = base > 0 ? parseFloat((totalWeight / base * 100).toFixed(3)) : 0;
                      return (
                        <span className={base > 0 ? (Math.abs(totalPct - 100) < 0.01 ? 'text-foreground' : totalPct > 100 ? 'text-destructive font-bold' : 'text-amber-600') : 'text-muted-foreground'}>
                          {totalPct} %
                        </span>
                      );
                    })()}
                  </div>
                </div>
                <SortableContext items={formulaIngredients.map((fi, i) => fi.ingredientId + '-' + i)} strategy={verticalListSortingStrategy}>
                  {formulaIngredients.map((fi, idx) => {
                    const ing = ingredients.find(i => i.id === fi.ingredientId);
                    return (
                      <SortableIngredientRow
                        key={fi.ingredientId + '-' + idx}
                        fi={fi}
                        index={idx}
                        ingredientName={ing?.name || '未知'}
                        materialCode={ing?.materialCode || ''}
                        onAmountChange={updateAmount}
                        onPercentChange={updatePercent}
                        onRemove={removeIngredient}
                        usePercent={usePercent}
                        totalWeight={totalWeight}
                        servingSize={selectedFormula?.servingSize || totalWeight}
                        nutrientPopover={renderNutrientPopover(fi.ingredientId)}
                      />
                    );
                  })}
                </SortableContext>
              </DndContext>
            )}
          </Card>
        </div>

        <div className="space-y-4">
          <Card className="p-4">
            <h3 className="text-sm font-medium mb-3">營養成分組成圖</h3>
            {pieData.length > 0 ? (
              <>
                <ResponsiveContainer width="100%" height={240}>
                  <PieChart>
                    <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} innerRadius={40}>
                      {pieData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                    </Pie>
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
                <div className="space-y-1 mt-2">
                  {pieData.map((d, i) => (
                    <div key={d.name} className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-1.5">
                        <div className="w-2.5 h-2.5 rounded-full" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />
                        <span>{d.name}</span>
                      </div>
                      <span className="font-medium">{pieDenominator > 0 ? ((d.value / pieDenominator) * 100).toFixed(4) : '0.0000'}%</span>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-8">加入原料後顯示圖表</p>
            )}
          </Card>


          <Card className="p-4 max-h-96 overflow-y-auto scrollbar-thin">
            <h3 className="text-sm font-medium mb-2">營養成分加總</h3>
            {Object.entries(NUTRIENT_CATEGORY_LABELS).map(([cat, label]) => {
              const catNutrients = nutrients.filter(n => n.category === cat);
              if (catNutrients.length === 0) return null;
              return (
                <div key={cat} className="mb-3">
                  <h4 className="text-xs font-medium text-muted-foreground mb-1">{label}</h4>
                  {catNutrients.map(n => (
                    <div key={n.id} className="flex justify-between text-xs py-0.5">
                      <span>{n.name}</span>
                      <span className="font-mono">{totals[n.id] !== undefined ? totals[n.id].toFixed(4) : 'ND'} {n.unit}</span>
                    </div>
                  ))}
                </div>
              );
            })}
          </Card>
        </div>
      </div>

      {failures.length > 0 && (
        <Card className="p-4 border-destructive bg-destructive/5">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            <h3 className="font-medium text-destructive">規範限值不合格項目</h3>
          </div>
          <div className="space-y-1">
            {failures.map(f => (
              <div key={f.nutrientId} className="text-sm">
                <span className="font-medium">{f.nutrientName}</span>：
                目前 {f.value.toFixed(4)} {f.unit}，
                要求{f.limit.type === 'min' ? `≧ ${f.limit.min}` : f.limit.type === 'max' ? `≦ ${f.limit.max}` : `${f.limit.min} ~ ${f.limit.max}`} {f.unit}
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
};

export default FormulaEditorPage;
