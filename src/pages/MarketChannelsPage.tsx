import React, { useState, useMemo } from 'react';
import { useAppContext } from '@/contexts/AppContext';
import { MarketChannel, NutrientLimit } from '@/lib/types';
import { NUTRIENT_CATEGORY_LABELS } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Checkbox } from '@/components/ui/checkbox';
import { Plus, Trash2, Pencil, ChevronDown, ChevronRight, Save, GitCompare, Download } from 'lucide-react';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';

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
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [compareMode, setCompareMode] = useState(false);
  const [compareIds, setCompareIds] = useState<Set<string>>(new Set());

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
    toast.success(editing ? '通路規範已更新' : '通路規範已新增');
  };

  const updateLimitForm = (nid: string, update: Partial<LimitForm>) => {
    setLimitForms(prev => ({ ...prev, [nid]: { ...prev[nid], ...update } }));
  };

  const toggleExpand = (id: string) => {
    setExpandedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleCompare = (id: string) => {
    setCompareIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleExportChannels = () => {
    const wb = XLSX.utils.book_new();
    channels.forEach(ch => {
      const rows = nutrients.map(n => {
        const l = ch.limits[n.id];
        return {
          營養素: n.name,
          單位: n.unit,
          類型: l ? (l.type === 'min' ? '≧ 最小' : l.type === 'max' ? '≦ 最大' : '範圍') : '未設定',
          最小值: l?.min ?? '',
          最大值: l?.max ?? '',
        };
      });
      const ws = XLSX.utils.json_to_sheet(rows);
      XLSX.utils.book_append_sheet(wb, ws, ch.name.slice(0, 31));
    });
    XLSX.writeFile(wb, '規範限值.xlsx');
    toast.success('規範限值已匯出');
  };

  const formatLimit = (l?: NutrientLimit) => {
    if (!l) return '-';
    if (l.type === 'min') return `≧ ${l.min}`;
    if (l.type === 'max') return `≦ ${l.max}`;
    return `${l.min} ~ ${l.max}`;
  };

  const compareChannels = useMemo(() =>
    channels.filter(c => compareIds.has(c.id)),
    [channels, compareIds]
  );

  const categories = Object.entries(NUTRIENT_CATEGORY_LABELS);

  const handleSaveToLocal = () => {
    try {
      localStorage.setItem('app_channels', JSON.stringify(channels));
      toast.success('規範限值資料已儲存');
    } catch {
      toast.error('儲存失敗');
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-bold">規範限值</h1>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleSaveToLocal} className="gap-1.5">
            <Save className="h-4 w-4" /> 儲存
          </Button>
          <Button
            variant={compareMode ? 'default' : 'outline'}
            size="sm"
            onClick={() => { setCompareMode(!compareMode); setCompareIds(new Set()); }}
            className="gap-1.5"
          >
            <GitCompare className="h-4 w-4" /> {compareMode ? '退出比較' : '比較通路'}
          </Button>
          <Button variant="outline" size="sm" onClick={handleExportChannels} className="gap-1.5">
            <Download className="h-4 w-4" /> 匯出
          </Button>
          <Button onClick={openNew} className="gap-1.5"><Plus className="h-4 w-4" /> 新增通路</Button>
        </div>
      </div>

      {/* Channel cards */}
      <div className="space-y-3">
        {channels.length === 0 && (
          <p className="text-muted-foreground text-center py-8">尚無通路規範，請新增</p>
        )}
        {channels.map(ch => (
          <Card key={ch.id} className="overflow-hidden">
            <div className="flex items-center gap-3 px-4 py-3">
              {compareMode && (
                <Checkbox
                  checked={compareIds.has(ch.id)}
                  onCheckedChange={() => toggleCompare(ch.id)}
                />
              )}
              <button onClick={() => toggleExpand(ch.id)} className="text-muted-foreground hover:text-foreground">
                {expandedIds.has(ch.id) ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
              </button>
              <div className="flex-1 min-w-0">
                <h3 className="font-medium">{ch.name}</h3>
                <p className="text-xs text-muted-foreground">
                  已設定 {Object.keys(ch.limits).length} 項限值 · 更新：{new Date(ch.updatedAt).toLocaleString('zh-TW', { timeZone: 'Asia/Taipei', hour12: false })}
                </p>
              </div>
              <div className="flex gap-1">
                <Button variant="ghost" size="icon" onClick={() => openEdit(ch)}><Pencil className="h-4 w-4" /></Button>
                <Button variant="ghost" size="icon" onClick={() => deleteChannel(ch.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
              </div>
            </div>
            {expandedIds.has(ch.id) && (
              <div className="border-t px-4 py-3 bg-muted/20">
                {categories.map(([cat, label]) => {
                  const catNutrients = nutrients.filter(n => n.category === cat);
                  const withLimits = catNutrients.filter(n => ch.limits[n.id]);
                  if (withLimits.length === 0) return null;
                  return (
                    <div key={cat} className="mb-3">
                      <h4 className="text-xs font-medium text-muted-foreground mb-1">{label}</h4>
                      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-4 gap-y-0.5">
                        {withLimits.map(n => (
                          <div key={n.id} className="flex justify-between text-xs py-0.5">
                            <span>{n.name}</span>
                            <span className="font-mono">{formatLimit(ch.limits[n.id])} {n.unit}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>
        ))}
      </div>

      {/* Comparison table */}
      {compareMode && compareChannels.length >= 2 && (
        <Card className="overflow-hidden">
          <div className="px-4 py-3 border-b bg-muted/30">
            <h3 className="font-medium text-sm">通路比較：{compareChannels.map(c => c.name).join(' vs ')}</h3>
          </div>
          <div className="overflow-x-auto scrollbar-thin">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="text-left px-3 py-2 font-medium">營養素</th>
                  <th className="text-left px-3 py-2 font-medium">單位</th>
                  {compareChannels.map(c => (
                    <th key={c.id} className="text-center px-3 py-2 font-medium">{c.name}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {nutrients.map(n => {
                  const hasAny = compareChannels.some(c => c.limits[n.id]);
                  if (!hasAny) return null;
                  const values = compareChannels.map(c => formatLimit(c.limits[n.id]));
                  const allSame = values.every(v => v === values[0]);
                  return (
                    <tr key={n.id} className={`border-b ${!allSame ? 'bg-warning/5' : ''}`}>
                      <td className="px-3 py-1.5">{n.name}</td>
                      <td className="px-3 py-1.5 text-muted-foreground">{n.unit}</td>
                      {compareChannels.map(c => (
                        <td key={c.id} className={`px-3 py-1.5 text-center font-mono ${!allSame ? 'font-semibold text-warning' : ''}`}>
                          {formatLimit(c.limits[n.id])}
                        </td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

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
              <Button onClick={handleSave} className="gap-1.5"><Save className="h-4 w-4" /> 儲存</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default MarketChannelsPage;
