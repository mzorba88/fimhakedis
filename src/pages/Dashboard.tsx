import { MainLayout } from '@/components/MainLayout';
import { StatCard } from '@/components/StatCard';
import { StatusBadge } from '@/components/StatusBadge';
import { useHakedisStore } from '@/store/hakedisStore';
import { calculateDashboardStats } from '@/data/mockData';
import { formatCurrency, formatDate, projectStatusLabels } from '@/types/hakedis';
import { 
  FolderKanban, 
  Clock, 
  CheckCircle2, 
  Wallet, 
  ArrowRight,
  Building2,
  MapPin
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';

export default function Dashboard() {
  const { projects, workEntries } = useHakedisStore();
  const stats = calculateDashboardStats(projects, workEntries);

  const recentEntries = [...workEntries]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 5);

  const pendingEntries = workEntries.filter(e => e.approvalStatus === 'onay_bekliyor');
  const activeProjects = projects.filter(p => p.status === 'aktif');

  return (
    <MainLayout>
      <div className="space-y-6 sm:space-y-8">
        {/* Page Header */}
        <div>
          <h1 className="page-title">Dashboard</h1>
          <p className="page-subtitle">
            Hakediş ve ödeme takip sisteminize hoş geldiniz
          </p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
          <StatCard
            title="Toplam Proje"
            value={stats.totalProjects}
            icon={<FolderKanban className="h-5 w-5" />}
          />
          <StatCard
            title="Onay Bekleyen"
            value={stats.pendingApprovals}
            subtitle="İşlem bekliyor"
            icon={<Clock className="h-5 w-5" />}
          />
          <StatCard
            title="Onaylanan Hakediş"
            value={formatCurrency(stats.approvedTotal)}
            icon={<CheckCircle2 className="h-5 w-5" />}
            trend={{ value: 12, label: 'bu ay', positive: true }}
          />
          <StatCard
            title="Gerçekleşen Ödeme"
            value={formatCurrency(stats.paidTotal)}
            subtitle={`Kalan: ${formatCurrency(stats.remainingBalance)}`}
            icon={<Wallet className="h-5 w-5" />}
          />
        </div>

        {/* Two Column Layout */}
        <div className="grid grid-cols-1 gap-4 sm:gap-6 lg:grid-cols-2">
          {/* Recent Work Entries */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="card-elevated"
          >
            <div className="flex items-center justify-between border-b p-3 sm:p-4">
              <h2 className="section-title">Son Altyüklenici Sözleşmeleri</h2>
              <Link 
                to="/yapilanisler" 
                className="flex items-center gap-1 text-xs sm:text-sm font-medium text-primary hover:underline"
              >
                Tümünü Gör <ArrowRight className="h-3 w-3 sm:h-4 sm:w-4" />
              </Link>
            </div>
            <div className="divide-y">
              {recentEntries.map((entry) => {
                const project = projects.find(p => p.id === entry.projectId);
                return (
                  <div key={entry.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 sm:p-4">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs sm:text-sm font-medium text-foreground">
                        {entry.workCategory} - {entry.subcontractor}
                      </p>
                      <p className="text-[10px] sm:text-xs text-muted-foreground">
                        {project?.projectCode} • {formatDate(entry.date)}
                      </p>
                    </div>
                    <div className="flex items-center justify-between sm:justify-end gap-2 sm:gap-3">
                      <span className="text-xs sm:text-sm font-medium text-foreground">
                        {formatCurrency(entry.totalAmount)}
                      </span>
                      <StatusBadge status={entry.approvalStatus} size="sm" />
                    </div>
                  </div>
                );
              })}
              {recentEntries.length === 0 && (
                <div className="p-6 sm:p-8 text-center text-xs sm:text-sm text-muted-foreground">
                  Henüz yapılan iş kaydı bulunmuyor
                </div>
              )}
            </div>
          </motion.div>

          {/* Pending Approvals */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="card-elevated"
          >
            <div className="flex items-center justify-between border-b p-3 sm:p-4">
              <h2 className="section-title">Onay Bekleyenler</h2>
              <Link 
                to="/onaylar" 
                className="flex items-center gap-1 text-xs sm:text-sm font-medium text-primary hover:underline"
              >
                Tümünü Gör <ArrowRight className="h-3 w-3 sm:h-4 sm:w-4" />
              </Link>
            </div>
            <div className="divide-y">
              {pendingEntries.slice(0, 5).map((entry) => {
                const project = projects.find(p => p.id === entry.projectId);
                return (
                  <div key={entry.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 sm:p-4">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs sm:text-sm font-medium text-foreground">
                        {entry.workCategory} - {entry.subcontractor}
                      </p>
                      <p className="text-[10px] sm:text-xs text-muted-foreground">
                        {project?.projectName}
                      </p>
                    </div>
                    <div className="flex items-center justify-between sm:justify-end gap-2 text-right">
                      <p className="text-xs sm:text-sm font-medium text-foreground">
                        {formatCurrency(entry.totalAmount)}
                      </p>
                      <p className="text-[10px] sm:text-xs text-muted-foreground">
                        {formatDate(entry.date)}
                      </p>
                    </div>
                  </div>
                );
              })}
              {pendingEntries.length === 0 && (
                <div className="p-6 sm:p-8 text-center text-xs sm:text-sm text-muted-foreground">
                  Onay bekleyen işlem bulunmuyor
                </div>
              )}
            </div>
          </motion.div>
        </div>

        {/* Projects Overview */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="card-elevated"
        >
          <div className="flex items-center justify-between border-b p-3 sm:p-4">
            <h2 className="section-title">Aktif Projeler</h2>
            <Link 
              to="/projeler" 
              className="flex items-center gap-1 text-xs sm:text-sm font-medium text-primary hover:underline"
            >
              Tümünü Gör <ArrowRight className="h-3 w-3 sm:h-4 sm:w-4" />
            </Link>
          </div>
          <div className="grid grid-cols-1 gap-3 p-3 sm:gap-4 sm:p-4 sm:grid-cols-2 lg:grid-cols-3">
            {activeProjects.slice(0, 6).map((project) => {
              const projectEntries = workEntries.filter(e => e.projectId === project.id);
              const approvedTotal = projectEntries
                .filter(e => e.approvalStatus === 'onaylandi')
                .reduce((sum, e) => sum + e.totalAmount, 0);

              return (
                <Link
                  key={project.id}
                  to={`/projeler`}
                  className="group rounded-lg border bg-card p-3 sm:p-4 transition-all hover:border-primary/50 hover:shadow-md"
                >
                  <div className="flex items-start gap-2 sm:gap-3">
                    <div className="rounded-lg bg-accent p-1.5 sm:p-2">
                      <Building2 className="h-4 w-4 sm:h-5 sm:w-5 text-accent-foreground" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <h3 className="truncate text-sm sm:text-base font-medium text-foreground group-hover:text-primary">
                        {project.projectName}
                      </h3>
                      <p className="text-[10px] sm:text-xs text-muted-foreground">{project.projectCode}</p>
                    </div>
                  </div>
                  <div className="mt-2 sm:mt-3 flex items-center gap-1.5 text-[10px] sm:text-xs text-muted-foreground">
                    <MapPin className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                    <span className="truncate">{project.location}</span>
                  </div>
                  <div className="mt-2 sm:mt-3 flex justify-between text-[10px] sm:text-xs">
                    <span className="text-muted-foreground">Onaylanan</span>
                    <span className="font-medium">{formatCurrency(approvedTotal)}</span>
                  </div>
                </Link>
              );
            })}
          </div>
        </motion.div>
      </div>
    </MainLayout>
  );
}
