import { useState } from 'react';
import { MainLayout } from '@/components/MainLayout';
import { StatusBadge } from '@/components/StatusBadge';
import { useHakedisStore } from '@/store/hakedisStore';
import { 
  formatCurrencyWithType, 
  formatDate, 
  WorkEntry,
  PaymentInstallment,
  WorkItemEntry,
  calculateVAT,
  calculateTotalWithVAT,
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
  Upload
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
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

export default function WorkEntries() {
  const { 
    projects, 
    workEntries, 
    addWorkEntry,
    getNextContractNo,
    subcontractors,
    addSubcontractor,
    currentUser 
  } = useHakedisStore();
  
  const [searchQuery, setSearchQuery] = useState('');
  const [filterProject, setFilterProject] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  
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
    const matchesStatus = filterStatus === 'all' || entry.approvalStatus === filterStatus;
    return matchesSearch && matchesProject && matchesStatus;
  });

  const sortedEntries = [...filteredEntries].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  const calculateTotals = () => {
    let subtotal = 0;

    if (newEntry.contractType === 'goturu_bedel') {
      subtotal = paymentPlan.reduce((sum, p) => sum + p.amount, 0);
    } else {
      subtotal = workItemEntries.reduce((sum, w) => sum + (w.quantity * w.unitPrice), 0);
    }

    const vatAmount = calculateVAT(subtotal);
    const totalAmount = calculateTotalWithVAT(subtotal);

    return { subtotal, vatAmount, totalAmount };
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
      subtotal: amounts.subtotal,
      vatAmount: amounts.vatAmount,
      totalAmount: amounts.totalAmount,
      paymentStatus: 'odenmedi',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    addWorkEntry(entry);
    handleCloseDialog();
  };

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
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
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-full sm:w-48">
              <SelectValue placeholder="Durum" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tüm Durumlar</SelectItem>
              <SelectItem value="onay_bekliyor">Onay Bekliyor</SelectItem>
              <SelectItem value="onaylandi">Onaylandı</SelectItem>
              <SelectItem value="revize">Revize Gerekli</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Entries Table */}
        <div className="card-elevated overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Proje
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    İş Kalemi
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Altyüklenici
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Tarih
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Sözleşme No
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Sözleşme Tipi
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Tutar
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
                          <p className="text-xs text-muted-foreground">
                            KDV: {formatCurrencyWithType(entry.vatAmount, entry.currency)}
                          </p>
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
            <DialogTitle>Yeni Yapılan İş Kaydı</DialogTitle>
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
            {amounts.subtotal > 0 && (
              <div className="rounded-lg bg-muted/50 p-4">
                <div className="flex justify-between text-sm">
                  <span className="font-medium">Ara Toplam</span>
                  <span className="font-semibold text-primary">{formatCurrencyWithType(amounts.subtotal, newEntry.currency)}</span>
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={handleCloseDialog}>
              İptal
            </Button>
            <Button onClick={handleCreateEntry}>
              Kaydet
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </MainLayout>
  );
}
