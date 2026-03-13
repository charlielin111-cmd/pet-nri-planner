import React, { useState } from 'react';
import { useAppContext } from '@/contexts/AppContext';
import { Ingredient } from '@/lib/types';
import { NUTRIENT_CATEGORY_LABELS } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Plus, Trash2, Pencil, ChevronDown } from 'lucide-react';

const IngredientsPage: React.FC = () => {
  const { ingredients, nutrients, saveIngredient, deleteIngredient } = useAppContext();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Ingredient | null>(null);
  const [form, setForm] = useState({ materialCode: '', name: '', pricePerGram: 0 });
  const [nutrientValues, setNutrientValues] = useState<Record<string, string>>({});

  const openNew = () => {
    setEditing(null);
    setForm({ materialCode: '', name: '', pricePerGram: 0 });
    setNutrientValues({});
    setDialogOpen(true);
  };

  const openEdit = (ing: Ingredient) => {
    setEditing(ing);
    setForm({ materialCode: ing.materialCode, name: ing.name, pricePerGram: ing.pricePerGram });
    const nv: Record<string, string> = {};
    nutrients.forEach(n => {
      const val = ing.nutrients[n.id];
      nv[n.id] = val === 'ND' ? 'ND' : val !== undefined ? String(val) : '';
    });
    setNutrientValues(nv);
    setDialogOpen(true);
  };

  const handleSave = async () => {
    const parsedNutrients: Record<string, number | 'ND'> = {};
    nutrients.forEach(n => {
      const raw = nutrientValues[n.id]?.trim();
      if (!raw || raw.toUpperCase() === 'ND') parsedNutrients[n.id] = 'ND';
      else parsedNutrients[n.id] = parseFloat(raw) || 0;
    });

    const item: Ingredient = {
      id: editing?.id || crypto.randomUUID(),
      materialCode: form.materialCode.trim(),
      name: form.name.trim(),
      pricePerGram: form.pricePerGram,
      nutrients: parsedNutrients,
      updatedAt: new Date().toISOString(),
    };
    await saveIngredient(item);
    setDialogOpen(false);
  };

  const categories = Object.entries(NUTRIENT_CATEGORY_LABELS);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">原料設定</h1>
        <Button onClick={openNew} className="gap-1.5"><Plus className="h-4 w-4" /> 新增原料</Button>
      </div>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="text-left px-4 py-3 font-medium">物料編號</th>
                <th className="text-left px-4 py-3 font-medium">品名</th>
                <th className="text-right px-4 py-3 font-medium">每公克價格</th>
                <th className="text-right px-4 py-3 font-medium">操作</th>
              </tr>
            </thead>
            <tbody>
              {ingredients.length === 0 && (
                <tr><td colSpan={4} className="text-center py-8 text-muted-foreground">尚無原料，請新增</td></tr>
              )}
              {ingredients.map(ing => (
                <tr key={ing.id} className="border-b hover:bg-muted/30">
                  <td className="px-4 py-3 font-mono">{ing.materialCode}</td>
                  <td className="px-4 py-3">{ing.name}</td>
                  <td className="px-4 py-3 text-right">${ing.pricePerGram}</td>
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
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">物料編號</label>
                <Input value={form.materialCode} onChange={e => setForm(p => ({ ...p, materialCode: e.target.value }))} />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">品名</label>
                <Input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">每公克價格</label>
                <Input type="number" value={form.pricePerGram} onChange={e => setForm(p => ({ ...p, pricePerGram: Number(e.target.value) || 0 }))} />
              </div>
            </div>

            <p className="text-xs text-muted-foreground">營養成分（每 1000 kcal ME），輸入 ND 代表未設定</p>

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
              <Button onClick={handleSave}>儲存</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default IngredientsPage;
