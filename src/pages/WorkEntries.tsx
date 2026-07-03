import { useState, useMemo, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { MainLayout } from '@/components/MainLayout';
import { sortNatural } from '@/lib/utils';
import { StatusBadge } from '@/components/StatusBadge';
import { AmountCell } from '@/components/AmountCell';
import { SortableTableHeader, useSorting, SortConfig } from '@/components/SortableTableHeader';
import { useHakedisStore } from '@/store/hakedisStore';
import { useWorkCategories } from '@/hooks/useWorkCategories';
import { 
  formatCurrencyWithType, 
  formatDate, 
  WorkEntry,
  PaymentInstallment,
  WorkItemEntry,
  
  Currency,
  ContractType,
  currencySymbols,
  contractTypeLabels
} from '@/types/hakedis';
import { generateContractPDF } from '@/utils/pdfGenerator';
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
  ExternalLink,
  FileSpreadsheet
} from 'lucide-react';
import { exportSingleContractToExcel } from '@/utils/excelExport';
import { motion, AnimatePresence } from 'framer-motion';
import { MobileCard, MobileCardHeader, MobileCardRow, MobileCardActions } from '@/components/MobileCard';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
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
    subcontractorHakedisler,
    currentUser 
  } = useHakedisStore();
  const { categories: workCategories, addCategory: addWorkCategory } = useWorkCategories();
  
  
  const [searchQuery, setSearchQuery] = useState('');
  const [filterProject, setFilterProject] = useState<string>('all');
  const { sortConfig, handleSort } = useSorting({ key: 'createdAt', direction: 'desc' });
  
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isDetailDialogOpen, setIsDetailDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [selectedEntry, setSelectedEntry] = useState<WorkEntry | null>(null);
  const [searchParams, setSearchParams] = useSearchParams();
  
  // Form state
  const [newEntry, setNewEntry] = useState({
    projectId: '',
    workCategory: '',
    subcontractor: '',
    newSubcontractor: '',
    contractType: 'birim_fiyat' as ContractType,
    date: new Date().toISOString().split('T')[0],
    currency: 'TRY' as Currency,
    vatRate: '10' as string | number,
    description: '',
  });

  // VAT inclusive checkbox
  const [vatInclusive, setVatInclusive] = useState(false);

  // Götürü Bedel - Payment Plan
  const [paymentPlan, setPaymentPlan] = useState<PaymentInstallment[]>([]);

  // Birim Fiyat - Work Items
  const [workItemEntries, setWorkItemEntries] = useState<WorkItemEntry[]>([]);

  const activeProjects = projects.filter(p => p.status === 'aktif');

  const filteredEntries = workEntries.filter(entry => {
    const project = projects.find(p => p.id === entry.projectId);
    const query = searchQuery.toLowerCase();
    const matchesSearch = !query ||
      (entry.workCategory || '').toLowerCase().includes(query) ||
      (entry.subcontractor || '').toLowerCase().includes(query) ||
      (project?.projectName || '').toLowerCase().includes(query) ||
      (project?.projectCode || '').toLowerCase().includes(query);
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
          comparison = (a.workCategory || '').localeCompare(b.workCategory || '');
          break;
        case 'subcontractor':
          comparison = (a.subcontractor || '').localeCompare(b.subcontractor || '');
          break;
        case 'date':
          comparison = new Date(a.date).getTime() - new Date(b.date).getTime();
          break;
        case 'contractNo':
          comparison = (a.contractNo || '').localeCompare(b.contractNo || '');
          break;
        case 'contractType':
          comparison = (a.contractType || '').localeCompare(b.contractType || '');
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

    // If vatInclusive is checked, back-calculate the base amount (KDV hariç)
    if (vatInclusive && newEntry.vatRate !== '' && Number(newEntry.vatRate) > 0) {
      totalAmount = totalAmount / (1 + Number(newEntry.vatRate) / 100);
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

  const handleCreateEntry = async () => {
    if (!newEntry.projectId || !newEntry.workCategory) return;

    const selectedSubcontractor = newEntry.subcontractor === 'new' 
      ? newEntry.newSubcontractor 
      : newEntry.subcontractor;

    if (!selectedSubcontractor) return;

    // Add new subcontractor if needed
    if (newEntry.subcontractor === 'new' && newEntry.newSubcontractor) {
      await addSubcontractor(newEntry.newSubcontractor, newEntry.workCategory);
    }

    const amounts = calculateTotals();

    try {
      if (isEditMode && selectedEntry) {
        // Update existing entry
        await updateWorkEntry(selectedEntry.id, {
          projectId: newEntry.projectId,
          workCategory: newEntry.workCategory,
          subcontractor: selectedSubcontractor,
          contractType: newEntry.contractType,
          date: newEntry.date,
          currency: newEntry.currency,
          vatRate: newEntry.vatRate !== '' ? Number(newEntry.vatRate) : undefined,
          description: newEntry.description || undefined,
          paymentPlan: newEntry.contractType === 'goturu_bedel' ? paymentPlan : undefined,
          workItemEntries: newEntry.contractType === 'birim_fiyat' ? workItemEntries : undefined,
          totalAmount: amounts.totalAmount,
        });
        toast.success('Sözleşme güncellendi');
      } else {
        // Create new entry
        const contractNo = await getNextContractNo();

        await addWorkEntry({
          contractNo,
          projectId: newEntry.projectId,
          workCategory: newEntry.workCategory,
          subcontractor: selectedSubcontractor,
          contractType: newEntry.contractType,
          date: newEntry.date,
          currency: newEntry.currency,
          vatRate: newEntry.vatRate !== '' ? Number(newEntry.vatRate) : undefined,
          description: newEntry.description || undefined,
          paymentPlan: newEntry.contractType === 'goturu_bedel' ? paymentPlan : undefined,
          workItemEntries: newEntry.contractType === 'birim_fiyat' ? workItemEntries : undefined,
          createdBy: currentUser.id,
          approvalStatus: 'onay_bekliyor',
          totalAmount: amounts.totalAmount,
          paymentStatus: 'odenmedi',
        });
        toast.success('Sözleşme oluşturuldu');
      }
      
      handleCloseDialog();
    } catch (error) {
      console.error('Error saving contract:', error);
      toast.error('Sözleşme kaydedilemedi');
    }
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
      vatRate: entry.vatRate ?? '',
      description: entry.description || '',
    });
    setPaymentPlan(entry.paymentPlan || []);
    setWorkItemEntries(entry.workItemEntries || []);
    setIsDetailDialogOpen(false);
    setIsDialogOpen(true);
  };

  // Deep-link handling: ?edit=<id> opens edit; ?view=<id> opens detail
  useEffect(() => {
    const editId = searchParams.get('edit');
    const viewId = searchParams.get('view');
    const id = editId || viewId;
    if (!id) return;
    const entry = workEntries.find(e => e.id === id);
    if (entry) {
      if (editId) {
        handleEditEntry(entry);
      } else {
        setSelectedEntry(entry);
        setIsDetailDialogOpen(true);
      }
    }
    searchParams.delete('edit');
    searchParams.delete('view');
    setSearchParams(searchParams, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workEntries]);

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    setIsEditMode(false);
    setSelectedEntry(null);
    setVatInclusive(false);
    setNewEntry({
      projectId: '',
      workCategory: '',
      subcontractor: '',
      newSubcontractor: '',
      contractType: 'birim_fiyat',
      date: new Date().toISOString().split('T')[0],
      currency: 'TRY',
      vatRate: '10',
      description: '',
    });
    setPaymentPlan([]);
    setWorkItemEntries([]);
  };

  const amounts = calculateTotals();

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="page-header">
          <div>
            <h1 className="page-title">Altyüklenici Sözleşmeleri</h1>
            <p className="page-subtitle">
              Tüm altyüklenici sözleşmelerini görüntüleyin ve yönetin
            </p>
          </div>
          <Button onClick={() => setIsDialogOpen(true)} className="gap-2 w-full sm:w-auto touch-target">
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
              {sortNatural(projects, (p) => p.projectCode).map((project) => (
                <SelectItem key={project.id} value={project.id}>
                  {project.projectCode}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Mobile Cards View */}
        <div className="mobile-cards">
          {sortedEntries.map((entry) => {
            const project = projects.find(p => p.id === entry.projectId);
            
            return (
              <MobileCard 
                key={entry.id}
                onClick={() => {
                  setSelectedEntry(entry);
                  setIsDetailDialogOpen(true);
                }}
              >
                <MobileCardHeader
                  title={`${project?.projectCode} - ${entry.subcontractor}`}
                  subtitle={`${entry.workCategory} • ${contractTypeLabels[entry.contractType]}`}
                />
                <div className="space-y-0.5">
                  <MobileCardRow label="İş Kalemi" value={
                    <span className="truncate max-w-[150px] block text-right">{entry.workCategory}</span>
                  } />
                  <MobileCardRow label="Sözleşme Tipi" value={contractTypeLabels[entry.contractType]} />
                  <MobileCardRow label="Tarih" value={formatDate(entry.date)} />
                  <MobileCardRow 
                    label="Maliyet Tutarı" 
                    value={
                      <AmountCell totalAmount={entry.totalAmount} vatRate={entry.vatRate} currency={entry.currency} />
                    } 
                  />
                </div>
                <MobileCardActions>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedEntry(entry);
                      setIsDetailDialogOpen(true);
                    }}
                    className="touch-target"
                  >
                    <Eye className="h-4 w-4" />
                  </Button>
                  {(currentUser.role === 'direktor' || currentUser.role === 'muhasebe') && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleEditEntry(entry);
                      }}
                      className="touch-target"
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={async (e) => {
                      e.stopPropagation();
                      try {
                        await generateContractPDF(entry, project, subcontractorHakedisler);
                        toast.success('PDF rapor indirildi');
                      } catch (error) {
                        toast.error('PDF oluşturulamadı');
                      }
                    }}
                    className="touch-target"
                  >
                    <FileText className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      exportSingleContractToExcel(entry, project, subcontractorHakedisler);
                    }}
                    className="touch-target"
                  >
                    <FileSpreadsheet className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedEntry(entry);
                      setIsDeleteDialogOpen(true);
                    }}
                    className="text-destructive hover:text-destructive touch-target"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </MobileCardActions>
              </MobileCard>
            );
          })}
          
          {sortedEntries.length === 0 && (
            <div className="p-8 text-center">
              <ClipboardList className="mx-auto h-10 w-10 text-muted-foreground/50" />
              <h3 className="mt-3 text-base font-medium text-foreground">Kayıt bulunamadı</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Arama kriterlerinize uygun sözleşme kaydı bulunmuyor.
              </p>
            </div>
          )}
        </div>

        {/* Desktop Table View */}
        <div className="desktop-table card-elevated overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b bg-muted/50">
                  <SortableTableHeader label="Proje" sortKey="project" currentSort={sortConfig} onSort={handleSort} />
                  <SortableTableHeader label="İş Kalemi" sortKey="workCategory" currentSort={sortConfig} onSort={handleSort} />
                  <SortableTableHeader label="Altyüklenici" sortKey="subcontractor" currentSort={sortConfig} onSort={handleSort} />
                   <SortableTableHeader label="Tarih" sortKey="date" currentSort={sortConfig} onSort={handleSort} />
                  <SortableTableHeader label="Sözleşme Tipi" sortKey="contractType" currentSort={sortConfig} onSort={handleSort} />
                  <SortableTableHeader label="Maliyet Tutarı" sortKey="totalAmount" currentSort={sortConfig} onSort={handleSort} align="right" />
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
                          <p className="text-sm text-foreground">
                            {contractTypeLabels[entry.contractType]}
                          </p>
                        </td>
                        <td className="px-4 py-4 text-right">
                          <AmountCell totalAmount={entry.totalAmount} vatRate={entry.vatRate} currency={entry.currency} />
                        </td>
                        <td className="px-4 py-4">
                          <div className="flex items-center justify-center gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setSelectedEntry(entry);
                                setIsDetailDialogOpen(true);
                              }}
                              title="Detay"
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            {(currentUser.role === 'direktor' || currentUser.role === 'muhasebe') && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleEditEntry(entry)}
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
                                  await generateContractPDF(entry, project, subcontractorHakedisler);
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
                              onClick={() => exportSingleContractToExcel(entry, project, subcontractorHakedisler)}
                              title="Excel Rapor"
                            >
                              <FileSpreadsheet className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setSelectedEntry(entry);
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
                  {sortNatural(activeProjects, (p) => p.projectCode).map((project) => (
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
                onValueChange={(value) => {
                  if (value === '__add_new__') {
                    const name = window.prompt('Yeni iş kalemi adı:');
                    if (!name) return;
                    const added = addWorkCategory(name);
                    if (added) {
                      setNewEntry({ ...newEntry, workCategory: added, subcontractor: '', newSubcontractor: '' });
                    }
                    return;
                  }
                  setNewEntry({ ...newEntry, workCategory: value, subcontractor: '', newSubcontractor: '' });
                }}
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
                  <SelectItem value="__add_new__" className="text-primary font-medium">
                    + Yeni İş Kalemi Ekle...
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Subcontractor */}
            <div className="space-y-2">
              <Label>Altyüklenici *</Label>
              {(() => {
                const filteredSubs = newEntry.workCategory
                  ? subcontractors.filter(sub => sub.workCategory === newEntry.workCategory)
                  : subcontractors;
                return (
                  <>
                    <Select
                      value={newEntry.subcontractor}
                      onValueChange={(value) => {
                        setNewEntry({ ...newEntry, subcontractor: value });
                        // Auto-fill work items from the subcontractor's most recent contract
                        if (value !== 'new' && !isEditMode) {
                          const subContracts = workEntries
                            .filter(e => e.subcontractor === value && e.contractType === 'birim_fiyat' && e.workItemEntries && e.workItemEntries.length > 0)
                            .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
                          
                          if (subContracts.length > 0) {
                            const lastContract = subContracts[0];
                            const copiedItems: WorkItemEntry[] = (lastContract.workItemEntries || []).map((item, idx) => ({
                              ...item,
                              id: `wie_copy_${Date.now()}_${idx}`,
                              quantity: 0,
                              currency: newEntry.currency,
                            }));
                            setWorkItemEntries(copiedItems);
                            if (newEntry.contractType !== 'birim_fiyat') {
                              setNewEntry(prev => ({ ...prev, subcontractor: value, contractType: 'birim_fiyat' }));
                            }
                            toast.info(`${value} altyüklenicisinin önceki sözleşmesindeki iş kalemleri yüklendi. Düzenleyebilirsiniz.`);
                          }
                        }
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Altyüklenici seçin" />
                      </SelectTrigger>
                      <SelectContent>
                        {sortNatural(filteredSubs, (s) => s.name).map((sub) => (
                          <SelectItem key={sub.name} value={sub.name}>
                            {sub.name}
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
                  </>
                );
              })()}
            </div>

            {/* Contract Description */}
            <div className="space-y-2">
              <Label>Sözleşme Açıklaması</Label>
              <Textarea
                placeholder="Sözleşme ile ilgili notlarınızı buraya yazabilirsiniz..."
                value={newEntry.description}
                onChange={(e) => setNewEntry({ ...newEntry, description: e.target.value })}
                rows={3}
              />
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

            {/* VAT Rate and Date */}
            <div className="grid grid-cols-2 gap-4">
              {/* VAT Rate */}
              <div className="space-y-2">
                <Label>KDV Oranı (%)</Label>
                <div className="flex items-center gap-3">
                  <Input
                    type="number"
                    placeholder="Örn: 20"
                    min="0"
                    max="100"
                    value={newEntry.vatRate}
                    onChange={(e) => setNewEntry({ ...newEntry, vatRate: e.target.value })}
                    className="flex-1"
                  />
                  <div className="flex items-center gap-1.5">
                    <Checkbox
                      id="vatInclusive"
                      checked={vatInclusive}
                      onCheckedChange={(checked) => setVatInclusive(checked === true)}
                    />
                    <Label htmlFor="vatInclusive" className="text-xs font-normal cursor-pointer whitespace-nowrap">
                      Dahil
                    </Label>
                  </div>
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

            {/* Amount Preview with VAT */}
            {amounts.totalAmount > 0 && (
              <div className="rounded-lg bg-muted/50 p-4 space-y-2">
                {(() => {
                  const enteredTotal = amounts.totalAmount;
                  const vr = newEntry.vatRate !== '' ? Number(newEntry.vatRate) : 0;
                  
                  if (vatInclusive && vr > 0) {
                    // Entered amounts are VAT-inclusive
                    const baseAmount = enteredTotal / (1 + vr / 100);
                    const vatAmount = enteredTotal - baseAmount;
                    return (
                      <>
                        <div className="flex justify-between text-sm">
                          <span>Girilen Tutar (KDV Dahil)</span>
                          <span className="font-medium">{formatCurrencyWithType(enteredTotal, newEntry.currency)}</span>
                        </div>
                        <div className="flex justify-between text-sm text-muted-foreground">
                          <span>KDV Hariç Tutar</span>
                          <span>{formatCurrencyWithType(baseAmount, newEntry.currency)}</span>
                        </div>
                        <div className="flex justify-between text-sm text-muted-foreground">
                          <span>KDV (%{vr})</span>
                          <span>{formatCurrencyWithType(vatAmount, newEntry.currency)}</span>
                        </div>
                        <div className="border-t pt-2 flex justify-between text-sm">
                          <span className="font-medium">KDV Dahil Toplam</span>
                          <span className="font-semibold text-primary">{formatCurrencyWithType(enteredTotal, newEntry.currency)}</span>
                        </div>
                      </>
                    );
                  }
                  
                  return (
                    <>
                      <div className="flex justify-between text-sm">
                        <span>Ara Toplam (KDV Hariç)</span>
                        <span className="font-medium">{formatCurrencyWithType(enteredTotal, newEntry.currency)}</span>
                      </div>
                      {vr > 0 && (
                        <>
                          <div className="flex justify-between text-sm text-muted-foreground">
                            <span>KDV (%{vr})</span>
                            <span>{formatCurrencyWithType(enteredTotal * vr / 100, newEntry.currency)}</span>
                          </div>
                          <div className="border-t pt-2 flex justify-between text-sm">
                            <span className="font-medium">KDV Dahil Toplam</span>
                            <span className="font-semibold text-primary">
                              {formatCurrencyWithType(enteredTotal * (1 + vr / 100), newEntry.currency)}
                            </span>
                          </div>
                        </>
                      )}
                      {vr === 0 && (
                        <div className="flex justify-between text-sm">
                          <span className="font-medium">Toplam</span>
                          <span className="font-semibold text-primary">{formatCurrencyWithType(enteredTotal, newEntry.currency)}</span>
                        </div>
                      )}
                    </>
                  );
                })()}
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

              {/* Contract Description */}
              {selectedEntry.description && (
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Sözleşme Açıklaması</p>
                  <div className="rounded-lg border bg-muted/30 p-3">
                    <p className="text-sm text-foreground whitespace-pre-wrap">{selectedEntry.description}</p>
                  </div>
                </div>
              )}

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
              <div className="rounded-lg bg-muted/50 p-4 space-y-2">
                {(() => {
                  const vatRate = selectedEntry.vatRate || 0;
                  const subtotal = selectedEntry.totalAmount;
                  const vatAmount = vatRate > 0 ? subtotal * (vatRate / 100) : 0;
                  const totalWithVat = subtotal + vatAmount;

                  const approvedHakedisler = subcontractorHakedisler.filter(h => h.contractId === selectedEntry.id);
                  const hakedisSubtotal = approvedHakedisler.reduce((sum, h) => sum + h.totalAmount, 0);
                  const hakedisVat = approvedHakedisler.reduce((sum, h) => {
                    const hVat = h.vatRate ? h.totalAmount * (h.vatRate / 100) : 0;
                    return sum + hVat;
                  }, 0);
                  const hakedisTotalWithVat = hakedisSubtotal + hakedisVat;

                  const paidTotal = approvedHakedisler.reduce((sum, h) => sum + (h.paidAmount || 0), 0);
                  const remainingBalance = totalWithVat - paidTotal;

                  return (
                    <>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Sözleşme Tutarı (KDV Hariç)</span>
                        <span className="font-medium">{formatCurrencyWithType(subtotal, selectedEntry.currency)}</span>
                      </div>
                      {vatRate > 0 && (
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">KDV (%{vatRate})</span>
                          <span className="font-medium">{formatCurrencyWithType(vatAmount, selectedEntry.currency)}</span>
                        </div>
                      )}
                      <div className="flex justify-between text-sm font-semibold">
                        <span>Sözleşme Tutarı (KDV Dahil)</span>
                        <span className="text-primary">{formatCurrencyWithType(totalWithVat, selectedEntry.currency)}</span>
                      </div>
                      <div className="border-t pt-2 mt-2 flex justify-between text-sm">
                        <span className="text-muted-foreground">Toplam Hakediş (KDV Dahil)</span>
                        <span className="text-green-600 font-medium">{formatCurrencyWithType(hakedisTotalWithVat, selectedEntry.currency)}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Ödenen Tutar (KDV Dahil)</span>
                        <span className="font-medium">{formatCurrencyWithType(paidTotal, selectedEntry.currency)}</span>
                      </div>
                      <div className="flex justify-between text-sm border-t pt-2 mt-2">
                        <span className="font-semibold">Kalan Bakiye (KDV Dahil)</span>
                        <span className={`font-semibold ${remainingBalance > 0 ? 'text-amber-600' : remainingBalance < 0 ? 'text-destructive' : 'text-green-600'}`}>
                          {formatCurrencyWithType(remainingBalance, selectedEntry.currency)}
                        </span>
                      </div>
                    </>
                  );
                })()}
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
              onClick={async () => {
                if (selectedEntry) {
                  try {
                    await deleteWorkEntry(selectedEntry.id);
                    toast.success('Sözleşme silindi');
                    setIsDeleteDialogOpen(false);
                    setIsDetailDialogOpen(false);
                    setSelectedEntry(null);
                  } catch (error) {
                    console.error('Error deleting contract:', error);
                    toast.error('Sözleşme silinemedi');
                  }
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
