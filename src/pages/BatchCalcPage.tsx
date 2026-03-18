import React, { useState, useMemo } from 'react';
import { useAppContext } from '@/contexts/AppContext';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { Scale, Download } from 'lucide-react';
import * as XLSX from 'xlsx';
import { toast } from 'sonner';

const PIE_COLORS = [
  'hsl(210, 90%, 50%)', 'hsl(170, 60%, 45%)', 'hsl(38, 92%, 50%)',
  'hsl(0, 72%, 55%)', 'hsl(270, 60%, 55%)', 'hsl(140, 50%, 45%)',
  'hsl(30, 80%, 55%)', 'hsl(200, 70%, 50%)', 'hsl(320, 60%, 50%)',
];

const BatchCalcPage: React.FC = () => {
  const { formulas, ingredients } = useAppContext();
  const [selectedFormulaId, setSelectedFormulaId] = useState('');
  const [targetWeight, setTargetWeight] = useState<number>(1000);

  const selectedFormula = formulas.find(f => f.id === selectedFormulaId);

  const formulaTotal = useMemo(() => {
    if (!selectedFormula) return 0;
    return selectedFormula.ingredients.reduce((s, fi) => s + fi.amount, 0);
  }, [selectedFormula]);

  const scaledIngredients = useMemo(() => {
    if (!selectedFormula || formulaTotal === 0) return [];
    const ratio = targetWeight / formulaTotal;
    return selectedFormula.ingredients.map(fi => {
      const ing = ingredients.find(i => i.id === fi.ingredientId);
      return {
        name: ing?.name || '未知',
        materialCode: ing?.materialCode || '',
        originalAmount: fi.amount,
        scaledAmount: fi.amount * ratio,
        percentage: parseFloat(((fi.amount / formulaTotal) * 100).toFixed(3)),
        pricePerGram: ing?.pricePerGram || 0,
      };
    });
  }, [selectedFormula, formulaTotal, targetWeight, ingredients]);

  const totalCost = scaledIngredients.reduce((s, i) => s + i.scaledAmount * i.pricePerGram, 0);

  const pieData = scaledIngredients.filter(i => i.scaledAmount > 0).map(i => ({
    name: i.name,
    value: parseFloat(i.scaledAmount.toFixed(2)),
  }));

  const handleExport = () => {
    if (!selectedFormula || scaledIngredients.length === 0) return;
    const rows = scaledIngredients.map(item => ({
      '編號': item.materialCode,
      '原料名稱': item.name,
      '配方量 (g)': parseFloat(item.originalAmount.toFixed(2)),
      '佔比 (%)': item.percentage,
      '需求量 (g)': parseFloat(item.scaledAmount.toFixed(2)),
      '成本': parseFloat((item.scaledAmount * item.pricePerGram).toFixed(2)),
    }));
    rows.push({
      '編號': '',
      '原料名稱': '合計',
      '配方量 (g)': parseFloat(formulaTotal.toFixed(2)),
      '佔比 (%)': 100,
      '需求量 (g)': parseFloat(targetWeight.toFixed(2)),
      '成本': parseFloat(totalCost.toFixed(2)),
    });
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, '核配計算');
    XLSX.writeFile(wb, `核配_${selectedFormula.code}_${selectedFormula.name}.xlsx`);
    toast.success('已匯出 Excel');
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">核配</h1>
        {selectedFormula && scaledIngredients.length > 0 && (
          <Button variant="outline" size="sm" onClick={handleExport} className="gap-1.5">
            <Download className="h-4 w-4" /> 匯出 Excel
          </Button>
        )}
      </div>

      <div className="flex flex-wrap items-end gap-4">
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">選擇配方</label>
          <Select value={selectedFormulaId} onValueChange={setSelectedFormulaId}>
            <SelectTrigger className="w-60"><SelectValue placeholder="選擇配方" /></SelectTrigger>
            <SelectContent>
              {formulas.map(f => <SelectItem key={f.id} value={f.id}>{f.code} - {f.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">成品重量 (g)</label>
          <Input
            type="number"
            value={targetWeight}
            onChange={e => setTargetWeight(Number(e.target.value) || 0)}
            className="w-40"
            min={0}
          />
        </div>
        {selectedFormula && (
          <div className="text-sm text-muted-foreground">
            配方基準：{formulaTotal.toFixed(1)}g → 成品：{targetWeight}g（倍率：{formulaTotal > 0 ? (targetWeight / formulaTotal).toFixed(2) : '-'}x）
          </div>
        )}
      </div>

      {selectedFormula && scaledIngredients.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2">
            <Card className="p-4">
              <h3 className="text-sm font-medium mb-3 flex items-center gap-1.5">
                <Scale className="h-4 w-4 text-muted-foreground" /> 各原料需求量
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-muted-foreground text-xs">
                      <th className="text-left py-2 pr-2">編號</th>
                      <th className="text-left py-2">原料名稱</th>
                      <th className="text-right py-2">配方量 (g)</th>
                      <th className="text-right py-2">佔比 (%)</th>
                      <th className="text-right py-2 font-semibold text-foreground">需求量 (g)</th>
                      <th className="text-right py-2">成本</th>
                    </tr>
                  </thead>
                  <tbody>
                    {scaledIngredients.map((item, idx) => (
                      <tr key={idx} className="border-b last:border-0">
                       <td className="py-2 pr-2 font-mono text-xs text-muted-foreground">{item.materialCode}</td>
                        <td className="py-2 flex items-center gap-1.5">
                          <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: PIE_COLORS[idx % PIE_COLORS.length] }} />
                          {item.name}
                        </td>
                        <td className="text-right py-2 font-mono text-muted-foreground">{item.originalAmount.toFixed(3)}</td>
                        <td className="text-right py-2 font-mono text-muted-foreground">{item.percentage.toFixed(3)}%</td>
                        <td className="text-right py-2 font-mono font-semibold">{parseFloat(item.scaledAmount.toFixed(3))}</td>
                        <td className="text-right py-2 font-mono text-muted-foreground">${(item.scaledAmount * item.pricePerGram).toFixed(3)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 font-semibold">
                      <td colSpan={2} className="py-2">合計</td>
                      <td className="text-right py-2 font-mono">{formulaTotal.toFixed(2)}</td>
                      <td className="text-right py-2 font-mono">100.00%</td>
                      <td className="text-right py-2 font-mono">{targetWeight.toFixed(2)}</td>
                      <td className="text-right py-2 font-mono">${totalCost.toFixed(2)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </Card>
          </div>

          <Card className="p-4">
            <h3 className="text-sm font-medium mb-3">原料佔比</h3>
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={85} innerRadius={35}>
                  {pieData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                </Pie>
                <Tooltip formatter={(value: number, name: string) => [`${value.toFixed(1)}g (${targetWeight > 0 ? ((value / targetWeight) * 100).toFixed(1) : 0}%)`, name]} />
              </PieChart>
            </ResponsiveContainer>
            <div className="space-y-1 mt-2">
              {scaledIngredients.map((item, i) => (
                <div key={i} className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-1.5">
                    <div className="w-2.5 h-2.5 rounded-full" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />
                    <span className="truncate max-w-[120px]">{item.name}</span>
                  </div>
                  <span className="font-medium">{item.percentage.toFixed(1)}%</span>
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}

      {selectedFormula && scaledIngredients.length === 0 && (
        <Card className="p-8 text-center text-muted-foreground text-sm">
          此配方尚無原料，請先至配方組成頁面編輯
        </Card>
      )}

      {!selectedFormulaId && (
        <Card className="p-8 text-center text-muted-foreground text-sm">
          請選擇一個配方開始核配計算
        </Card>
      )}
    </div>
  );
};

export default BatchCalcPage;
