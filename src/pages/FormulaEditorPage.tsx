import React, { useState, useMemo, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAppContext } from '@/contexts/AppContext';
import { FormulaIngredient, ValidationResult, NUTRIENT_CATEGORY_LABELS } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Search, Trash2, GripVertical, Save, AlertTriangle, Settings2, Plus, X, Percent, Weight, Download, Info } from 'lucide-react';
import { Toggle } from '@/components/ui/toggle';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy, useSortable, arrayMove } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';

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

  const pct = totalWeight > 0 ? (fi.amount / totalWeight) * 100 : 0;

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
              onValueChange={([v]) => onPercentChange(index, parseFloat(v.toFixed(2)))}
              max={100}
              step={0.01}
              className="w-24"
            />
            <Input
              type="number"
              value={parseFloat(pct.toFixed(2))}
              onChange={e => onPercentChange(index, Number(e.target.value) || 0)}
              className="w-20 text-right text-sm h-8"
              min={0}
              max={100}
              step={0.01}
            />
            <span className="text-xs text-muted-foreground">%</span>
          </>
        ) : (
          <>
            <Slider
              value={[fi.amount]}
              onValueChange={([v]) => onAmountChange(index, v)}
              max={500}
              step={1}
              className="w-24"
            />
            <Input
              type="number"
              value={fi.amount}
              onChange={e => onAmountChange(index, Number(e.target.value) || 0)}
              className="w-20 text-right text-sm h-8"
              min={0}
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
  const { ingredients, channels, formulas, nutrients, saveFormula } = useAppContext();
  const [searchParams] = useSearchParams();
  const formulaId = searchParams.get('formula');

  const [selectedFormulaId, setSelectedFormulaId] = useState(formulaId || '');
  const [formulaIngredients, setFormulaIngredients] = useState<FormulaIngredient[]>([]);
  const [search, setSearch] = useState('');
  const [selectedChannelId, setSelectedChannelId] = useState('');
  const [summaryItems, setSummaryItems] = useState(DEFAULT_SUMMARY_ITEMS);
  const [summaryEditOpen, setSummaryEditOpen] = useState(false);
  const [usePercent, setUsePercent] = useState(false);

  const selectedFormula = formulas.find(f => f.id === selectedFormulaId);

  useEffect(() => {
    if (selectedFormula) {
      setFormulaIngredients([...selectedFormula.ingredients]);
      setSelectedChannelId(selectedFormula.channelId || '');
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
    const currentTotal = formulaIngredients.reduce((s, fi) => s + fi.amount, 0);
    if (currentTotal <= 0) return;
    const clampedPct = Math.max(0, Math.min(100, newPct));
    const newAmount = (clampedPct / 100) * currentTotal;
    const oldAmount = formulaIngredients[idx].amount;
    const diff = newAmount - oldAmount;
    const othersTotal = currentTotal - oldAmount;

    setFormulaIngredients(prev => prev.map((fi, i) => {
      if (i === idx) return { ...fi, amount: parseFloat(newAmount.toFixed(2)) };
      if (othersTotal <= 0) return fi;
      const scale = 1 - diff / othersTotal;
      return { ...fi, amount: parseFloat(Math.max(0, fi.amount * scale).toFixed(2)) };
    }));
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

  // Totals: nutrients are per 100g, so contribution = (nutrient_per_100g / 100) * amount_g
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

  // Total calories of formula (sum of each ingredient's kcal contribution)
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

  // Nutrient options for summary editor
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

  const pieData = useMemo(() => {
    const categories: Record<string, number> = {};
    nutrients.forEach(n => {
      if (totals[n.id]) {
        const catLabel = NUTRIENT_CATEGORY_LABELS[n.category];
        categories[catLabel] = (categories[catLabel] || 0) + totals[n.id];
      }
    });
    return Object.entries(categories)
      .filter(([, v]) => v > 0)
      .map(([name, value]) => ({ name, value: parseFloat(value.toFixed(2)) }));
  }, [totals, nutrients]);

  const totalPieValue = pieData.reduce((s, d) => s + d.value, 0);

  // Ingredient weight distribution pie data
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
  // Validation: convert totals to per-1000kcal for channel limit comparison
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

  const handleSave = async () => {
    if (!selectedFormula) return;
    await saveFormula({
      ...selectedFormula,
      ingredients: formulaIngredients,
      channelId: selectedChannelId,
      updatedAt: new Date().toISOString(),
    });
    toast.success('配方已儲存');
  };

  const handleExport = () => {
    if (!selectedFormula || formulaIngredients.length === 0) return;
    // Sheet 1: ingredient composition
    const ingRows = formulaIngredients.map(fi => {
      const ing = ingredients.find(i => i.id === fi.ingredientId);
      return {
        '編號': ing?.materialCode || '',
        '原料名稱': ing?.name || '未知',
        '用量 (g)': fi.amount,
        '佔比 (%)': totalWeight > 0 ? parseFloat(((fi.amount / totalWeight) * 100).toFixed(2)) : 0,
      };
    });
    ingRows.push({
      '編號': '',
      '原料名稱': '合計',
      '用量 (g)': parseFloat(totalWeight.toFixed(2)),
      '佔比 (%)': 100,
    });

    // Sheet 2: nutrient totals
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

  // Build nutrient popover for an ingredient
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
        <h1 className="text-2xl font-bold">配方組成</h1>
        <div className="flex items-center gap-3">
          <Select value={selectedFormulaId} onValueChange={setSelectedFormulaId}>
            <SelectTrigger className="w-52"><SelectValue placeholder="選擇配方" /></SelectTrigger>
            <SelectContent>
              {formulas.map(f => <SelectItem key={f.id} value={f.id}>{f.code} - {f.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={selectedChannelId} onValueChange={setSelectedChannelId}>
            <SelectTrigger className="w-44"><SelectValue placeholder="審查通路" /></SelectTrigger>
            <SelectContent>
              {channels.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={handleExport} disabled={!selectedFormula || formulaIngredients.length === 0} className="gap-1.5">
            <Download className="h-4 w-4" /> 匯出
          </Button>
          <Button onClick={handleSave} disabled={!selectedFormula} className="gap-1.5">
            <Save className="h-4 w-4" /> 儲存
          </Button>
        </div>
      </div>

      {/* Summary bar - editable */}
      <Card className="p-4">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-xs font-medium text-muted-foreground">快速摘要</h3>
          <Button variant="ghost" size="sm" onClick={() => setSummaryEditOpen(true)} className="h-6 px-2 gap-1 text-xs">
            <Settings2 className="h-3 w-3" /> 編輯
          </Button>
        </div>
        <div className="flex gap-4 items-start">
          {/* Ingredient weight pie chart */}
          <div className="shrink-0 w-48">
            <div className="text-xs text-muted-foreground mb-1 text-center">原料佔比</div>
            {ingredientPieData.length > 0 ? (
              <ResponsiveContainer width="100%" height={160}>
                <PieChart>
                  <Pie data={ingredientPieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={65} innerRadius={30}>
                    {ingredientPieData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                  </Pie>
                  <Tooltip formatter={(value: number, name: string) => [`${value.toFixed(1)}g (${totalWeight > 0 ? ((value / totalWeight) * 100).toFixed(1) : 0}%)`, name]} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[160px] flex items-center justify-center text-xs text-muted-foreground">尚無原料</div>
            )}
          </div>
          {/* Summary items grid */}
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
                {/* Total summary bar */}
                <div className="flex items-center justify-between px-3 py-2 mb-2 rounded-md bg-muted/60 border">
                  <span className="text-sm font-semibold text-foreground">成分加總</span>
                  <div className="flex items-center gap-3 text-sm font-mono font-semibold">
                    <span>{parseFloat(totalWeight.toFixed(2))} g</span>
                    <span className="text-muted-foreground">/</span>
                    <span className={totalWeight > 0 ? (Math.abs(formulaIngredients.reduce((s, fi) => s + (fi.amount / totalWeight) * 100, 0) - 100) < 0.01 ? 'text-foreground' : 'text-amber-600') : 'text-muted-foreground'}>
                      {totalWeight > 0 ? parseFloat(formulaIngredients.reduce((s, fi) => s + (fi.amount / totalWeight) * 100, 0).toFixed(2)) : 0} %
                    </span>
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
                      <span className="font-medium">{totalPieValue > 0 ? ((d.value / totalPieValue) * 100).toFixed(1) : 0}%</span>
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
