import { useState } from 'react';
import { MainLayout } from '@/components/MainLayout';
import { StatusBadge } from '@/components/StatusBadge';
import { useHakedisStore } from '@/store/hakedisStore';
import { 
  formatCurrency, 
  formatDate, 
  WorkEntry,
  calculateVAT,
  calculateTotalWithVAT
} from '@/types/hakedis';
import { 
  Plus, 
  Search, 
  ClipboardList,
  Calendar,
  FileText
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
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
    workItems, 
    milestones, 
    workEntries, 
    addWorkEntry,
    currentUser 
  } = useHakedisStore();
  
  const [searchQuery, setSearchQuery] = useState('');
  const [filterProject, setFilterProject] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  
  const [newEntry, setNewEntry] = useState({
    projectId: '',
    workItemId: '',
    milestoneId: '',
    quantity: '',
    completionPercentage: '',
    description: '',
    date: new Date().toISOString().split('T')[0],
  });

  const selectedProject = projects.find(p => p.id === newEntry.projectId);
  const projectWorkItems = workItems.filter(wi => wi.projectId === newEntry.projectId);
  const projectMilestones = milestones.filter(m => m.projectId === newEntry.projectId);

  const filteredEntries = workEntries.filter(entry => {
    const project = projects.find(p => p.id === entry.projectId);
    const matchesSearch = 
      entry.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      project?.projectName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      project?.projectCode.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesProject = filterProject === 'all' || entry.projectId === filterProject;
    const matchesStatus = filterStatus === 'all' || entry.approvalStatus === filterStatus;
    return matchesSearch && matchesProject && matchesStatus;
  });

  const sortedEntries = [...filteredEntries].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  const calculateEntryAmount = () => {
    if (!selectedProject) return { subtotal: 0, vatAmount: 0, totalAmount: 0 };

    let subtotal = 0;

    if (selectedProject.contractType === 'birim_fiyat' && newEntry.workItemId) {
      const workItem = workItems.find(wi => wi.id === newEntry.workItemId);
      if (workItem && newEntry.quantity) {
        subtotal = parseFloat(newEntry.quantity) * workItem.unitPrice;
      }
    } else if (selectedProject.contractType === 'goturu_bedel' && newEntry.milestoneId) {
      const milestone = milestones.find(m => m.id === newEntry.milestoneId);
      if (milestone && newEntry.completionPercentage) {
        subtotal = milestone.amount * (parseFloat(newEntry.completionPercentage) / 100);
      }
    }

    const vatAmount = calculateVAT(subtotal);
    const totalAmount = calculateTotalWithVAT(subtotal);

    return { subtotal, vatAmount, totalAmount };
  };

  const handleCreateEntry = () => {
    if (!newEntry.projectId || !newEntry.description) return;

    const amounts = calculateEntryAmount();

    const entry: WorkEntry = {
      id: `we${Date.now()}`,
      projectId: newEntry.projectId,
      workItemId: selectedProject?.contractType === 'birim_fiyat' ? newEntry.workItemId : undefined,
      milestoneId: selectedProject?.contractType === 'goturu_bedel' ? newEntry.milestoneId : undefined,
      quantity: newEntry.quantity ? parseFloat(newEntry.quantity) : undefined,
      completionPercentage: newEntry.completionPercentage ? parseFloat(newEntry.completionPercentage) : undefined,
      description: newEntry.description,
      date: newEntry.date,
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
    setIsDialogOpen(false);
    setNewEntry({
      projectId: '',
      workItemId: '',
      milestoneId: '',
      quantity: '',
      completionPercentage: '',
      description: '',
      date: new Date().toISOString().split('T')[0],
    });
  };

  const amounts = calculateEntryAmount();

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-foreground">Yapılan İşler</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Tüm yapılan iş kayıtlarını görüntüleyin ve yönetin
            </p>
          </div>
          {currentUser.role === 'saha_sorumlusu' && (
            <Button onClick={() => setIsDialogOpen(true)} className="gap-2">
              <Plus className="h-4 w-4" />
              Yeni Kayıt
            </Button>
          )}
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
                    Açıklama
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Proje
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Tarih
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Tutar
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Onay Durumu
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Ödeme
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y">
                <AnimatePresence>
                  {sortedEntries.map((entry) => {
                    const project = projects.find(p => p.id === entry.projectId);
                    const workItem = workItems.find(wi => wi.id === entry.workItemId);
                    const milestone = milestones.find(m => m.id === entry.milestoneId);
                    
                    return (
                      <motion.tr
                        key={entry.id}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="group hover:bg-muted/30"
                      >
                        <td className="px-4 py-4">
                          <div className="max-w-xs">
                            <p className="font-medium text-foreground truncate">
                              {entry.description}
                            </p>
                            {workItem && (
                              <p className="text-xs text-muted-foreground mt-0.5">
                                {workItem.itemCode}: {entry.quantity} {workItem.unit}
                              </p>
                            )}
                            {milestone && (
                              <p className="text-xs text-muted-foreground mt-0.5">
                                {milestone.name}: %{entry.completionPercentage}
                              </p>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-4">
                          <p className="text-sm font-medium text-foreground">
                            {project?.projectCode}
                          </p>
                          <p className="text-xs text-muted-foreground truncate max-w-[150px]">
                            {project?.projectName}
                          </p>
                        </td>
                        <td className="px-4 py-4">
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Calendar className="h-4 w-4" />
                            {formatDate(entry.date)}
                          </div>
                        </td>
                        <td className="px-4 py-4 text-right">
                          <p className="text-sm font-semibold text-foreground">
                            {formatCurrency(entry.totalAmount)}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            KDV: {formatCurrency(entry.vatAmount)}
                          </p>
                        </td>
                        <td className="px-4 py-4 text-center">
                          <StatusBadge status={entry.approvalStatus} />
                        </td>
                        <td className="px-4 py-4 text-center">
                          <StatusBadge status={entry.paymentStatus} />
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
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Yeni Yapılan İş Kaydı</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Proje *</Label>
              <Select
                value={newEntry.projectId}
                onValueChange={(value) => setNewEntry({ 
                  ...newEntry, 
                  projectId: value,
                  workItemId: '',
                  milestoneId: '',
                  quantity: '',
                  completionPercentage: ''
                })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Proje seçin" />
                </SelectTrigger>
                <SelectContent>
                  {projects.map((project) => (
                    <SelectItem key={project.id} value={project.id}>
                      {project.projectCode} - {project.projectName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {selectedProject?.contractType === 'birim_fiyat' && (
              <>
                <div className="space-y-2">
                  <Label>İş Kalemi *</Label>
                  <Select
                    value={newEntry.workItemId}
                    onValueChange={(value) => setNewEntry({ ...newEntry, workItemId: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="İş kalemi seçin" />
                    </SelectTrigger>
                    <SelectContent>
                      {projectWorkItems.map((item) => (
                        <SelectItem key={item.id} value={item.id}>
                          {item.itemCode} - {item.description} ({formatCurrency(item.unitPrice)}/{item.unit})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Miktar</Label>
                  <Input
                    type="number"
                    placeholder="0"
                    value={newEntry.quantity}
                    onChange={(e) => setNewEntry({ ...newEntry, quantity: e.target.value })}
                  />
                </div>
              </>
            )}

            {selectedProject?.contractType === 'goturu_bedel' && (
              <>
                <div className="space-y-2">
                  <Label>Kilometre Taşı *</Label>
                  <Select
                    value={newEntry.milestoneId}
                    onValueChange={(value) => setNewEntry({ ...newEntry, milestoneId: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Kilometre taşı seçin" />
                    </SelectTrigger>
                    <SelectContent>
                      {projectMilestones.map((milestone) => (
                        <SelectItem key={milestone.id} value={milestone.id}>
                          {milestone.name} - %{milestone.percentage} ({formatCurrency(milestone.amount)})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Tamamlanma Yüzdesi (%)</Label>
                  <Input
                    type="number"
                    placeholder="0"
                    min="0"
                    max="100"
                    value={newEntry.completionPercentage}
                    onChange={(e) => setNewEntry({ ...newEntry, completionPercentage: e.target.value })}
                  />
                </div>
              </>
            )}

            <div className="space-y-2">
              <Label>Tarih</Label>
              <Input
                type="date"
                value={newEntry.date}
                onChange={(e) => setNewEntry({ ...newEntry, date: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label>Açıklama *</Label>
              <Textarea
                placeholder="Yapılan iş açıklaması"
                value={newEntry.description}
                onChange={(e) => setNewEntry({ ...newEntry, description: e.target.value })}
                rows={3}
              />
            </div>

            {/* Amount Preview */}
            {amounts.subtotal > 0 && (
              <div className="rounded-lg bg-muted/50 p-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Ara Toplam</span>
                  <span className="font-medium">{formatCurrency(amounts.subtotal)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">KDV (%20)</span>
                  <span className="font-medium">{formatCurrency(amounts.vatAmount)}</span>
                </div>
                <div className="flex justify-between text-sm pt-2 border-t">
                  <span className="font-medium">Toplam</span>
                  <span className="font-semibold text-primary">{formatCurrency(amounts.totalAmount)}</span>
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              İptal
            </Button>
            <Button onClick={handleCreateEntry}>
              Kayıt Oluştur
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </MainLayout>
  );
}
