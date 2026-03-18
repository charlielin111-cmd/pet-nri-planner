import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { Ingredient, MarketChannel, Formula, NutrientDefinition } from '@/lib/types';
import { DEFAULT_NUTRIENTS } from '@/lib/nutrients';
import * as db from '@/lib/db';

interface AppState {
  ingredients: Ingredient[];
  channels: MarketChannel[];
  formulas: Formula[];
  nutrients: NutrientDefinition[];
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
  saveFormula: (item: Formula) => Promise<void>;
  deleteFormula: (id: string) => Promise<void>;
  saveNutrients: (items: NutrientDefinition[]) => Promise<void>;
  undo: () => Promise<void>;
  exportAllData: () => Promise<string>;
  importAllData: (json: string, mode?: 'overwrite' | 'update') => Promise<void>;
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

  const refreshAll = useCallback(async () => {
    setLoading(true);
    try {
      const [ings, chs, forms, nuts, meta] = await Promise.all([
        db.getAll<Ingredient>('ingredients'),
        db.getAll<MarketChannel>('channels'),
        db.getAll<Formula>('formulas'),
        db.getAll<NutrientDefinition>('nutrients'),
        db.getMeta('lastUpdate'),
      ]);
      setIngredients(ings.sort((a, b) => a.materialCode.localeCompare(b.materialCode)));
      setChannels(chs);
      setFormulas(forms);
      if (nuts.length > 0) setNutrients(nuts.sort((a, b) => a.order - b.order));
      if (meta) setLastUpdate(meta);
    } finally {
      setLoading(false);
    }
  }, []);

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

  const saveFormula = async (item: Formula) => {
    pushUndo();
    await db.putItem('formulas', item);
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
      // Clear all existing data
      const allIngs = await db.getAll<Ingredient>('ingredients');
      for (const i of allIngs) await db.deleteItem('ingredients', i.id);
      const allChs = await db.getAll<MarketChannel>('channels');
      for (const c of allChs) await db.deleteItem('channels', c.id);
      const allForms = await db.getAll<Formula>('formulas');
      for (const f of allForms) await db.deleteItem('formulas', f.id);
      const allNuts = await db.getAll<NutrientDefinition>('nutrients');
      for (const n of allNuts) await db.deleteItem('nutrients', n.id);

      // Import all
      if (data.ingredients) for (const i of data.ingredients) await db.putItem('ingredients', i);
      if (data.channels) for (const c of data.channels) await db.putItem('channels', c);
      if (data.formulas) for (const f of data.formulas) await db.putItem('formulas', f);
      if (data.nutrients) for (const n of data.nutrients) await db.putItem('nutrients', n);
    } else {
      // Update mode: match by code/name, update existing, add new
      const existingIngs = await db.getAll<Ingredient>('ingredients');
      const existingChs = await db.getAll<MarketChannel>('channels');
      const existingForms = await db.getAll<Formula>('formulas');

      if (data.ingredients) {
        for (const incoming of data.ingredients as Ingredient[]) {
          const match = existingIngs.find(e => e.materialCode === incoming.materialCode);
          if (match) {
            await db.putItem('ingredients', { ...incoming, id: match.id });
          } else {
            await db.putItem('ingredients', incoming);
          }
        }
      }

      if (data.channels) {
        for (const incoming of data.channels as MarketChannel[]) {
          const match = existingChs.find(e => e.name === incoming.name);
          if (match) {
            await db.putItem('channels', { ...incoming, id: match.id });
          } else {
            await db.putItem('channels', incoming);
          }
        }
      }

      if (data.formulas) {
        for (const incoming of data.formulas as Formula[]) {
          const match = existingForms.find(e => e.code === incoming.code);
          if (match) {
            await db.putItem('formulas', { ...incoming, id: match.id });
          } else {
            await db.putItem('formulas', incoming);
          }
        }
      }

      if (data.nutrients) {
        for (const n of data.nutrients as NutrientDefinition[]) {
          await db.putItem('nutrients', n);
        }
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
      undo, exportAllData, importAllData,
    }}>
      {children}
    </AppContext.Provider>
  );
};
