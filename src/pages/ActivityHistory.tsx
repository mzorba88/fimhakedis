import { useState } from 'react';
import { MainLayout } from '@/components/MainLayout';
import { useHakedisStore } from '@/store/hakedisStore';
import { activityTypeLabels } from '@/types/activityLog';
import { formatDate } from '@/types/hakedis';
import { 
  Search,
  History,
  FolderPlus,
  FolderEdit,
  FolderMinus,
  FilePlus,
  FileEdit,
  FileMinus,
  FileText,
  CheckCircle,
  XCircle,
  Wallet,
  FileX,
  UserCog,
  Filter
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';

const iconMap = {
  project_created: FolderPlus,
  project_updated: FolderEdit,
  project_deleted: FolderMinus,
  contract_created: FilePlus,
  contract_updated: FileEdit,
  contract_deleted: FileMinus,
  hakedis_created: FileText,
  hakedis_approved: CheckCircle,
  hakedis_rejected: XCircle,
  hakedis_paid: Wallet,
  hakedis_deleted: FileX,
  user_role_changed: UserCog,
};

const typeColors = {
  project_created: 'bg-blue-500/10 text-blue-600 border-blue-200',
  project_updated: 'bg-sky-500/10 text-sky-600 border-sky-200',
  project_deleted: 'bg-red-500/10 text-red-600 border-red-200',
  contract_created: 'bg-emerald-500/10 text-emerald-600 border-emerald-200',
  contract_updated: 'bg-teal-500/10 text-teal-600 border-teal-200',
  contract_deleted: 'bg-rose-500/10 text-rose-600 border-rose-200',
  hakedis_created: 'bg-violet-500/10 text-violet-600 border-violet-200',
  hakedis_approved: 'bg-green-500/10 text-green-600 border-green-200',
  hakedis_rejected: 'bg-orange-500/10 text-orange-600 border-orange-200',
  hakedis_paid: 'bg-emerald-500/10 text-emerald-600 border-emerald-200',
  hakedis_deleted: 'bg-red-500/10 text-red-600 border-red-200',
  user_role_changed: 'bg-purple-500/10 text-purple-600 border-purple-200',
};

export default function ActivityHistory() {
  const { activityLogs } = useHakedisStore();
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<string>('all');

  const filteredLogs = activityLogs.filter(log => {
    const query = searchQuery.toLowerCase();
    const matchesSearch = !query ||
      (log.userName || '').toLowerCase().includes(query) ||
      (log.description || '').toLowerCase().includes(query) ||
      (log.details || '').toLowerCase().includes(query);
    
    const matchesType = filterType === 'all' || log.type === filterType;
    
    return matchesSearch && matchesType;
  });

  const sortedLogs = [...filteredLogs].sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('tr-TR', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const groupLogsByDate = (logs: typeof sortedLogs) => {
    const groups: { [key: string]: typeof logs } = {};
    
    logs.forEach(log => {
      const dateKey = formatDate(log.timestamp);
      if (!groups[dateKey]) {
        groups[dateKey] = [];
      }
      groups[dateKey].push(log);
    });
    
    return groups;
  };

  const groupedLogs = groupLogsByDate(sortedLogs);

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-foreground">İşlem Geçmişi</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Sistemdeki tüm aksiyonlar ve değişiklikler
            </p>
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <History className="h-4 w-4" />
            <span>Toplam {activityLogs.length} işlem</span>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-col gap-4 sm:flex-row">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="İşlem ara..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={filterType} onValueChange={setFilterType}>
            <SelectTrigger className="w-full sm:w-56">
              <Filter className="h-4 w-4 mr-2" />
              <SelectValue placeholder="İşlem Tipi" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tüm İşlemler</SelectItem>
              <SelectItem value="project_created">Proje Oluşturma</SelectItem>
              <SelectItem value="project_updated">Proje Güncelleme</SelectItem>
              <SelectItem value="contract_created">Sözleşme Oluşturma</SelectItem>
              <SelectItem value="hakedis_created">Hakediş Oluşturma</SelectItem>
              <SelectItem value="hakedis_approved">Hakediş Onay</SelectItem>
              <SelectItem value="hakedis_rejected">Hakediş Red</SelectItem>
              <SelectItem value="hakedis_paid">Hakediş Ödeme</SelectItem>
              <SelectItem value="user_role_changed">Rol Değişikliği</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Activity Timeline */}
        <div className="space-y-8">
          {Object.entries(groupedLogs).map(([date, logs]) => (
            <div key={date}>
              <div className="sticky top-0 z-10 mb-4">
                <Badge variant="secondary" className="text-xs font-medium">
                  {date}
                </Badge>
              </div>
              
              <div className="space-y-3">
                <AnimatePresence>
                  {logs.map((log, index) => {
                    const Icon = iconMap[log.type] || History;
                    const colorClass = typeColors[log.type] || 'bg-gray-500/10 text-gray-600 border-gray-200';
                    
                    return (
                      <motion.div
                        key={log.id}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -20 }}
                        transition={{ delay: index * 0.05 }}
                        className="card-elevated p-4"
                      >
                        <div className="flex items-start gap-4">
                          <div className={`rounded-lg p-2.5 border ${colorClass}`}>
                            <Icon className="h-5 w-5" />
                          </div>
                          
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-2">
                              <p className="font-medium text-foreground">
                                {log.description}
                              </p>
                              <span className="text-xs text-muted-foreground whitespace-nowrap">
                                {formatTime(log.timestamp)}
                              </span>
                            </div>
                            
                            {log.details && (
                              <p className="mt-1 text-sm text-muted-foreground">
                                {log.details}
                              </p>
                            )}
                            
                            <div className="mt-2">
                              <Badge variant="outline" className="text-xs">
                                {log.userRole}
                              </Badge>
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    );
                  })}
                </AnimatePresence>
              </div>
            </div>
          ))}
        </div>

        {sortedLogs.length === 0 && (
          <div className="card-elevated p-12 text-center">
            <History className="mx-auto h-12 w-12 text-muted-foreground/50" />
            <h3 className="mt-4 text-lg font-medium text-foreground">İşlem bulunamadı</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              {searchQuery || filterType !== 'all' 
                ? 'Arama kriterlerinize uygun işlem bulunmuyor.'
                : 'Henüz sistem üzerinde kayıtlı işlem bulunmuyor.'}
            </p>
          </div>
        )}
      </div>
    </MainLayout>
  );
}
