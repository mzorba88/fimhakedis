import { useState } from 'react';
import { MainLayout } from '@/components/MainLayout';
import { useHakedisStore } from '@/store/hakedisStore';
import { formatDate, Project, ProjectStatus, projectStatusLabels } from '@/types/hakedis';
import { 
  Plus, 
  Search, 
  Building2, 
  MoreHorizontal,
  Calendar,
  MapPin,
  Edit2
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
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

export default function Projects() {
  const { projects, addProject, updateProject, addActivityLog } = useHakedisStore();
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'aktif' | 'tamamlandi'>('aktif');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [newProject, setNewProject] = useState({
    projectName: '',
    projectCode: '',
    location: '',
    startDate: '',
    status: 'aktif' as ProjectStatus,
  });

  const filteredProjects = projects.filter(project => {
    const matchesSearch = 
      project.projectName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      project.projectCode.toLowerCase().includes(searchQuery.toLowerCase()) ||
      project.location.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = project.status === activeTab;
    return matchesSearch && matchesStatus;
  });

  const handleCreateProject = () => {
    if (!newProject.projectName || !newProject.projectCode) {
      return;
    }

    const project: Project = {
      id: `p${Date.now()}`,
      projectName: newProject.projectName,
      projectCode: newProject.projectCode,
      location: newProject.location,
      startDate: newProject.startDate || new Date().toISOString().split('T')[0],
      status: newProject.status,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    addProject(project);
    addActivityLog(
      'project_created',
      `${project.projectCode} projesi oluşturuldu`,
      `Proje: ${project.projectName} - Lokasyon: ${project.location || 'Belirtilmedi'}`,
      project.id,
      'project'
    );
    handleCloseDialog();
  };

  const handleUpdateProject = () => {
    if (!editingProject) return;

    updateProject(editingProject.id, {
      projectName: newProject.projectName,
      projectCode: newProject.projectCode,
      location: newProject.location,
      startDate: newProject.startDate,
      status: newProject.status,
    });
    addActivityLog(
      'project_updated',
      `${newProject.projectCode} projesi güncellendi`,
      `Proje: ${newProject.projectName}`,
      editingProject.id,
      'project'
    );

    handleCloseDialog();
  };

  const handleEditClick = (project: Project) => {
    setEditingProject(project);
    setNewProject({
      projectName: project.projectName,
      projectCode: project.projectCode,
      location: project.location,
      startDate: project.startDate,
      status: project.status,
    });
    setIsDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    setEditingProject(null);
    setNewProject({
      projectName: '',
      projectCode: '',
      location: '',
      startDate: '',
      status: 'aktif',
    });
  };

  const activeCount = projects.filter(p => p.status === 'aktif').length;
  const completedCount = projects.filter(p => p.status === 'tamamlandi').length;

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-foreground">Projeler</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Tüm projelerinizi yönetin
            </p>
          </div>
          <Button onClick={() => setIsDialogOpen(true)} className="gap-2">
            <Plus className="h-4 w-4" />
            Yeni Proje
          </Button>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'aktif' | 'tamamlandi')}>
          <TabsList className="grid w-full grid-cols-2 max-w-md">
            <TabsTrigger value="aktif" className="gap-2">
              Aktif Projeler
              <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium">
                {activeCount}
              </span>
            </TabsTrigger>
            <TabsTrigger value="tamamlandi" className="gap-2">
              Tamamlanmış
              <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium">
                {completedCount}
              </span>
            </TabsTrigger>
          </TabsList>

          <div className="mt-4">
            {/* Search */}
            <div className="relative max-w-md">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Proje ara..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>

          <TabsContent value="aktif" className="mt-4">
            <ProjectGrid 
              projects={filteredProjects} 
              onEditClick={handleEditClick}
            />
          </TabsContent>

          <TabsContent value="tamamlandi" className="mt-4">
            <ProjectGrid 
              projects={filteredProjects} 
              onEditClick={handleEditClick}
            />
          </TabsContent>
        </Tabs>
      </div>

      {/* Project Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={handleCloseDialog}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editingProject ? 'Proje Düzenle' : 'Yeni Proje Oluştur'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="projectName">Proje İsmi *</Label>
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
                placeholder="Ör: 578"
                value={newProject.projectCode}
                onChange={(e) => setNewProject({ ...newProject, projectCode: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="location">Lokasyon</Label>
              <Input
                id="location"
                placeholder="Ör: KOĞLU, GİRNE"
                value={newProject.location}
                onChange={(e) => setNewProject({ ...newProject, location: e.target.value })}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="startDate">Başlangıç Tarihi</Label>
                <Input
                  id="startDate"
                  type="date"
                  value={newProject.startDate}
                  onChange={(e) => setNewProject({ ...newProject, startDate: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Durum</Label>
                <Select
                  value={newProject.status}
                  onValueChange={(value: ProjectStatus) => setNewProject({ ...newProject, status: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="aktif">Aktif</SelectItem>
                    <SelectItem value="tamamlandi">Tamamlandı</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={handleCloseDialog}>
              İptal
            </Button>
            <Button onClick={editingProject ? handleUpdateProject : handleCreateProject}>
              {editingProject ? 'Güncelle' : 'Proje Oluştur'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </MainLayout>
  );
}

function ProjectGrid({ 
  projects, 
  onEditClick 
}: { 
  projects: Project[];
  onEditClick: (project: Project) => void;
}) {
  if (projects.length === 0) {
    return (
      <div className="card-elevated p-12 text-center">
        <Building2 className="mx-auto h-12 w-12 text-muted-foreground/50" />
        <h3 className="mt-4 text-lg font-medium text-foreground">Proje bulunamadı</h3>
        <p className="mt-2 text-sm text-muted-foreground">
          Bu kategoride proje bulunmuyor.
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
      <AnimatePresence>
        {projects.map((project, index) => (
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
                      {project.projectCode} - {project.projectName}
                    </h3>
                  </div>
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button className="rounded-lg p-1 text-muted-foreground hover:bg-muted">
                      <MoreHorizontal className="h-4 w-4" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => onEditClick(project)}>
                      <Edit2 className="h-4 w-4 mr-2" />
                      Düzenle
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>

              <div className="mt-4 space-y-2">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <MapPin className="h-4 w-4" />
                  <span className="truncate">{project.location || 'Belirtilmedi'}</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Calendar className="h-4 w-4" />
                  <span>{formatDate(project.startDate)}</span>
                </div>
              </div>

              <div className="mt-4 pt-4 border-t">
                <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                  project.status === 'aktif' 
                    ? 'bg-status-approved-bg text-status-approved' 
                    : 'bg-muted text-muted-foreground'
                }`}>
                  {projectStatusLabels[project.status]}
                </span>
              </div>
            </div>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
