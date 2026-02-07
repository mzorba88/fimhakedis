import { useState, useMemo } from 'react';
import { MainLayout } from '@/components/MainLayout';
import { StatusBadge } from '@/components/StatusBadge';
import { SortableTableHeader, useSorting, SortConfig } from '@/components/SortableTableHeader';
import { useHakedisStore } from '@/store/hakedisStore';
import { 
  formatCurrencyWithType, 
  formatDate, 
  WorkEntry,
  PaymentInstallment,
  WorkItemEntry,
  workCategories,
  Currency,
  ContractType,
  currencySymbols,
  contractTypeLabels
} from '@/types/hakedis';
import { 
  Plus, 
  Search, 
  ClipboardList,
  Calendar,
  Trash2,
  Upload,
  Eye,
  Pencil,
  FileText,
  ExternalLink
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';

export default function WorkEntries() {
  const { 
    projects, 
    workEntries, 
    addWorkEntry,
    updateWorkEntry,
    deleteWorkEntry,
    getNextContractNo,
    subcontractors,
    addSubcontractor,
    currentUser 
  } = useHakedisStore();
  
  const [searchQuery, setSearchQuery] = useState('');
  const [filterProject, setFilterProject] = useState<string>('all');
  const { sortConfig, handleSort } = useSorting({ key: 'createdAt', direction: 'desc' });
  
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isDetailDialogOpen, setIsDetailDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [selectedEntry, setSelectedEntry] = useState<WorkEntry | null>(null);
  
  // Form state
  const [newEntry, setNewEntry] = useState({
    projectId: '',
    workCategory: '',
    subcontractor: '',
    newSubcontractor: '',
    contractType: 'birim_fiyat' as ContractType,
    date: new Date().toISOString().split('T')[0],
    currency: 'TRY' as Currency,
  });

  // Götürü Bedel - Payment Plan
  const [paymentPlan, setPaymentPlan] = useState<PaymentInstallment[]>([]);

  // Birim Fiyat - Work Items
  const [workItemEntries, setWorkItemEntries] = useState<WorkItemEntry[]>([]);

  const activeProjects = projects.filter(p => p.status === 'aktif');

  const filteredEntries = workEntries.filter(entry => {
    const project = projects.find(p => p.id === entry.projectId);
    const matchesSearch = 
      entry.workCategory.toLowerCase().includes(searchQuery.toLowerCase()) ||
      entry.subcontractor.toLowerCase().includes(searchQuery.toLowerCase()) ||
      project?.projectName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      project?.projectCode.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesProject = filterProject === 'all' || entry.projectId === filterProject;
    return matchesSearch && matchesProject;
  });

  const sortedEntries = useMemo(() => {
    const sorted = [...filteredEntries];
    if (!sortConfig.key || !sortConfig.direction) {
      return sorted.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    }
    
    return sorted.sort((a, b) => {
      const projectA = projects.find(p => p.id === a.projectId);
      const projectB = projects.find(p => p.id === b.projectId);
      
      let comparison = 0;
      switch (sortConfig.key) {
        case 'project':
          comparison = (projectA?.projectCode || '').localeCompare(projectB?.projectCode || '');
          break;
        case 'workCategory':
          comparison = a.workCategory.localeCompare(b.workCategory);
          break;
        case 'subcontractor':
          comparison = a.subcontractor.localeCompare(b.subcontractor);
          break;
        case 'date':
          comparison = new Date(a.date).getTime() - new Date(b.date).getTime();
          break;
        case 'contractNo':
          comparison = a.contractNo.localeCompare(b.contractNo);
          break;
        case 'contractType':
          comparison = a.contractType.localeCompare(b.contractType);
          break;
        case 'totalAmount':
          comparison = a.totalAmount - b.totalAmount;
          break;
        default:
          comparison = 0;
      }
      
      return sortConfig.direction === 'asc' ? comparison : -comparison;
    });
  }, [filteredEntries, sortConfig, projects]);

  const calculateTotals = () => {
    let totalAmount = 0;

    if (newEntry.contractType === 'goturu_bedel') {
      totalAmount = paymentPlan.reduce((sum, p) => sum + p.amount, 0);
    } else {
      totalAmount = workItemEntries.reduce((sum, w) => sum + (w.quantity * w.unitPrice), 0);
    }

    return { totalAmount };
  };

  const addPaymentInstallment = () => {
    setPaymentPlan([
      ...paymentPlan,
      {
        id: `pi${Date.now()}`,
        description: '',
        amount: 0,
        currency: newEntry.currency,
        isPaid: false,
      }
    ]);
  };

  const removePaymentInstallment = (id: string) => {
    setPaymentPlan(paymentPlan.filter(p => p.id !== id));
  };

  const updatePaymentInstallment = (id: string, field: keyof PaymentInstallment, value: any) => {
    setPaymentPlan(paymentPlan.map(p => 
      p.id === id ? { ...p, [field]: value } : p
    ));
  };

  const addWorkItemEntry = () => {
    setWorkItemEntries([
      ...workItemEntries,
      {
        id: `wie${Date.now()}`,
        workCategory: '',
        description: '',
        unit: '',
        quantity: 0,
        unitPrice: 0,
        currency: newEntry.currency,
      }
    ]);
  };

  const removeWorkItemEntry = (id: string) => {
    setWorkItemEntries(workItemEntries.filter(w => w.id !== id));
  };

  const updateWorkItemEntry = (id: string, field: keyof WorkItemEntry, value: any) => {
    setWorkItemEntries(workItemEntries.map(w => 
      w.id === id ? { ...w, [field]: value } : w
    ));
  };

  const handleCreateEntry = () => {
    if (!newEntry.projectId || !newEntry.workCategory) return;

    const selectedSubcontractor = newEntry.subcontractor === 'new' 
      ? newEntry.newSubcontractor 
      : newEntry.subcontractor;

    if (!selectedSubcontractor) return;

    // Add new subcontractor if needed
    if (newEntry.subcontractor === 'new' && newEntry.newSubcontractor) {
      addSubcontractor(newEntry.newSubcontractor);
    }

    const amounts = calculateTotals();

    if (isEditMode && selectedEntry) {
      // Update existing entry
      updateWorkEntry(selectedEntry.id, {
        projectId: newEntry.projectId,
        workCategory: newEntry.workCategory,
        subcontractor: selectedSubcontractor,
        contractType: newEntry.contractType,
        date: newEntry.date,
        currency: newEntry.currency,
        paymentPlan: newEntry.contractType === 'goturu_bedel' ? paymentPlan : undefined,
        workItemEntries: newEntry.contractType === 'birim_fiyat' ? workItemEntries : undefined,
        totalAmount: amounts.totalAmount,
      });
      toast.success('Sözleşme güncellendi');
    } else {
      // Create new entry
      const contractNo = getNextContractNo();

      const entry: WorkEntry = {
        id: `we${Date.now()}`,
        contractNo,
        projectId: newEntry.projectId,
        workCategory: newEntry.workCategory,
        subcontractor: selectedSubcontractor,
        contractType: newEntry.contractType,
        date: newEntry.date,
        currency: newEntry.currency,
        paymentPlan: newEntry.contractType === 'goturu_bedel' ? paymentPlan : undefined,
        workItemEntries: newEntry.contractType === 'birim_fiyat' ? workItemEntries : undefined,
        createdBy: currentUser.id,
        approvalStatus: 'onay_bekliyor',
        totalAmount: amounts.totalAmount,
        paymentStatus: 'odenmedi',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      addWorkEntry(entry);
      toast.success('Sözleşme oluşturuldu');
    }
    
    handleCloseDialog();
  };

  const handleEditEntry = (entry: WorkEntry) => {
    setSelectedEntry(entry);
    setIsEditMode(true);
    setNewEntry({
      projectId: entry.projectId,
      workCategory: entry.workCategory,
      subcontractor: entry.subcontractor,
      newSubcontractor: '',
      contractType: entry.contractType,
      date: entry.date,
      currency: entry.currency,
    });
    setPaymentPlan(entry.paymentPlan || []);
    setWorkItemEntries(entry.workItemEntries || []);
    setIsDetailDialogOpen(false);
    setIsDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    setIsEditMode(false);
    setSelectedEntry(null);
    setNewEntry({
      projectId: '',
      workCategory: '',
      subcontractor: '',
      newSubcontractor: '',
      contractType: 'birim_fiyat',
      date: new Date().toISOString().split('T')[0],
      currency: 'TRY',
    });
    setPaymentPlan([]);
    setWorkItemEntries([]);
  };

  const amounts = calculateTotals();

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-foreground">Altyüklenici Sözleşmeleri</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Tüm altyüklenici sözleşmelerini görüntüleyin ve yönetin
            </p>
          </div>
          <Button onClick={() => setIsDialogOpen(true)} className="gap-2">
            <Plus className="h-4 w-4" />
            Yeni Kayıt
          </Button>
        </div>

        {/* Filters */}
        <div className="flex flex-col gap-4 sm:flex-row">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Kayıt ara..."
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
                  {project.projectCode}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Entries Table */}
        <div className="card-elevated overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b bg-muted/50">
                  <SortableTableHeader label="Proje" sortKey="project" currentSort={sortConfig} onSort={handleSort} />
                  <SortableTableHeader label="İş Kalemi" sortKey="workCategory" currentSort={sortConfig} onSort={handleSort} />
                  <SortableTableHeader label="Altyüklenici" sortKey="subcontractor" currentSort={sortConfig} onSort={handleSort} />
                  <SortableTableHeader label="Tarih" sortKey="date" currentSort={sortConfig} onSort={handleSort} />
                  <SortableTableHeader label="Sözleşme No" sortKey="contractNo" currentSort={sortConfig} onSort={handleSort} />
                  <SortableTableHeader label="Sözleşme Tipi" sortKey="contractType" currentSort={sortConfig} onSort={handleSort} />
                  <SortableTableHeader label="Tutar" sortKey="totalAmount" currentSort={sortConfig} onSort={handleSort} align="right" />
                  <th className="px-4 py-3 text-center text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    İşlem
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y">
                <AnimatePresence>
                  {sortedEntries.map((entry) => {
                    const project = projects.find(p => p.id === entry.projectId);
                    
                    return (
                      <motion.tr
                        key={entry.id}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="group hover:bg-muted/30"
                      >
                        <td className="px-4 py-4">
                          <p className="text-sm font-medium text-foreground">
                            {project?.projectCode}
                          </p>
                          <p className="text-xs text-muted-foreground truncate max-w-[150px]">
                            {project?.projectName}
                          </p>
                        </td>
                        <td className="px-4 py-4">
                          <p className="text-sm font-medium text-foreground truncate max-w-[150px]">
                            {entry.workCategory}
                          </p>
                        </td>
                        <td className="px-4 py-4">
                          <p className="text-sm text-foreground">
                            {entry.subcontractor}
                          </p>
                        </td>
                        <td className="px-4 py-4">
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Calendar className="h-4 w-4" />
                            {formatDate(entry.date)}
                          </div>
                        </td>
                        <td className="px-4 py-4">
                          <p className="text-sm font-medium text-primary">
                            {entry.contractNo}
                          </p>
                        </td>
                        <td className="px-4 py-4">
                          <p className="text-sm text-foreground">
                            {contractTypeLabels[entry.contractType]}
                          </p>
                        </td>
                        <td className="px-4 py-4 text-right">
                          <p className="text-sm font-semibold text-foreground">
                            {formatCurrencyWithType(entry.totalAmount, entry.currency)}
                          </p>
                        </td>
                        <td className="px-4 py-4 text-center">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setSelectedEntry(entry);
                              setIsDetailDialogOpen(true);
                            }}
                            className="gap-1.5"
                          >
                            <Eye className="h-4 w-4" />
                            Detay
                          </Button>
                        </td>
                      </motion.tr>
                    );
                  })}
                </AnimatePresence>
              </tbody>
            </table>
          </div>

          {sortedEntries.length === 0 && (
            <div className="p-12 text-center">
              <ClipboardList className="mx-auto h-12 w-12 text-muted-foreground/50" />
              <h3 className="mt-4 text-lg font-medium text-foreground">Kayıt bulunamadı</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                Arama kriterlerinize uygun yapılan iş kaydı bulunmuyor.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* New Entry Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={handleCloseDialog}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{isEditMode ? 'Sözleşme Düzenle' : 'Yeni Sözleşme Kaydı'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {/* Project Selection */}
            <div className="space-y-2">
              <Label>Proje *</Label>
              <Select
                value={newEntry.projectId}
                onValueChange={(value) => setNewEntry({ ...newEntry, projectId: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Proje seçin" />
                </SelectTrigger>
                <SelectContent>
                  {activeProjects.map((project) => (
                    <SelectItem key={project.id} value={project.id}>
                      {project.projectCode} - {project.projectName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Work Category */}
            <div className="space-y-2">
              <Label>İş Kalemi *</Label>
              <Select
                value={newEntry.workCategory}
                onValueChange={(value) => setNewEntry({ ...newEntry, workCategory: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="İş kalemi seçin" />
                </SelectTrigger>
                <SelectContent>
                  {workCategories.map((category) => (
                    <SelectItem key={category} value={category}>
                      {category}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Subcontractor */}
            <div className="space-y-2">
              <Label>Altyüklenici *</Label>
              <Select
                value={newEntry.subcontractor}
                onValueChange={(value) => setNewEntry({ ...newEntry, subcontractor: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Altyüklenici seçin" />
                </SelectTrigger>
                <SelectContent>
                  {subcontractors.map((sub) => (
                    <SelectItem key={sub} value={sub}>
                      {sub}
                    </SelectItem>
                  ))}
                  <SelectItem value="new">+ Yeni Altyüklenici Ekle</SelectItem>
                </SelectContent>
              </Select>
              {newEntry.subcontractor === 'new' && (
                <Input
                  placeholder="Yeni altyüklenici adı"
                  value={newEntry.newSubcontractor}
                  onChange={(e) => setNewEntry({ ...newEntry, newSubcontractor: e.target.value })}
                  className="mt-2"
                />
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              {/* Contract Type */}
              <div className="space-y-2">
                <Label>Sözleşme Tipi</Label>
                <Select
                  value={newEntry.contractType}
                  onValueChange={(value: ContractType) => {
                    setNewEntry({ ...newEntry, contractType: value });
                    setPaymentPlan([]);
                    setWorkItemEntries([]);
                  }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="goturu_bedel">Götürü Bedel</SelectItem>
                    <SelectItem value="birim_fiyat">Birim Fiyat</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Currency */}
              <div className="space-y-2">
                <Label>Para Birimi</Label>
                <Select
                  value={newEntry.currency}
                  onValueChange={(value: Currency) => setNewEntry({ ...newEntry, currency: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="TRY">TRY (₺)</SelectItem>
                    <SelectItem value="USD">USD ($)</SelectItem>
                    <SelectItem value="EUR">EUR (€)</SelectItem>
                    <SelectItem value="GBP">GBP (£)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Date */}
            <div className="space-y-2">
              <Label>Tarih</Label>
              <Input
                type="date"
                value={newEntry.date}
                onChange={(e) => setNewEntry({ ...newEntry, date: e.target.value })}
              />
            </div>

            {/* Contract File Upload */}
            <div className="space-y-2">
              <Label>Sözleşme Dosyası</Label>
              <div className="border-2 border-dashed rounded-lg p-6 text-center hover:border-primary/50 transition-colors cursor-pointer">
                <Upload className="h-8 w-8 mx-auto text-muted-foreground" />
                <p className="mt-2 text-sm text-muted-foreground">
                  PDF veya resim dosyası yüklemek için tıklayın
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  (Bu özellik için backend gerekli)
                </p>
              </div>
            </div>

            {/* Götürü Bedel - Payment Plan */}
            {newEntry.contractType === 'goturu_bedel' && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label>Ödeme Planı (Taksitler)</Label>
                  <Button type="button" variant="outline" size="sm" onClick={addPaymentInstallment}>
                    <Plus className="h-4 w-4 mr-1" />
                    Taksit Ekle
                  </Button>
                </div>
                {paymentPlan.map((installment, index) => (
                  <div key={installment.id} className="flex gap-2 items-start p-3 bg-muted/30 rounded-lg">
                    <div className="flex-1 grid grid-cols-2 gap-2">
                      <Input
                        placeholder="Açıklama"
                        value={installment.description}
                        onChange={(e) => updatePaymentInstallment(installment.id, 'description', e.target.value)}
                      />
                      <div className="flex gap-2">
                        <Input
                          type="number"
                          placeholder="Tutar"
                          value={installment.amount || ''}
                          onChange={(e) => updatePaymentInstallment(installment.id, 'amount', parseFloat(e.target.value) || 0)}
                        />
                        <span className="flex items-center text-sm text-muted-foreground">
                          {currencySymbols[newEntry.currency]}
                        </span>
                      </div>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => removePaymentInstallment(installment.id)}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                ))}
              </div>
            )}

            {/* Birim Fiyat - Work Items */}
            {newEntry.contractType === 'birim_fiyat' && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label>İş Kalemleri ve Birim Fiyatlar</Label>
                  <Button type="button" variant="outline" size="sm" onClick={addWorkItemEntry}>
                    <Plus className="h-4 w-4 mr-1" />
                    Kalem Ekle
                  </Button>
                </div>
                {workItemEntries.map((item) => (
                  <div key={item.id} className="p-3 bg-muted/30 rounded-lg space-y-2">
                    <div className="flex gap-2">
                      <Input
                        placeholder="Açıklama"
                        value={item.description}
                        onChange={(e) => updateWorkItemEntry(item.id, 'description', e.target.value)}
                        className="flex-1"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => removeWorkItemEntry(item.id)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                    <div className="grid grid-cols-4 gap-2">
                      <Input
                        placeholder="Birim"
                        value={item.unit}
                        onChange={(e) => updateWorkItemEntry(item.id, 'unit', e.target.value)}
                      />
                      <Input
                        type="number"
                        placeholder="Miktar"
                        value={item.quantity || ''}
                        onChange={(e) => updateWorkItemEntry(item.id, 'quantity', parseFloat(e.target.value) || 0)}
                      />
                      <Input
                        type="number"
                        placeholder="Birim Fiyat"
                        value={item.unitPrice || ''}
                        onChange={(e) => updateWorkItemEntry(item.id, 'unitPrice', parseFloat(e.target.value) || 0)}
                      />
                      <div className="flex items-center justify-end text-sm font-medium">
                        {formatCurrencyWithType(item.quantity * item.unitPrice, newEntry.currency)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Amount Preview */}
            {amounts.totalAmount > 0 && (
              <div className="rounded-lg bg-muted/50 p-4">
                <div className="flex justify-between text-sm">
                  <span className="font-medium">Toplam</span>
                  <span className="font-semibold text-primary">{formatCurrencyWithType(amounts.totalAmount, newEntry.currency)}</span>
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={handleCloseDialog}>
              İptal
            </Button>
            <Button onClick={handleCreateEntry}>
              {isEditMode ? 'Güncelle' : 'Kaydet'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Detail Dialog */}
      <Dialog open={isDetailDialogOpen} onOpenChange={setIsDetailDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Sözleşme Detayı</DialogTitle>
          </DialogHeader>
          
          {selectedEntry && (
            <div className="space-y-6 py-4">
              {/* Basic Info */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-muted-foreground">Sözleşme No</p>
                  <p className="text-sm font-medium text-primary">{selectedEntry.contractNo}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Tarih</p>
                  <p className="text-sm font-medium">{formatDate(selectedEntry.date)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Proje</p>
                  <p className="text-sm font-medium">
                    {projects.find(p => p.id === selectedEntry.projectId)?.projectCode} - {projects.find(p => p.id === selectedEntry.projectId)?.projectName}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Sözleşme Tipi</p>
                  <p className="text-sm font-medium">{contractTypeLabels[selectedEntry.contractType]}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">İş Kalemi</p>
                  <p className="text-sm font-medium">{selectedEntry.workCategory}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Altyüklenici</p>
                  <p className="text-sm font-medium">{selectedEntry.subcontractor}</p>
                </div>
              </div>

              {/* Contract File */}
              {selectedEntry.contractFile && (
                <div className="rounded-lg border p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="rounded-lg bg-primary/10 p-2">
                        <FileText className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <p className="text-sm font-medium">Sözleşme Dosyası</p>
                        <p className="text-xs text-muted-foreground">Ekli dosya mevcut</p>
                      </div>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => window.open(selectedEntry.contractFile, '_blank')}
                      className="gap-1.5"
                    >
                      <ExternalLink className="h-4 w-4" />
                      Görüntüle
                    </Button>
                  </div>
                </div>
              )}

              {/* Payment Plan for Götürü Bedel */}
              {selectedEntry.contractType === 'goturu_bedel' && selectedEntry.paymentPlan && selectedEntry.paymentPlan.length > 0 && (
                <div>
                  <h4 className="text-sm font-medium mb-3">Ödeme Planı</h4>
                  <div className="rounded-lg border overflow-hidden">
                    <table className="w-full">
                      <thead>
                        <tr className="bg-muted/50">
                          <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Açıklama</th>
                          <th className="px-3 py-2 text-right text-xs font-medium text-muted-foreground">Tutar</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {selectedEntry.paymentPlan.map((payment, index) => (
                          <tr key={payment.id}>
                            <td className="px-3 py-2 text-sm">{payment.description || `Taksit ${index + 1}`}</td>
                            <td className="px-3 py-2 text-sm text-right font-medium">
                              {formatCurrencyWithType(payment.amount, selectedEntry.currency)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Work Items for Birim Fiyat */}
              {selectedEntry.contractType === 'birim_fiyat' && selectedEntry.workItemEntries && selectedEntry.workItemEntries.length > 0 && (
                <div>
                  <h4 className="text-sm font-medium mb-3">İş Kalemleri</h4>
                  <div className="rounded-lg border overflow-hidden">
                    <table className="w-full">
                      <thead>
                        <tr className="bg-muted/50">
                          <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Açıklama</th>
                          <th className="px-3 py-2 text-center text-xs font-medium text-muted-foreground">Miktar</th>
                          <th className="px-3 py-2 text-right text-xs font-medium text-muted-foreground">Birim Fiyat</th>
                          <th className="px-3 py-2 text-right text-xs font-medium text-muted-foreground">Tutar</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {selectedEntry.workItemEntries.map((item) => (
                          <tr key={item.id}>
                            <td className="px-3 py-2 text-sm">{item.description}</td>
                            <td className="px-3 py-2 text-sm text-center">{item.quantity} {item.unit}</td>
                            <td className="px-3 py-2 text-sm text-right">
                              {formatCurrencyWithType(item.unitPrice, selectedEntry.currency)}
                            </td>
                            <td className="px-3 py-2 text-sm text-right font-medium">
                              {formatCurrencyWithType(item.quantity * item.unitPrice, selectedEntry.currency)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Totals */}
              <div className="rounded-lg bg-muted/50 p-4">
                <div className="flex justify-between text-sm font-semibold">
                  <span>Toplam</span>
                  <span className="text-primary">{formatCurrencyWithType(selectedEntry.totalAmount, selectedEntry.currency)}</span>
                </div>
              </div>
            </div>
          )}

          <DialogFooter className="flex-col sm:flex-row gap-2">
            <div className="flex gap-2">
              <Button
                variant="destructive"
                onClick={() => setIsDeleteDialogOpen(true)}
                className="gap-1.5"
              >
                <Trash2 className="h-4 w-4" />
                Sil
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  if (selectedEntry) {
                    handleEditEntry(selectedEntry);
                  }
                }}
                className="gap-1.5"
              >
                <Pencil className="h-4 w-4" />
                Düzenle
              </Button>
            </div>
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
            <AlertDialogTitle>Sözleşmeyi Sil</AlertDialogTitle>
            <AlertDialogDescription>
              Bu sözleşmeyi silmek istediğinizden emin misiniz? Bu işlem geri alınamaz.
              {selectedEntry && (
                <span className="block mt-2 font-medium text-foreground">
                  {selectedEntry.contractNo} - {selectedEntry.workCategory}
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>İptal</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (selectedEntry) {
                  deleteWorkEntry(selectedEntry.id);
                  toast.success('Sözleşme silindi');
                  setIsDeleteDialogOpen(false);
                  setIsDetailDialogOpen(false);
                  setSelectedEntry(null);
                }
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Sil
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </MainLayout>
  );
}
