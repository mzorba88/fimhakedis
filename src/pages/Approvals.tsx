import { useState } from 'react';
import { MainLayout } from '@/components/MainLayout';
import { StatusBadge } from '@/components/StatusBadge';
import { useHakedisStore } from '@/store/hakedisStore';
import { formatCurrencyWithType, formatDate, contractTypeLabels } from '@/types/hakedis';
import { 
  Search, 
  CheckCircle2,
  XCircle,
  Clock,
  AlertTriangle,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';

export default function Approvals() {
  const { 
    projects, 
    workEntries, 
    approveEntry,
    rejectEntry,
    currentUser 
  } = useHakedisStore();
  
  const [searchQuery, setSearchQuery] = useState('');
  const [filterProject, setFilterProject] = useState<string>('all');
  const [expandedEntry, setExpandedEntry] = useState<string | null>(null);
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [selectedEntryId, setSelectedEntryId] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');

  const pendingEntries = workEntries.filter(e => e.approvalStatus === 'onay_bekliyor');

  const filteredEntries = pendingEntries.filter(entry => {
    const project = projects.find(p => p.id === entry.projectId);
    const matchesSearch = 
      entry.workCategory.toLowerCase().includes(searchQuery.toLowerCase()) ||
      entry.subcontractor.toLowerCase().includes(searchQuery.toLowerCase()) ||
      project?.projectName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      project?.projectCode.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesProject = filterProject === 'all' || entry.projectId === filterProject;
    return matchesSearch && matchesProject;
  });

  const sortedEntries = [...filteredEntries].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  );

  const handleApprove = (entryId: string) => {
    approveEntry(entryId, currentUser.id);
    toast.success('İş kaydı onaylandı');
  };

  const handleReject = () => {
    if (!selectedEntryId || !rejectionReason.trim()) return;
    rejectEntry(selectedEntryId, rejectionReason);
    setRejectDialogOpen(false);
    setSelectedEntryId(null);
    setRejectionReason('');
    toast.info('İş kaydı revize için geri gönderildi');
  };

  const openRejectDialog = (entryId: string) => {
    setSelectedEntryId(entryId);
    setRejectDialogOpen(true);
  };

  const isDirector = currentUser.role === 'direktor';

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-foreground">Onay Bekleyenler</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Direktör onayı bekleyen iş kayıtları
            </p>
          </div>
          <div className="flex items-center gap-2 rounded-lg bg-status-pending-bg px-4 py-2">
            <Clock className="h-5 w-5 text-status-pending" />
            <span className="text-sm font-medium text-status-pending">
              {pendingEntries.length} kayıt bekliyor
            </span>
          </div>
        </div>

        {/* Info Banner for non-directors */}
        {!isDirector && (
          <div className="flex items-center gap-3 rounded-lg border border-status-pending/30 bg-status-pending-bg p-4">
            <AlertTriangle className="h-5 w-5 text-status-pending" />
            <p className="text-sm text-foreground">
              Onay işlemleri sadece <strong>Direktör</strong> rolündeki kullanıcılar tarafından yapılabilir.
              Rol değiştirmek için sağ üstteki menüyü kullanabilirsiniz.
            </p>
          </div>
        )}

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

        {/* Approval Cards */}
        <div className="space-y-4">
          <AnimatePresence>
            {sortedEntries.map((entry, index) => {
              const project = projects.find(p => p.id === entry.projectId);
              const isExpanded = expandedEntry === entry.id;

              return (
                <motion.div
                  key={entry.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, x: -100 }}
                  transition={{ delay: index * 0.05 }}
                  className="card-elevated overflow-hidden"
                >
                  <div className="p-4 sm:p-6">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start gap-3">
                          <div className="rounded-lg bg-status-pending-bg p-2.5">
                            <Clock className="h-5 w-5 text-status-pending" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <h3 className="font-medium text-foreground">
                              {entry.workCategory}
                            </h3>
                            <p className="mt-0.5 text-sm text-muted-foreground">
                              {entry.subcontractor}
                            </p>
                            <p className="mt-1 text-sm text-muted-foreground">
                              {project?.projectCode} - {project?.projectName}
                            </p>
                            <p className="text-xs text-muted-foreground mt-1">
                              Oluşturulma: {formatDate(entry.createdAt)}
                            </p>
                          </div>
                        </div>
                      </div>

                      <div className="flex flex-col items-end gap-3">
                        <div className="text-right">
                          <p className="text-lg font-semibold text-foreground">
                            {formatCurrencyWithType(entry.totalAmount, entry.currency)}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            (KDV dahil)
                          </p>
                        </div>
                        <StatusBadge status={entry.approvalStatus} />
                      </div>
                    </div>

                    {/* Expandable Details */}
                    <button
                      onClick={() => setExpandedEntry(isExpanded ? null : entry.id)}
                      className="mt-4 flex items-center gap-2 text-sm text-primary hover:underline"
                    >
                      {isExpanded ? (
                        <>
                          <ChevronUp className="h-4 w-4" />
                          Detayları Gizle
                        </>
                      ) : (
                        <>
                          <ChevronDown className="h-4 w-4" />
                          Detayları Göster
                        </>
                      )}
                    </button>

                    <AnimatePresence>
                      {isExpanded && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          className="overflow-hidden"
                        >
                          <div className="mt-4 pt-4 border-t space-y-4">
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                              <div>
                                <p className="text-xs text-muted-foreground">İş Tarihi</p>
                                <p className="text-sm font-medium">{formatDate(entry.date)}</p>
                              </div>
                              <div>
                                <p className="text-xs text-muted-foreground">Sözleşme Tipi</p>
                                <p className="text-sm font-medium">{contractTypeLabels[entry.contractType]}</p>
                              </div>
                            </div>

                            {/* Show payment plan for götürü bedel */}
                            {entry.paymentPlan && entry.paymentPlan.length > 0 && (
                              <div>
                                <p className="text-xs text-muted-foreground mb-2">Ödeme Planı</p>
                                <div className="space-y-1">
                                  {entry.paymentPlan.map((p, i) => (
                                    <div key={i} className="flex justify-between text-sm">
                                      <span>{p.description || `Taksit ${i + 1}`}</span>
                                      <span className="font-medium">{formatCurrencyWithType(p.amount, entry.currency)}</span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* Show work items for birim fiyat */}
                            {entry.workItemEntries && entry.workItemEntries.length > 0 && (
                              <div>
                                <p className="text-xs text-muted-foreground mb-2">İş Kalemleri</p>
                                <div className="space-y-1">
                                  {entry.workItemEntries.map((w, i) => (
                                    <div key={i} className="flex justify-between text-sm">
                                      <span>{w.description} ({w.quantity} {w.unit})</span>
                                      <span className="font-medium">{formatCurrencyWithType(w.quantity * w.unitPrice, entry.currency)}</span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}

                            <div className="rounded-lg bg-muted/50 p-4 space-y-2">
                              <div className="flex justify-between text-sm">
                                <span className="text-muted-foreground">Ara Toplam</span>
                                <span className="font-medium">{formatCurrencyWithType(entry.subtotal, entry.currency)}</span>
                              </div>
                              <div className="flex justify-between text-sm">
                                <span className="text-muted-foreground">KDV (%20)</span>
                                <span className="font-medium">{formatCurrencyWithType(entry.vatAmount, entry.currency)}</span>
                              </div>
                              <div className="flex justify-between text-sm pt-2 border-t font-semibold">
                                <span>Toplam</span>
                                <span className="text-primary">{formatCurrencyWithType(entry.totalAmount, entry.currency)}</span>
                              </div>
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>

                    {/* Action Buttons */}
                    {isDirector && (
                      <div className="mt-4 pt-4 border-t flex flex-col sm:flex-row gap-3">
                        <Button
                          onClick={() => handleApprove(entry.id)}
                          className="flex-1 gap-2 bg-status-approved hover:bg-status-approved/90"
                        >
                          <CheckCircle2 className="h-4 w-4" />
                          Onayla
                        </Button>
                        <Button
                          variant="outline"
                          onClick={() => openRejectDialog(entry.id)}
                          className="flex-1 gap-2 border-status-rejected text-status-rejected hover:bg-status-rejected-bg"
                        >
                          <XCircle className="h-4 w-4" />
                          Revize İste
                        </Button>
                      </div>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>

        {sortedEntries.length === 0 && (
          <div className="card-elevated p-12 text-center">
            <CheckCircle2 className="mx-auto h-12 w-12 text-status-approved/50" />
            <h3 className="mt-4 text-lg font-medium text-foreground">
              Onay bekleyen kayıt yok
            </h3>
            <p className="mt-2 text-sm text-muted-foreground">
              Tüm iş kayıtları işlendi.
            </p>
          </div>
        )}
      </div>

      {/* Rejection Dialog */}
      <Dialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Revize Talebi</DialogTitle>
            <DialogDescription>
              Bu kaydı neden revize edilmesi gerektiğini açıklayın.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Textarea
              placeholder="Revize nedeni..."
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              rows={4}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectDialogOpen(false)}>
              İptal
            </Button>
            <Button 
              onClick={handleReject}
              className="bg-status-rejected hover:bg-status-rejected/90"
              disabled={!rejectionReason.trim()}
            >
              Revize İste
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </MainLayout>
  );
}
