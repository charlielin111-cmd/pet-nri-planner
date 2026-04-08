import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { Ingredient, MarketChannel, Formula, NutrientDefinition, FormulaVersion } from '@/lib/types';
import { DEFAULT_NUTRIENTS } from '@/lib/nutrients';
import * as db from '@/lib/db';

interface AppState {
  ingredients: Ingredient[];
  channels: MarketChannel[];
  formulas: Formula[];
  nutrients: NutrientDefinition[];
}

export interface ImportDiffItem {
  key: string; // id or materialCode/code/name
  label: string; // display name
  type: 'new' | 'update';
  data: any;
  matchId?: string; // existing id to update
}

export interface ImportDiff {
  ingredients: ImportDiffItem[];
  channels: ImportDiffItem[];
  formulas: ImportDiffItem[];
  nutrients: ImportDiffItem[];
}

interface AppContextType {
  ingredients: Ingredient[];
  channels: MarketChannel[];
  formulas: Formula[];
  nutrients: NutrientDefinition[];
  lastUpdate: string;
  loading: boolean;
  canUndo: boolean;
  undoCount: number;
  refreshAll: () => Promise<void>;
  saveIngredient: (item: Ingredient) => Promise<void>;
  deleteIngredient: (id: string) => Promise<void>;
  saveChannel: (item: MarketChannel) => Promise<void>;
  deleteChannel: (id: string) => Promise<void>;
  saveFormula: (item: Formula, patchNotes?: string, skipVersion?: boolean) => Promise<void>;
  deleteFormula: (id: string) => Promise<void>;
  saveNutrients: (items: NutrientDefinition[]) => Promise<void>;
  getFormulaVersions: (formulaId: string) => Promise<FormulaVersion[]>;
  restoreFormulaVersion: (version: FormulaVersion) => Promise<void>;
  undo: () => Promise<void>;
  exportAllData: () => Promise<string>;
  importAllData: (json: string, mode?: 'overwrite' | 'update') => Promise<void>;
  previewImportDiff: (json: string) => Promise<ImportDiff>;
  importSelective: (json: string, selected: { ingredients: string[]; channels: string[]; formulas: string[]; nutrients: string[] }) => Promise<void>;
}

const AppContext = createContext<AppContextType | null>(null);

export const useAppContext = () => {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useAppContext must be within AppProvider');
  return ctx;
};

const formatTaipeiTime = () => {
  return new Date().toLocaleString('zh-TW', {
    timeZone: 'Asia/Taipei',
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
};

const MAX_UNDO = 3;

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [channels, setChannels] = useState<MarketChannel[]>([]);
  const [formulas, setFormulas] = useState<Formula[]>([]);
  const [nutrients, setNutrients] = useState<NutrientDefinition[]>(DEFAULT_NUTRIENTS);
  const [lastUpdate, setLastUpdate] = useState('');
  const [loading, setLoading] = useState(true);
  const undoStack = useRef<AppState[]>([]);
  const [undoCount, setUndoCount] = useState(0);

  const captureState = useCallback((): AppState => ({
    ingredients: [...ingredients],
    channels: [...channels],
    formulas: [...formulas],
    nutrients: [...nutrients],
  }), [ingredients, channels, formulas, nutrients]);

  const pushUndo = useCallback(() => {
    const state = captureState();
    undoStack.current = [...undoStack.current.slice(-(MAX_UNDO - 1)), state];
    setUndoCount(undoStack.current.length);
  }, [captureState]);

  const updateTime = useCallback(async () => {
    const t = formatTaipeiTime();
    setLastUpdate(t);
    await db.setMeta('lastUpdate', t);
  }, []);

  // Auto-sync to localStorage whenever data changes
  const syncToLocalStorage = useCallback((ings: Ingredient[], chs: MarketChannel[], forms: Formula[], nuts: NutrientDefinition[]) => {
    try {
      localStorage.setItem('petNri_ingredients', JSON.stringify(ings));
      localStorage.setItem('petNri_channels', JSON.stringify(chs));
      localStorage.setItem('petNri_formulas', JSON.stringify(forms));
      localStorage.setItem('petNri_nutrients', JSON.stringify(nuts));
      localStorage.setItem('petNri_lastSync', new Date().toISOString());
    } catch (e) {
      console.warn('localStorage sync failed:', e);
    }
  }, []);

  const refreshAll = useCallback(async () => {
    setLoading(true);
    try {
      // Try loading from localStorage first (faster initial load)
      const lsIngs = localStorage.getItem('petNri_ingredients');
      const lsChs = localStorage.getItem('petNri_channels');
      const lsForms = localStorage.getItem('petNri_formulas');
      const lsNuts = localStorage.getItem('petNri_nutrients');

      const [ings, chs, forms, nuts, meta] = await Promise.all([
        db.getAll<Ingredient>('ingredients'),
        db.getAll<MarketChannel>('channels'),
        db.getAll<Formula>('formulas'),
        db.getAll<NutrientDefinition>('nutrients'),
        db.getMeta('lastUpdate'),
      ]);

      // Use IndexedDB data if available, otherwise fall back to localStorage
      const finalIngs = ings.length > 0 ? ings : (lsIngs ? JSON.parse(lsIngs) as Ingredient[] : []);
      const finalChs = chs.length > 0 ? chs : (lsChs ? JSON.parse(lsChs) as MarketChannel[] : []);
      const finalForms = forms.length > 0 ? forms : (lsForms ? JSON.parse(lsForms) as Formula[] : []);
      const finalNuts = nuts.length > 0 ? nuts : (lsNuts ? JSON.parse(lsNuts) as NutrientDefinition[] : []);

      // If IndexedDB was empty but localStorage had data, restore to IndexedDB
      if (ings.length === 0 && lsIngs && finalIngs.length > 0) {
        for (const item of finalIngs) await db.putItem('ingredients', item);
      }
      if (chs.length === 0 && lsChs && finalChs.length > 0) {
        for (const item of finalChs) await db.putItem('channels', item);
      }
      if (forms.length === 0 && lsForms && finalForms.length > 0) {
        for (const item of finalForms) await db.putItem('formulas', item);
      }
      if (nuts.length === 0 && lsNuts && finalNuts.length > 0) {
        for (const item of finalNuts) await db.putItem('nutrients', item);
      }

      const sortedIngs = finalIngs.sort((a, b) => a.materialCode.localeCompare(b.materialCode));
      const sortedNuts = finalNuts.length > 0 ? finalNuts.sort((a, b) => a.order - b.order) : DEFAULT_NUTRIENTS;

      setIngredients(sortedIngs);
      setChannels(finalChs);
      setFormulas(finalForms);
      setNutrients(sortedNuts);
      if (meta) setLastUpdate(meta);

      // Sync to localStorage
      syncToLocalStorage(sortedIngs, finalChs, finalForms, sortedNuts);
    } finally {
      setLoading(false);
    }
  }, [syncToLocalStorage]);

  useEffect(() => { refreshAll(); }, [refreshAll]);

  const saveIngredient = async (item: Ingredient) => {
    pushUndo();
    await db.putItem('ingredients', item);
    await updateTime();
    await refreshAll();
  };

  const deleteIngredient = async (id: string) => {
    pushUndo();
    await db.deleteItem('ingredients', id);
    await updateTime();
    await refreshAll();
  };

  const saveChannel = async (item: MarketChannel) => {
    pushUndo();
    await db.putItem('channels', item);
    await updateTime();
    await refreshAll();
  };

  const deleteChannel = async (id: string) => {
    pushUndo();
    await db.deleteItem('channels', id);
    await updateTime();
    await refreshAll();
  };

  const saveFormula = async (item: Formula, patchNotes?: string, skipVersion?: boolean) => {
    pushUndo();
    if (!skipVersion) {
      // Auto-create version
      const existingVersions = await db.getAllByIndex<FormulaVersion>('formulaVersions', 'formulaId', item.id);
      const nextVersion = existingVersions.length > 0 ? Math.max(...existingVersions.map(v => v.version)) + 1 : 1;
      const version: FormulaVersion = {
        id: `${item.id}_v${nextVersion}_${Date.now()}`,
        formulaId: item.id,
        version: nextVersion,
        patchNotes: patchNotes || '',
        snapshot: { ...item },
        createdAt: new Date().toISOString(),
      };
      await db.putItem('formulaVersions', version);
    } else {
      // Update the latest version's snapshot instead
      const existingVersions = await db.getAllByIndex<FormulaVersion>('formulaVersions', 'formulaId', item.id);
      if (existingVersions.length > 0) {
        const latest = existingVersions.sort((a, b) => b.version - a.version)[0];
        await db.putItem('formulaVersions', { ...latest, snapshot: { ...item }, patchNotes: patchNotes || latest.patchNotes, createdAt: new Date().toISOString() });
      }
    }
    await db.putItem('formulas', item);
    await updateTime();
    await refreshAll();
  };

  const getFormulaVersions = async (formulaId: string): Promise<FormulaVersion[]> => {
    const versions = await db.getAllByIndex<FormulaVersion>('formulaVersions', 'formulaId', formulaId);
    return versions.sort((a, b) => b.version - a.version);
  };

  const restoreFormulaVersion = async (version: FormulaVersion) => {
    pushUndo();
    await db.putItem('formulas', { ...version.snapshot, updatedAt: new Date().toISOString() });
    await updateTime();
    await refreshAll();
  };

  const deleteFormula = async (id: string) => {
    pushUndo();
    await db.deleteItem('formulas', id);
    await updateTime();
    await refreshAll();
  };

  const saveNutrients = async (items: NutrientDefinition[]) => {
    pushUndo();
    for (const n of items) await db.putItem('nutrients', n);
    await updateTime();
    await refreshAll();
  };

  const undo = async () => {
    if (undoStack.current.length === 0) return;
    const prev = undoStack.current.pop()!;
    setUndoCount(undoStack.current.length);

    // Clear all stores and restore
    const allIngs = await db.getAll<Ingredient>('ingredients');
    for (const i of allIngs) await db.deleteItem('ingredients', i.id);
    for (const i of prev.ingredients) await db.putItem('ingredients', i);

    const allChs = await db.getAll<MarketChannel>('channels');
    for (const c of allChs) await db.deleteItem('channels', c.id);
    for (const c of prev.channels) await db.putItem('channels', c);

    const allForms = await db.getAll<Formula>('formulas');
    for (const f of allForms) await db.deleteItem('formulas', f.id);
    for (const f of prev.formulas) await db.putItem('formulas', f);

    const allNuts = await db.getAll<NutrientDefinition>('nutrients');
    for (const n of allNuts) await db.deleteItem('nutrients', n.id);
    for (const n of prev.nutrients) await db.putItem('nutrients', n);

    await updateTime();
    await refreshAll();
  };

  const exportAllData = async (): Promise<string> => {
    const [ings, chs, forms, nuts] = await Promise.all([
      db.getAll<Ingredient>('ingredients'),
      db.getAll<MarketChannel>('channels'),
      db.getAll<Formula>('formulas'),
      db.getAll<NutrientDefinition>('nutrients'),
    ]);
    return JSON.stringify({ ingredients: ings, channels: chs, formulas: forms, nutrients: nuts, exportedAt: new Date().toISOString() }, null, 2);
  };

  const importAllData = async (json: string, mode: 'overwrite' | 'update' = 'overwrite') => {
    pushUndo();
    const data = JSON.parse(json);

    if (mode === 'overwrite') {
      const allIngs = await db.getAll<Ingredient>('ingredients');
      for (const i of allIngs) await db.deleteItem('ingredients', i.id);
      const allChs = await db.getAll<MarketChannel>('channels');
      for (const c of allChs) await db.deleteItem('channels', c.id);
      const allForms = await db.getAll<Formula>('formulas');
      for (const f of allForms) await db.deleteItem('formulas', f.id);
      const allNuts = await db.getAll<NutrientDefinition>('nutrients');
      for (const n of allNuts) await db.deleteItem('nutrients', n.id);

      if (data.ingredients) for (const i of data.ingredients) await db.putItem('ingredients', i);
      if (data.channels) for (const c of data.channels) await db.putItem('channels', c);
      if (data.formulas) for (const f of data.formulas) await db.putItem('formulas', f);
      if (data.nutrients) for (const n of data.nutrients) await db.putItem('nutrients', n);
    } else {
      const existingIngs = await db.getAll<Ingredient>('ingredients');
      const existingChs = await db.getAll<MarketChannel>('channels');
      const existingForms = await db.getAll<Formula>('formulas');

      if (data.ingredients) {
        for (const incoming of data.ingredients as Ingredient[]) {
          const match = existingIngs.find(e => e.materialCode === incoming.materialCode);
          if (match) await db.putItem('ingredients', { ...incoming, id: match.id });
          else await db.putItem('ingredients', incoming);
        }
      }
      if (data.channels) {
        for (const incoming of data.channels as MarketChannel[]) {
          const match = existingChs.find(e => e.name === incoming.name);
          if (match) await db.putItem('channels', { ...incoming, id: match.id });
          else await db.putItem('channels', incoming);
        }
      }
      if (data.formulas) {
        for (const incoming of data.formulas as Formula[]) {
          const match = existingForms.find(e => e.code === incoming.code);
          if (match) await db.putItem('formulas', { ...incoming, id: match.id });
          else await db.putItem('formulas', incoming);
        }
      }
      if (data.nutrients) {
        for (const n of data.nutrients as NutrientDefinition[]) await db.putItem('nutrients', n);
      }
    }

    await updateTime();
    await refreshAll();
  };

  const previewImportDiff = async (json: string): Promise<ImportDiff> => {
    const data = JSON.parse(json);
    const existingIngs = await db.getAll<Ingredient>('ingredients');
    const existingChs = await db.getAll<MarketChannel>('channels');
    const existingForms = await db.getAll<Formula>('formulas');
    const existingNuts = await db.getAll<NutrientDefinition>('nutrients');

    const isDataEqual = (a: any, b: any, ignoreKeys: string[] = ['id', 'updatedAt']): boolean => {
      const filterKeys = (obj: any) => {
        const copy = { ...obj };
        for (const k of ignoreKeys) delete copy[k];
        return copy;
      };
      return JSON.stringify(filterKeys(a)) === JSON.stringify(filterKeys(b));
    };

    const diffIngredients: ImportDiffItem[] = (data.ingredients || []).filter((inc: Ingredient) => {
      const match = existingIngs.find(e => e.materialCode === inc.materialCode);
      return !match || !isDataEqual(inc, match);
    }).map((inc: Ingredient) => {
      const match = existingIngs.find(e => e.materialCode === inc.materialCode);
      return { key: inc.materialCode || inc.id, label: `${inc.materialCode} - ${inc.name}`, type: match ? 'update' as const : 'new' as const, data: inc, matchId: match?.id };
    });
    const diffChannels: ImportDiffItem[] = (data.channels || []).filter((inc: MarketChannel) => {
      const match = existingChs.find(e => e.name === inc.name);
      return !match || !isDataEqual(inc, match);
    }).map((inc: MarketChannel) => {
      const match = existingChs.find(e => e.name === inc.name);
      return { key: inc.name || inc.id, label: inc.name, type: match ? 'update' as const : 'new' as const, data: inc, matchId: match?.id };
    });
    const diffFormulas: ImportDiffItem[] = (data.formulas || []).filter((inc: Formula) => {
      const match = existingForms.find(e => e.code === inc.code);
      return !match || !isDataEqual(inc, match);
    }).map((inc: Formula) => {
      const match = existingForms.find(e => e.code === inc.code);
      return { key: inc.code || inc.id, label: `${inc.code} - ${inc.name}`, type: match ? 'update' as const : 'new' as const, data: inc, matchId: match?.id };
    });
    const diffNutrients: ImportDiffItem[] = (data.nutrients || []).filter((inc: NutrientDefinition) => {
      const match = existingNuts.find(e => e.id === inc.id);
      return !match || !isDataEqual(inc, match);
    }).map((inc: NutrientDefinition) => {
      const match = existingNuts.find(e => e.id === inc.id);
      return { key: inc.id, label: `${inc.name} (${inc.nameEn})`, type: match ? 'update' as const : 'new' as const, data: inc, matchId: match?.id };
    });

    return { ingredients: diffIngredients, channels: diffChannels, formulas: diffFormulas, nutrients: diffNutrients };
  };

  const importSelective = async (json: string, selected: { ingredients: string[]; channels: string[]; formulas: string[]; nutrients: string[] }) => {
    pushUndo();
    const data = JSON.parse(json);
    const existingIngs = await db.getAll<Ingredient>('ingredients');
    const existingChs = await db.getAll<MarketChannel>('channels');
    const existingForms = await db.getAll<Formula>('formulas');

    if (data.ingredients) {
      for (const inc of data.ingredients as Ingredient[]) {
        const key = inc.materialCode || inc.id;
        if (!selected.ingredients.includes(key)) continue;
        const match = existingIngs.find(e => e.materialCode === inc.materialCode);
        if (match) await db.putItem('ingredients', { ...inc, id: match.id });
        else await db.putItem('ingredients', inc);
      }
    }
    if (data.channels) {
      for (const inc of data.channels as MarketChannel[]) {
        const key = inc.name || inc.id;
        if (!selected.channels.includes(key)) continue;
        const match = existingChs.find(e => e.name === inc.name);
        if (match) await db.putItem('channels', { ...inc, id: match.id });
        else await db.putItem('channels', inc);
      }
    }
    if (data.formulas) {
      for (const inc of data.formulas as Formula[]) {
        const key = inc.code || inc.id;
        if (!selected.formulas.includes(key)) continue;
        const match = existingForms.find(e => e.code === inc.code);
        if (match) await db.putItem('formulas', { ...inc, id: match.id });
        else await db.putItem('formulas', inc);
      }
    }
    if (data.nutrients) {
      for (const n of data.nutrients as NutrientDefinition[]) {
        if (!selected.nutrients.includes(n.id)) continue;
        await db.putItem('nutrients', n);
      }
    }

    await updateTime();
    await refreshAll();
  };

  return (
    <AppContext.Provider value={{
      ingredients, channels, formulas, nutrients, lastUpdate, loading,
      canUndo: undoStack.current.length > 0, undoCount,
      refreshAll, saveIngredient, deleteIngredient,
      saveChannel, deleteChannel, saveFormula, deleteFormula, saveNutrients,
      getFormulaVersions, restoreFormulaVersion,
      undo, exportAllData, importAllData, previewImportDiff, importSelective,
    }}>
      {children}
    </AppContext.Provider>
  );
};
