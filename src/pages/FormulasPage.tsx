import React, { useState } from 'react';
import { useAppContext } from '@/contexts/AppContext';
import { Formula } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card } from '@/components/ui/card';
import { Plus, Trash2, Download, Save } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';

const FormulasPage: React.FC = () => {
  const { formulas, channels, ingredients, nutrients, saveFormula, deleteFormula } = useAppContext();
  const navigate = useNavigate();
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [channelId, setChannelId] = useState('');
  const [servingSize, setServingSize] = useState('');
  const [note, setNote] = useState('');

  const handleAdd = async () => {
    if (!code.trim() || !name.trim()) return;
    const formula: Formula = {
      id: crypto.randomUUID(),
      code: code.trim(),
      name: name.trim(),
      channelId,
      servingSize: servingSize ? Number(servingSize) : undefined,
      note: note.trim() || undefined,
      ingredients: [],
      updatedAt: new Date().toISOString(),
    };
    await saveFormula(formula);
    setCode(''); setName(''); setChannelId(''); setServingSize(''); setNote('');
    toast.success('配方已新增');
  };

  const handleExport = (formula: Formula) => {
    const wb = XLSX.utils.book_new();
    const ingRows = formula.ingredients.map(fi => {
      const ing = ingredients.find(i => i.id === fi.ingredientId);
      return { 物料編號: ing?.materialCode || '', 品名: ing?.name || '', 用量g: fi.amount };
    });
    const ws1 = XLSX.utils.json_to_sheet(ingRows);
    XLSX.utils.book_append_sheet(wb, ws1, '配方原料');

    const totals: Record<string, number> = {};
    formula.ingredients.forEach(fi => {
      const ing = ingredients.find(i => i.id === fi.ingredientId);
      if (!ing) return;
      nutrients.forEach(n => {
        const val = ing.nutrients[n.id];
        if (val !== 'ND' && typeof val === 'number') {
          totals[n.id] = (totals[n.id] || 0) + val * fi.amount;
        }
      });
    });
    const nutRows = nutrients.map(n => ({
      營養素: n.name,
      數值: totals[n.id]?.toFixed(4) ?? 'ND',
      單位: n.unit,
    }));
    const ws2 = XLSX.utils.json_to_sheet(nutRows);
    XLSX.utils.book_append_sheet(wb, ws2, '營養成分');

    XLSX.writeFile(wb, `${formula.code}_${formula.name}.xlsx`);
    toast.success('配方已匯出');
  };

  const handleDelete = async (id: string) => {
    await deleteFormula(id);
    toast.success('配方已刪除');
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">配方管理</h1>
      <Card className="p-4">
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 items-end">
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">配方編號</label>
            <Input value={code} onChange={e => setCode(e.target.value)} placeholder="F001" />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">配方名稱</label>
            <Input value={name} onChange={e => setName(e.target.value)} placeholder="成犬雞肉配方" />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">對應通路</label>
            <Select value={channelId} onValueChange={setChannelId}>
              <SelectTrigger><SelectValue placeholder="選擇通路" /></SelectTrigger>
              <SelectContent>
                {channels.map(ch => (
                  <SelectItem key={ch.id} value={ch.id}>{ch.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button onClick={handleAdd} className="gap-1.5">
            <Plus className="h-4 w-4" /> 新增配方
          </Button>
        </div>
      </Card>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="text-left px-4 py-3 font-medium">配方編號</th>
                <th className="text-left px-4 py-3 font-medium">配方名稱</th>
                <th className="text-left px-4 py-3 font-medium">對應通路</th>
                <th className="text-left px-4 py-3 font-medium">原料數</th>
                <th className="text-left px-4 py-3 font-medium">最後更新</th>
                <th className="text-right px-4 py-3 font-medium">操作</th>
              </tr>
            </thead>
            <tbody>
              {formulas.length === 0 && (
                <tr><td colSpan={6} className="text-center py-8 text-muted-foreground">尚無配方，請新增</td></tr>
              )}
              {formulas.map(f => {
                const ch = channels.find(c => c.id === f.channelId);
                return (
                  <tr key={f.id} className="border-b hover:bg-muted/30 cursor-pointer" onClick={() => navigate(`/editor?formula=${f.id}`)}>
                    <td className="px-4 py-3 font-mono">{f.code}</td>
                    <td className="px-4 py-3">{f.name}</td>
                    <td className="px-4 py-3">{ch?.name || '-'}</td>
                    <td className="px-4 py-3">{f.ingredients.length}</td>
                    <td className="px-4 py-3 text-muted-foreground text-xs">
                      {new Date(f.updatedAt).toLocaleString('zh-TW', { timeZone: 'Asia/Taipei', hour12: false })}
                    </td>
                    <td className="px-4 py-3 text-right" onClick={e => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-1">
                        <Button variant="ghost" size="icon" onClick={() => handleExport(f)} title="匯出 Excel">
                          <Download className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => handleDelete(f.id)} title="刪除">
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
};

export default FormulasPage;
