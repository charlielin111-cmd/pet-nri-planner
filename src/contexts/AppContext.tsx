import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { Ingredient, MarketChannel, Formula, NutrientDefinition } from '@/lib/types';
import { DEFAULT_NUTRIENTS } from '@/lib/nutrients';
import * as db from '@/lib/db';

interface AppContextType {
  ingredients: Ingredient[];
  channels: MarketChannel[];
  formulas: Formula[];
  nutrients: NutrientDefinition[];
  lastUpdate: string;
  loading: boolean;
  refreshAll: () => Promise<void>;
  saveIngredient: (item: Ingredient) => Promise<void>;
  deleteIngredient: (id: string) => Promise<void>;
  saveChannel: (item: MarketChannel) => Promise<void>;
  deleteChannel: (id: string) => Promise<void>;
  saveFormula: (item: Formula) => Promise<void>;
  deleteFormula: (id: string) => Promise<void>;
  saveNutrients: (items: NutrientDefinition[]) => Promise<void>;
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

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [channels, setChannels] = useState<MarketChannel[]>([]);
  const [formulas, setFormulas] = useState<Formula[]>([]);
  const [nutrients, setNutrients] = useState<NutrientDefinition[]>(DEFAULT_NUTRIENTS);
  const [lastUpdate, setLastUpdate] = useState('');
  const [loading, setLoading] = useState(true);

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
    await db.putItem('ingredients', item);
    await updateTime();
    await refreshAll();
  };

  const deleteIngredient = async (id: string) => {
    await db.deleteItem('ingredients', id);
    await updateTime();
    await refreshAll();
  };

  const saveChannel = async (item: MarketChannel) => {
    await db.putItem('channels', item);
    await updateTime();
    await refreshAll();
  };

  const deleteChannel = async (id: string) => {
    await db.deleteItem('channels', id);
    await updateTime();
    await refreshAll();
  };

  const saveFormula = async (item: Formula) => {
    await db.putItem('formulas', item);
    await updateTime();
    await refreshAll();
  };

  const deleteFormula = async (id: string) => {
    await db.deleteItem('formulas', id);
    await updateTime();
    await refreshAll();
  };

  const saveNutrients = async (items: NutrientDefinition[]) => {
    for (const n of items) await db.putItem('nutrients', n);
    await updateTime();
    await refreshAll();
  };

  return (
    <AppContext.Provider value={{
      ingredients, channels, formulas, nutrients, lastUpdate, loading,
      refreshAll, saveIngredient, deleteIngredient,
      saveChannel, deleteChannel, saveFormula, deleteFormula, saveNutrients,
    }}>
      {children}
    </AppContext.Provider>
  );
};
