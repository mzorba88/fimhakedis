import { useState } from 'react';
import { MainLayout } from '@/components/MainLayout';
import { StatusBadge } from '@/components/StatusBadge';
import { useHakedisStore } from '@/store/hakedisStore';
import { formatCurrencyWithType, formatDate, contractTypeLabels, formatCurrency } from '@/types/hakedis';
import { 
  Search, 
  Wallet,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Banknote,
  FileText,
  ClipboardList
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';

export default function Payments() {
  const { 
    projects, 
    workEntries,
    subcontractorHakedisler,
    markAsPaid,
    markHakedisAsPaid,
    currentUser 
  } = useHakedisStore();
  
  const [searchQuery, setSearchQuery] = useState('');
  const [filterProject, setFilterProject] = useState<string>('all');
  const [filterPayment, setFilterPayment] = useState<string>('all');
  const [activeTab, setActiveTab] = useState('hakedisler');

  // Only show approved hakedisler
  const approvedHakedisler = subcontractorHakedisler.filter(h => h.approvalStatus === 'onaylandi');

  const filteredHakedisler = approvedHakedisler.filter(hakedis => {
    const project = projects.find(p => p.id === hakedis.projectId);
    const matchesSearch = 
      hakedis.subcontractor.toLowerCase().includes(searchQuery.toLowerCase()) ||
      hakedis.hakedisNo.toLowerCase().includes(searchQuery.toLowerCase()) ||
      hakedis.contractNo.toLowerCase().includes(searchQuery.toLowerCase()) ||
      project?.projectName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      project?.projectCode.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesProject = filterProject === 'all' || hakedis.projectId === filterProject;
    const matchesPayment = filterPayment === 'all' || hakedis.paymentStatus === filterPayment;
    return matchesSearch && matchesProject && matchesPayment;
  });

  const sortedHakedisler = [...filteredHakedisler].sort(
    (a, b) => new Date(b.approvalDate || b.createdAt).getTime() - new Date(a.approvalDate || a.createdAt).getTime()
  );

  // Summary Stats for hakedisler
  const totalApprovedHakedis = approvedHakedisler.reduce((sum, h) => sum + h.totalAmount, 0);
  const totalPaidHakedis = approvedHakedisler
    .filter(h => h.paymentStatus === 'odendi')
    .reduce((sum, h) => sum + h.totalAmount, 0);
  const totalUnpaidHakedis = totalApprovedHakedis - totalPaidHakedis;

  const handleMarkHakedisAsPaid = (hakedisId: string) => {
    markHakedisAsPaid(hakedisId);
    toast.success('Hakediş ödendi olarak işaretlendi');
  };

  const isAccountant = currentUser.role === 'muhasebe';

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-foreground">Ödemeler</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Onaylanmış hakedişlerin ödeme takibi
            </p>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="stat-card"
          >
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-accent p-2.5">
                <CheckCircle2 className="h-5 w-5 text-accent-foreground" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Onaylanan Hakedişler</p>
                <p className="text-xl font-semibold">{formatCurrency(totalApprovedHakedis)}</p>
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="stat-card"
          >
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-status-paid-bg p-2.5">
                <Wallet className="h-5 w-5 text-status-paid" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Ödenen Toplam</p>
                <p className="text-xl font-semibold text-status-paid">{formatCurrency(totalPaidHakedis)}</p>
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="stat-card"
          >
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-status-pending-bg p-2.5">
                <Clock className="h-5 w-5 text-status-pending" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Bekleyen Ödeme</p>
                <p className="text-xl font-semibold text-status-pending">{formatCurrency(totalUnpaidHakedis)}</p>
              </div>
            </div>
          </motion.div>
        </div>

        {/* Info Banner for non-accountants */}
        {!isAccountant && (
          <div className="flex items-center gap-3 rounded-lg border border-primary/30 bg-accent p-4">
            <AlertTriangle className="h-5 w-5 text-primary" />
            <p className="text-sm text-foreground">
              Ödeme işlemleri sadece <strong>Muhasebe</strong> rolündeki kullanıcılar tarafından yapılabilir.
              Rol değiştirmek için sağ üstteki menüyü kullanabilirsiniz.
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
          <Select value={filterPayment} onValueChange={setFilterPayment}>
            <SelectTrigger className="w-full sm:w-48">
              <SelectValue placeholder="Ödeme Durumu" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tüm Durumlar</SelectItem>
              <SelectItem value="odendi">Ödendi</SelectItem>
              <SelectItem value="odenmedi">Ödenmedi</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Hakedisler Table */}
        <div className="card-elevated overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Hakediş No / Altyüklenici
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Proje
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Sözleşme No
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Onay Tarihi
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Tutar
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Ödeme Durumu
                  </th>
                  {isAccountant && (
                    <th className="px-4 py-3 text-center text-xs font-medium uppercase tracking-wider text-muted-foreground">
                      İşlem
                    </th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y">
                <AnimatePresence>
                  {sortedHakedisler.map((hakedis) => {
                    const project = projects.find(p => p.id === hakedis.projectId);
                    const isPaid = hakedis.paymentStatus === 'odendi';
                    
                    return (
                      <motion.tr
                        key={hakedis.id}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="group hover:bg-muted/30"
                      >
                        <td className="px-4 py-4">
                          <div className="max-w-xs">
                            <p className="font-medium text-foreground">
                              {hakedis.hakedisNo}
                            </p>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              {hakedis.subcontractor}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {contractTypeLabels[hakedis.contractType]}
                            </p>
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
                        <td className="px-4 py-4 text-sm text-foreground">
                          {hakedis.contractNo}
                        </td>
                        <td className="px-4 py-4 text-sm text-muted-foreground">
                          {hakedis.approvalDate ? formatDate(hakedis.approvalDate) : '-'}
                        </td>
                        <td className="px-4 py-4 text-right">
                          <p className="text-sm font-semibold text-foreground">
                            {formatCurrencyWithType(hakedis.totalAmount, hakedis.currency)}
                          </p>
                        </td>
                        <td className="px-4 py-4 text-center">
                          <StatusBadge status={hakedis.paymentStatus} />
                          {isPaid && hakedis.paidDate && (
                            <p className="text-xs text-muted-foreground mt-1">
                              {formatDate(hakedis.paidDate)}
                            </p>
                          )}
                        </td>
                        {isAccountant && (
                          <td className="px-4 py-4 text-center">
                            {!isPaid && (
                              <Button
                                size="sm"
                                onClick={() => handleMarkHakedisAsPaid(hakedis.id)}
                                className="gap-1.5 bg-status-paid hover:bg-status-paid/90"
                              >
                                <Banknote className="h-4 w-4" />
                                Ödendi
                              </Button>
                            )}
                          </td>
                        )}
                      </motion.tr>
                    );
                  })}
                </AnimatePresence>
              </tbody>
            </table>
          </div>

          {sortedHakedisler.length === 0 && (
            <div className="p-12 text-center">
              <Wallet className="mx-auto h-12 w-12 text-muted-foreground/50" />
              <h3 className="mt-4 text-lg font-medium text-foreground">Hakediş kaydı bulunamadı</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                Arama kriterlerinize uygun onaylanmış hakediş bulunmuyor.
              </p>
            </div>
          )}
        </div>
      </div>
    </MainLayout>
  );
}
