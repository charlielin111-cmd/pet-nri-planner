import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Bell, Plus, Trash2, Pencil, Check, X, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

export interface AppUpdateNote {
  id: string;
  version: string;
  notes: string;
  createdAt: string;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const AppUpdatesDialog: React.FC<Props> = ({ open, onOpenChange }) => {
  const [updates, setUpdates] = useState<AppUpdateNote[]>([]);
  const [loading, setLoading] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [version, setVersion] = useState('');
  const [notes, setNotes] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editVersion, setEditVersion] = useState('');
  const [editNotes, setEditNotes] = useState('');

  const fetchUpdates = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('app_updates')
      .select('id, version, notes, created_at')
      .order('created_at', { ascending: false });
    setLoading(false);
    if (error) {
      toast.error('讀取更新備註失敗');
      return;
    }
    setUpdates(
      (data || []).map(d => ({
        id: d.id,
        version: d.version,
        notes: d.notes,
        createdAt: d.created_at,
      }))
    );
  };

  useEffect(() => {
    if (open) fetchUpdates();
  }, [open]);

  // Realtime sync
  useEffect(() => {
    if (!open) return;
    const channel = supabase
      .channel('app_updates_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'app_updates' }, () => {
        fetchUpdates();
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [open]);

  const handleAdd = async () => {
    if (!version.trim() || !notes.trim()) {
      toast.error('請填寫版本與更新內容');
      return;
    }
    const { error } = await supabase.from('app_updates').insert({
      version: version.trim(),
      notes: notes.trim(),
    });
    if (error) {
      toast.error('新增失敗');
      return;
    }
    setVersion('');
    setNotes('');
    setAddOpen(false);
    toast.success('已新增更新備註（全站同步）');
    fetchUpdates();
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from('app_updates').delete().eq('id', id);
    if (error) {
      toast.error('刪除失敗');
      return;
    }
    toast.success('已刪除');
    fetchUpdates();
  };

  const startEdit = (u: AppUpdateNote) => {
    setEditingId(u.id);
    setEditVersion(u.version);
    setEditNotes(u.notes);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditVersion('');
    setEditNotes('');
  };

  const saveEdit = async (id: string) => {
    if (!editVersion.trim() || !editNotes.trim()) {
      toast.error('內容不可為空');
      return;
    }
    const { error } = await supabase
      .from('app_updates')
      .update({ version: editVersion.trim(), notes: editNotes.trim(), updated_at: new Date().toISOString() })
      .eq('id', id);
    if (error) {
      toast.error('更新失敗');
      return;
    }
    setEditingId(null);
    toast.success('已更新');
    fetchUpdates();
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-lg max-h-[80vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Bell className="h-4 w-4" /> APP 更新備註
              <span className="text-xs font-normal text-muted-foreground ml-1">（全站同步）</span>
            </DialogTitle>
          </DialogHeader>
          <div className="flex justify-end">
            <Button size="sm" onClick={() => setAddOpen(true)} className="gap-1.5">
              <Plus className="h-4 w-4" /> 新增更新
            </Button>
          </div>
          <ScrollArea className="max-h-[55vh] pr-2">
            {loading ? (
              <div className="py-8 flex items-center justify-center text-muted-foreground text-sm gap-2">
                <Loader2 className="h-4 w-4 animate-spin" /> 載入中...
              </div>
            ) : updates.length === 0 ? (
              <p className="text-sm text-muted-foreground py-8 text-center">尚無更新紀錄</p>
            ) : (
              <div className="space-y-2">
                {updates.map(u => {
                  const isEditing = editingId === u.id;
                  return (
                    <Card key={u.id} className="p-3">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          {isEditing ? (
                            <Input
                              value={editVersion}
                              onChange={e => setEditVersion(e.target.value)}
                              className="h-7 text-sm font-mono w-28"
                            />
                          ) : (
                            <span className="font-mono font-bold text-sm bg-primary/10 text-primary px-1.5 py-0.5 rounded">
                              {u.version}
                            </span>
                          )}
                          <span className="text-xs text-muted-foreground">
                            {new Date(u.createdAt).toLocaleString('zh-TW', { timeZone: 'Asia/Taipei' })}
                          </span>
                        </div>
                        <div className="flex items-center gap-0.5 shrink-0">
                          {isEditing ? (
                            <>
                              <Button variant="ghost" size="icon" onClick={() => saveEdit(u.id)} className="h-7 w-7" title="儲存">
                                <Check className="h-3.5 w-3.5 text-primary" />
                              </Button>
                              <Button variant="ghost" size="icon" onClick={cancelEdit} className="h-7 w-7" title="取消">
                                <X className="h-3.5 w-3.5" />
                              </Button>
                            </>
                          ) : (
                            <>
                              <Button variant="ghost" size="icon" onClick={() => startEdit(u)} className="h-7 w-7" title="編輯">
                                <Pencil className="h-3.5 w-3.5" />
                              </Button>
                              <Button variant="ghost" size="icon" onClick={() => handleDelete(u.id)} className="h-7 w-7" title="刪除">
                                <Trash2 className="h-3.5 w-3.5 text-destructive" />
                              </Button>
                            </>
                          )}
                        </div>
                      </div>
                      {isEditing ? (
                        <Textarea
                          value={editNotes}
                          onChange={e => setEditNotes(e.target.value)}
                          rows={3}
                          className="mt-2 text-sm"
                        />
                      ) : (
                        <p
                          className="text-sm mt-2 whitespace-pre-wrap cursor-text hover:bg-muted/40 rounded px-1 -mx-1"
                          onClick={() => startEdit(u)}
                          title="點擊編輯"
                        >
                          {u.notes}
                        </p>
                      )}
                    </Card>
                  );
                })}
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
