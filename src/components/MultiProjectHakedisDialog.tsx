import { useState, useMemo, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { sortNatural } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { useHakedisStore } from '@/store/hakedisStore';
import {
  Currency, HakedisRecordType, ApprovalStatus, PaymentStatus,
  HakedisItem, ExtraWorkItem,
  formatCurrencyWithType, contractTypeLabels, hakedisTypeLabels, roleLabels, currencySymbols,
} from '@/types/hakedis';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type RowMode = 'contract' | 'small';

interface SmallItem {
  id: string;
  description: string;
  unit: string;
  unitPrice: number;
  quantity: number;
  amount: number;
}

interface ProjectRow {
  id: string;
  projectMode: 'existing' | 'custom';
  projectId: string;
  projectName: string; // for custom small
  rowMode: RowMode;
  contractId: string;
  hakedisType: HakedisRecordType;
  currency: Currency;
  date: string;
  description: string;
  // götürü bedel / alelhesap (contract mode)
  amount: string;
  // birim fiyat
  hakedisItems: HakedisItem[];
  extraItems: ExtraWorkItem[];
  // small mode items
  smallItems: SmallItem[];
  vatRate: string;
  vatInclusive: boolean;
}

const makeSmallItem = (): SmallItem => ({
  id: crypto.randomUUID(),
  description: '',
  unit: 'adet',
  unitPrice: 0,
  quantity: 0,
  amount: 0,
});

const makeRow = (): ProjectRow => ({
  id: crypto.randomUUID(),
  projectMode: 'existing',
  projectId: '',
  projectName: '',
  rowMode: 'contract',
  contractId: '',
  hakedisType: 'ara_hakedis',
  currency: 'TRY',
  date: new Date().toISOString().split('T')[0],
  description: '',
  amount: '',
  hakedisItems: [],
  extraItems: [],
  smallItems: [makeSmallItem()],
  vatRate: '10',
  vatInclusive: false,
});

export function MultiProjectHakedisDialog({ open, onOpenChange }: Props) {
  const {
    projects, workEntries, subcontractors, subcontractorHakedisler,
    addSubcontractorHakedis, addSubcontractor, addActivityLog, currentUser,
  } = useHakedisStore();

  const [subMode, setSubMode] = useState<'existing' | 'custom'>('existing');
  const [subcontractor, setSubcontractor] = useState('');
  const [customSubcontractor, setCustomSubcontractor] = useState('');
  const [rows, setRows] = useState<ProjectRow[]>([makeRow()]);
  const [submitting, setSubmitting] = useState(false);

  const allSubcontractorNames = useMemo(() => {
    const names = new Set<string>();
    subcontractors.forEach(s => names.add(s.name));
    workEntries.forEach(e => e.subcontractor && names.add(e.subcontractor));
    subcontractorHakedisler.forEach(h => h.subcontractor && names.add(h.subcontractor));
    return Array.from(names).sort((a, b) => a.localeCompare(b, 'tr'));
  }, [subcontractors, workEntries, subcontractorHakedisler]);

  const effectiveSub = subMode === 'existing' ? subcontractor : customSubcontractor.trim();

  // Reset on close
  useEffect(() => {
    if (!open) {
      setSubMode('existing');
      setSubcontractor('');
      setCustomSubcontractor('');
      setRows([makeRow()]);
      setSubmitting(false);
    }
  }, [open]);

  const updateRow = (id: string, patch: Partial<ProjectRow>) => {
    setRows(prev => prev.map(r => r.id === id ? { ...r, ...patch } : r));
  };

  // Get contracts available for a given project + selected subcontractor
  const getAvailableContracts = (projectId: string) => {
    if (!projectId || !effectiveSub) return [];
    return workEntries.filter(e => e.projectId === projectId && e.subcontractor === effectiveSub);
  };

  // Get projects that have at least one contract for the selected subcontractor
  const projectsForSub = useMemo(() => {
    if (!effectiveSub) return projects.filter(p => p.status === 'aktif');
    const projectIds = new Set(
      workEntries.filter(e => e.subcontractor === effectiveSub).map(e => e.projectId)
    );
    // include all active projects too (for small mode)
    return projects.filter(p => p.status === 'aktif' || projectIds.has(p.id));
  }, [projects, workEntries, effectiveSub]);

  const handleContractSelect = (rowId: string, contractId: string) => {
    const contract = workEntries.find(e => e.id === contractId);
    let hakedisItems: HakedisItem[] = [];
    if (contract?.contractType === 'birim_fiyat' && contract.workItemEntries) {
      hakedisItems = contract.workItemEntries.map(item => ({
        id: crypto.randomUUID(),
        workItemEntryId: item.id,
        workCategory: item.workCategory,
        description: item.description,
        unit: item.unit,
        unitPrice: item.unitPrice,
        quantity: 0,
        amount: 0,
      }));
    }
    updateRow(rowId, {
      contractId,
      currency: (contract?.currency as Currency) || 'TRY',
      hakedisItems,
      extraItems: [],
      amount: '',
    });
  };

  const updateHakedisItemQty = (rowId: string, itemId: string, quantity: number) => {
    setRows(prev => prev.map(r => {
      if (r.id !== rowId) return r;
      return {
        ...r,
        hakedisItems: r.hakedisItems.map(it =>
          it.id === itemId ? { ...it, quantity, amount: quantity * it.unitPrice } : it
        ),
      };
    }));
  };

  const computeRowTotal = (row: ProjectRow): { base: number; total: number; currency: Currency } => {
    const contract = workEntries.find(e => e.id === row.contractId);
    const currency: Currency = (row.currency as Currency) || (contract?.currency as Currency) || 'TRY';
    let base = 0;
    if (row.rowMode === 'small') {
      const itemsTotal = row.smallItems.reduce((s, i) => s + i.amount, 0);
      const vr = row.vatRate !== '' ? Number(row.vatRate) : 0;
      base = row.vatInclusive && vr > 0 ? itemsTotal / (1 + vr / 100) : itemsTotal;
    } else if (contract) {
      if (row.hakedisType === 'alelhesap' || contract.contractType === 'goturu_bedel') {
        base = parseFloat(row.amount) || 0;
      } else {
        base = row.hakedisItems.reduce((s, i) => s + i.amount, 0);
      }
      const extras = row.extraItems.reduce((s, i) => s + i.amount, 0);
      base += extras;
      const vr = row.vatRate !== '' ? Number(row.vatRate) : 0;
      if (row.vatInclusive && vr > 0) base = base / (1 + vr / 100);
    }
    const vr = row.vatRate !== '' ? Number(row.vatRate) : 0;
    const total = vr > 0 ? base * (1 + vr / 100) : base;
    return { base, total, currency };
  };

  const handleSubmit = async () => {
    if (!effectiveSub) {
      toast.error('Lütfen altyüklenici seçin veya girin');
      return;
    }
    // Validate rows
    const validRows: ProjectRow[] = [];
    for (const r of rows) {
      const projectOk = r.projectMode === 'existing'
        ? !!r.projectId
        : (r.rowMode === 'small' && !!r.projectName.trim());
      if (!projectOk) continue;
      if (r.rowMode === 'contract') {
        if (!r.contractId) continue;
        const { base } = computeRowTotal(r);
        if (base <= 0) continue;
      } else {
        const validItems = r.smallItems.filter(i => i.amount > 0 && i.description.trim());
        if (validItems.length === 0) continue;
      }
      validRows.push(r);
    }
    if (validRows.length === 0) {
      toast.error('Lütfen en az bir geçerli satır girin');
      return;
    }

    setSubmitting(true);
    try {
      // Add new subcontractor if needed
      if (subMode === 'custom' && customSubcontractor.trim()) {
        await addSubcontractor(customSubcontractor.trim());
      }

      // Compute starting small hakediş number once
      const existingSmallNos = subcontractorHakedisler
        .filter(h => !h.contractId && h.hakedisNo?.startsWith('KH-S'))
        .map(h => parseInt(h.hakedisNo.replace('KH-S', ''), 10) || 0);
      let nextSmallNum = existingSmallNos.length > 0 ? Math.max(...existingSmallNos) + 1 : 1;

      const selectedSub = subcontractors.find(s => s.name === effectiveSub);
      const subWorkCategory = selectedSub?.workCategory || '';

      let createdCount = 0;

      for (const row of validRows) {
        const { base } = computeRowTotal(row);
        const totalAmount = base; // we store KDV hariç as totalAmount (consistent with existing logic)

        if (row.rowMode === 'small') {
          // contractless
          const projectLabel = row.projectMode === 'existing'
            ? projects.find(p => p.id === row.projectId)?.projectName || ''
            : row.projectName.trim();
          const projectPrefix = row.projectMode === 'custom' && row.projectName.trim()
            ? `[Proje: ${row.projectName.trim()}] ` : '';
          const workCategoryLabel = subWorkCategory ? `[${subWorkCategory}] ` : '';
          const hakedisNo = `KH-S${String(nextSmallNum).padStart(3, '0')}`;
          nextSmallNum++;

          const rowCurrency = row.currency || 'TRY';
          const validItems = row.smallItems.filter(i => i.amount > 0 && i.description.trim());
          const itemsAsExtra: ExtraWorkItem[] = validItems.map(i => ({
            id: i.id,
            description: i.description.trim(),
            unit: i.unit,
            unitPrice: i.unitPrice,
            quantity: i.quantity,
            amount: i.amount,
          }));
          const autoDescription = validItems.map(i =>
            `${i.description.trim()} (${i.quantity} ${i.unit} × ${formatCurrencyWithType(i.unitPrice, rowCurrency)})`
          ).join('; ');
          const finalDescription = `${workCategoryLabel}${projectPrefix}${row.description.trim() || autoDescription}`;

          const data = {
            hakedisNo,
            hakedisType: 'ara_hakedis' as HakedisRecordType,
            projectId: row.projectMode === 'existing' && row.projectId ? row.projectId : (null as any),
            subcontractor: effectiveSub,
            contractId: null as any,
            contractNo: null as any,
            contractType: 'goturu_bedel' as const,
            currency: rowCurrency,
            vatRate: row.vatRate !== '' && Number(row.vatRate) > 0 ? Number(row.vatRate) : null,
            date: row.date,
            description: finalDescription,
            paymentAmount: totalAmount,
            extraItems: itemsAsExtra.length > 0 ? itemsAsExtra : undefined,
            totalAmount,
            createdBy: currentUser.id,
            approvalStatus: currentUser.role === 'direktor' ? 'onaylandi' as ApprovalStatus : 'onay_bekliyor' as ApprovalStatus,
            approvedBy: currentUser.role === 'direktor' ? roleLabels[currentUser.role] : undefined,
            approvalDate: currentUser.role === 'direktor' ? new Date().toISOString() : undefined,
            paidAmount: 0,
            paymentStatus: 'odenmedi' as PaymentStatus,
          };
          const newH = await addSubcontractorHakedis(data);
          await addActivityLog(
            'hakedis_created',
            `${newH.hakedisNo} Sözleşmesiz Küçük Hakediş oluşturuldu`,
            `Altyüklenici: ${effectiveSub} - Tutar: ${formatCurrencyWithType(totalAmount, rowCurrency)}${projectLabel ? ` - Proje: ${projectLabel}` : ''}`,
            newH.id,
            'hakedis'
          );
          createdCount++;
        } else {
          // contract-based
          const contract = workEntries.find(e => e.id === row.contractId)!;
          const prefix = row.hakedisType === 'alelhesap' ? 'AH' : row.hakedisType === 'kesin_hesap' ? 'KH' : 'H';
          const existingNos = subcontractorHakedisler
            .filter(h => h.contractId === row.contractId && h.hakedisNo?.includes(`-${prefix}`))
            .map(h => {
              const m = h.hakedisNo.match(new RegExp(`-${prefix}(\\d+)$`));
              return m ? parseInt(m[1], 10) : 0;
            });
          const nextNum = existingNos.length > 0 ? Math.max(...existingNos) + 1 : 1;
          const hakedisNo = `${contract.contractNo}-${prefix}${String(nextNum).padStart(2, '0')}`;

          const data = {
            hakedisNo,
            hakedisType: row.hakedisType,
            projectId: row.projectId,
            subcontractor: effectiveSub,
            contractId: row.contractId,
            contractNo: contract.contractNo,
            contractType: contract.contractType,
            currency: row.currency,
            vatRate: row.vatRate !== '' ? Number(row.vatRate) : undefined,
            date: row.date,
            description: row.description || undefined,
            paymentAmount: (row.hakedisType === 'alelhesap' || contract.contractType === 'goturu_bedel')
              ? (parseFloat(row.amount) || 0) : undefined,
            hakedisItems: (row.hakedisType !== 'alelhesap' && contract.contractType === 'birim_fiyat')
              ? row.hakedisItems.filter(i => i.quantity > 0) : undefined,
            extraItems: row.extraItems.length > 0 ? row.extraItems : undefined,
            totalAmount,

            createdBy: currentUser.id,
            approvalStatus: currentUser.role === 'direktor' ? 'onaylandi' as ApprovalStatus : 'onay_bekliyor' as ApprovalStatus,
            approvedBy: currentUser.role === 'direktor' ? roleLabels[currentUser.role] : undefined,
            approvalDate: currentUser.role === 'direktor' ? new Date().toISOString() : undefined,
            paidAmount: 0,
            paymentStatus: 'odenmedi' as PaymentStatus,
          };
          const newH = await addSubcontractorHakedis(data);
          await addActivityLog(
            'hakedis_created',
            `${newH.hakedisNo} ${hakedisTypeLabels[row.hakedisType]} oluşturuldu`,
            `Altyüklenici: ${effectiveSub} - Tutar: ${formatCurrencyWithType(totalAmount, row.currency)}`,
            newH.id,
            'hakedis'
          );
          createdCount++;
        }
      }

      toast.success(createdCount > 1 ? `${createdCount} hakediş oluşturuldu` : 'Hakediş oluşturuldu');
      onOpenChange(false);
    } catch (e: any) {
      console.error(e);
      toast.error(`Hakediş kaydedilemedi: ${e?.message || 'Bilinmeyen hata'}`);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Yeni Hakediş Kaydı</DialogTitle>
        </DialogHeader>

        <div className="space-y-5">
          {/* Subcontractor first */}
          <div className="space-y-2 p-4 rounded-lg border bg-muted/30">
            <Label className="text-sm font-semibold">1. Altyüklenici Seçin</Label>
            <Select value={subMode} onValueChange={(v: 'existing' | 'custom') => {
              setSubMode(v); setSubcontractor(''); setCustomSubcontractor('');
              setRows([makeRow()]);
            }}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="existing">Mevcut Altyüklenici</SelectItem>
                <SelectItem value="custom">Yeni Altyüklenici</SelectItem>
              </SelectContent>
            </Select>
            {subMode === 'existing' ? (
              <Select value={subcontractor} onValueChange={(v) => { setSubcontractor(v); setRows([makeRow()]); }}>
                <SelectTrigger><SelectValue placeholder="Altyüklenici seçin" /></SelectTrigger>
                <SelectContent>
                  {allSubcontractorNames.map(n => (
                    <SelectItem key={n} value={n}>{n}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <Input
                placeholder="Yeni altyüklenici adı"
                value={customSubcontractor}
                onChange={e => setCustomSubcontractor(e.target.value)}
              />
            )}
          </div>

          {/* Project rows */}
          {effectiveSub && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-semibold">
                  2. Projeler <span className="text-xs text-muted-foreground font-normal">
                    (Birden fazla projede aynı anda hakediş girebilirsiniz)
                  </span>
                </Label>
                <Button type="button" variant="outline" size="sm"
                  onClick={() => setRows(prev => [...prev, makeRow()])} className="gap-1">
                  <Plus className="h-3.5 w-3.5" /> Proje Ekle
                </Button>
              </div>

              {rows.map((row, idx) => {
                const availableContracts = getAvailableContracts(row.projectId);
                const contract = workEntries.find(e => e.id === row.contractId);
                const { base, total, currency } = computeRowTotal(row);
                const vr = row.vatRate !== '' ? Number(row.vatRate) : 0;
                const vatAmount = vr > 0 ? base * (vr / 100) : 0;

                return (
                  <div key={row.id} className="rounded-lg border p-4 space-y-3 bg-background">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-muted-foreground">Proje {idx + 1}</span>
                      {rows.length > 1 && (
                        <Button type="button" variant="ghost" size="sm"
                          onClick={() => setRows(prev => prev.filter(r => r.id !== row.id))}
                          className="h-7 px-2 text-destructive">
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>

                    {/* Project select */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="space-y-2">
                        <Label className="text-xs">Proje Modu</Label>
                        <Select value={row.projectMode} onValueChange={(v: 'existing' | 'custom') =>
                          updateRow(row.id, { projectMode: v, projectId: '', projectName: '', contractId: '', rowMode: v === 'custom' ? 'small' : 'contract', hakedisItems: [], extraItems: [] })
                        }>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="existing">Mevcut Proje</SelectItem>
                            <SelectItem value="custom">Küçük İş (Serbest Giriş)</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs">Proje</Label>
                        {row.projectMode === 'existing' ? (
                          <Select value={row.projectId} onValueChange={(v) => {
                            const contracts = workEntries.filter(e => e.projectId === v && e.subcontractor === effectiveSub);
                            updateRow(row.id, {
                              projectId: v,
                              contractId: '',
                              rowMode: contracts.length > 0 ? 'contract' : 'small',
                              hakedisItems: [],
                              extraItems: [],
                            });
                          }}>
                            <SelectTrigger><SelectValue placeholder="Proje seçin" /></SelectTrigger>
                            <SelectContent>
                              {projectsForSub.map(p => (
                                <SelectItem key={p.id} value={p.id}>
                                  {p.projectCode} - {p.projectName}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        ) : (
                          <Input
                            placeholder="Proje / iş adı"
                            value={row.projectName}
                            onChange={e => updateRow(row.id, { projectName: e.target.value })}
                          />
                        )}
                      </div>
                    </div>

                    {/* Contract selection or small mode */}
                    {row.projectMode === 'existing' && row.projectId && (
                      <>
                        {availableContracts.length > 0 ? (
                          <div className="space-y-2">
                            <Label className="text-xs">Sözleşme</Label>
                            <Select
                              value={row.rowMode === 'small' ? '__small__' : row.contractId}
                              onValueChange={(v) => {
                                if (v === '__small__') {
                                  updateRow(row.id, { rowMode: 'small', contractId: '', hakedisItems: [], extraItems: [] });
                                } else {
                                  updateRow(row.id, { rowMode: 'contract' });
                                  handleContractSelect(row.id, v);
                                }
                              }}
                            >
                              <SelectTrigger><SelectValue placeholder="Sözleşme seçin" /></SelectTrigger>
                              <SelectContent>
                                {availableContracts.map(c => (
                                  <SelectItem key={c.id} value={c.id}>
                                    {c.contractNo} - {c.workCategory} ({contractTypeLabels[c.contractType]})
                                  </SelectItem>
                                ))}
                                <SelectItem value="__small__">— Sözleşmesiz (Küçük Hakediş) —</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        ) : (
                          <div className="text-xs text-muted-foreground bg-muted/50 rounded px-3 py-2">
                            Bu projede bu altyüklenici için sözleşme yok. Sözleşmesiz küçük hakediş olarak girilecek.
                          </div>
                        )}
                      </>
                    )}

                    {/* Hakediş Type for contract mode */}
                    {row.rowMode === 'contract' && row.contractId && contract && (
                      <div className="space-y-2">
                        <Label className="text-xs">Hakediş Tipi</Label>
                        <Select value={row.hakedisType} onValueChange={(v: HakedisRecordType) =>
                          updateRow(row.id, { hakedisType: v })
                        }>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="ara_hakedis">Ara Hakediş</SelectItem>
                            <SelectItem value="alelhesap">Alelhesap (Avans)</SelectItem>
                            {contract.contractType === 'birim_fiyat' && (
                              <SelectItem value="kesin_hesap">Kesin Hesap</SelectItem>
                            )}
                          </SelectContent>
                        </Select>
                      </div>
                    )}

                    {/* Date + Currency + VAT */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div className="space-y-2">
                        <Label className="text-xs">Tarih</Label>
                        <Input type="date" value={row.date}
                          onChange={e => updateRow(row.id, { date: e.target.value })} />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs">Para Birimi</Label>
                        <Select value={row.currency} onValueChange={(v: Currency) => updateRow(row.id, { currency: v })}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="TRY">{currencySymbols.TRY} TRY</SelectItem>
                            <SelectItem value="USD">{currencySymbols.USD} USD</SelectItem>
                            <SelectItem value="EUR">{currencySymbols.EUR} EUR</SelectItem>
                            <SelectItem value="GBP">{currencySymbols.GBP} GBP</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs">KDV Oranı (%)</Label>
                        <div className="flex items-center gap-2">
                          <Input type="number" className="w-20" value={row.vatRate}
                            onChange={e => updateRow(row.id, { vatRate: e.target.value })}
                            min="0" step="1" />
                          <div className="flex items-center gap-1.5">
                            <Checkbox id={`vat-inc-${row.id}`} checked={row.vatInclusive}
                              onCheckedChange={(c) => updateRow(row.id, { vatInclusive: c === true })} />
                            <Label htmlFor={`vat-inc-${row.id}`} className="text-xs cursor-pointer">Dahil</Label>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Description */}
                    <div className="space-y-2">
                      <Label className="text-xs">Genel Açıklama (opsiyonel)</Label>
                      <Textarea rows={2} value={row.description}
                        onChange={e => updateRow(row.id, { description: e.target.value })}
                        placeholder="Hakediş açıklaması" />
                    </div>

                    {/* Amount input for contract götürü/alelhesap */}
                    {row.rowMode === 'contract' && contract &&
                      (row.hakedisType === 'alelhesap' || contract.contractType === 'goturu_bedel') && (
                      <div className="space-y-2">
                        <Label className="text-xs">Tutar ({currency})</Label>
                        <Input type="number" placeholder="0.00" value={row.amount}
                          onChange={e => updateRow(row.id, { amount: e.target.value })}
                          min="0" step="0.01" />
                      </div>
                    )}

                    {/* Small mode item table */}
                    {row.rowMode === 'small' && (
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <Label className="text-xs">İş Kalemleri</Label>
                          <Button type="button" variant="outline" size="sm" className="h-7 gap-1 text-xs"
                            onClick={() => updateRow(row.id, { smallItems: [...row.smallItems, makeSmallItem()] })}>
                            <Plus className="h-3 w-3" /> Kalem Ekle
                          </Button>
                        </div>
                        <div className="rounded border overflow-hidden">
                          <table className="w-full text-xs">
                            <thead className="bg-muted/50">
                              <tr>
                                <th className="text-left p-2">Açıklama</th>
                                <th className="text-left p-2 w-20">Birim</th>
                                <th className="text-right p-2 w-24">Birim Fiyat</th>
                                <th className="text-right p-2 w-20">Miktar</th>
                                <th className="text-right p-2 w-28">Tutar</th>
                                <th className="w-8"></th>
                              </tr>
                            </thead>
                            <tbody>
                              {row.smallItems.map((item, sIdx) => {
                                const updateItem = (patch: Partial<SmallItem>) => {
                                  const updated = { ...item, ...patch };
                                  updated.amount = (updated.quantity || 0) * (updated.unitPrice || 0);
                                  updateRow(row.id, {
                                    smallItems: row.smallItems.map((it, i) => i === sIdx ? updated : it),
                                  });
                                };
                                return (
                                  <tr key={item.id} className="border-t">
                                    <td className="p-1.5">
                                      <Input value={item.description} placeholder="İş açıklaması"
                                        className="h-7 text-xs"
                                        onChange={e => updateItem({ description: e.target.value })} />
                                    </td>
                                    <td className="p-1.5">
                                      <Input value={item.unit} placeholder="adet"
                                        className="h-7 text-xs"
                                        onChange={e => updateItem({ unit: e.target.value })} />
                                    </td>
                                    <td className="p-1.5">
                                      <Input type="number" value={item.unitPrice || ''} min="0" step="0.01"
                                        className="h-7 text-xs text-right"
                                        onChange={e => updateItem({ unitPrice: parseFloat(e.target.value) || 0 })} />
                                    </td>
                                    <td className="p-1.5">
                                      <Input type="number" value={item.quantity || ''} min="0" step="0.01"
                                        className="h-7 text-xs text-right"
                                        onChange={e => updateItem({ quantity: parseFloat(e.target.value) || 0 })} />
                                    </td>
                                    <td className="p-1.5 text-right font-medium">
                                      {formatCurrencyWithType(item.amount, currency)}
                                    </td>
                                    <td className="p-1.5">
                                      {row.smallItems.length > 1 && (
                                        <Button type="button" variant="ghost" size="sm"
                                          className="h-6 w-6 p-0 text-destructive"
                                          onClick={() => updateRow(row.id, {
                                            smallItems: row.smallItems.filter((_, i) => i !== sIdx),
                                          })}>
                                          <Trash2 className="h-3 w-3" />
                                        </Button>
                                      )}
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}

                    {/* Birim fiyat items table */}
                    {row.rowMode === 'contract' && contract?.contractType === 'birim_fiyat' &&
                      row.hakedisType !== 'alelhesap' && row.hakedisItems.length > 0 && (
                      <div className="space-y-2">
                        <Label className="text-xs">İş Kalemleri (Miktar Girin)</Label>
                        <div className="rounded border overflow-hidden">
                          <table className="w-full text-xs">
                            <thead className="bg-muted/50">
                              <tr>
                                <th className="text-left p-2">Açıklama</th>
                                <th className="text-left p-2 w-16">Birim</th>
                                <th className="text-right p-2 w-24">Birim Fiyat</th>
                                <th className="text-right p-2 w-24">Miktar</th>
                                <th className="text-right p-2 w-28">Tutar</th>
                              </tr>
                            </thead>
                            <tbody>
                              {row.hakedisItems.map(item => (
                                <tr key={item.id} className="border-t">
                                  <td className="p-2">{item.description}</td>
                                  <td className="p-2">{item.unit}</td>
                                  <td className="p-2 text-right">{formatCurrencyWithType(item.unitPrice, currency)}</td>
                                  <td className="p-2">
                                    <Input type="number" value={item.quantity || ''} min="0" step="0.01"
                                      className="h-7 text-right text-xs"
                                      onChange={e => updateHakedisItemQty(row.id, item.id, parseFloat(e.target.value) || 0)} />
                                  </td>
                                  <td className="p-2 text-right font-medium">{formatCurrencyWithType(item.amount, currency)}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}

                    {/* Summary */}
                    {base > 0 && (
                      <div className="rounded border bg-muted/30 p-2.5 space-y-1 text-xs">
                        <div className="flex justify-between"><span className="text-muted-foreground">KDV Hariç</span>
                          <span>{formatCurrencyWithType(base, currency)}</span></div>
                        {vr > 0 && (
                          <div className="flex justify-between"><span className="text-muted-foreground">KDV (%{vr})</span>
                            <span>{formatCurrencyWithType(vatAmount, currency)}</span></div>
                        )}
                        <div className="flex justify-between font-semibold border-t pt-1">
                          <span>KDV Dahil Toplam</span>
                          <span className="text-primary">{formatCurrencyWithType(total, currency)}</span>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>İptal</Button>
          <Button onClick={handleSubmit} disabled={submitting || !effectiveSub}>
            {submitting ? 'Kaydediliyor...' : 'Hakediş Oluştur'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
