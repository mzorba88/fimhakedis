import { useState, useMemo } from 'react';
import { MainLayout } from '@/components/MainLayout';
import { sortNatural } from '@/lib/utils';
import { StatusBadge } from '@/components/StatusBadge';
import { SortableTableHeader, useSorting } from '@/components/SortableTableHeader';
import { useHakedisStore } from '@/store/hakedisStore';
import { formatCurrencyWithType, formatDate, contractTypeLabels } from '@/types/hakedis';
import { 
  Search, 
  CheckCircle2,
  XCircle,
  Clock,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  FileText
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { MobileCard, MobileCardHeader, MobileCardRow, MobileCardActions } from '@/components/MobileCard';
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
    subcontractorHakedisler,
    approveHakedis,
    rejectHakedis,
    currentUser,
    addActivityLog
  } = useHakedisStore();
  
  const [searchQuery, setSearchQuery] = useState('');
  const [filterProject, setFilterProject] = useState<string>('all');
  const { sortConfig, handleSort } = useSorting({ key: 'createdAt', direction: 'asc' });
  const [expandedEntry, setExpandedEntry] = useState<string | null>(null);
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [selectedHakedisId, setSelectedHakedisId] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');

  // Pending hakedisler only
  const pendingHakedisler = subcontractorHakedisler.filter(h => h.approvalStatus === 'onay_bekliyor');

  const filteredHakedisler = pendingHakedisler.filter(hakedis => {
    const project = projects.find(p => p.id === hakedis.projectId);
    const query = searchQuery.toLowerCase();
    const matchesSearch = !query ||
      (hakedis.hakedisNo || '').toLowerCase().includes(query) ||
      (hakedis.subcontractor || '').toLowerCase().includes(query) ||
      (hakedis.contractNo || '').toLowerCase().includes(query) ||
      (project?.projectName || '').toLowerCase().includes(query) ||
      (project?.projectCode || '').toLowerCase().includes(query);
    const matchesProject = filterProject === 'all' || hakedis.projectId === filterProject;
    return matchesSearch && matchesProject;
  });

  const sortedHakedisler = useMemo(() => {
    const sorted = [...filteredHakedisler];
    if (!sortConfig.key || !sortConfig.direction) {
      return sorted.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    }
    
    return sorted.sort((a, b) => {
      const projectA = projects.find(p => p.id === a.projectId);
      const projectB = projects.find(p => p.id === b.projectId);
      
      let comparison = 0;
      switch (sortConfig.key) {
        case 'hakedisNo':
          comparison = (a.hakedisNo || '').localeCompare(b.hakedisNo || '');
          break;
        case 'subcontractor':
          comparison = (a.subcontractor || '').localeCompare(b.subcontractor || '');
          break;
        case 'project':
          comparison = (projectA?.projectCode || '').localeCompare(projectB?.projectCode || '');
          break;
        case 'createdAt':
          comparison = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
          break;
        case 'totalAmount':
          comparison = a.totalAmount - b.totalAmount;
          break;
        default:
          comparison = 0;
      }
      
      return sortConfig.direction === 'asc' ? comparison : -comparison;
    });
  }, [filteredHakedisler, sortConfig, projects]);

  const handleApproveHakedis = async (hakedisId: string) => {
    const hakedis = subcontractorHakedisler.find(h => h.id === hakedisId);
    try {
      await approveHakedis(hakedisId, currentUser.id);
      if (hakedis) {
        await addActivityLog(
          'hakedis_approved',
          `${hakedis.hakedisNo} hakediş onaylandı`,
          `Altyüklenici: ${hakedis.subcontractor} - Tutar: ${formatCurrencyWithType(hakedis.totalAmount, hakedis.currency)}`,
          hakedisId,
          'hakedis'
        );
      }
      toast.success('Hakediş onaylandı');
    } catch (error) {
      console.error('Error approving hakedis:', error);
      toast.error('Hakediş onaylanamadı');
    }
  };

  const handleReject = async () => {
    if (!selectedHakedisId || !rejectionReason.trim()) return;
    
    const hakedis = subcontractorHakedisler.find(h => h.id === selectedHakedisId);
    try {
      await rejectHakedis(selectedHakedisId, rejectionReason);
      if (hakedis) {
        await addActivityLog(
          'hakedis_rejected',
          `${hakedis.hakedisNo} hakediş revize için geri gönderildi`,
          `Altyüklenici: ${hakedis.subcontractor} - Neden: ${rejectionReason}`,
          selectedHakedisId,
          'hakedis'
        );
      }
      toast.info('Hakediş revize için geri gönderildi');
      
      setRejectDialogOpen(false);
      setSelectedHakedisId(null);
      setRejectionReason('');
    } catch (error) {
      console.error('Error rejecting hakedis:', error);
      toast.error('Hakediş reddedilemedi');
    }
  };

  const openRejectDialog = (hakedisId: string) => {
    setSelectedHakedisId(hakedisId);
    setRejectDialogOpen(true);
  };

  const isDirector = currentUser.role === 'direktor';

  return (
    <MainLayout>
      <div className="space-y-4 sm:space-y-6">
        {/* Header */}
        <div className="page-header">
          <div>
            <h1 className="page-title">Onay Bekleyenler</h1>
            <p className="page-subtitle">
              Direktör onayı bekleyen altyüklenici hakediş kayıtları
            </p>
          </div>
          <div className="flex items-center gap-2 rounded-lg bg-[hsl(var(--status-pending-bg))] px-3 py-1.5 sm:px-4 sm:py-2">
            <Clock className="h-4 w-4 sm:h-5 sm:w-5 text-[hsl(var(--status-pending))]" />
            <span className="text-xs sm:text-sm font-medium text-[hsl(var(--status-pending))]">
              {pendingHakedisler.length} hakediş bekliyor
            </span>
          </div>
        </div>

        {/* Info Banner for non-directors */}
        {!isDirector && (
          <div className="flex items-start sm:items-center gap-3 rounded-lg border border-[hsl(var(--status-pending))]/30 bg-[hsl(var(--status-pending-bg))] p-3 sm:p-4">
            <AlertTriangle className="h-4 w-4 sm:h-5 sm:w-5 text-[hsl(var(--status-pending))] shrink-0 mt-0.5 sm:mt-0" />
            <p className="text-xs sm:text-sm text-foreground">
              Onay işlemleri sadece <strong>Direktör</strong> rolündeki kullanıcılar tarafından yapılabilir.
            </p>
          </div>
        )}

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
                  {project.projectCode}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Hakedisler List */}
        <div className="space-y-4">
          <AnimatePresence>
            {sortedHakedisler.map((hakedis, index) => {
              const project = projects.find(p => p.id === hakedis.projectId);
              const isExpanded = expandedEntry === hakedis.id;

              return (
                <motion.div
                  key={hakedis.id}
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
                          <div className="rounded-lg bg-[hsl(var(--status-pending-bg))] p-2 sm:p-2.5">
                            <FileText className="h-4 w-4 sm:h-5 sm:w-5 text-[hsl(var(--status-pending))]" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <p className="text-xs text-muted-foreground">{hakedis.hakedisNo}</p>
                            </div>
                            <h3 className="font-medium text-foreground">
                              {hakedis.subcontractor}
                            </h3>
                            <p className="mt-0.5 text-sm text-muted-foreground">
                              Sözleşme: {hakedis.contractNo}
                            </p>
                            <p className="mt-1 text-sm text-muted-foreground">
                              {project?.projectCode} - {project?.projectName}
                            </p>
                            <p className="text-xs text-muted-foreground mt-1">
                              Oluşturulma: {formatDate(hakedis.createdAt)}
                            </p>
                          </div>
                        </div>
                      </div>

                      <div className="flex flex-col items-end gap-3">
                        <div className="text-right">
                          <p className="text-lg font-semibold text-foreground">
                            {formatCurrencyWithType(hakedis.totalAmount, hakedis.currency)}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {contractTypeLabels[hakedis.contractType]}
                          </p>
                        </div>
                        <StatusBadge status={hakedis.approvalStatus} />
                      </div>
                    </div>

                    {/* Expandable Details */}
                    <button
                      onClick={() => setExpandedEntry(isExpanded ? null : hakedis.id)}
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
                            {/* Basic Info Grid */}
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                              <div>
                                <p className="text-xs text-muted-foreground">Hakediş Tarihi</p>
                                <p className="text-sm font-medium">{formatDate(hakedis.date)}</p>
                              </div>
                              <div>
                                <p className="text-xs text-muted-foreground">Sözleşme Tipi</p>
                                <p className="text-sm font-medium">{contractTypeLabels[hakedis.contractType]}</p>
                              </div>
                              <div>
                                <p className="text-xs text-muted-foreground">Para Birimi</p>
                                <p className="text-sm font-medium">{hakedis.currency}</p>
                              </div>
                              {hakedis.vatRate !== undefined && hakedis.vatRate !== null && (
                                <div>
                                  <p className="text-xs text-muted-foreground">KDV Oranı</p>
                                  <p className="text-sm font-medium">%{hakedis.vatRate}</p>
                                </div>
                              )}
                            </div>

                            {/* Hakediş Açıklaması */}
                            {hakedis.description && (
                              <div className="rounded-lg bg-muted/30 p-3">
                                <p className="text-xs text-muted-foreground mb-1">Hakediş Açıklaması</p>
                                <p className="text-sm text-foreground whitespace-pre-wrap">{hakedis.description}</p>
                              </div>
                            )}

                            {/* Show payment amount for götürü bedel */}
                            {hakedis.contractType === 'goturu_bedel' && hakedis.paymentAmount && (
                              <div>
                                <p className="text-xs text-muted-foreground mb-2">Ödeme Tutarı</p>
                                <p className="text-sm font-medium">
                                  {formatCurrencyWithType(hakedis.paymentAmount, hakedis.currency)}
                                </p>
                              </div>
                            )}

                            {/* Show hakediş items for birim fiyat */}
                            {hakedis.hakedisItems && hakedis.hakedisItems.length > 0 && (
                              <div>
                                <p className="text-xs text-muted-foreground mb-2">Hakediş Kalemleri</p>
                                <div className="rounded-lg border overflow-hidden">
                                  <table className="w-full text-sm">
                                    <thead className="bg-muted/50">
                                      <tr>
                                        <th className="text-left px-3 py-2 text-xs font-medium text-muted-foreground">Açıklama</th>
                                        <th className="text-right px-3 py-2 text-xs font-medium text-muted-foreground">Miktar</th>
                                        <th className="text-right px-3 py-2 text-xs font-medium text-muted-foreground">Birim Fiyat</th>
                                        <th className="text-right px-3 py-2 text-xs font-medium text-muted-foreground">Tutar</th>
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y">
                                      {hakedis.hakedisItems.map((item, i) => (
                                        <tr key={i}>
                                          <td className="px-3 py-2">{item.description}</td>
                                          <td className="px-3 py-2 text-right">{item.quantity} {item.unit}</td>
                                          <td className="px-3 py-2 text-right">{formatCurrencyWithType(item.unitPrice, hakedis.currency)}</td>
                                          <td className="px-3 py-2 text-right font-medium">{formatCurrencyWithType(item.amount, hakedis.currency)}</td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              </div>
                            )}

                            {/* Extra items outside contract */}
                            {hakedis.extraItems && hakedis.extraItems.length > 0 && (
                              <div>
                                <p className="text-xs text-muted-foreground mb-2">Sözleşme Harici Ek İşler</p>
                                <div className="rounded-lg border border-status-pending overflow-hidden">
                                  <table className="w-full text-sm">
                                    <thead className="bg-status-pending-bg">
                                      <tr>
                                        <th className="text-left px-3 py-2 text-xs font-medium text-muted-foreground">Açıklama</th>
                                        <th className="text-right px-3 py-2 text-xs font-medium text-muted-foreground">Miktar</th>
                                        <th className="text-right px-3 py-2 text-xs font-medium text-muted-foreground">Birim Fiyat</th>
                                        <th className="text-right px-3 py-2 text-xs font-medium text-muted-foreground">Tutar</th>
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y">
                                      {hakedis.extraItems.map((item, i) => (
                                        <tr key={i}>
                                          <td className="px-3 py-2">{item.description}</td>
                                          <td className="px-3 py-2 text-right">{item.quantity} {item.unit}</td>
                                          <td className="px-3 py-2 text-right">{formatCurrencyWithType(item.unitPrice, hakedis.currency)}</td>
                                          <td className="px-3 py-2 text-right font-medium">{formatCurrencyWithType(item.amount, hakedis.currency)}</td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              </div>
                            )}


                            {/* Total Summary */}
                            <div className="rounded-lg bg-muted/50 p-4">
                              <div className="flex justify-between text-sm font-semibold">
                                <span>Toplam Tutar</span>
                                <span className="text-primary">{formatCurrencyWithType(hakedis.totalAmount, hakedis.currency)}</span>
                              </div>
                              {hakedis.vatRate !== undefined && hakedis.vatRate !== null && hakedis.vatRate > 0 && (
                                <>
                                  <div className="flex justify-between text-xs text-muted-foreground mt-2">
                                    <span>KDV (%{hakedis.vatRate})</span>
                                    <span>{formatCurrencyWithType(hakedis.totalAmount * (hakedis.vatRate / 100), hakedis.currency)}</span>
                                  </div>
                                  <div className="flex justify-between text-sm font-bold mt-2 pt-2 border-t">
                                    <span>Genel Toplam (KDV Dahil)</span>
                                    <span className="text-primary">{formatCurrencyWithType(hakedis.totalAmount * (1 + hakedis.vatRate / 100), hakedis.currency)}</span>
                                  </div>
                                </>
                              )}
                            </div>

                            {/* Meta info */}
                            <div className="grid grid-cols-2 gap-4 text-xs text-muted-foreground pt-2 border-t">
                              <div>
                                <span>Oluşturan: </span>
                                <span className="font-medium">{hakedis.createdBy}</span>
                              </div>
                              <div>
                                <span>Oluşturulma: </span>
                                <span className="font-medium">{formatDate(hakedis.createdAt)}</span>
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
                          onClick={() => handleApproveHakedis(hakedis.id)}
                          className="flex-1 gap-2 bg-status-approved hover:bg-status-approved/90"
                        >
                          <CheckCircle2 className="h-4 w-4" />
                          Onayla
                        </Button>
                        <Button
                          variant="outline"
                          onClick={() => openRejectDialog(hakedis.id)}
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

          {sortedHakedisler.length === 0 && (
            <div className="card-elevated p-12 text-center">
              <CheckCircle2 className="mx-auto h-12 w-12 text-status-approved/50" />
              <h3 className="mt-4 text-lg font-medium text-foreground">
                Onay bekleyen hakediş yok
              </h3>
              <p className="mt-2 text-sm text-muted-foreground">
                Tüm hakediş kayıtları işlendi.
              </p>
            </div>
          )}
        </div>

        {/* Reject Dialog */}
        <Dialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Revize Talep Et</DialogTitle>
              <DialogDescription>
                Hakediş kaydını revize için geri göndermek üzeresiniz.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div>
                <label className="text-sm font-medium text-foreground">
                  Revize Nedeni <span className="text-destructive">*</span>
                </label>
                <Textarea
                  placeholder="Lütfen revize nedenini açıklayın..."
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  className="mt-1.5"
                  rows={4}
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setRejectDialogOpen(false)}
              >
                İptal
              </Button>
              <Button
                onClick={handleReject}
                disabled={!rejectionReason.trim()}
                className="bg-status-rejected hover:bg-status-rejected/90"
              >
                Revize İste
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </MainLayout>
  );
}
