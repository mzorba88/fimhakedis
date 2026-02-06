import { useState } from 'react';
import { MainLayout } from '@/components/MainLayout';
import { useHakedisStore } from '@/store/hakedisStore';
import { formatCurrency, formatDate, contractTypeLabels, Project, ContractType } from '@/types/hakedis';
import { 
  Plus, 
  Search, 
  Building2, 
  MoreHorizontal,
  Calendar,
  Banknote,
  X
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

export default function Projects() {
  const { projects, workEntries, addProject } = useHakedisStore();
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<string>('all');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [newProject, setNewProject] = useState({
    projectName: '',
    projectCode: '',
    contractType: 'birim_fiyat' as ContractType,
    subcontractorName: '',
    subcontractorTaxId: '',
    totalContractValue: '',
    startDate: '',
    description: '',
  });

  const filteredProjects = projects.filter(project => {
    const matchesSearch = 
      project.projectName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      project.projectCode.toLowerCase().includes(searchQuery.toLowerCase()) ||
      project.subcontractorName.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesType = filterType === 'all' || project.contractType === filterType;
    return matchesSearch && matchesType;
  });

  const handleCreateProject = () => {
    if (!newProject.projectName || !newProject.projectCode || !newProject.subcontractorName) {
      return;
    }

    const project: Project = {
      id: `p${Date.now()}`,
      projectName: newProject.projectName,
      projectCode: newProject.projectCode,
      contractType: newProject.contractType,
      subcontractorName: newProject.subcontractorName,
      subcontractorTaxId: newProject.subcontractorTaxId,
      totalContractValue: parseFloat(newProject.totalContractValue) || 0,
      startDate: newProject.startDate || new Date().toISOString().split('T')[0],
      description: newProject.description,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    addProject(project);
    setIsDialogOpen(false);
    setNewProject({
      projectName: '',
      projectCode: '',
      contractType: 'birim_fiyat',
      subcontractorName: '',
      subcontractorTaxId: '',
      totalContractValue: '',
      startDate: '',
      description: '',
    });
  };

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-foreground">Projeler</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Tüm proje ve sözleşmelerinizi yönetin
            </p>
          </div>
          <Button onClick={() => setIsDialogOpen(true)} className="gap-2">
            <Plus className="h-4 w-4" />
            Yeni Proje
          </Button>
        </div>

        {/* Filters */}
        <div className="flex flex-col gap-4 sm:flex-row">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Proje ara..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={filterType} onValueChange={setFilterType}>
            <SelectTrigger className="w-full sm:w-48">
              <SelectValue placeholder="Sözleşme Tipi" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tümü</SelectItem>
              <SelectItem value="birim_fiyat">Birim Fiyat</SelectItem>
              <SelectItem value="goturu_bedel">Götürü Bedel</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Projects Grid */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          <AnimatePresence>
            {filteredProjects.map((project, index) => {
              const projectEntries = workEntries.filter(e => e.projectId === project.id);
              const approvedTotal = projectEntries
                .filter(e => e.approvalStatus === 'onaylandi')
                .reduce((sum, e) => sum + e.totalAmount, 0);
              const paidTotal = projectEntries
                .filter(e => e.paymentStatus === 'odendi')
                .reduce((sum, e) => sum + e.totalAmount, 0);
              const progress = (approvedTotal / project.totalContractValue) * 100;

              return (
                <motion.div
                  key={project.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ delay: index * 0.05 }}
                  className="group card-elevated overflow-hidden"
                >
                  <div className="p-5">
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-3">
                        <div className="rounded-lg bg-accent p-2.5">
                          <Building2 className="h-5 w-5 text-accent-foreground" />
                        </div>
                        <div>
                          <h3 className="font-medium text-foreground line-clamp-2">
                            {project.projectName}
                          </h3>
                          <p className="mt-0.5 text-xs text-muted-foreground">
                            {project.projectCode}
                          </p>
                        </div>
                      </div>
                      <button className="rounded-lg p-1 text-muted-foreground opacity-0 transition-opacity hover:bg-muted group-hover:opacity-100">
                        <MoreHorizontal className="h-4 w-4" />
                      </button>
                    </div>

                    <div className="mt-4 space-y-3">
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Building2 className="h-4 w-4" />
                        <span className="truncate">{project.subcontractorName}</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Calendar className="h-4 w-4" />
                        <span>{formatDate(project.startDate)}</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Banknote className="h-4 w-4" />
                        <span>{formatCurrency(project.totalContractValue)}</span>
                      </div>
                    </div>

                    <div className="mt-4 pt-4 border-t">
                      <div className="flex justify-between text-xs mb-2">
                        <span className="text-muted-foreground">İlerleme</span>
                        <span className="font-medium">{progress.toFixed(1)}%</span>
                      </div>
                      <div className="h-2 rounded-full bg-muted">
                        <div 
                          className="h-2 rounded-full bg-primary transition-all duration-500" 
                          style={{ width: `${Math.min(progress, 100)}%` }}
                        />
                      </div>
                      <div className="mt-3 flex items-center justify-between">
                        <span className="inline-flex items-center rounded-full bg-accent px-2.5 py-0.5 text-xs font-medium text-accent-foreground">
                          {contractTypeLabels[project.contractType]}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          Ödenen: {formatCurrency(paidTotal)}
                        </span>
                      </div>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>

        {filteredProjects.length === 0 && (
          <div className="card-elevated p-12 text-center">
            <Building2 className="mx-auto h-12 w-12 text-muted-foreground/50" />
            <h3 className="mt-4 text-lg font-medium text-foreground">Proje bulunamadı</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              Arama kriterlerinize uygun proje bulunmuyor.
            </p>
          </div>
        )}
      </div>

      {/* New Project Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Yeni Proje Oluştur</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="projectName">Proje Adı *</Label>
                <Input
                  id="projectName"
                  placeholder="Proje adını girin"
                  value={newProject.projectName}
                  onChange={(e) => setNewProject({ ...newProject, projectName: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="projectCode">Proje Kodu *</Label>
                <Input
                  id="projectCode"
                  placeholder="Ör: PRJ-2024-001"
                  value={newProject.projectCode}
                  onChange={(e) => setNewProject({ ...newProject, projectCode: e.target.value })}
                />
              </div>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="contractType">Sözleşme Tipi</Label>
              <Select
                value={newProject.contractType}
                onValueChange={(value: ContractType) => setNewProject({ ...newProject, contractType: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="birim_fiyat">Birim Fiyat</SelectItem>
                  <SelectItem value="goturu_bedel">Götürü Bedel</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="subcontractorName">Altyüklenici Adı *</Label>
                <Input
                  id="subcontractorName"
                  placeholder="Firma adı"
                  value={newProject.subcontractorName}
                  onChange={(e) => setNewProject({ ...newProject, subcontractorName: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="subcontractorTaxId">Vergi No</Label>
                <Input
                  id="subcontractorTaxId"
                  placeholder="Vergi numarası"
                  value={newProject.subcontractorTaxId}
                  onChange={(e) => setNewProject({ ...newProject, subcontractorTaxId: e.target.value })}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="totalContractValue">Sözleşme Bedeli (₺)</Label>
                <Input
                  id="totalContractValue"
                  type="number"
                  placeholder="0.00"
                  value={newProject.totalContractValue}
                  onChange={(e) => setNewProject({ ...newProject, totalContractValue: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="startDate">Başlangıç Tarihi</Label>
                <Input
                  id="startDate"
                  type="date"
                  value={newProject.startDate}
                  onChange={(e) => setNewProject({ ...newProject, startDate: e.target.value })}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Açıklama</Label>
              <Input
                id="description"
                placeholder="Proje hakkında kısa açıklama"
                value={newProject.description}
                onChange={(e) => setNewProject({ ...newProject, description: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              İptal
            </Button>
            <Button onClick={handleCreateProject}>
              Proje Oluştur
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </MainLayout>
  );
}
