import React, { useState } from 'react';
import { useAppContext } from '@/contexts/AppContext';
import { MarketChannel, NutrientLimit } from '@/lib/types';
import { NUTRIENT_CATEGORY_LABELS } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Plus, Trash2, Pencil, ChevronDown } from 'lucide-react';

interface LimitForm {
  type: 'min' | 'max' | 'range' | 'none';
  min: string;
  max: string;
}

const MarketChannelsPage: React.FC = () => {
  const { channels, nutrients, saveChannel, deleteChannel } = useAppContext();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<MarketChannel | null>(null);
  const [name, setName] = useState('');
  const [limitForms, setLimitForms] = useState<Record<string, LimitForm>>({});

  const initLimitForms = (limits?: Record<string, NutrientLimit>) => {
    const forms: Record<string, LimitForm> = {};
    nutrients.forEach(n => {
      const l = limits?.[n.id];
      if (l) {
        forms[n.id] = { type: l.type, min: l.min?.toString() || '', max: l.max?.toString() || '' };
      } else {
        forms[n.id] = { type: 'none', min: '', max: '' };
      }
    });
    return forms;
  };

  const openNew = () => {
    setEditing(null);
    setName('');
    setLimitForms(initLimitForms());
    setDialogOpen(true);
  };

  const openEdit = (ch: MarketChannel) => {
    setEditing(ch);
    setName(ch.name);
    setLimitForms(initLimitForms(ch.limits));
    setDialogOpen(true);
  };

  const handleSave = async () => {
    const limits: Record<string, NutrientLimit> = {};
    Object.entries(limitForms).forEach(([nid, f]) => {
      if (f.type === 'none') return;
      const limit: NutrientLimit = { type: f.type as NutrientLimit['type'] };
      if (f.min) limit.min = parseFloat(f.min);
      if (f.max) limit.max = parseFloat(f.max);
      limits[nid] = limit;
    });

    const item: MarketChannel = {
      id: editing?.id || crypto.randomUUID(),
      name: name.trim(),
      limits,
      updatedAt: new Date().toISOString(),
    };
    await saveChannel(item);
    setDialogOpen(false);
  };

  const updateLimitForm = (nid: string, update: Partial<LimitForm>) => {
    setLimitForms(prev => ({ ...prev, [nid]: { ...prev[nid], ...update } }));
  };

  const categories = Object.entries(NUTRIENT_CATEGORY_LABELS);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">規範限值</h1>
        <Button onClick={openNew} className="gap-1.5"><Plus className="h-4 w-4" /> 新增通路</Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {channels.length === 0 && (
          <p className="text-muted-foreground col-span-full text-center py-8">尚無通路規範，請新增</p>
        )}
        {channels.map(ch => (
          <Card key={ch.id} className="p-4">
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-medium">{ch.name}</h3>
              <div className="flex gap-1">
                <Button variant="ghost" size="icon" onClick={() => openEdit(ch)}><Pencil className="h-4 w-4" /></Button>
                <Button variant="ghost" size="icon" onClick={() => deleteChannel(ch.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              已設定 {Object.keys(ch.limits).length} 項限值
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              更新：{new Date(ch.updatedAt).toLocaleString('zh-TW', { timeZone: 'Asia/Taipei', hour12: false })}
            </p>
          </Card>
        ))}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto scrollbar-thin">
          <DialogHeader>
            <DialogTitle>{editing ? '編輯通路規範' : '新增通路規範'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">通路名稱</label>
              <Input value={name} onChange={e => setName(e.target.value)} placeholder="例：AAFCO 成犬" />
            </div>

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
                    <div className="space-y-2 mt-1">
                      {catNutrients.map(n => {
                        const f = limitForms[n.id] || { type: 'none', min: '', max: '' };
                        return (
                          <div key={n.id} className="grid grid-cols-[1fr_auto_auto_auto] gap-2 items-center">
                            <span className="text-xs truncate" title={n.nameEn}>{n.name} ({n.unit})</span>
                            <Select value={f.type} onValueChange={v => updateLimitForm(n.id, { type: v as LimitForm['type'] })}>
                              <SelectTrigger className="w-24 h-7 text-xs"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="none">未設定</SelectItem>
                                <SelectItem value="min">≧ 最小</SelectItem>
                                <SelectItem value="max">≦ 最大</SelectItem>
                                <SelectItem value="range">範圍</SelectItem>
                              </SelectContent>
                            </Select>
                            {(f.type === 'min' || f.type === 'range') && (
                              <Input value={f.min} onChange={e => updateLimitForm(n.id, { min: e.target.value })} placeholder="最小值" className="w-20 h-7 text-xs" />
                            )}
                            {(f.type === 'max' || f.type === 'range') && (
                              <Input value={f.max} onChange={e => updateLimitForm(n.id, { max: e.target.value })} placeholder="最大值" className="w-20 h-7 text-xs" />
                            )}
                          </div>
                        );
                      })}
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

export default MarketChannelsPage;
