import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Bell, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

export interface AppUpdateNote {
  id: string;
  version: string;
  notes: string;
  createdAt: string;
}

const STORAGE_KEY = 'petNri_appUpdates';

const loadUpdates = (): AppUpdateNote[] => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as AppUpdateNote[];
  } catch {
    return [];
  }
};

const saveUpdates = (items: AppUpdateNote[]) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
};

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const AppUpdatesDialog: React.FC<Props> = ({ open, onOpenChange }) => {
  const [updates, setUpdates] = useState<AppUpdateNote[]>([]);
  const [addOpen, setAddOpen] = useState(false);
  const [version, setVersion] = useState('');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (open) setUpdates(loadUpdates());
  }, [open]);

  const handleAdd = () => {
    if (!version.trim() || !notes.trim()) {
      toast.error('請填寫版本與更新內容');
      return;
    }
    const next: AppUpdateNote = {
      id: crypto.randomUUID(),
      version: version.trim(),
      notes: notes.trim(),
      createdAt: new Date().toISOString(),
    };
    const list = [next, ...updates];
    setUpdates(list);
    saveUpdates(list);
    setVersion('');
    setNotes('');
    setAddOpen(false);
    toast.success('已新增更新備註');
  };

  const handleDelete = (id: string) => {
    const list = updates.filter(u => u.id !== id);
    setUpdates(list);
    saveUpdates(list);
    toast.success('已刪除');
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-lg max-h-[80vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Bell className="h-4 w-4" /> APP 更新備註
            </DialogTitle>
          </DialogHeader>
          <div className="flex justify-end">
            <Button size="sm" onClick={() => setAddOpen(true)} className="gap-1.5">
              <Plus className="h-4 w-4" /> 新增更新
            </Button>
          </div>
          <ScrollArea className="max-h-[55vh] pr-2">
            {updates.length === 0 ? (
              <p className="text-sm text-muted-foreground py-8 text-center">尚無更新紀錄</p>
            ) : (
              <div className="space-y-2">
                {updates.map(u => (
                  <Card key={u.id} className="p-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-sm bg-primary/10 text-primary px-1.5 py-0.5 rounded">
                          {u.version}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {new Date(u.createdAt).toLocaleString('zh-TW', { timeZone: 'Asia/Taipei' })}
                        </span>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDelete(u.id)}
                        className="h-7 w-7"
                      >
                        <Trash2 className="h-3.5 w-3.5 text-destructive" />
                      </Button>
                    </div>
                    <p className="text-sm mt-2 whitespace-pre-wrap">{u.notes}</p>
                  </Card>
                ))}
              </div>
            )}
          </ScrollArea>
        </DialogContent>
      </Dialog>

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>新增更新備註</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-sm font-medium">版本號</label>
              <Input
                value={version}
                onChange={e => setVersion(e.target.value)}
                placeholder="例：v1.2.0"
                className="mt-1"
              />
            </div>
            <div>
              <label className="text-sm font-medium">更新內容</label>
              <Textarea
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="本次更新內容..."
                rows={4}
                className="mt-1"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)}>取消</Button>
            <Button onClick={handleAdd}>儲存</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};
