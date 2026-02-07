import { useState, useMemo } from 'react';
import { MainLayout } from '@/components/MainLayout';
import { StatusBadge } from '@/components/StatusBadge';
import { SortableTableHeader, useSorting } from '@/components/SortableTableHeader';
import { useHakedisStore } from '@/store/hakedisStore';
import { 
  formatCurrencyWithType, 
  formatDate, 
  contractTypeLabels,
  currencySymbols,
  SubcontractorHakedis as HakedisType,
  HakedisItem,
  Currency
} from '@/types/hakedis';
import { generateHakedisPDF } from '@/utils/pdfGenerator';
import { 
  Plus, 
  Search, 
  FileText,
  Calculator,
  Receipt,
  Eye,
  Trash2,
  Pencil
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { toast } from 'sonner';

export default function SubcontractorHakedis() {
  const { 
    projects, 
    workEntries,
    subcontractorHakedisler,
    addSubcontractorHakedis,
    updateSubcontractorHakedis,
    deleteSubcontractorHakedis,
    currentUser,
    addActivityLog
  } = useHakedisStore();
  
  const [searchQuery, setSearchQuery] = useState('');
  const [filterProject, setFilterProject] = useState<string>('all');
  const { sortConfig, handleSort } = useSorting({ key: 'createdAt', direction: 'desc' });
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isDetailDialogOpen, setIsDetailDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [editingHakedisId, setEditingHakedisId] = useState<string | null>(null);
  const [selectedHakedis, setSelectedHakedis] = useState<HakedisType | null>(null);
  
  // Form state
  const [selectedProjectId, setSelectedProjectId] = useState('');
  const [selectedSubcontractor, setSelectedSubcontractor] = useState('');
  const [selectedContractId, setSelectedContractId] = useState('');
  const [paymentAmount, setPaymentAmount] = useState('');
  const [hakedisItems, setHakedisItems] = useState<HakedisItem[]>([]);
  const [hakedisDate, setHakedisDate] = useState(new Date().toISOString().split('T')[0]);
  const [vatRate, setVatRate] = useState<string>('');

  // Get unique subcontractors from contracts
  const contractSubcontractors = useMemo(() => {
    const subs = new Set<string>();
    workEntries.forEach(entry => {
      if (entry.projectId === selectedProjectId) {
        subs.add(entry.subcontractor);
      }
    });
    return Array.from(subs).sort();
  }, [workEntries, selectedProjectId]);

  // Get contracts for selected project and subcontractor
  const availableContracts = useMemo(() => {
    return workEntries.filter(entry => 
      entry.projectId === selectedProjectId && 
      entry.subcontractor === selectedSubcontractor
    );
  }, [workEntries, selectedProjectId, selectedSubcontractor]);

  // Get selected contract details
  const selectedContract = useMemo(() => {
    return workEntries.find(e => e.id === selectedContractId);
  }, [workEntries, selectedContractId]);

  // Calculate already paid amount for götürü bedel
  const paidAmountForContract = useMemo(() => {
    if (!selectedContractId) return 0;
    return subcontractorHakedisler
      .filter(h => h.contractId === selectedContractId)
      .reduce((sum, h) => sum + h.totalAmount, 0);
  }, [subcontractorHakedisler, selectedContractId]);

  // Calculate remaining amount for götürü bedel
  const remainingAmount = useMemo(() => {
    if (!selectedContract) return 0;
    return selectedContract.totalAmount - paidAmountForContract;
  }, [selectedContract, paidAmountForContract]);

  // Calculate totals for birim fiyat
  const birimFiyatTotal = useMemo(() => {
    return hakedisItems.reduce((sum, item) => sum + item.amount, 0);
  }, [hakedisItems]);

  // Filtered hakedisler
  const filteredHakedisler = subcontractorHakedisler.filter(hakedis => {
    const project = projects.find(p => p.id === hakedis.projectId);
    const matchesSearch = 
      hakedis.subcontractor.toLowerCase().includes(searchQuery.toLowerCase()) ||
      hakedis.contractNo.toLowerCase().includes(searchQuery.toLowerCase()) ||
      hakedis.hakedisNo.toLowerCase().includes(searchQuery.toLowerCase()) ||
      project?.projectName.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesProject = filterProject === 'all' || hakedis.projectId === filterProject;
    return matchesSearch && matchesProject;
  });

  const sortedHakedisler = useMemo(() => {
    const sorted = [...filteredHakedisler];
    if (!sortConfig.key || !sortConfig.direction) {
      return sorted.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    }
    
    return sorted.sort((a, b) => {
      const projectA = projects.find(p => p.id === a.projectId);
      const projectB = projects.find(p => p.id === b.projectId);
      
      let comparison = 0;
      switch (sortConfig.key) {
        case 'hakedisNo':
          comparison = a.hakedisNo.localeCompare(b.hakedisNo);
          break;
        case 'project':
          comparison = (projectA?.projectCode || '').localeCompare(projectB?.projectCode || '');
          break;
        case 'subcontractor':
          comparison = a.subcontractor.localeCompare(b.subcontractor, 'tr');
          break;
        case 'workCategory': {
          const contractA = workEntries.find(e => e.id === a.contractId);
          const contractB = workEntries.find(e => e.id === b.contractId);
          comparison = (contractA?.workCategory || '').localeCompare(contractB?.workCategory || '', 'tr');
          break;
        }
        case 'date':
          comparison = new Date(a.date).getTime() - new Date(b.date).getTime();
          break;
        case 'totalAmount':
          comparison = a.totalAmount - b.totalAmount;
          break;
        case 'approvalStatus':
          comparison = a.approvalStatus.localeCompare(b.approvalStatus);
          break;
        case 'paymentStatus':
          comparison = a.paymentStatus.localeCompare(b.paymentStatus);
          break;
        default:
          comparison = 0;
      }
      
      return sortConfig.direction === 'asc' ? comparison : -comparison;
    });
  }, [filteredHakedisler, sortConfig, projects]);

  const resetForm = () => {
    setSelectedProjectId('');
    setSelectedSubcontractor('');
    setSelectedContractId('');
    setPaymentAmount('');
    setHakedisItems([]);
    setHakedisDate(new Date().toISOString().split('T')[0]);
    setVatRate('');
    setIsEditMode(false);
    setEditingHakedisId(null);
  };

  const handleContractSelect = (contractId: string) => {
    setSelectedContractId(contractId);
    const contract = workEntries.find(e => e.id === contractId);
    if (contract && contract.contractType === 'birim_fiyat' && contract.workItemEntries) {
      // Initialize hakediş items from contract work items
      const items: HakedisItem[] = contract.workItemEntries.map(item => ({
        id: crypto.randomUUID(),
        workItemEntryId: item.id,
        workCategory: item.workCategory,
        description: item.description,
        unit: item.unit,
        unitPrice: item.unitPrice,
        quantity: 0,
        amount: 0
      }));
      setHakedisItems(items);
    } else {
      setHakedisItems([]);
    }
    setPaymentAmount('');
  };

  const updateHakedisItemQuantity = (itemId: string, quantity: number) => {
    setHakedisItems(items => items.map(item => {
      if (item.id === itemId) {
        return {
          ...item,
          quantity,
          amount: quantity * item.unitPrice
        };
      }
      return item;
    }));
  };

  const handleEditHakedis = (hakedis: HakedisType) => {
    // Only allow editing for pending approval hakedis
    if (hakedis.approvalStatus !== 'onay_bekliyor') {
      toast.error('Sadece onay bekleyen hakedişler düzenlenebilir');
      return;
    }

    const contract = workEntries.find(e => e.id === hakedis.contractId);
    if (!contract) return;

    setSelectedProjectId(hakedis.projectId);
    setSelectedSubcontractor(hakedis.subcontractor);
    setSelectedContractId(hakedis.contractId);
    setHakedisDate(hakedis.date);
    setVatRate(hakedis.vatRate !== undefined ? String(hakedis.vatRate) : '');
    
    if (contract.contractType === 'goturu_bedel') {
      setPaymentAmount(String(hakedis.totalAmount));
    } else if (hakedis.hakedisItems) {
      // For birim fiyat, restore the items with their quantities
      if (contract.workItemEntries) {
        const items: HakedisItem[] = contract.workItemEntries.map(item => {
          const existingItem = hakedis.hakedisItems?.find(hi => hi.workItemEntryId === item.id);
          return {
            id: existingItem?.id || crypto.randomUUID(),
            workItemEntryId: item.id,
            workCategory: item.workCategory,
            description: item.description,
            unit: item.unit,
            unitPrice: item.unitPrice,
            quantity: existingItem?.quantity || 0,
            amount: existingItem?.amount || 0
          };
        });
        setHakedisItems(items);
      }
    }

    setIsEditMode(true);
    setEditingHakedisId(hakedis.id);
    setIsDetailDialogOpen(false);
    setIsDialogOpen(true);
  };

  const handleSubmit = () => {
    if (!selectedProjectId || !selectedSubcontractor || !selectedContractId) {
      toast.error('Lütfen tüm alanları doldurun');
      return;
    }

    const contract = workEntries.find(e => e.id === selectedContractId);
    if (!contract) return;

    let totalAmount = 0;
    if (contract.contractType === 'goturu_bedel') {
      totalAmount = parseFloat(paymentAmount) || 0;
      if (totalAmount <= 0) {
        toast.error('Lütfen geçerli bir ödeme tutarı girin');
        return;
      }
      // For edit mode, add current hakedis amount back to remaining
      const currentHakedisAmount = isEditMode && editingHakedisId 
        ? subcontractorHakedisler.find(h => h.id === editingHakedisId)?.totalAmount || 0 
        : 0;
      const adjustedRemaining = remainingAmount + currentHakedisAmount;
      if (totalAmount > adjustedRemaining) {
        toast.error('Ödeme tutarı kalan tutardan fazla olamaz');
        return;
      }
    } else {
      totalAmount = birimFiyatTotal;
      if (totalAmount <= 0) {
        toast.error('Lütfen en az bir kalem için miktar girin');
        return;
      }
    }

    if (isEditMode && editingHakedisId) {
      // Update existing hakedis
      updateSubcontractorHakedis(editingHakedisId, {
        vatRate: vatRate !== '' ? Number(vatRate) : undefined,
        date: hakedisDate,
        paymentAmount: contract.contractType === 'goturu_bedel' ? totalAmount : undefined,
        hakedisItems: contract.contractType === 'birim_fiyat' ? hakedisItems.filter(i => i.quantity > 0) : undefined,
        totalAmount,
      });
      addActivityLog(
        'hakedis_updated',
        `Hakediş güncellendi`,
        `Tutar: ${formatCurrencyWithType(totalAmount, contract.currency)}`,
        editingHakedisId,
        'hakedis'
      );
      toast.success('Hakediş güncellendi');
    } else {
      // Generate hakediş number
      const hakedisCount = subcontractorHakedisler.filter(h => h.contractId === selectedContractId).length;
      const hakedisNo = `${contract.contractNo}-H${(hakedisCount + 1).toString().padStart(2, '0')}`;

      const newHakedis: HakedisType = {
        id: crypto.randomUUID(),
        hakedisNo,
        projectId: selectedProjectId,
        subcontractor: selectedSubcontractor,
        contractId: selectedContractId,
        contractNo: contract.contractNo,
        contractType: contract.contractType,
        currency: contract.currency,
        vatRate: vatRate !== '' ? Number(vatRate) : undefined,
        date: hakedisDate,
        paymentAmount: contract.contractType === 'goturu_bedel' ? totalAmount : undefined,
        hakedisItems: contract.contractType === 'birim_fiyat' ? hakedisItems.filter(i => i.quantity > 0) : undefined,
        totalAmount,
        createdBy: currentUser.id,
        approvalStatus: 'onay_bekliyor',
        paymentStatus: 'odenmedi',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      addSubcontractorHakedis(newHakedis);
      addActivityLog(
        'hakedis_created',
        `${newHakedis.hakedisNo} hakediş oluşturuldu`,
        `Altyüklenici: ${newHakedis.subcontractor} - Tutar: ${formatCurrencyWithType(newHakedis.totalAmount, newHakedis.currency)}`,
        newHakedis.id,
        'hakedis'
      );
      toast.success('Hakediş kaydı oluşturuldu');
    }
    
    setIsDialogOpen(false);
    resetForm();
  };

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-foreground">Altyüklenici Hakedişleri</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Altyüklenici sözleşmelerine ait hakediş kayıtları
            </p>
          </div>
          <Button onClick={() => setIsDialogOpen(true)} className="gap-2">
            <Plus className="h-4 w-4" />
            Yeni Hakediş
          </Button>
        </div>

        {/* Filters */}
        <div className="flex flex-col gap-4 sm:flex-row">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Hakediş ara..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={filterProject} onValueChange={setFilterProject}>
            <SelectTrigger className="w-full sm:w-56">
              <SelectValue placeholder="Proje Seç" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tüm Projeler</SelectItem>
              {projects.map((project) => (
                <SelectItem key={project.id} value={project.id}>
                  {project.projectCode} - {project.projectName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Hakedisler Table */}
        <div className="card-elevated overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b bg-muted/50">
                  <SortableTableHeader label="Hakediş No" sortKey="hakedisNo" currentSort={sortConfig} onSort={handleSort} />
                  <SortableTableHeader label="Proje" sortKey="project" currentSort={sortConfig} onSort={handleSort} />
                  <SortableTableHeader label="Altyüklenici" sortKey="subcontractor" currentSort={sortConfig} onSort={handleSort} />
                  <SortableTableHeader label="İş Kalemi" sortKey="workCategory" currentSort={sortConfig} onSort={handleSort} />
                  <SortableTableHeader label="Tarih" sortKey="date" currentSort={sortConfig} onSort={handleSort} />
                  <SortableTableHeader label="Tutar" sortKey="totalAmount" currentSort={sortConfig} onSort={handleSort} align="right" />
                  <SortableTableHeader label="Onay Durumu" sortKey="approvalStatus" currentSort={sortConfig} onSort={handleSort} align="center" />
                  <SortableTableHeader label="Ödeme Durumu" sortKey="paymentStatus" currentSort={sortConfig} onSort={handleSort} align="center" />
                  <th className="px-4 py-3 text-center text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    İşlemler
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y">
                <AnimatePresence>
                {sortedHakedisler.map((hakedis) => {
                    const project = projects.find(p => p.id === hakedis.projectId);
                    const contract = workEntries.find(e => e.id === hakedis.contractId);
                    const workCategory = contract?.workCategory || '-';
                    
                    return (
                      <motion.tr
                        key={hakedis.id}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="group hover:bg-muted/30"
                      >
                        <td className="px-4 py-4">
                          <p className="font-medium text-foreground">
                            {hakedis.hakedisNo}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {contractTypeLabels[hakedis.contractType]}
                          </p>
                        </td>
                        <td className="px-4 py-4">
                          <p className="text-sm font-medium text-foreground">
                            {project?.projectCode}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {project?.projectName}
                          </p>
                        </td>
                        <td className="px-4 py-4 text-sm text-foreground">
                          {hakedis.subcontractor}
                        </td>
                        <td className="px-4 py-4 text-sm text-foreground">
                          {workCategory}
                        </td>
                        <td className="px-4 py-4 text-sm text-muted-foreground">
                          {formatDate(hakedis.date)}
                        </td>
                        <td className="px-4 py-4 text-right">
                          <p className="text-sm font-semibold text-foreground">
                            {formatCurrencyWithType(hakedis.totalAmount, hakedis.currency)}
                          </p>
                        </td>
                        <td className="px-4 py-4 text-center">
                          <StatusBadge status={hakedis.approvalStatus} />
                        </td>
                        <td className="px-4 py-4 text-center">
                          <StatusBadge status={hakedis.paymentStatus} />
                        </td>
                        <td className="px-4 py-4">
                          <div className="flex items-center justify-center gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setSelectedHakedis(hakedis);
                                setIsDetailDialogOpen(true);
                              }}
                              title="Detay"
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            {hakedis.approvalStatus === 'onay_bekliyor' && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleEditHakedis(hakedis)}
                                title="Düzenle"
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                            )}
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={async () => {
                                try {
                                  const project = projects.find(p => p.id === hakedis.projectId);
                                  const contract = workEntries.find(e => e.id === hakedis.contractId);
                                  await generateHakedisPDF(hakedis, project, contract, subcontractorHakedisler);
                                  toast.success('PDF rapor indirildi');
                                } catch (error) {
                                  toast.error('PDF oluşturulamadı');
                                }
                              }}
                              title="PDF Rapor"
                            >
                              <FileText className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setSelectedHakedis(hakedis);
                                setIsDeleteDialogOpen(true);
                              }}
                              title="Sil"
                              className="text-destructive hover:text-destructive"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </td>
                      </motion.tr>
                    );
                  })}
                </AnimatePresence>
              </tbody>
            </table>
          </div>

          {sortedHakedisler.length === 0 && (
            <div className="p-12 text-center">
              <Receipt className="mx-auto h-12 w-12 text-muted-foreground/50" />
              <h3 className="mt-4 text-lg font-medium text-foreground">Hakediş kaydı bulunamadı</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                Yeni hakediş kaydı eklemek için yukarıdaki butonu kullanın.
              </p>
            </div>
          )}
        </div>

        {/* New Hakedis Dialog */}
        <Dialog open={isDialogOpen} onOpenChange={(open) => {
          if (!open) resetForm();
          setIsDialogOpen(open);
        }}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{isEditMode ? 'Hakediş Düzenle' : 'Yeni Hakediş Kaydı'}</DialogTitle>
            </DialogHeader>
            
            <div className="space-y-6 py-4">
              {/* Project Selection */}
              <div className="space-y-2">
                <Label>Proje</Label>
                <Select 
                  value={selectedProjectId} 
                  onValueChange={(value) => {
                    setSelectedProjectId(value);
                    setSelectedSubcontractor('');
                    setSelectedContractId('');
                  }}
                  disabled={isEditMode}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Proje seçin" />
                  </SelectTrigger>
                  <SelectContent>
                    {projects.filter(p => p.status === 'aktif').map((project) => (
                      <SelectItem key={project.id} value={project.id}>
                        {project.projectCode} - {project.projectName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Subcontractor Selection */}
              {selectedProjectId && (
                <div className="space-y-2">
                  <Label>Altyüklenici</Label>
                  <Select 
                    value={selectedSubcontractor} 
                    onValueChange={(value) => {
                      setSelectedSubcontractor(value);
                      setSelectedContractId('');
                    }}
                    disabled={isEditMode}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Altyüklenici seçin" />
                    </SelectTrigger>
                    <SelectContent>
                      {contractSubcontractors.map((sub) => (
                        <SelectItem key={sub} value={sub}>
                          {sub}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {contractSubcontractors.length === 0 && (
                    <p className="text-xs text-muted-foreground">
                      Bu projede kayıtlı sözleşme bulunmuyor.
                    </p>
                  )}
                </div>
              )}

              {/* Contract Selection */}
              {selectedSubcontractor && (
                <div className="space-y-2">
                  <Label>Sözleşme No</Label>
                  <Select value={selectedContractId} onValueChange={handleContractSelect} disabled={isEditMode}>
                    <SelectTrigger>
                      <SelectValue placeholder="Sözleşme seçin" />
                    </SelectTrigger>
                    <SelectContent>
                      {availableContracts.map((contract) => (
                        <SelectItem key={contract.id} value={contract.id}>
                          {contract.contractNo} - {contract.workCategory} ({contractTypeLabels[contract.contractType]})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Date and VAT Rate */}
              {selectedContractId && (
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Tarih</Label>
                    <Input
                      type="date"
                      value={hakedisDate}
                      onChange={(e) => setHakedisDate(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>KDV Oranı (%)</Label>
                    <Input
                      type="number"
                      placeholder="Örn: 20"
                      min="0"
                      max="100"
                      value={vatRate}
                      onChange={(e) => setVatRate(e.target.value)}
                    />
                  </div>
                </div>
              )}

              {/* Götürü Bedel Payment */}
              {selectedContract?.contractType === 'goturu_bedel' && (
                <div className="space-y-4">
                  <div className="rounded-lg border bg-muted/30 p-4">
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <p className="text-muted-foreground">Sözleşme Tutarı</p>
                        <p className="font-semibold">
                          {formatCurrencyWithType(selectedContract.totalAmount, selectedContract.currency)}
                        </p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Ödenen Toplam</p>
                        <p className="font-semibold text-status-paid">
                          {formatCurrencyWithType(paidAmountForContract, selectedContract.currency)}
                        </p>
                      </div>
                      <div className="col-span-2">
                        <p className="text-muted-foreground">Kalan Tutar</p>
                        <p className="text-lg font-bold text-primary">
                          {formatCurrencyWithType(remainingAmount, selectedContract.currency)}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Ödenecek Tutar ({currencySymbols[selectedContract.currency]})</Label>
                    <Input
                      type="number"
                      placeholder="0.00"
                      value={paymentAmount}
                      onChange={(e) => setPaymentAmount(e.target.value)}
                      max={remainingAmount}
                    />
                    {paymentAmount && (
                      <div className="rounded-lg border bg-accent/50 p-3 text-sm space-y-2">
                        <div className="flex justify-between">
                          <span>Ara Toplam</span>
                          <span className="font-medium">{formatCurrencyWithType(parseFloat(paymentAmount) || 0, selectedContract.currency)}</span>
                        </div>
                        {vatRate !== '' && Number(vatRate) > 0 && (
                          <>
                            <div className="flex justify-between text-muted-foreground">
                              <span>KDV (%{vatRate})</span>
                              <span>{formatCurrencyWithType((parseFloat(paymentAmount) || 0) * Number(vatRate) / 100, selectedContract.currency)}</span>
                            </div>
                            <div className="border-t pt-2 flex justify-between">
                              <span className="font-medium">KDV Dahil Toplam</span>
                              <span className="font-semibold text-primary">
                                {formatCurrencyWithType((parseFloat(paymentAmount) || 0) * (1 + Number(vatRate) / 100), selectedContract.currency)}
                              </span>
                            </div>
                          </>
                        )}
                        {(vatRate === '' || Number(vatRate) === 0) && (
                          <div className="flex justify-between font-semibold">
                            <span>Toplam</span>
                            <span>{formatCurrencyWithType(parseFloat(paymentAmount) || 0, selectedContract.currency)}</span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Birim Fiyat Items */}
              {selectedContract?.contractType === 'birim_fiyat' && hakedisItems.length > 0 && (
                <div className="space-y-4">
                  <Label>İş Kalemleri ve Miktarlar</Label>
                  <div className="space-y-3">
                    {hakedisItems.map((item) => (
                      <div key={item.id} className="rounded-lg border p-3">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1">
                            <p className="font-medium text-sm">{item.workCategory}</p>
                            <p className="text-xs text-muted-foreground">{item.description}</p>
                            <p className="text-xs text-muted-foreground mt-1">
                              Birim Fiyat: {formatCurrencyWithType(item.unitPrice, selectedContract.currency)} / {item.unit}
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            <Input
                              type="number"
                              placeholder="Miktar"
                              className="w-24"
                              value={item.quantity || ''}
                              onChange={(e) => updateHakedisItemQuantity(item.id, parseFloat(e.target.value) || 0)}
                            />
                            <span className="text-sm text-muted-foreground w-12">{item.unit}</span>
                          </div>
                        </div>
                        {item.quantity > 0 && (
                          <div className="mt-2 text-right text-sm font-medium">
                            Tutar: {formatCurrencyWithType(item.amount, selectedContract.currency)}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>

                  {birimFiyatTotal > 0 && (
                    <div className="rounded-lg border bg-accent/50 p-3 text-sm space-y-2">
                      <div className="flex justify-between">
                        <span>Ara Toplam</span>
                        <span className="font-medium">{formatCurrencyWithType(birimFiyatTotal, selectedContract.currency)}</span>
                      </div>
                      {vatRate !== '' && Number(vatRate) > 0 && (
                        <>
                          <div className="flex justify-between text-muted-foreground">
                            <span>KDV (%{vatRate})</span>
                            <span>{formatCurrencyWithType(birimFiyatTotal * Number(vatRate) / 100, selectedContract.currency)}</span>
                          </div>
                          <div className="border-t pt-2 flex justify-between">
                            <span className="font-medium">KDV Dahil Toplam</span>
                            <span className="font-semibold text-primary">
                              {formatCurrencyWithType(birimFiyatTotal * (1 + Number(vatRate) / 100), selectedContract.currency)}
                            </span>
                          </div>
                        </>
                      )}
                      {(vatRate === '' || Number(vatRate) === 0) && (
                        <div className="flex justify-between font-semibold">
                          <span>Toplam</span>
                          <span>{formatCurrencyWithType(birimFiyatTotal, selectedContract.currency)}</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Actions */}
              <div className="flex justify-end gap-3 pt-4">
                <Button variant="outline" onClick={() => {
                  setIsDialogOpen(false);
                  resetForm();
                }}>
                  İptal
                </Button>
                <Button onClick={handleSubmit} disabled={!selectedContractId}>
                  <Calculator className="h-4 w-4 mr-2" />
                  {isEditMode ? 'Güncelle' : 'Hakediş Oluştur'}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Detail Dialog */}
        <Dialog open={isDetailDialogOpen} onOpenChange={setIsDetailDialogOpen}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Hakediş Detayı</DialogTitle>
            </DialogHeader>
            
            {selectedHakedis && (
              <div className="space-y-6 py-4">
                {/* Header Info */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-muted-foreground">Hakediş No</p>
                    <p className="font-medium">{selectedHakedis.hakedisNo}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Sözleşme No</p>
                    <p className="font-medium">{selectedHakedis.contractNo}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Proje</p>
                    <p className="font-medium">
                      {projects.find(p => p.id === selectedHakedis.projectId)?.projectName || '-'}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Altyüklenici</p>
                    <p className="font-medium">{selectedHakedis.subcontractor}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Sözleşme Tipi</p>
                    <p className="font-medium">{contractTypeLabels[selectedHakedis.contractType]}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Tarih</p>
                    <p className="font-medium">{formatDate(selectedHakedis.date)}</p>
                  </div>
                </div>

                {/* Status */}
                <div className="flex gap-4">
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Onay Durumu</p>
                    <StatusBadge status={selectedHakedis.approvalStatus} />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Ödeme Durumu</p>
                    <StatusBadge status={selectedHakedis.paymentStatus} />
                  </div>
                </div>

                {/* Rejection Reason */}
                {selectedHakedis.rejectionReason && (
                  <div className="rounded-lg border border-status-rejected/30 bg-status-rejected-bg p-4">
                    <p className="text-xs text-muted-foreground mb-1">Revize Nedeni</p>
                    <p className="text-sm text-foreground">{selectedHakedis.rejectionReason}</p>
                  </div>
                )}

                {/* Payment Amount for Götürü Bedel */}
                {selectedHakedis.contractType === 'goturu_bedel' && selectedHakedis.paymentAmount && (
                  <div>
                    <p className="text-xs text-muted-foreground mb-2">Ödeme Tutarı</p>
                    <p className="text-lg font-semibold">
                      {formatCurrencyWithType(selectedHakedis.paymentAmount, selectedHakedis.currency)}
                    </p>
                  </div>
                )}

                {/* Hakediş Items for Birim Fiyat */}
                {selectedHakedis.hakedisItems && selectedHakedis.hakedisItems.length > 0 && (
                  <div>
                    <p className="text-xs text-muted-foreground mb-2">Hakediş Kalemleri</p>
                    <div className="rounded-lg border divide-y">
                      {selectedHakedis.hakedisItems.map((item, index) => (
                        <div key={index} className="p-3 flex justify-between items-center">
                          <div>
                            <p className="font-medium text-sm">{item.workCategory}</p>
                            <p className="text-xs text-muted-foreground">{item.description}</p>
                            <p className="text-xs text-muted-foreground">
                              {item.quantity} {item.unit} x {formatCurrencyWithType(item.unitPrice, selectedHakedis.currency)}
                            </p>
                          </div>
                          <p className="font-semibold text-sm">
                            {formatCurrencyWithType(item.amount, selectedHakedis.currency)}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Total and Payment Summary */}
                <div className="rounded-lg bg-muted/50 p-4 space-y-2">
                  <div className="flex justify-between text-sm font-semibold">
                    <span>Bu Hakediş Tutarı</span>
                    <span className="text-primary text-lg">
                      {formatCurrencyWithType(selectedHakedis.totalAmount, selectedHakedis.currency)}
                    </span>
                  </div>
                  {(() => {
                    const contract = workEntries.find(e => e.id === selectedHakedis.contractId);
                    if (!contract) return null;
                    
                    const totalPaid = subcontractorHakedisler
                      .filter(h => h.contractId === selectedHakedis.contractId)
                      .reduce((sum, h) => sum + h.totalAmount, 0);
                    const remainingBalance = contract.totalAmount - totalPaid;
                    
                    return (
                      <>
                        <div className="border-t pt-2 mt-2 space-y-1">
                          <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">Sözleşme Tutarı</span>
                            <span className="font-medium">{formatCurrencyWithType(contract.totalAmount, contract.currency)}</span>
                          </div>
                          <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">Toplam Ödenen</span>
                            <span className="text-green-600 font-medium">{formatCurrencyWithType(totalPaid, contract.currency)}</span>
                          </div>
                          {selectedHakedis.contractType === 'goturu_bedel' && (
                            <div className="flex justify-between text-sm border-t pt-2 mt-1">
                              <span className="font-semibold">Kalan Bakiye</span>
                              <span className={`font-semibold ${remainingBalance > 0 ? 'text-amber-600' : 'text-green-600'}`}>
                                {formatCurrencyWithType(remainingBalance, contract.currency)}
                              </span>
                            </div>
                          )}
                        </div>
                      </>
                    );
                  })()}
                </div>

                {/* Dates */}
                <div className="grid grid-cols-2 gap-4 text-xs text-muted-foreground">
                  <div>
                    <p>Oluşturulma: {formatDate(selectedHakedis.createdAt)}</p>
                  </div>
                  {selectedHakedis.approvalDate && (
                    <div>
                      <p>Onay Tarihi: {formatDate(selectedHakedis.approvalDate)}</p>
                    </div>
                  )}
                  {selectedHakedis.paidDate && (
                    <div>
                      <p>Ödeme Tarihi: {formatDate(selectedHakedis.paidDate)}</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            <DialogFooter className="gap-2">
              <Button
                variant="destructive"
                onClick={() => {
                  setIsDetailDialogOpen(false);
                  setIsDeleteDialogOpen(true);
                }}
                className="gap-2"
              >
                <Trash2 className="h-4 w-4" />
                Sil
              </Button>
              <Button variant="outline" onClick={() => setIsDetailDialogOpen(false)}>
                Kapat
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation Dialog */}
        <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Hakediş Kaydını Sil</AlertDialogTitle>
              <AlertDialogDescription>
                <strong>{selectedHakedis?.hakedisNo}</strong> numaralı hakediş kaydını silmek istediğinizden emin misiniz?
                Bu işlem geri alınamaz.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>İptal</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => {
                  if (selectedHakedis) {
                    deleteSubcontractorHakedis(selectedHakedis.id);
                    toast.success('Hakediş kaydı silindi');
                    setIsDeleteDialogOpen(false);
                    setSelectedHakedis(null);
                  }
                }}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Sil
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </MainLayout>
  );
}
