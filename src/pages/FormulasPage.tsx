import React, { useState, useMemo } from 'react';
import { useAppContext } from '@/contexts/AppContext';
import { Formula } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Plus, Trash2, Download, Save, Copy, Pencil, Search, GripVertical, HardDrive } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';
import * as XLSX from 'xlsx';
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy, useSortable, arrayMove } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

interface SortableFormulaRowProps {
  formula: Formula;
  channelName: string;
  onEdit: (f: Formula) => void;
  onCopy: (f: Formula) => void;
  onExport: (f: Formula) => void;
  onDelete: (id: string) => void;
  onNavigate: (id: string) => void;
}

const SortableFormulaRow: React.FC<SortableFormulaRowProps> = ({ formula: f, channelName, onEdit, onCopy, onExport, onDelete, onNavigate }) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: f.id });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 };

  return (
    <tr ref={setNodeRef} style={style} className="border-b hover:bg-muted/30">
      <td className="px-2 py-3 w-8">
        <button {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing p-1 text-muted-foreground hover:text-foreground">
          <GripVertical className="h-4 w-4" />
        </button>
      </td>
      <td className="px-4 py-3 font-mono cursor-pointer" onClick={() => onNavigate(f.id)}>{f.code}</td>
      <td className="px-4 py-3 cursor-pointer" onClick={() => onNavigate(f.id)}>{f.name}</td>
      <td className="px-4 py-3">{channelName}</td>
      <td className="px-4 py-3">{f.servingSize ? `${f.servingSize}g` : '-'}</td>
      <td className="px-4 py-3">{f.ingredients.length}</td>
      <td className="px-4 py-3 text-xs text-muted-foreground truncate max-w-[120px]">{f.note || '-'}</td>
      <td className="px-4 py-3 text-muted-foreground text-xs">
        {new Date(f.updatedAt).toLocaleString('zh-TW', { timeZone: 'Asia/Taipei', hour12: false })}
      </td>
      <td className="px-4 py-3 text-right">
        <div className="flex items-center justify-end gap-1">
          <Button variant="ghost" size="icon" onClick={() => onEdit(f)} title="編輯配方"><Pencil className="h-4 w-4" /></Button>
          <Button variant="ghost" size="icon" onClick={() => onCopy(f)} title="複製配方"><Copy className="h-4 w-4" /></Button>
          <Button variant="ghost" size="icon" onClick={() => onExport(f)} title="匯出 Excel"><Download className="h-4 w-4" /></Button>
          <Button variant="ghost" size="icon" onClick={() => onDelete(f.id)} title="刪除"><Trash2 className="h-4 w-4 text-destructive" /></Button>
        </div>
      </td>
    </tr>
  );
};

const FormulasPage: React.FC = () => {
  const { formulas, channels, ingredients, nutrients, saveFormula, deleteFormula } = useAppContext();
  const navigate = useNavigate();

  // Search & filter
  const [searchText, setSearchText] = useState('');
  const [filterChannelId, setFilterChannelId] = useState('__all__');

  // Add form
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [channelId, setChannelId] = useState('');
  const [servingSize, setServingSize] = useState('');
  const [note, setNote] = useState('');

  // Edit dialog
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingFormula, setEditingFormula] = useState<Formula | null>(null);
  const [editCode, setEditCode] = useState('');
  const [editName, setEditName] = useState('');
  const [editChannelId, setEditChannelId] = useState('');
  const [editServingSize, setEditServingSize] = useState('');
  const [editNote, setEditNote] = useState('');

  // Custom order tracking
  const [customOrder, setCustomOrder] = useState<string[] | null>(null);

  // DnD sensors
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  // Sort formulas: use custom order if set, otherwise sort by code ascending
  const sortedFormulas = useMemo(() => {
    const sorted = [...formulas].sort((a, b) => a.code.localeCompare(b.code, 'zh-TW', { numeric: true }));
    if (customOrder) {
      const orderMap = new Map(customOrder.map((id, i) => [id, i]));
      sorted.sort((a, b) => {
        const oa = orderMap.get(a.id);
        const ob = orderMap.get(b.id);
        if (oa !== undefined && ob !== undefined) return oa - ob;
        if (oa !== undefined) return -1;
        if (ob !== undefined) return 1;
        return a.code.localeCompare(b.code, 'zh-TW', { numeric: true });
      });
    }
    return sorted;
  }, [formulas, customOrder]);

  // Filtered formulas
  const filteredFormulas = useMemo(() => {
    return sortedFormulas.filter(f => {
      const matchSearch = !searchText.trim() ||
        f.code.toLowerCase().includes(searchText.toLowerCase()) ||
        f.name.toLowerCase().includes(searchText.toLowerCase()) ||
        (f.note || '').toLowerCase().includes(searchText.toLowerCase());
      const matchChannel = filterChannelId === '__all__' || f.channelId === filterChannelId;
      return matchSearch && matchChannel;
    });
  }, [sortedFormulas, searchText, filterChannelId]);

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

  const openEdit = (f: Formula) => {
    setEditingFormula(f);
    setEditCode(f.code);
    setEditName(f.name);
    setEditChannelId(f.channelId || '');
    setEditServingSize(f.servingSize ? String(f.servingSize) : '');
    setEditNote(f.note || '');
    setEditDialogOpen(true);
  };

  const handleEditSave = async () => {
    if (!editingFormula || !editCode.trim() || !editName.trim()) return;
    await saveFormula({
      ...editingFormula,
      code: editCode.trim(),
      name: editName.trim(),
      channelId: editChannelId,
      servingSize: editServingSize ? Number(editServingSize) : undefined,
      note: editNote.trim() || undefined,
      updatedAt: new Date().toISOString(),
    });
    setEditDialogOpen(false);
    toast.success('配方已更新');
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
          totals[n.id] = (totals[n.id] || 0) + (val / 100) * fi.amount;
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

  const handleCopy = async (f: Formula) => {
    const newFormula: Formula = {
      ...f,
      id: crypto.randomUUID(),
      code: f.code + '_copy',
      name: f.name + ' (副本)',
      ingredients: f.ingredients.map(fi => ({ ...fi })),
      summaryItems: f.summaryItems ? [...f.summaryItems] : undefined,
      updatedAt: new Date().toISOString(),
    };
    await saveFormula(newFormula);
    toast.success('配方已複製');
  };

  const handleDragEnd = (event: any) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const currentIds = filteredFormulas.map(f => f.id);
    const oldIndex = currentIds.indexOf(active.id);
    const newIndex = currentIds.indexOf(over.id);
    if (oldIndex === -1 || newIndex === -1) return;
    const allIds = sortedFormulas.map(f => f.id);
    const newOrder = arrayMove(allIds, allIds.indexOf(active.id), allIds.indexOf(over.id));
    setCustomOrder(newOrder);
    toast.success('排序已更新');
  };

  const handleSaveToLocal = () => {
    const data = JSON.stringify(formulas, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `配方備份_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('配方資料已儲存至本機');
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-bold">配方管理</h1>
        <Button variant="outline" size="sm" onClick={handleSaveToLocal} className="gap-1.5">
          <HardDrive className="h-4 w-4" /> 儲存至本機
        </Button>
      </div>

      {/* Search & Filter */}
      <Card className="p-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={searchText}
              onChange={e => setSearchText(e.target.value)}
              placeholder="搜尋配方編號、名稱或備註..."
              className="pl-9"
            />
          </div>
          <div className="w-full sm:w-48">
            <Select value={filterChannelId} onValueChange={setFilterChannelId}>
              <SelectTrigger><SelectValue placeholder="篩選通路" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">全部通路</SelectItem>
                {channels.map(ch => (
                  <SelectItem key={ch.id} value={ch.id}>{ch.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </Card>

      {/* Add form */}
      <Card className="p-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-6 gap-3 items-end">
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
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">每份規格 (g)</label>
            <Input type="number" value={servingSize} onChange={e => setServingSize(e.target.value)} placeholder="100" min={0} step={0.1} />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">備註</label>
            <Input value={note} onChange={e => setNote(e.target.value)} placeholder="備註說明..." />
          </div>
          <Button onClick={handleAdd} className="gap-1.5">
            <Plus className="h-4 w-4" /> 新增配方
          </Button>
        </div>
      </Card>

      {/* Formula table with DnD */}
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="w-8 px-2 py-3"></th>
                  <th className="text-left px-4 py-3 font-medium">配方編號</th>
                  <th className="text-left px-4 py-3 font-medium">配方名稱</th>
                  <th className="text-left px-4 py-3 font-medium">對應通路</th>
                  <th className="text-left px-4 py-3 font-medium">每份規格</th>
                  <th className="text-left px-4 py-3 font-medium">原料數</th>
                  <th className="text-left px-4 py-3 font-medium">備註</th>
                  <th className="text-left px-4 py-3 font-medium">最後更新</th>
                  <th className="text-right px-4 py-3 font-medium">操作</th>
                </tr>
              </thead>
              <SortableContext items={filteredFormulas.map(f => f.id)} strategy={verticalListSortingStrategy}>
                <tbody>
                  {filteredFormulas.length === 0 && (
                    <tr><td colSpan={9} className="text-center py-8 text-muted-foreground">
                      {formulas.length === 0 ? '尚無配方，請新增' : '無符合條件的配方'}
                    </td></tr>
                  )}
                  {filteredFormulas.map(f => {
                    const ch = channels.find(c => c.id === f.channelId);
                    return (
                      <SortableFormulaRow
                        key={f.id}
                        formula={f}
                        channelName={ch?.name || '-'}
                        onEdit={openEdit}
                        onCopy={handleCopy}
                        onExport={handleExport}
                        onDelete={handleDelete}
                        onNavigate={(id) => navigate(`/editor?formula=${id}`)}
                      />
                    );
                  })}
                </tbody>
              </SortableContext>
            </table>
          </DndContext>
        </div>
      </Card>

      {/* Edit formula dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>編輯配方資訊</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">配方編號</label>
                <Input value={editCode} onChange={e => setEditCode(e.target.value)} />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">配方名稱</label>
                <Input value={editName} onChange={e => setEditName(e.target.value)} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">對應通路</label>
                <Select value={editChannelId} onValueChange={setEditChannelId}>
                  <SelectTrigger><SelectValue placeholder="選擇通路" /></SelectTrigger>
                  <SelectContent>
                    {channels.map(ch => (
                      <SelectItem key={ch.id} value={ch.id}>{ch.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">每份規格 (g)</label>
                <Input type="number" value={editServingSize} onChange={e => setEditServingSize(e.target.value)} placeholder="100" min={0} step={0.1} />
              </div>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">備註</label>
              <Input value={editNote} onChange={e => setEditNote(e.target.value)} placeholder="備註說明..." />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="secondary" onClick={() => setEditDialogOpen(false)}>取消</Button>
              <Button onClick={handleEditSave} className="gap-1.5"><Save className="h-4 w-4" /> 儲存</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default FormulasPage;
