import { useState, useMemo, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { MainLayout } from '@/components/MainLayout';
import { sortNatural } from '@/lib/utils';
import { StatusBadge } from '@/components/StatusBadge';
import { SortableTableHeader, useSorting } from '@/components/SortableTableHeader';
import { AmountCell } from '@/components/AmountCell';
import { useHakedisStore } from '@/store/hakedisStore';
import { 
  formatCurrencyWithType, 
  formatDate, 
  contractTypeLabels,
  hakedisTypeLabels,
  approvalStatusLabels,
  paymentStatusLabels,
  currencySymbols,
  roleLabels,
  SubcontractorHakedis as HakedisType,
  HakedisItem,
  ExtraWorkItem,
  Currency,
  HakedisRecordType,
  ApprovalStatus,
  PaymentStatus
} from '@/types/hakedis';
import { generateHakedisPDF } from '@/utils/pdfGenerator';
import { getCumulativeWorkItemQuantities, getContractAccount } from '@/utils/contractAccounting';
import { 
  Plus, 
  Search, 
  FileText,
  Calculator,
  Receipt,
  Eye,
  Trash2,
  Pencil,
  PlusCircle,
  AlertTriangle,
  FileSpreadsheet
} from 'lucide-react';
import { exportSingleHakedisToExcel } from '@/utils/excelExport';
import { MobileCard, MobileCardHeader, MobileCardRow, MobileCardActions } from '@/components/MobileCard';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
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
import { useIsMobile } from '@/hooks/use-mobile';
import { MultiProjectHakedisDialog } from '@/components/MultiProjectHakedisDialog';

export default function SubcontractorHakedis() {
  const { 
    projects, 
    workEntries,
    subcontractorHakedisler,
    subcontractors,
    addSubcontractorHakedis,
    updateSubcontractorHakedis,
    deleteSubcontractorHakedis,
    currentUser,
    addActivityLog,
    addSubcontractor,
  } = useHakedisStore();
  const isMobile = useIsMobile();
  const [searchParams, setSearchParams] = useSearchParams();
  
  const [searchQuery, setSearchQuery] = useState('');
  const [filterProject, setFilterProject] = useState<string>('all');
  const [filterApproval, setFilterApproval] = useState<string>('all');
  const [filterPayment, setFilterPayment] = useState<string>('all');
  const { sortConfig, handleSort } = useSorting({ key: 'createdAt', direction: 'desc' });
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isMultiDialogOpen, setIsMultiDialogOpen] = useState(false);
  const [isDetailDialogOpen, setIsDetailDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [editingHakedisId, setEditingHakedisId] = useState<string | null>(null);
  const [selectedHakedis, setSelectedHakedis] = useState<HakedisType | null>(null);

  // Small contractless hakediş dialog state
  const [isSmallHakedisDialogOpen, setIsSmallHakedisDialogOpen] = useState(false);
  const [smallSubcontractorMode, setSmallSubcontractorMode] = useState<'existing' | 'custom'>('existing');
  const [smallSubcontractor, setSmallSubcontractor] = useState('');
  const [smallCustomSubcontractor, setSmallCustomSubcontractor] = useState('');
  const [smallDate, setSmallDate] = useState(new Date().toISOString().split('T')[0]);
  const [smallCurrency, setSmallCurrency] = useState<Currency>('TRY');
  // Multi-project rows for small hakediş
  type SmallRow = {
    projectMode: 'existing' | 'custom';
    projectId: string;
    projectName: string;
    description: string;
    amount: string;
    vatRate: string;
    vatInclusive: boolean;
  };
  const makeEmptyRow = (): SmallRow => ({
    projectMode: 'existing', projectId: '', projectName: '',
    description: '', amount: '', vatRate: '10', vatInclusive: false,
  });
  const [smallRows, setSmallRows] = useState<SmallRow[]>([makeEmptyRow()]);
  
  // Form state
  const [selectedProjectId, setSelectedProjectId] = useState('');
  const [selectedSubcontractor, setSelectedSubcontractor] = useState('');
  const [selectedContractId, setSelectedContractId] = useState('');
  const [paymentAmount, setPaymentAmount] = useState('');
  const [hakedisItems, setHakedisItems] = useState<HakedisItem[]>([]);
  const [extraItems, setExtraItems] = useState<ExtraWorkItem[]>([]);
  const [showAddExtraItem, setShowAddExtraItem] = useState(false);
  const [newExtraItem, setNewExtraItem] = useState<Partial<ExtraWorkItem>>({
    description: '',
    unit: '',
    unitPrice: 0,
    quantity: 0
  });
  const [hakedisDate, setHakedisDate] = useState(new Date().toISOString().split('T')[0]);
  const [vatRate, setVatRate] = useState<string>('10');
  const [description, setDescription] = useState<string>('');
  const [hakedisType, setHakedisType] = useState<HakedisRecordType>('ara_hakedis');
  const [vatInclusive, setVatInclusive] = useState(false);
  const [hakedisCurrency, setHakedisCurrency] = useState<Currency>('TRY');
  const contractSubcontractors = useMemo(() => {
    const subs = new Set<string>();

    workEntries.forEach((entry) => {
      if (entry.projectId !== selectedProjectId) return;
      const subcontractorName = entry.subcontractor?.trim();
      if (subcontractorName) subs.add(subcontractorName);
    });

    return Array.from(subs).sort((a, b) => a.localeCompare(b, 'tr'));
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

  // Calculate totals for birim fiyat (including extra items)
  const birimFiyatTotal = useMemo(() => {
    const contractItemsTotal = hakedisItems.reduce((sum, item) => sum + item.amount, 0);
    const extraItemsTotal = extraItems.reduce((sum, item) => sum + item.amount, 0);
    return contractItemsTotal + extraItemsTotal;
  }, [hakedisItems, extraItems]);

  // Calculate previous payments for kesin hesap (all alelhesap + ara_hakedis for the contract)
  const previousPaymentsTotal = useMemo(() => {
    if (!selectedContractId) return 0;
    return subcontractorHakedisler
      .filter(h => h.contractId === selectedContractId && h.id !== editingHakedisId)
      .reduce((sum, h) => sum + h.totalAmount, 0);
  }, [subcontractorHakedisler, selectedContractId, editingHakedisId]);

  // Cumulative quantities per workItemEntryId from previous hakedişler (excluding current)
  const cumulativeQuantities = useMemo(() => {
    if (!selectedContractId) return new Map<string, number>();
    return getCumulativeWorkItemQuantities(
      selectedContractId,
      subcontractorHakedisler,
      editingHakedisId || undefined
    );
  }, [selectedContractId, subcontractorHakedisler, editingHakedisId]);

  // Aggregated contract account summary
  const contractAccount = useMemo(() => {
    if (!selectedContract) return null;
    return getContractAccount(
      selectedContract,
      subcontractorHakedisler,
      editingHakedisId || undefined
    );
  }, [selectedContract, subcontractorHakedisler, editingHakedisId]);

  // Helper: fill "remaining" quantity for one row or all rows
  const fillRemainingQuantity = (itemId: string) => {
    setHakedisItems(items => items.map(item => {
      if (item.id !== itemId) return item;
      const contractQty = selectedContract?.workItemEntries?.find(w => w.id === item.workItemEntryId)?.quantity ?? 0;
      const used = cumulativeQuantities.get(item.workItemEntryId) || 0;
      const remaining = Math.max(0, contractQty - used);
      return { ...item, quantity: remaining, amount: remaining * item.unitPrice };
    }));
  };

  const fillAllRemainingQuantities = () => {
    setHakedisItems(items => items.map(item => {
      const contractQty = selectedContract?.workItemEntries?.find(w => w.id === item.workItemEntryId)?.quantity ?? 0;
      const used = cumulativeQuantities.get(item.workItemEntryId) || 0;
      const remaining = Math.max(0, contractQty - used);
      return { ...item, quantity: remaining, amount: remaining * item.unitPrice };
    }));
    toast.success('Tüm kalemler için kalan miktarlar dolduruldu');
  };



  // Filtered hakedisler
  const filteredHakedisler = subcontractorHakedisler.filter(hakedis => {
    const project = projects.find(p => p.id === hakedis.projectId);
    const query = searchQuery.toLowerCase();
    const matchesSearch = !query ||
      (hakedis.subcontractor || '').toLowerCase().includes(query) ||
      (hakedis.contractNo || '').toLowerCase().includes(query) ||
      (hakedis.hakedisNo || '').toLowerCase().includes(query) ||
      (project?.projectName || '').toLowerCase().includes(query);
    const matchesProject = filterProject === 'all' || hakedis.projectId === filterProject;
    const matchesApproval = filterApproval === 'all' || hakedis.approvalStatus === filterApproval;
    const matchesPayment = filterPayment === 'all' || hakedis.paymentStatus === filterPayment;
    return matchesSearch && matchesProject && matchesApproval && matchesPayment;
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
    setExtraItems([]);
    setShowAddExtraItem(false);
    setNewExtraItem({ description: '', unit: '', unitPrice: 0, quantity: 0 });
    setHakedisDate(new Date().toISOString().split('T')[0]);
    setVatRate('10');
    setDescription('');
    setHakedisType('ara_hakedis');
    setVatInclusive(false);
    setHakedisCurrency('TRY');
    setIsEditMode(false);
    setEditingHakedisId(null);
  };

  const handleContractSelect = (contractId: string) => {
    setSelectedContractId(contractId);
    const contract = workEntries.find(e => e.id === contractId);
    if (contract) setHakedisCurrency((contract.currency as Currency) || 'TRY');
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
      setExtraItems([]);
    } else {
      setHakedisItems([]);
      setExtraItems([]);
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
    // Approved hakedis can only be edited by Direktor
    if (hakedis.approvalStatus === 'onaylandi' && currentUser.role !== 'direktor') {
      toast.error('Onaylanmış hakedişleri yalnızca Direktör düzenleyebilir.');
      return;
    }
    // For other statuses, only allow editing for pending approval or revision required hakedis (non-direktor)
    if (
      currentUser.role !== 'direktor' &&
      hakedis.approvalStatus !== 'onay_bekliyor' &&
      hakedis.approvalStatus !== 'revize'
    ) {
      toast.error('Sadece onay bekleyen veya revize gerekli hakedişler düzenlenebilir. Önce ödemeler ekranından "Onay İptali" ile düzenlenebilir hale getirin.');
      return;
    }

    const contract = workEntries.find(e => e.id === hakedis.contractId);
    
    // For contractless (small) hakediş, open the small hakediş dialog for editing
    if (!contract) {
      setSmallSubcontractorMode('existing');
      setSmallSubcontractor(hakedis.subcontractor);
      setSmallDate(hakedis.date);
      setSmallCurrency((hakedis.currency as Currency) || 'TRY');
      setSmallRows([{
        projectMode: 'existing',
        projectId: hakedis.projectId || '',
        projectName: '',
        description: hakedis.description || '',
        amount: String(hakedis.totalAmount || 0),
        vatRate: hakedis.vatRate !== undefined && hakedis.vatRate !== null ? String(hakedis.vatRate) : '10',
        vatInclusive: false,
      }]);
      setIsEditMode(true);
      setEditingHakedisId(hakedis.id);
      setIsDetailDialogOpen(false);
      setIsSmallHakedisDialogOpen(true);
      return;
    }

    setSelectedProjectId(hakedis.projectId);
    setSelectedSubcontractor(hakedis.subcontractor);
    setSelectedContractId(hakedis.contractId);
    setHakedisDate(hakedis.date);
    setVatRate(hakedis.vatRate !== undefined ? String(hakedis.vatRate) : '10');
    setDescription(hakedis.description || '');
    setHakedisType(hakedis.hakedisType || 'ara_hakedis');
    setHakedisCurrency((hakedis.currency as Currency) || (contract.currency as Currency) || 'TRY');
    
    if (contract.contractType === 'goturu_bedel') {
      // For götürü bedel, set payment amount (subtract extra items if any)
      const extraTotal = hakedis.extraItems?.reduce((sum, i) => sum + i.amount, 0) || 0;
      setPaymentAmount(String(hakedis.paymentAmount || (hakedis.totalAmount - extraTotal)));
      // Restore extra items if any
      if (hakedis.extraItems) {
        setExtraItems(hakedis.extraItems);
      } else {
        setExtraItems([]);
      }
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
      // Restore extra items if any
      if (hakedis.extraItems) {
        setExtraItems(hakedis.extraItems);
      } else {
        setExtraItems([]);
      }
    }

    setIsEditMode(true);
    setEditingHakedisId(hakedis.id);
    setIsDetailDialogOpen(false);
    setIsDialogOpen(true);
  };

  // Auto-open edit/view dialog when navigated with ?edit=<id> or ?view=<id>
  useEffect(() => {
    const editId = searchParams.get('edit');
    const viewId = searchParams.get('view');
    const id = editId || viewId;
    if (!id) return;
    const hakedis = subcontractorHakedisler.find(h => h.id === id);
    if (hakedis) {
      if (editId) {
        handleEditHakedis(hakedis);
      } else {
        setSelectedHakedis(hakedis);
        setIsDetailDialogOpen(true);
      }
    }
    searchParams.delete('edit');
    searchParams.delete('view');
    setSearchParams(searchParams, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subcontractorHakedisler]);


  const handleSubmit = async () => {
    if (!selectedProjectId || !selectedSubcontractor || !selectedContractId) {
      toast.error('Lütfen tüm alanları doldurun');
      return;
    }

    if (!description.trim()) {
      toast.error('Lütfen hakediş açıklaması girin');
      return;
    }

    const contract = workEntries.find(e => e.id === selectedContractId);
    if (!contract) return;

    let totalAmount = 0;
    const extraItemsTotal = extraItems.reduce((sum, i) => sum + i.amount, 0);
    
    if (hakedisType === 'alelhesap') {
      // Alelhesap: just a lump sum payment amount
      const paymentBase = parseFloat(paymentAmount) || 0;
      if (paymentBase <= 0) {
        toast.error('Lütfen geçerli bir ödeme tutarı girin');
        return;
      }
      totalAmount = paymentBase;
    } else if (hakedisType === 'kesin_hesap') {
      // Kesin hesap: only for birim fiyat - enter final quantities
      totalAmount = birimFiyatTotal;
      if (totalAmount <= 0) {
        toast.error('Lütfen en az bir kalem için miktar girin');
        return;
      }
      // Net amount after deducting previous payments will be shown but totalAmount stays as the full kesin hesap amount
    } else if (contract.contractType === 'goturu_bedel') {
      const paymentBase = parseFloat(paymentAmount) || 0;
      if (paymentBase <= 0 && extraItemsTotal <= 0) {
        toast.error('Lütfen geçerli bir ödeme tutarı girin veya ek iş ekleyin');
        return;
      }
      // For edit mode, add current hakedis amount back to remaining
      const currentHakedisAmount = isEditMode && editingHakedisId 
        ? subcontractorHakedisler.find(h => h.id === editingHakedisId)?.totalAmount || 0 
        : 0;
      const adjustedRemaining = remainingAmount + currentHakedisAmount;
      if (paymentBase > adjustedRemaining) {
        toast.error('Ödeme tutarı kalan tutardan fazla olamaz');
        return;
      }
      totalAmount = paymentBase + extraItemsTotal;
    } else {
      // ara_hakedis birim fiyat
      totalAmount = birimFiyatTotal;
      if (totalAmount <= 0) {
        toast.error('Lütfen en az bir kalem için miktar girin');
        return;
      }
    }

    // If vatInclusive is checked, back-calculate the base amount (KDV hariç)
    if (vatInclusive && vatRate !== '' && Number(vatRate) > 0) {
      totalAmount = totalAmount / (1 + Number(vatRate) / 100);
    }


    try {
      if (isEditMode && editingHakedisId) {
        const existingHakedis = subcontractorHakedisler.find(h => h.id === editingHakedisId);
        const shouldResetToOnayBekliyor = existingHakedis?.approvalStatus === 'revize';
        
        await updateSubcontractorHakedis(editingHakedisId, {
          hakedisType,
          currency: hakedisCurrency,
          vatRate: vatRate !== '' ? Number(vatRate) : undefined,
          date: hakedisDate,
          description: description || undefined,
          paymentAmount: (hakedisType === 'alelhesap' || contract.contractType === 'goturu_bedel') ? (parseFloat(paymentAmount) || 0) : undefined,
          hakedisItems: (hakedisType !== 'alelhesap' && contract.contractType === 'birim_fiyat') ? hakedisItems.filter(i => i.quantity > 0) : undefined,
          extraItems: extraItems.length > 0 ? extraItems : undefined,
          totalAmount,
          contractExceededNote: undefined,

          ...(shouldResetToOnayBekliyor && {
            approvalStatus: 'onay_bekliyor' as const,
            rejectionReason: undefined,
          }),
        });
        await addActivityLog(
          'hakedis_updated',
          `Hakediş güncellendi${shouldResetToOnayBekliyor ? ' ve onaya sunuldu' : ''}`,
          `Tutar: ${formatCurrencyWithType(totalAmount, hakedisCurrency)}`,
          editingHakedisId,
          'hakedis'
        );
        toast.success(shouldResetToOnayBekliyor ? 'Hakediş güncellendi ve onaya sunuldu' : 'Hakediş güncellendi');
      } else {
        // Generate hakediş number - use prefix-specific max to avoid duplicates
        const prefix = hakedisType === 'alelhesap' ? 'AH' : hakedisType === 'kesin_hesap' ? 'KH' : 'H';
        const existingNos = subcontractorHakedisler
          .filter(h => h.contractId === selectedContractId && h.hakedisNo?.includes(`-${prefix}`))
          .map(h => {
            const match = h.hakedisNo.match(new RegExp(`-${prefix}(\\d+)$`));
            return match ? parseInt(match[1], 10) : 0;
          });
        const nextNum = existingNos.length > 0 ? Math.max(...existingNos) + 1 : 1;
        const hakedisNo = `${contract.contractNo}-${prefix}${nextNum.toString().padStart(2, '0')}`;

        const newHakedis = await addSubcontractorHakedis({
          hakedisNo,
          hakedisType,
          projectId: selectedProjectId,
          subcontractor: selectedSubcontractor,
          contractId: selectedContractId,
          contractNo: contract.contractNo,
          contractType: contract.contractType,
          currency: hakedisCurrency,
          vatRate: vatRate !== '' ? Number(vatRate) : undefined,
          date: hakedisDate,
          description: description || undefined,
          paymentAmount: (hakedisType === 'alelhesap' || contract.contractType === 'goturu_bedel') ? (parseFloat(paymentAmount) || 0) : undefined,
          hakedisItems: (hakedisType !== 'alelhesap' && contract.contractType === 'birim_fiyat') ? hakedisItems.filter(i => i.quantity > 0) : undefined,
          extraItems: extraItems.length > 0 ? extraItems : undefined,
          totalAmount,
          
          createdBy: currentUser.id,
          approvalStatus: currentUser.role === 'direktor' ? 'onaylandi' as ApprovalStatus : 'onay_bekliyor' as ApprovalStatus,
          approvedBy: currentUser.role === 'direktor' ? roleLabels[currentUser.role] : undefined,
          approvalDate: currentUser.role === 'direktor' ? new Date().toISOString() : undefined,
          paidAmount: 0,
          paymentStatus: 'odenmedi',
        });

        await addActivityLog(
          'hakedis_created',
          `${newHakedis.hakedisNo} ${hakedisTypeLabels[hakedisType]} oluşturuldu`,
          `Altyüklenici: ${newHakedis.subcontractor} - Tutar: ${formatCurrencyWithType(newHakedis.totalAmount, newHakedis.currency)}`,
          newHakedis.id,
          'hakedis'
        );
        toast.success(`${hakedisTypeLabels[hakedisType]} kaydı oluşturuldu`);
      }
      
      setIsDialogOpen(false);
      resetForm();
    } catch (error) {
      console.error('Error saving hakedis:', error);
      toast.error('Hakediş kaydedilemedi');
    }
  };

  const resetSmallForm = () => {
    setSmallSubcontractorMode('existing');
    setSmallSubcontractor('');
    setSmallCustomSubcontractor('');
    setSmallDate(new Date().toISOString().split('T')[0]);
    setSmallCurrency('TRY');
    setSmallRows([makeEmptyRow()]);
    setIsEditMode(false);
    setEditingHakedisId(null);
  };

  const handleSmallHakedisSubmit = async () => {
    const subcontractorName = smallSubcontractorMode === 'existing' ? smallSubcontractor : smallCustomSubcontractor.trim();
    if (!subcontractorName) {
      toast.error('Lütfen altyüklenici seçin veya girin');
      return;
    }

    // Validate rows
    const validRows = smallRows.filter(r => {
      const amt = parseFloat(r.amount) || 0;
      return amt > 0 && r.description.trim().length > 0;
    });
    if (validRows.length === 0) {
      toast.error('Lütfen en az bir geçerli satır (proje + açıklama + tutar) girin');
      return;
    }
    if (isEditMode && validRows.length > 1) {
      toast.error('Düzenleme modunda yalnızca tek satır kaydedilebilir');
      return;
    }

    try {
      // If new subcontractor, add to DB
      if (smallSubcontractorMode === 'custom' && smallCustomSubcontractor.trim()) {
        await addSubcontractor(smallCustomSubcontractor.trim());
      }

      const selectedSub = subcontractors.find(s => s.name === subcontractorName);
      const workCategoryLabel = selectedSub?.workCategory ? `[${selectedSub.workCategory}] ` : '';

      // Compute starting hakediş number
      const existingSmallNos = subcontractorHakedisler
        .filter(h => !h.contractId && h.hakedisNo?.startsWith('KH-S'))
        .map(h => {
          const num = parseInt(h.hakedisNo.replace('KH-S', ''), 10);
          return isNaN(num) ? 0 : num;
        });
      let nextNum = existingSmallNos.length > 0 ? Math.max(...existingSmallNos) + 1 : 1;

      let createdCount = 0;
      for (const row of validRows) {
        const rawAmount = parseFloat(row.amount) || 0;
        const vr = row.vatRate !== '' ? Number(row.vatRate) : 0;
        let totalAmount = rawAmount;
        if (row.vatInclusive && vr > 0) {
          totalAmount = rawAmount / (1 + vr / 100);
        }

        const projectLabel = row.projectMode === 'existing'
          ? projects.find(p => p.id === row.projectId)?.projectName || ''
          : row.projectName.trim();
        const projectPrefix = row.projectMode === 'custom' && row.projectName.trim()
          ? `[Proje: ${row.projectName.trim()}] ` : '';

        const hakedisNo = `KH-S${nextNum.toString().padStart(3, '0')}`;
        nextNum++;

        const hakedisData = {
          hakedisNo,
          hakedisType: 'ara_hakedis' as const,
          projectId: row.projectMode === 'existing' && row.projectId ? row.projectId : (null as any),
          subcontractor: subcontractorName,
          contractId: null as any,
          contractNo: null as any,
          contractType: 'goturu_bedel' as const,
          currency: smallCurrency,
          vatRate: vr > 0 ? vr : null,
          date: smallDate,
          description: `${workCategoryLabel}${projectPrefix}${row.description.trim()}`,
          paymentAmount: totalAmount,
          totalAmount,
          createdBy: currentUser.id,
          approvalStatus: currentUser.role === 'direktor' ? 'onaylandi' as ApprovalStatus : 'onay_bekliyor' as ApprovalStatus,
          approvedBy: currentUser.role === 'direktor' ? roleLabels[currentUser.role] : undefined,
          approvalDate: currentUser.role === 'direktor' ? new Date().toISOString() : undefined,
          paidAmount: 0,
          paymentStatus: 'odenmedi' as PaymentStatus,
        };

        if (isEditMode && editingHakedisId) {
          const existingHakedis = subcontractorHakedisler.find(h => h.id === editingHakedisId);
          await updateSubcontractorHakedis(editingHakedisId, {
            ...hakedisData,
            hakedisNo: existingHakedis?.hakedisNo || hakedisData.hakedisNo,
            approvalStatus: existingHakedis?.approvalStatus === 'revize' ? 'onay_bekliyor' as ApprovalStatus : existingHakedis?.approvalStatus || 'onay_bekliyor' as ApprovalStatus,
          });

          await addActivityLog(
            'hakedis_updated',
            `${existingHakedis?.hakedisNo} Sözleşmesiz Küçük Hakediş güncellendi`,
            `Altyüklenici: ${subcontractorName} - Tutar: ${formatCurrencyWithType(totalAmount, smallCurrency)}`,
            editingHakedisId,
            'hakedis'
          );
        } else {
          const newHakedis = await addSubcontractorHakedis(hakedisData);
          await addActivityLog(
            'hakedis_created',
            `${newHakedis.hakedisNo} Sözleşmesiz Küçük Hakediş oluşturuldu`,
            `Altyüklenici: ${subcontractorName} - Tutar: ${formatCurrencyWithType(totalAmount, smallCurrency)}${projectLabel ? ` - Proje: ${projectLabel}` : ''}`,
            newHakedis.id,
            'hakedis'
          );
          createdCount++;
        }
      }

      if (isEditMode) {
        toast.success('Hakediş güncellendi');
      } else {
        toast.success(createdCount > 1 ? `${createdCount} hakediş oluşturuldu` : 'Sözleşmesiz küçük hakediş oluşturuldu');
      }
      setIsSmallHakedisDialogOpen(false);
      resetSmallForm();
    } catch (error: any) {
      console.error('Error saving small hakedis:', error);
      console.error('Error details:', error?.message, error?.details, error?.hint, error?.code);
      toast.error(`Hakediş kaydedilemedi: ${error?.message || 'Bilinmeyen hata'}`);
    }
  };

  // Unique subcontractor names for dropdown
  const allSubcontractorNames = useMemo(() => {
    const names = new Set<string>();
    subcontractors.forEach(s => names.add(s.name));
    workEntries.forEach(e => names.add(e.subcontractor));
    subcontractorHakedisler.forEach(h => names.add(h.subcontractor));
    return Array.from(names).sort((a, b) => a.localeCompare(b, 'tr'));
  }, [subcontractors, workEntries, subcontractorHakedisler]);

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="page-header">
          <div>
            <h1 className="page-title">Altyüklenici Hakedişleri</h1>
            <p className="page-subtitle">
              Altyüklenici sözleşmelerine ait hakediş kayıtları
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
            <Button onClick={() => setIsMultiDialogOpen(true)} className="gap-2 w-full sm:w-auto touch-target">
              <Plus className="h-4 w-4" />
              Yeni Hakediş
            </Button>
          </div>
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
            <SelectTrigger className="w-full sm:w-44">
              <SelectValue placeholder="Proje Seç" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tüm Projeler</SelectItem>
              {sortNatural(projects, (p) => p.projectCode).map((project) => (
                <SelectItem key={project.id} value={project.id}>
                  {project.projectCode} - {project.projectName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={filterApproval} onValueChange={setFilterApproval}>
            <SelectTrigger className="w-full sm:w-44">
              <SelectValue placeholder="Onay Durumu" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tüm Onay Durumları</SelectItem>
              {Object.entries(approvalStatusLabels).map(([value, label]) => (
                <SelectItem key={value} value={value}>{label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={filterPayment} onValueChange={setFilterPayment}>
            <SelectTrigger className="w-full sm:w-44">
              <SelectValue placeholder="Ödeme Durumu" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tüm Ödeme Durumları</SelectItem>
              {Object.entries(paymentStatusLabels).map(([value, label]) => (
                <SelectItem key={value} value={value}>{label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Mobile Cards View */}
        <div className="mobile-cards">
          {sortedHakedisler.map((hakedis) => {
            const project = projects.find(p => p.id === hakedis.projectId);
            const contract = workEntries.find(e => e.id === hakedis.contractId);
            const workCategory = contract?.workCategory || '-';
            
            return (
              <MobileCard 
                key={hakedis.id}
                onClick={() => {
                  setSelectedHakedis(hakedis);
                  setIsDetailDialogOpen(true);
                }}
              >
                <MobileCardHeader
                  title={`${project?.projectCode || 'Küçük İş'} - ${hakedis.subcontractor}`}
                  subtitle={hakedis.contractId ? `${hakedisTypeLabels[hakedis.hakedisType || 'ara_hakedis']} • ${contractTypeLabels[hakedis.contractType]}` : 'Sözleşmesiz Küçük Hakediş'}
                  badge={
                    <div className="flex flex-col items-end gap-1">
                      <StatusBadge status={hakedis.approvalStatus} size="sm" />
                      <StatusBadge status={hakedis.paymentStatus} size="sm" />
                    </div>
                  }
                  
                />
                <div className="space-y-0.5">
                  <MobileCardRow label="İş Kalemi" value={workCategory} />
                  <MobileCardRow label="Açıklama" value={
                    <span className="truncate max-w-[150px] block text-right">{hakedis.description || '-'}</span>
                  } />
                  <MobileCardRow label="Tarih" value={formatDate(hakedis.date)} />
                  <MobileCardRow 
                    label="Maliyet Tutarı" 
                    value={
                      <AmountCell totalAmount={hakedis.totalAmount} vatRate={hakedis.vatRate} currency={hakedis.currency} />
                    } 
                  />
                </div>
                <MobileCardActions>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedHakedis(hakedis);
                      setIsDetailDialogOpen(true);
                    }}
                    className="touch-target"
                  >
                    <Eye className="h-4 w-4" />
                  </Button>
                  {(hakedis.approvalStatus === 'onay_bekliyor' || hakedis.approvalStatus === 'revize') && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleEditHakedis(hakedis);
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
                        const project = projects.find(p => p.id === hakedis.projectId);
                        const contract = workEntries.find(e => e.id === hakedis.contractId);
                        await generateHakedisPDF(hakedis, project, contract, subcontractorHakedisler);
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
                      const project = projects.find(p => p.id === hakedis.projectId);
                      const contract = workEntries.find(c => c.id === hakedis.contractId);
                      exportSingleHakedisToExcel(hakedis, project, contract, subcontractorHakedisler);
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
                      setSelectedHakedis(hakedis);
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
          
          {sortedHakedisler.length === 0 && (
            <div className="p-8 text-center">
              <Receipt className="mx-auto h-10 w-10 text-muted-foreground/50" />
              <h3 className="mt-3 text-base font-medium text-foreground">Hakediş kaydı bulunamadı</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Yeni hakediş kaydı eklemek için yukarıdaki butonu kullanın.
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
                  <SortableTableHeader label="Altyüklenici" sortKey="subcontractor" currentSort={sortConfig} onSort={handleSort} />
                  <SortableTableHeader label="İş Kalemi" sortKey="workCategory" currentSort={sortConfig} onSort={handleSort} />
                  <SortableTableHeader label="Açıklama" sortKey="description" currentSort={sortConfig} onSort={handleSort} />
                  <SortableTableHeader label="Tarih" sortKey="date" currentSort={sortConfig} onSort={handleSort} />
                  <SortableTableHeader label="Maliyet Tutarı" sortKey="totalAmount" currentSort={sortConfig} onSort={handleSort} align="right" />
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
                          <div className="flex items-center gap-2">
                            <div>
                              <p className="text-sm font-medium text-foreground">
                                {project?.projectCode || 'Küçük İş'}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {project?.projectName || '-'}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-4 text-sm text-foreground">
                          {hakedis.subcontractor}
                        </td>
                        <td className="px-4 py-4 text-sm text-foreground">
                          {workCategory}
                        </td>
                        <td className="px-4 py-4 text-sm text-muted-foreground max-w-xs">
                          <p className="truncate" title={hakedis.description || '-'}>
                            {hakedis.description || '-'}
                          </p>
                        </td>
                        <td className="px-4 py-4 text-sm text-muted-foreground">
                          {formatDate(hakedis.date)}
                        </td>
                        <td className="px-4 py-4 text-right">
                          <AmountCell totalAmount={hakedis.totalAmount} vatRate={hakedis.vatRate} currency={hakedis.currency} />
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
                            {(hakedis.approvalStatus === 'onay_bekliyor' || hakedis.approvalStatus === 'revize') && (
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
                                const project = projects.find(p => p.id === hakedis.projectId);
                                const contract = workEntries.find(c => c.id === hakedis.contractId);
                                exportSingleHakedisToExcel(hakedis, project, contract, subcontractorHakedisler);
                              }}
                              title="Excel Rapor"
                            >
                              <FileSpreadsheet className="h-4 w-4" />
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
          <DialogContent className="sm:max-w-2xl top-[5%] translate-y-0 overflow-visible p-0">
            <div className="max-h-[calc(100vh-2rem)] overflow-y-auto p-4 sm:p-6">
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
                  disabled={isEditMode && !(currentUser.role === 'direktor' || currentUser.role === 'muhasebe')}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Proje seçin" />
                  </SelectTrigger>
                  <SelectContent>
                    {sortNatural(projects.filter(p => p.status === 'aktif'), (p) => p.projectCode).map((project) => (
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

                  {isMobile ? (
                    <select
                      value={selectedSubcontractor}
                      onChange={(e) => {
                        setSelectedSubcontractor(e.target.value);
                        setSelectedContractId('');
                      }}
                      disabled={(isEditMode && !(currentUser.role === 'direktor' || currentUser.role === 'muhasebe')) || contractSubcontractors.length === 0}
                      className="flex h-10 w-full items-center rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <option value="">Altyüklenici seçin</option>
                      {sortNatural(contractSubcontractors, (s) => s).map((sub) => (
                        <option key={sub} value={sub}>
                          {sub}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <Select
                      value={selectedSubcontractor}
                      onValueChange={(value) => {
                        setSelectedSubcontractor(value);
                        setSelectedContractId('');
                      }}
                      disabled={(isEditMode && !(currentUser.role === 'direktor' || currentUser.role === 'muhasebe')) || contractSubcontractors.length === 0}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Altyüklenici seçin" />
                      </SelectTrigger>
                      <SelectContent>
                        {sortNatural(contractSubcontractors, (s) => s).map((sub) => (
                          <SelectItem key={sub} value={sub}>
                            {sub}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}

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
                  <Select value={selectedContractId} onValueChange={handleContractSelect} disabled={isEditMode && !(currentUser.role === 'direktor' || currentUser.role === 'muhasebe')}>
                    <SelectTrigger>
                      <SelectValue placeholder="Sözleşme seçin" />
                    </SelectTrigger>
                    <SelectContent>
                      {sortNatural(availableContracts, (c) => c.contractNo).map((contract) => (
                        <SelectItem key={contract.id} value={contract.id}>
                          {contract.contractNo} - {contract.workCategory} ({contractTypeLabels[contract.contractType]})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Hakediş Type Selection */}
              {selectedContractId && (
                <div className="space-y-2">
                  <Label>Hakediş Tipi</Label>
                  <Select 
                    value={hakedisType} 
                    onValueChange={(value: HakedisRecordType) => setHakedisType(value)}
                    disabled={isEditMode}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ara_hakedis">Ara Hakediş</SelectItem>
                      <SelectItem value="alelhesap">Alelhesap (Avans Ödeme)</SelectItem>
                      {selectedContract?.contractType === 'birim_fiyat' && (
                        <SelectItem value="kesin_hesap">Kesin Hesap</SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                  {hakedisType === 'alelhesap' && (
                    <p className="text-xs text-muted-foreground">
                      Sözleşme taksitlerine veya iş kalemlerine bağlı olmadan yapılan avans ödeme.
                    </p>
                  )}
                  {hakedisType === 'kesin_hesap' && (
                    <p className="text-xs text-muted-foreground">
                      İş tamamlandığında kesin miktarlar girilir, önceki ödemeler otomatik düşülür.
                    </p>
                  )}
                </div>
              )}

              {/* Date and VAT Rate */}
              {selectedContractId && (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label>Tarih</Label>
                      <Input
                        type="date"
                        value={hakedisDate}
                        onChange={(e) => setHakedisDate(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Para Birimi</Label>
                      <Select value={hakedisCurrency} onValueChange={(v) => setHakedisCurrency(v as Currency)}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="TRY">₺ TRY</SelectItem>
                          <SelectItem value="USD">$ USD</SelectItem>
                          <SelectItem value="EUR">€ EUR</SelectItem>
                          <SelectItem value="GBP">£ GBP</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>KDV Oranı (%)</Label>
                      <div className="flex items-center gap-3">
                        <Input
                          type="number"
                          placeholder="Örn: 20"
                          min="0"
                          max="100"
                          value={vatRate}
                          onChange={(e) => setVatRate(e.target.value)}
                          className="flex-1"
                        />
                        <div className="flex items-center gap-1.5">
                          <Checkbox
                            id="vatInclusiveHakedis"
                            checked={vatInclusive}
                            onCheckedChange={(checked) => setVatInclusive(checked === true)}
                          />
                          <Label htmlFor="vatInclusiveHakedis" className="text-xs font-normal cursor-pointer whitespace-nowrap">
                            Dahil
                          </Label>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Description/Notes */}
                  <div className="space-y-2">
                    <Label>
                      Açıklama <span className="text-destructive">*</span>
                    </Label>
                    <Textarea
                      placeholder="Hakediş ile ilgili notlarınızı buraya yazabilirsiniz... (Zorunlu)"
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      rows={3}
                      required
                    />
                    {!description.trim() && (
                      <p className="text-xs text-destructive">Açıklama alanı zorunludur</p>
                    )}
                  </div>
                </>
              )}

              {/* Alelhesap - Simple Payment Amount */}
              {hakedisType === 'alelhesap' && selectedContractId && (
                <div className="space-y-4">
                  <div className="rounded-lg border bg-muted/30 p-4">
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <p className="text-muted-foreground">Sözleşme Tutarı</p>
                        <p className="font-semibold">
                          {formatCurrencyWithType(selectedContract?.totalAmount || 0, hakedisCurrency)}
                        </p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Önceki Ödemeler</p>
                        <p className="font-semibold text-primary">
                          {formatCurrencyWithType(previousPaymentsTotal, hakedisCurrency)}
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Alelhesap Tutarı ({currencySymbols[hakedisCurrency]})</Label>
                    <Input
                      type="number"
                      placeholder="0.00"
                      value={paymentAmount}
                      onChange={(e) => setPaymentAmount(e.target.value)}
                    />
                    {paymentAmount && (
                      <div className="rounded-lg border bg-accent/50 p-3 text-sm space-y-2">
                        {(() => {
                          const entered = parseFloat(paymentAmount) || 0;
                          const vr = vatRate !== '' ? Number(vatRate) : 0;
                          const cur = hakedisCurrency;
                          if (vatInclusive && vr > 0) {
                            const base = entered / (1 + vr / 100);
                            const vatAmt = entered - base;
                            return (<>
                              <div className="flex justify-between"><span>Girilen Tutar (KDV Dahil)</span><span className="font-medium">{formatCurrencyWithType(entered, cur)}</span></div>
                              <div className="flex justify-between text-muted-foreground"><span>KDV Hariç Tutar</span><span>{formatCurrencyWithType(base, cur)}</span></div>
                              <div className="flex justify-between text-muted-foreground"><span>KDV (%{vr})</span><span>{formatCurrencyWithType(vatAmt, cur)}</span></div>
                              <div className="border-t pt-2 flex justify-between"><span className="font-medium">KDV Dahil Toplam</span><span className="font-semibold text-primary">{formatCurrencyWithType(entered, cur)}</span></div>
                            </>);
                          }
                          return (<>
                            <div className="flex justify-between"><span>Ara Toplam (KDV Hariç)</span><span className="font-medium">{formatCurrencyWithType(entered, cur)}</span></div>
                            {vr > 0 && (<>
                              <div className="flex justify-between text-muted-foreground"><span>KDV (%{vr})</span><span>{formatCurrencyWithType(entered * vr / 100, cur)}</span></div>
                              <div className="border-t pt-2 flex justify-between"><span className="font-medium">KDV Dahil Toplam</span><span className="font-semibold text-primary">{formatCurrencyWithType(entered * (1 + vr / 100), cur)}</span></div>
                            </>)}
                            {vr === 0 && (<div className="flex justify-between font-semibold"><span>Toplam</span><span>{formatCurrencyWithType(entered, cur)}</span></div>)}
                          </>);
                        })()}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Kesin Hesap - Birim Fiyat items with final quantities + previous payment deduction */}
              {hakedisType === 'kesin_hesap' && selectedContract?.contractType === 'birim_fiyat' && hakedisItems.length > 0 && (
                <div className="space-y-4">
                  <div className="rounded-lg border bg-muted/30 p-4">
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <p className="text-muted-foreground">Sözleşme Tutarı</p>
                        <p className="font-semibold">
                          {formatCurrencyWithType(selectedContract.totalAmount, hakedisCurrency)}
                        </p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Önceki Ödemeler Toplamı</p>
                        <p className="font-semibold text-primary">
                          {formatCurrencyWithType(previousPaymentsTotal, hakedisCurrency)}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <Label>Kesin İş Miktarları</Label>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={fillAllRemainingQuantities}
                      title="Her kalem için sözleşme metrajından önceki hakedişler düşülerek kalan otomatik doldurulur"
                    >
                      Tüm kalemler için kalanı getir
                    </Button>
                  </div>
                  <div className="space-y-3">
                    {hakedisItems.map((item) => {
                      const contractQty = selectedContract?.workItemEntries?.find(w => w.id === item.workItemEntryId)?.quantity ?? 0;
                      const used = cumulativeQuantities.get(item.workItemEntryId) || 0;
                      const remaining = Math.max(0, contractQty - used);
                      const over = item.quantity > remaining;
                      return (
                        <div key={item.id} className="rounded-lg border p-3">
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex-1">
                              <p className="font-medium text-sm">{item.workCategory}</p>
                              <p className="text-xs text-muted-foreground">{item.description}</p>
                              <p className="text-xs text-muted-foreground mt-1">
                                Birim Fiyat: {formatCurrencyWithType(item.unitPrice, hakedisCurrency)} / {item.unit}
                              </p>
                              <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-muted-foreground tabular-nums">
                                <span>Sözleşme: <span className="font-medium text-foreground">{contractQty} {item.unit}</span></span>
                                <span>Şimdiye kadar: <span className="font-medium text-foreground">{used} {item.unit}</span></span>
                                <span>Kalan: <span className={`font-medium ${remaining > 0 ? 'text-emerald-600' : 'text-muted-foreground'}`}>{remaining} {item.unit}</span></span>
                              </div>
                            </div>
                            <div className="flex flex-col items-end gap-1">
                              <div className="flex items-center gap-2">
                                <Input
                                  type="number"
                                  placeholder="Kesin Miktar"
                                  className={`w-28 ${over ? 'border-destructive focus-visible:ring-destructive' : ''}`}
                                  value={item.quantity || ''}
                                  onChange={(e) => updateHakedisItemQuantity(item.id, parseFloat(e.target.value) || 0)}
                                />
                                <span className="text-sm text-muted-foreground w-12">{item.unit}</span>
                              </div>
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="h-6 px-2 text-[11px]"
                                onClick={() => fillRemainingQuantity(item.id)}
                                disabled={remaining <= 0}
                              >
                                Kalanı getir
                              </Button>
                            </div>
                          </div>
                          {item.quantity > 0 && (
                            <div className={`mt-2 text-right text-sm font-medium ${over ? 'text-destructive' : ''}`}>
                              {over && <span className="text-[11px] mr-2">Kalan miktarı aşıyor</span>}
                              Tutar: {formatCurrencyWithType(item.amount, hakedisCurrency)}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>


                  {/* Extra Work Items for Kesin Hesap */}
                  {extraItems.length > 0 && (
                    <div className="space-y-3 mt-4">
                      <Label className="text-amber-600">Sözleşme Harici Ek İşler</Label>
                      {extraItems.map((item) => (
                        <div key={item.id} className="rounded-lg border border-amber-200 bg-amber-50/50 p-3">
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex-1">
                              <p className="font-medium text-sm">{item.description}</p>
                              <p className="text-xs text-muted-foreground mt-1">
                                {item.quantity} {item.unit} × {formatCurrencyWithType(item.unitPrice, hakedisCurrency)}
                              </p>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-sm">
                                {formatCurrencyWithType(item.amount, hakedisCurrency)}
                              </span>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-destructive hover:text-destructive"
                                onClick={() => setExtraItems(items => items.filter(i => i.id !== item.id))}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {!showAddExtraItem && (
                    <Button
                      type="button"
                      variant="outline"
                      className="w-full border-dashed border-amber-400 text-amber-600 hover:bg-amber-50 hover:text-amber-700"
                      onClick={() => setShowAddExtraItem(true)}
                    >
                      <PlusCircle className="h-4 w-4 mr-2" />
                      Sözleşme Harici Ek İş Ekle
                    </Button>
                  )}

                  {showAddExtraItem && (
                    <div className="rounded-lg border border-amber-200 bg-amber-50/50 p-4 space-y-4">
                      <div className="flex items-center justify-between">
                        <Label className="text-amber-700 font-semibold">Yeni Ek İş Kalemi</Label>
                        <Button type="button" variant="ghost" size="sm" onClick={() => { setShowAddExtraItem(false); setNewExtraItem({ description: '', unit: '', unitPrice: 0, quantity: 0 }); }}>İptal</Button>
                      </div>
                      <div className="space-y-3">
                        <div className="space-y-2">
                          <Label className="text-sm">İş Açıklaması</Label>
                          <Input placeholder="Örn: Ek işler" value={newExtraItem.description || ''} onChange={(e) => setNewExtraItem(prev => ({ ...prev, description: e.target.value }))} />
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                          <div className="space-y-2">
                            <Label className="text-sm">Miktar</Label>
                            <Input type="number" placeholder="0" value={newExtraItem.quantity || ''} onChange={(e) => setNewExtraItem(prev => ({ ...prev, quantity: parseFloat(e.target.value) || 0 }))} />
                          </div>
                          <div className="space-y-2">
                            <Label className="text-sm">Birim</Label>
                            <Input placeholder="m², adet, kg..." value={newExtraItem.unit || ''} onChange={(e) => setNewExtraItem(prev => ({ ...prev, unit: e.target.value }))} />
                          </div>
                          <div className="space-y-2 col-span-2 sm:col-span-1">
                            <Label className="text-sm">Birim Fiyat ({currencySymbols[hakedisCurrency]})</Label>
                            <Input type="number" placeholder="0.00" value={newExtraItem.unitPrice || ''} onChange={(e) => setNewExtraItem(prev => ({ ...prev, unitPrice: parseFloat(e.target.value) || 0 }))} />
                          </div>
                        </div>
                        {(newExtraItem.quantity || 0) > 0 && (newExtraItem.unitPrice || 0) > 0 && (
                          <div className="rounded-lg bg-amber-100 p-3 text-sm">
                            <div className="flex justify-between items-center">
                              <span className="text-amber-700">Toplam Tutar:</span>
                              <span className="font-bold text-amber-900">{formatCurrencyWithType((newExtraItem.quantity || 0) * (newExtraItem.unitPrice || 0), hakedisCurrency)}</span>
                            </div>
                          </div>
                        )}
                        <Button type="button" className="w-full" disabled={!newExtraItem.description || !newExtraItem.unit || !newExtraItem.quantity || !newExtraItem.unitPrice} onClick={() => {
                          const amount = (newExtraItem.quantity || 0) * (newExtraItem.unitPrice || 0);
                          setExtraItems(items => [...items, { id: crypto.randomUUID(), description: newExtraItem.description || '', unit: newExtraItem.unit || '', unitPrice: newExtraItem.unitPrice || 0, quantity: newExtraItem.quantity || 0, amount }]);
                          setNewExtraItem({ description: '', unit: '', unitPrice: 0, quantity: 0 }); setShowAddExtraItem(false); toast.success('Ek iş kalemi eklendi');
                        }}>
                          <Plus className="h-4 w-4 mr-2" /> Ek İş Kalemini Ekle
                        </Button>
                      </div>
                    </div>
                  )}

                  {/* Kesin Hesap Summary */}
                  {birimFiyatTotal > 0 && (
                    <div className="rounded-lg border-2 border-primary bg-primary/5 p-4 text-sm space-y-2">
                      <div className="flex justify-between">
                        <span>Kesin Hesap Tutarı</span>
                        <span className="font-medium">{formatCurrencyWithType(birimFiyatTotal, hakedisCurrency)}</span>
                      </div>
                      {vatRate !== '' && Number(vatRate) > 0 && (
                        <div className="flex justify-between text-muted-foreground">
                          <span>KDV (%{vatRate})</span>
                          <span>{formatCurrencyWithType(birimFiyatTotal * Number(vatRate) / 100, hakedisCurrency)}</span>
                        </div>
                      )}
                      <div className="border-t pt-2 flex justify-between">
                        <span className="font-medium">Önceki Ödemeler</span>
                        <span className="font-medium text-destructive">- {formatCurrencyWithType(previousPaymentsTotal, hakedisCurrency)}</span>
                      </div>
                      <div className="border-t pt-2 flex justify-between text-lg">
                        <span className="font-bold">Net Ödenecek Tutar</span>
                        <span className={`font-bold ${(birimFiyatTotal - previousPaymentsTotal) >= 0 ? 'text-primary' : 'text-destructive'}`}>
                          {formatCurrencyWithType(birimFiyatTotal - previousPaymentsTotal, hakedisCurrency)}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Götürü Bedel Payment (only for ara_hakedis) */}
              {hakedisType === 'ara_hakedis' && selectedContract?.contractType === 'goturu_bedel' && (
                <div className="space-y-4">
                  <div className="rounded-lg border bg-muted/30 p-4">
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <p className="text-muted-foreground">Sözleşme Tutarı</p>
                        <p className="font-semibold">
                          {formatCurrencyWithType(selectedContract.totalAmount, hakedisCurrency)}
                        </p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Ödenen Toplam</p>
                        <p className="font-semibold text-status-paid">
                          {formatCurrencyWithType(paidAmountForContract, hakedisCurrency)}
                        </p>
                      </div>
                      <div className="col-span-2">
                        <p className="text-muted-foreground">Kalan Tutar</p>
                        <p className="text-lg font-bold text-primary">
                          {formatCurrencyWithType(remainingAmount, hakedisCurrency)}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Ödenecek Tutar ({currencySymbols[hakedisCurrency]})</Label>
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
                          <span className="font-medium">{formatCurrencyWithType(parseFloat(paymentAmount) || 0, hakedisCurrency)}</span>
                        </div>
                        {vatRate !== '' && Number(vatRate) > 0 && (
                          <>
                            <div className="flex justify-between text-muted-foreground">
                              <span>KDV (%{vatRate})</span>
                              <span>{formatCurrencyWithType((parseFloat(paymentAmount) || 0) * Number(vatRate) / 100, hakedisCurrency)}</span>
                            </div>
                            <div className="border-t pt-2 flex justify-between">
                              <span className="font-medium">KDV Dahil Toplam</span>
                              <span className="font-semibold text-primary">
                                {formatCurrencyWithType((parseFloat(paymentAmount) || 0) * (1 + Number(vatRate) / 100), hakedisCurrency)}
                              </span>
                            </div>
                          </>
                        )}
                        {(vatRate === '' || Number(vatRate) === 0) && (
                          <div className="flex justify-between font-semibold">
                            <span>Toplam</span>
                            <span>{formatCurrencyWithType(parseFloat(paymentAmount) || 0, hakedisCurrency)}</span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Extra Work Items for Götürü Bedel */}
                  {extraItems.length > 0 && (
                    <div className="space-y-3 mt-4">
                      <Label className="text-amber-600">Sözleşme Harici Ek İşler</Label>
                      {extraItems.map((item) => (
                        <div key={item.id} className="rounded-lg border border-amber-200 bg-amber-50/50 p-3">
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex-1">
                              <p className="font-medium text-sm">{item.description}</p>
                              <p className="text-xs text-muted-foreground mt-1">
                                {item.quantity} {item.unit} × {formatCurrencyWithType(item.unitPrice, hakedisCurrency)}
                              </p>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-sm">
                                {formatCurrencyWithType(item.amount, hakedisCurrency)}
                              </span>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-destructive hover:text-destructive"
                                onClick={() => setExtraItems(items => items.filter(i => i.id !== item.id))}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Add Extra Work Item Button for Götürü Bedel */}
                  {!showAddExtraItem && (
                    <Button
                      type="button"
                      variant="outline"
                      className="w-full border-dashed border-amber-400 text-amber-600 hover:bg-amber-50 hover:text-amber-700"
                      onClick={() => setShowAddExtraItem(true)}
                    >
                      <PlusCircle className="h-4 w-4 mr-2" />
                      Sözleşme Harici Ek İş Ekle
                    </Button>
                  )}

                  {/* Add Extra Work Item Form for Götürü Bedel */}
                  {showAddExtraItem && (
                    <div className="rounded-lg border border-amber-200 bg-amber-50/50 p-4 space-y-4">
                      <div className="flex items-center justify-between">
                        <Label className="text-amber-700 font-semibold">Yeni Ek İş Kalemi</Label>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setShowAddExtraItem(false);
                            setNewExtraItem({ description: '', unit: '', unitPrice: 0, quantity: 0 });
                          }}
                        >
                          İptal
                        </Button>
                      </div>

                      <div className="space-y-3">
                        <div className="space-y-2">
                          <Label className="text-sm">İş Açıklaması</Label>
                          <Input
                            placeholder="Örn: Ek boya işleri"
                            value={newExtraItem.description || ''}
                            onChange={(e) => setNewExtraItem(prev => ({ ...prev, description: e.target.value }))}
                          />
                        </div>

                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                          <div className="space-y-2">
                            <Label className="text-sm">Miktar</Label>
                            <Input
                              type="number"
                              placeholder="0"
                              value={newExtraItem.quantity || ''}
                              onChange={(e) => setNewExtraItem(prev => ({ ...prev, quantity: parseFloat(e.target.value) || 0 }))}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label className="text-sm">Birim</Label>
                            <Input
                              placeholder="m², adet, kg..."
                              value={newExtraItem.unit || ''}
                              onChange={(e) => setNewExtraItem(prev => ({ ...prev, unit: e.target.value }))}
                            />
                          </div>
                          <div className="space-y-2 col-span-2 sm:col-span-1">
                            <Label className="text-sm">Birim Fiyat ({currencySymbols[hakedisCurrency]})</Label>
                            <Input
                              type="number"
                              placeholder="0.00"
                              value={newExtraItem.unitPrice || ''}
                              onChange={(e) => setNewExtraItem(prev => ({ ...prev, unitPrice: parseFloat(e.target.value) || 0 }))}
                            />
                          </div>
                        </div>

                        {/* Calculated Total */}
                        {(newExtraItem.quantity || 0) > 0 && (newExtraItem.unitPrice || 0) > 0 && (
                          <div className="rounded-lg bg-amber-100 p-3 text-sm">
                            <div className="flex justify-between items-center">
                              <span className="text-amber-700">Toplam Tutar:</span>
                              <span className="font-bold text-amber-900">
                                {formatCurrencyWithType((newExtraItem.quantity || 0) * (newExtraItem.unitPrice || 0), hakedisCurrency)}
                              </span>
                            </div>
                          </div>
                        )}

                        <Button
                          type="button"
                          className="w-full"
                          disabled={!newExtraItem.description || !newExtraItem.unit || !newExtraItem.quantity || !newExtraItem.unitPrice}
                          onClick={() => {
                            const amount = (newExtraItem.quantity || 0) * (newExtraItem.unitPrice || 0);
                            const extraItem: ExtraWorkItem = {
                              id: crypto.randomUUID(),
                              description: newExtraItem.description || '',
                              unit: newExtraItem.unit || '',
                              unitPrice: newExtraItem.unitPrice || 0,
                              quantity: newExtraItem.quantity || 0,
                              amount
                            };
                            setExtraItems(items => [...items, extraItem]);
                            setNewExtraItem({ description: '', unit: '', unitPrice: 0, quantity: 0 });
                            setShowAddExtraItem(false);
                            toast.success('Ek iş kalemi eklendi');
                          }}
                        >
                          <Plus className="h-4 w-4 mr-2" />
                          Ek İş Kalemini Ekle
                        </Button>
                      </div>
                    </div>
                  )}

                  {/* Updated Summary with Extra Items for Götürü Bedel */}
                  {extraItems.length > 0 && (
                    <div className="rounded-lg border bg-accent/50 p-3 text-sm space-y-2">
                      {(() => {
                        const payBase = parseFloat(paymentAmount) || 0;
                        const extraTotal = extraItems.reduce((sum, i) => sum + i.amount, 0);
                        const entered = payBase + extraTotal;
                        const vr = vatRate !== '' ? Number(vatRate) : 0;
                        const cur = hakedisCurrency;
                        return (<>
                          <div className="flex justify-between"><span>Sözleşme Ödemesi</span><span className="font-medium">{formatCurrencyWithType(payBase, cur)}</span></div>
                          <div className="flex justify-between text-amber-600"><span>Ek İşler Toplamı</span><span className="font-medium">{formatCurrencyWithType(extraTotal, cur)}</span></div>
                          {vatInclusive && vr > 0 ? (<>
                            <div className="border-t pt-2 flex justify-between"><span className="font-medium">Girilen Toplam (KDV Dahil)</span><span className="font-semibold">{formatCurrencyWithType(entered, cur)}</span></div>
                            <div className="flex justify-between text-muted-foreground"><span>KDV Hariç Tutar</span><span>{formatCurrencyWithType(entered / (1 + vr / 100), cur)}</span></div>
                            <div className="flex justify-between text-muted-foreground"><span>KDV (%{vr})</span><span>{formatCurrencyWithType(entered - entered / (1 + vr / 100), cur)}</span></div>
                          </>) : (<>
                            <div className="border-t pt-2 flex justify-between"><span className="font-medium">Ara Toplam (KDV Hariç)</span><span className="font-semibold">{formatCurrencyWithType(entered, cur)}</span></div>
                            {vr > 0 && (<>
                              <div className="flex justify-between text-muted-foreground"><span>KDV (%{vr})</span><span>{formatCurrencyWithType(entered * vr / 100, cur)}</span></div>
                              <div className="border-t pt-2 flex justify-between"><span className="font-medium">KDV Dahil Toplam</span><span className="font-semibold text-primary">{formatCurrencyWithType(entered * (1 + vr / 100), cur)}</span></div>
                            </>)}
                          </>)}
                        </>);
                      })()}
                    </div>
                  )}
                </div>
              )}

              {/* Birim Fiyat Items */}
              {hakedisType === 'ara_hakedis' && selectedContract?.contractType === 'birim_fiyat' && hakedisItems.length > 0 && (
                <div className="space-y-4">
                  {/* Contract Balance Info for Birim Fiyat */}
                  <div className="rounded-lg border bg-muted/30 p-4">
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <p className="text-muted-foreground">Sözleşme Tutarı</p>
                        <p className="font-semibold">
                          {formatCurrencyWithType(selectedContract.totalAmount, hakedisCurrency)}
                        </p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Toplam Hakediş</p>
                        <p className="font-semibold text-green-600">
                          {formatCurrencyWithType(paidAmountForContract, hakedisCurrency)}
                        </p>
                      </div>
                      <div className="col-span-2">
                        <p className="text-muted-foreground">Kalan Bakiye</p>
                        <p className={`text-lg font-bold ${remainingAmount > 0 ? 'text-amber-600' : remainingAmount < 0 ? 'text-destructive' : 'text-green-600'}`}>
                          {formatCurrencyWithType(remainingAmount, hakedisCurrency)}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <Label>İş Kalemleri ve Miktarlar</Label>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={fillAllRemainingQuantities}
                      title="Her kalem için sözleşme metrajından önceki hakedişler düşülerek kalan otomatik doldurulur"
                    >
                      Tüm kalemler için kalanı getir
                    </Button>
                  </div>
                  <div className="space-y-3">
                    {hakedisItems.map((item) => {
                      const contractQty = selectedContract?.workItemEntries?.find(w => w.id === item.workItemEntryId)?.quantity ?? 0;
                      const used = cumulativeQuantities.get(item.workItemEntryId) || 0;
                      const remaining = Math.max(0, contractQty - used);
                      const over = item.quantity > remaining;
                      return (
                        <div key={item.id} className="rounded-lg border p-3">
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex-1">
                              <p className="font-medium text-sm">{item.workCategory}</p>
                              <p className="text-xs text-muted-foreground">{item.description}</p>
                              <p className="text-xs text-muted-foreground mt-1">
                                Birim Fiyat: {formatCurrencyWithType(item.unitPrice, hakedisCurrency)} / {item.unit}
                              </p>
                              <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-muted-foreground tabular-nums">
                                <span>Sözleşme: <span className="font-medium text-foreground">{contractQty} {item.unit}</span></span>
                                <span>Şimdiye kadar: <span className="font-medium text-foreground">{used} {item.unit}</span></span>
                                <span>Kalan: <span className={`font-medium ${remaining > 0 ? 'text-emerald-600' : 'text-muted-foreground'}`}>{remaining} {item.unit}</span></span>
                              </div>
                            </div>
                            <div className="flex flex-col items-end gap-1">
                              <div className="flex items-center gap-2">
                                <Input
                                  type="number"
                                  placeholder="Miktar"
                                  className={`w-24 ${over ? 'border-destructive focus-visible:ring-destructive' : ''}`}
                                  value={item.quantity || ''}
                                  onChange={(e) => updateHakedisItemQuantity(item.id, parseFloat(e.target.value) || 0)}
                                />
                                <span className="text-sm text-muted-foreground w-12">{item.unit}</span>
                              </div>
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="h-6 px-2 text-[11px]"
                                onClick={() => fillRemainingQuantity(item.id)}
                                disabled={remaining <= 0}
                              >
                                Kalanı getir
                              </Button>
                            </div>
                          </div>
                          {item.quantity > 0 && (
                            <div className={`mt-2 text-right text-sm font-medium ${over ? 'text-destructive' : ''}`}>
                              {over && <span className="text-[11px] mr-2">Kalan miktarı aşıyor</span>}
                              Tutar: {formatCurrencyWithType(item.amount, hakedisCurrency)}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>


                  {/* Extra Work Items */}
                  {extraItems.length > 0 && (
                    <div className="space-y-3 mt-4">
                      <Label className="text-amber-600">Sözleşme Harici Ek İşler</Label>
                      {extraItems.map((item) => (
                        <div key={item.id} className="rounded-lg border border-amber-200 bg-amber-50/50 p-3">
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex-1">
                              <p className="font-medium text-sm">{item.description}</p>
                              <p className="text-xs text-muted-foreground mt-1">
                                {item.quantity} {item.unit} × {formatCurrencyWithType(item.unitPrice, hakedisCurrency)}
                              </p>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-sm">
                                {formatCurrencyWithType(item.amount, hakedisCurrency)}
                              </span>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-destructive hover:text-destructive"
                                onClick={() => setExtraItems(items => items.filter(i => i.id !== item.id))}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Add Extra Work Item Button */}
                  {!showAddExtraItem && (
                    <Button
                      type="button"
                      variant="outline"
                      className="w-full border-dashed border-amber-400 text-amber-600 hover:bg-amber-50 hover:text-amber-700"
                      onClick={() => setShowAddExtraItem(true)}
                    >
                      <PlusCircle className="h-4 w-4 mr-2" />
                      Sözleşme Harici Ek İş Ekle
                    </Button>
                  )}

                  {/* Add Extra Work Item Form */}
                  {showAddExtraItem && (
                    <div className="rounded-lg border border-amber-200 bg-amber-50/50 p-4 space-y-4">
                      <div className="flex items-center justify-between">
                        <Label className="text-amber-700 font-semibold">Yeni Ek İş Kalemi</Label>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setShowAddExtraItem(false);
                            setNewExtraItem({ description: '', unit: '', unitPrice: 0, quantity: 0 });
                          }}
                        >
                          İptal
                        </Button>
                      </div>

                      <div className="space-y-3">
                        <div className="space-y-2">
                          <Label className="text-sm">İş Açıklaması</Label>
                          <Input
                            placeholder="Örn: Ek boya işleri"
                            value={newExtraItem.description || ''}
                            onChange={(e) => setNewExtraItem(prev => ({ ...prev, description: e.target.value }))}
                          />
                        </div>

                        <div className="grid grid-cols-3 gap-3">
                          <div className="space-y-2">
                            <Label className="text-sm">Miktar</Label>
                            <Input
                              type="number"
                              placeholder="0"
                              value={newExtraItem.quantity || ''}
                              onChange={(e) => setNewExtraItem(prev => ({ ...prev, quantity: parseFloat(e.target.value) || 0 }))}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label className="text-sm">Birim</Label>
                            <Input
                              placeholder="m², adet, kg..."
                              value={newExtraItem.unit || ''}
                              onChange={(e) => setNewExtraItem(prev => ({ ...prev, unit: e.target.value }))}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label className="text-sm">Birim Fiyat ({currencySymbols[hakedisCurrency]})</Label>
                            <Input
                              type="number"
                              placeholder="0.00"
                              value={newExtraItem.unitPrice || ''}
                              onChange={(e) => setNewExtraItem(prev => ({ ...prev, unitPrice: parseFloat(e.target.value) || 0 }))}
                            />
                          </div>
                        </div>

                        {/* Calculated Total */}
                        {(newExtraItem.quantity || 0) > 0 && (newExtraItem.unitPrice || 0) > 0 && (
                          <div className="rounded-lg bg-amber-100 p-3 text-sm">
                            <div className="flex justify-between items-center">
                              <span className="text-amber-700">Toplam Tutar:</span>
                              <span className="font-bold text-amber-900">
                                {formatCurrencyWithType((newExtraItem.quantity || 0) * (newExtraItem.unitPrice || 0), hakedisCurrency)}
                              </span>
                            </div>
                          </div>
                        )}

                        <Button
                          type="button"
                          className="w-full"
                          disabled={!newExtraItem.description || !newExtraItem.unit || !newExtraItem.quantity || !newExtraItem.unitPrice}
                          onClick={() => {
                            const amount = (newExtraItem.quantity || 0) * (newExtraItem.unitPrice || 0);
                            const extraItem: ExtraWorkItem = {
                              id: crypto.randomUUID(),
                              description: newExtraItem.description || '',
                              unit: newExtraItem.unit || '',
                              unitPrice: newExtraItem.unitPrice || 0,
                              quantity: newExtraItem.quantity || 0,
                              amount
                            };
                            setExtraItems(items => [...items, extraItem]);
                            setNewExtraItem({ description: '', unit: '', unitPrice: 0, quantity: 0 });
                            setShowAddExtraItem(false);
                            toast.success('Ek iş kalemi eklendi');
                          }}
                        >
                          <Plus className="h-4 w-4 mr-2" />
                          Ek İş Kalemini Ekle
                        </Button>
                      </div>
                    </div>
                  )}

                  {birimFiyatTotal > 0 && (
                    <div className="rounded-lg border bg-accent/50 p-3 text-sm space-y-2">
                      {(() => {
                        const entered = birimFiyatTotal;
                        const vr = vatRate !== '' ? Number(vatRate) : 0;
                        const cur = hakedisCurrency;
                        if (vatInclusive && vr > 0) {
                          const base = entered / (1 + vr / 100);
                          const vatAmt = entered - base;
                          return (<>
                            <div className="flex justify-between"><span>Girilen Toplam (KDV Dahil)</span><span className="font-medium">{formatCurrencyWithType(entered, cur)}</span></div>
                            <div className="flex justify-between text-muted-foreground"><span>KDV Hariç Tutar</span><span>{formatCurrencyWithType(base, cur)}</span></div>
                            <div className="flex justify-between text-muted-foreground"><span>KDV (%{vr})</span><span>{formatCurrencyWithType(vatAmt, cur)}</span></div>
                            <div className="border-t pt-2 flex justify-between"><span className="font-medium">KDV Dahil Toplam</span><span className="font-semibold text-primary">{formatCurrencyWithType(entered, cur)}</span></div>
                          </>);
                        }
                        return (<>
                          <div className="flex justify-between"><span>Ara Toplam (KDV Hariç)</span><span className="font-medium">{formatCurrencyWithType(entered, cur)}</span></div>
                          {vr > 0 && (<>
                            <div className="flex justify-between text-muted-foreground"><span>KDV (%{vr})</span><span>{formatCurrencyWithType(entered * vr / 100, cur)}</span></div>
                            <div className="border-t pt-2 flex justify-between"><span className="font-medium">KDV Dahil Toplam</span><span className="font-semibold text-primary">{formatCurrencyWithType(entered * (1 + vr / 100), cur)}</span></div>
                          </>)}
                          {vr === 0 && (<div className="flex justify-between font-semibold"><span>Toplam</span><span>{formatCurrencyWithType(entered, cur)}</span></div>)}
                        </>);
                      })()}
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
                    <p className="font-medium">{selectedHakedis.contractNo || 'Sözleşmesiz'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Proje</p>
                    <p className="font-medium">
                      {projects.find(p => p.id === selectedHakedis.projectId)?.projectName || 'Küçük İş'}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Altyüklenici</p>
                    <p className="font-medium">{selectedHakedis.subcontractor}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Hakediş Tipi</p>
                    <p className="font-medium">{hakedisTypeLabels[selectedHakedis.hakedisType || 'ara_hakedis']}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Sözleşme Tipi</p>
                    <p className="font-medium">{selectedHakedis.contractId ? contractTypeLabels[selectedHakedis.contractType] : 'Sözleşmesiz Küçük Hakediş'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Tarih</p>
                    <p className="font-medium">{formatDate(selectedHakedis.date)}</p>
                  </div>
                </div>

                {/* Hakediş Description */}
                {selectedHakedis.description && (
                  <div className="rounded-lg border bg-muted/30 p-4">
                    <p className="text-xs text-muted-foreground mb-1">Hakediş Açıklaması</p>
                    <p className="text-sm text-foreground">{selectedHakedis.description}</p>
                  </div>
                )}
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

                {/* Extra Work Items for Birim Fiyat */}
                {selectedHakedis.extraItems && selectedHakedis.extraItems.length > 0 && (
                  <div>
                    <p className="text-xs text-amber-600 mb-2 font-medium">Sözleşme Harici Ek İşler</p>
                    <div className="rounded-lg border border-amber-200 bg-amber-50/50 divide-y divide-amber-200">
                      {selectedHakedis.extraItems.map((item, index) => (
                        <div key={index} className="p-3 flex justify-between items-center">
                          <div>
                            <p className="font-medium text-sm">{item.description}</p>
                            <p className="text-xs text-muted-foreground">
                              {item.quantity} {item.unit} x {formatCurrencyWithType(item.unitPrice, selectedHakedis.currency)}
                            </p>
                          </div>
                          <p className="font-semibold text-sm text-amber-700">
                            {formatCurrencyWithType(item.amount, selectedHakedis.currency)}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Total and Payment Summary */}
                <div className="rounded-lg bg-muted/50 p-4 space-y-2">
                  {(() => {
                    const hVatRate = selectedHakedis.vatRate || 0;
                    const hSubtotal = selectedHakedis.totalAmount;
                    const hVatAmount = hVatRate > 0 ? hSubtotal * (hVatRate / 100) : 0;
                    const hTotalWithVat = hSubtotal + hVatAmount;

                    return (
                      <>
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Bu Hakediş Tutarı (KDV Hariç)</span>
                          <span className="font-medium">{formatCurrencyWithType(hSubtotal, selectedHakedis.currency)}</span>
                        </div>
                        {hVatRate > 0 && (
                          <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">KDV (%{hVatRate})</span>
                            <span className="font-medium">{formatCurrencyWithType(hVatAmount, selectedHakedis.currency)}</span>
                          </div>
                        )}
                        <div className="flex justify-between text-sm font-semibold">
                          <span>Bu Hakediş Tutarı (KDV Dahil)</span>
                          <span className="text-primary text-lg">{formatCurrencyWithType(hTotalWithVat, selectedHakedis.currency)}</span>
                        </div>
                      </>
                    );
                  })()}
                  {(() => {
                    const contract = workEntries.find(e => e.id === selectedHakedis.contractId);
                    if (!contract) return null;

                    const cVatRate = contract.vatRate || 0;
                    const cSubtotal = contract.totalAmount;
                    const cVatAmount = cVatRate > 0 ? cSubtotal * (cVatRate / 100) : 0;
                    const cTotalWithVat = cSubtotal + cVatAmount;

                    const allHakedisler = subcontractorHakedisler.filter(h => h.contractId === selectedHakedis.contractId);
                    const totalHakedisWithVat = allHakedisler.reduce((sum, h) => {
                      const hv = h.vatRate ? h.totalAmount * (h.vatRate / 100) : 0;
                      return sum + h.totalAmount + hv;
                    }, 0);
                    const previousPaidWithVat = allHakedisler
                      .filter(h => h.id !== selectedHakedis.id)
                      .reduce((sum, h) => {
                        const hv = h.vatRate ? h.totalAmount * (h.vatRate / 100) : 0;
                        return sum + h.totalAmount + hv;
                      }, 0);
                    const paidTotal = allHakedisler.reduce((sum, h) => sum + (h.paidAmount || 0), 0);
                    const hVatRateC = selectedHakedis.vatRate || 0;
                    const hTotalWithVatC = selectedHakedis.totalAmount + (hVatRateC > 0 ? selectedHakedis.totalAmount * (hVatRateC / 100) : 0);
                    const thisHakedisPaid = selectedHakedis.paidAmount || 0;
                    const remainingAfterPayment = cTotalWithVat - paidTotal - (hTotalWithVatC - thisHakedisPaid);

                    return (
                      <>
                        {selectedHakedis.hakedisType === 'kesin_hesap' && (
                          <div className="border-t pt-2 mt-2 space-y-1">
                            <div className="flex justify-between text-sm">
                              <span className="font-medium">Önceki Ödemeler (KDV Dahil)</span>
                              <span className="font-medium text-destructive">- {formatCurrencyWithType(previousPaidWithVat, contract.currency)}</span>
                            </div>
                            <div className="flex justify-between text-sm border-t pt-2 mt-1">
                              <span className="font-bold">Net Ödenecek Tutar (KDV Dahil)</span>
                              <span className={`font-bold text-lg ${(selectedHakedis.totalAmount - previousPaidWithVat) >= 0 ? 'text-primary' : 'text-destructive'}`}>
                                {formatCurrencyWithType(
                                  (selectedHakedis.totalAmount + (selectedHakedis.vatRate ? selectedHakedis.totalAmount * (selectedHakedis.vatRate / 100) : 0)) - previousPaidWithVat,
                                  contract.currency
                                )}
                              </span>
                            </div>
                          </div>
                        )}
                        <div className="border-t pt-2 mt-2 space-y-1">
                          <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">Sözleşme Tutarı (KDV Hariç)</span>
                            <span className="font-medium">{formatCurrencyWithType(cSubtotal, contract.currency)}</span>
                          </div>
                          {cVatRate > 0 && (
                            <div className="flex justify-between text-sm">
                              <span className="text-muted-foreground">KDV (%{cVatRate})</span>
                              <span className="font-medium">{formatCurrencyWithType(cVatAmount, contract.currency)}</span>
                            </div>
                          )}
                          <div className="flex justify-between text-sm font-semibold">
                            <span>Sözleşme Tutarı (KDV Dahil)</span>
                            <span>{formatCurrencyWithType(cTotalWithVat, contract.currency)}</span>
                          </div>
                          <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">Toplam Hakediş (KDV Dahil)</span>
                            <span className="text-primary font-medium">{formatCurrencyWithType(totalHakedisWithVat, contract.currency)}</span>
                          </div>
                          <div className="flex justify-between text-sm border-t pt-2 mt-1">
                            <span className="font-semibold">Ödeme Gerçekleşince Kalan Bakiye (KDV Dahil)</span>
                            <span className={`font-semibold ${remainingAfterPayment > 0 ? 'text-amber-600' : remainingAfterPayment < 0 ? 'text-destructive' : 'text-primary'}`}>
                              {formatCurrencyWithType(remainingAfterPayment, contract.currency)}
                            </span>
                          </div>
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
                onClick={async () => {
                  if (selectedHakedis) {
                    try {
                      await deleteSubcontractorHakedis(selectedHakedis.id);
                      toast.success('Hakediş kaydı silindi');
                      setIsDeleteDialogOpen(false);
                      setSelectedHakedis(null);
                    } catch (error) {
                      console.error('Error deleting hakedis:', error);
                      toast.error('Hakediş silinemedi');
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

        {/* Small Contractless Hakediş Dialog */}
        <Dialog open={isSmallHakedisDialogOpen} onOpenChange={(open) => { if (!open) { resetSmallForm(); } setIsSmallHakedisDialogOpen(open); }}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{isEditMode ? 'Sözleşmesiz Küçük Hakediş Düzenle' : 'Sözleşmesiz Küçük Hakediş'}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              {/* Subcontractor */}
              <div className="space-y-2">
                <Label>Altyüklenici</Label>
                <Select value={smallSubcontractorMode} onValueChange={(v: 'existing' | 'custom') => { setSmallSubcontractorMode(v); setSmallSubcontractor(''); setSmallCustomSubcontractor(''); }}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="existing">Mevcut Altyüklenici</SelectItem>
                    <SelectItem value="custom">Yeni Altyüklenici</SelectItem>
                  </SelectContent>
                </Select>
                {smallSubcontractorMode === 'existing' ? (
                  <Select value={smallSubcontractor} onValueChange={setSmallSubcontractor}>
                    <SelectTrigger>
                      <SelectValue placeholder="Altyüklenici seçin" />
                    </SelectTrigger>
                    <SelectContent>
                      {allSubcontractorNames.map(name => (
                        <SelectItem key={name} value={name}>{name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <Input placeholder="Altyüklenici adını yazın" value={smallCustomSubcontractor} onChange={e => setSmallCustomSubcontractor(e.target.value)} />
                )}
                {smallSubcontractorMode === 'existing' && smallSubcontractor && (() => {
                  const sub = subcontractors.find(s => s.name === smallSubcontractor);
                  return sub?.workCategory ? (
                    <div className="text-sm text-muted-foreground bg-muted/50 rounded px-3 py-1.5">
                      İş Kalemi: <span className="font-medium text-foreground">{sub.workCategory}</span>
                    </div>
                  ) : null;
                })()}
              </div>

              {/* Date + Currency */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Tarih</Label>
                  <Input type="date" value={smallDate} onChange={e => setSmallDate(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Para Birimi</Label>
                  <Select value={smallCurrency} onValueChange={(v: Currency) => setSmallCurrency(v)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="TRY">₺ TRY</SelectItem>
                      <SelectItem value="USD">$ USD</SelectItem>
                      <SelectItem value="EUR">€ EUR</SelectItem>
                      <SelectItem value="GBP">£ GBP</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Project rows */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label>Proje Satırları {!isEditMode && <span className="text-xs text-muted-foreground font-normal">(Aynı altyüklenici için birden fazla projede hakediş girebilirsiniz)</span>}</Label>
                  {!isEditMode && (
                    <Button type="button" variant="outline" size="sm" onClick={() => setSmallRows(prev => [...prev, makeEmptyRow()])} className="gap-1">
                      <Plus className="h-3.5 w-3.5" /> Satır Ekle
                    </Button>
                  )}
                </div>

                {smallRows.map((row, idx) => {
                  const rawAmt = parseFloat(row.amount) || 0;
                  const vr = row.vatRate !== '' ? Number(row.vatRate) : 0;
                  let baseAmount = rawAmt;
                  if (row.vatInclusive && vr > 0) baseAmount = rawAmt / (1 + vr / 100);
                  const vatAmount = vr > 0 ? baseAmount * (vr / 100) : 0;
                  const totalWithVat = baseAmount + vatAmount;

                  const updateRow = (patch: Partial<SmallRow>) => {
                    setSmallRows(prev => prev.map((r, i) => i === idx ? { ...r, ...patch } : r));
                  };

                  return (
                    <div key={idx} className="rounded-lg border p-3 space-y-3 bg-muted/20">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-muted-foreground">Satır {idx + 1}</span>
                        {smallRows.length > 1 && !isEditMode && (
                          <Button type="button" variant="ghost" size="sm" onClick={() => setSmallRows(prev => prev.filter((_, i) => i !== idx))} className="h-7 px-2 text-destructive">
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </div>

                      {/* Project */}
                      <div className="space-y-2">
                        <Label className="text-xs">Proje</Label>
                        <Select value={row.projectMode} onValueChange={(v: 'existing' | 'custom') => updateRow({ projectMode: v, projectId: '', projectName: '' })}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="existing">Mevcut Proje</SelectItem>
                            <SelectItem value="custom">Küçük İş (Serbest Giriş)</SelectItem>
                          </SelectContent>
                        </Select>
                        {row.projectMode === 'existing' ? (
                          <Select value={row.projectId} onValueChange={(v) => updateRow({ projectId: v })}>
                            <SelectTrigger>
                              <SelectValue placeholder="Proje seçin" />
                            </SelectTrigger>
                            <SelectContent>
                              {projects.map(p => (
                                <SelectItem key={p.id} value={p.id}>{p.projectCode} - {p.projectName}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        ) : (
                          <Input placeholder="Proje / iş adını yazın" value={row.projectName} onChange={e => updateRow({ projectName: e.target.value })} />
                        )}
                      </div>

                      {/* Description */}
                      <div className="space-y-2">
                        <Label className="text-xs">Açıklama</Label>
                        <Textarea placeholder="Hakediş açıklaması" value={row.description} onChange={e => updateRow({ description: e.target.value })} rows={2} />
                      </div>

                      {/* Amount + VAT */}
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-2">
                          <Label className="text-xs">Tutar</Label>
                          <Input type="number" placeholder="0.00" value={row.amount} onChange={e => updateRow({ amount: e.target.value })} min="0" step="0.01" />
                        </div>
                        <div className="space-y-2">
                          <Label className="text-xs">KDV Oranı (%)</Label>
                          <div className="flex items-center gap-2">
                            <Input type="number" className="w-20" value={row.vatRate} onChange={e => updateRow({ vatRate: e.target.value })} min="0" step="1" />
                            <div className="flex items-center gap-1.5">
                              <Checkbox id={`small-vat-inclusive-${idx}`} checked={row.vatInclusive} onCheckedChange={(checked) => updateRow({ vatInclusive: checked === true })} />
                              <Label htmlFor={`small-vat-inclusive-${idx}`} className="text-xs cursor-pointer">Dahil</Label>
                            </div>
                          </div>
                        </div>
                      </div>

                      {rawAmt > 0 && (
                        <div className="rounded border bg-background p-2.5 space-y-1 text-xs">
                          {row.vatInclusive && vr > 0 && (
                            <div className="flex justify-between"><span className="text-muted-foreground">Girilen (KDV Dahil)</span><span>{formatCurrencyWithType(rawAmt, smallCurrency)}</span></div>
                          )}
                          <div className="flex justify-between"><span className="text-muted-foreground">KDV Hariç</span><span>{formatCurrencyWithType(baseAmount, smallCurrency)}</span></div>
                          {vr > 0 && (
                            <div className="flex justify-between"><span className="text-muted-foreground">KDV (%{vr})</span><span>{formatCurrencyWithType(vatAmount, smallCurrency)}</span></div>
                          )}
                          <div className="flex justify-between font-semibold border-t pt-1"><span>KDV Dahil Toplam</span><span className="text-primary">{formatCurrencyWithType(totalWithVat, smallCurrency)}</span></div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={() => { resetSmallForm(); setIsSmallHakedisDialogOpen(false); }}>İptal</Button>
              <Button onClick={handleSmallHakedisSubmit}>{isEditMode ? 'Güncelle' : 'Hakediş Oluştur'}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Multi-Project Hakediş Dialog (new) */}
        <MultiProjectHakedisDialog
          open={isMultiDialogOpen}
          onOpenChange={setIsMultiDialogOpen}
        />
      </div>
    </MainLayout>
  );
}
