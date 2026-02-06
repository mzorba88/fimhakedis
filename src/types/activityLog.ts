export type ActivityType = 
  | 'project_created'
  | 'project_updated'
  | 'project_deleted'
  | 'contract_created'
  | 'contract_updated'
  | 'contract_deleted'
  | 'hakedis_created'
  | 'hakedis_approved'
  | 'hakedis_rejected'
  | 'hakedis_paid'
  | 'hakedis_deleted'
  | 'user_role_changed';

export interface ActivityLog {
  id: string;
  type: ActivityType;
  userId: string;
  userName: string;
  userRole: string;
  description: string;
  details?: string;
  entityId?: string;
  entityType?: 'project' | 'contract' | 'hakedis';
  timestamp: string;
}

export const activityTypeLabels: Record<ActivityType, string> = {
  project_created: 'Proje Oluşturuldu',
  project_updated: 'Proje Güncellendi',
  project_deleted: 'Proje Silindi',
  contract_created: 'Sözleşme Oluşturuldu',
  contract_updated: 'Sözleşme Güncellendi',
  contract_deleted: 'Sözleşme Silindi',
  hakedis_created: 'Hakediş Oluşturuldu',
  hakedis_approved: 'Hakediş Onaylandı',
  hakedis_rejected: 'Hakediş Reddedildi',
  hakedis_paid: 'Hakediş Ödendi',
  hakedis_deleted: 'Hakediş Silindi',
  user_role_changed: 'Rol Değiştirildi',
};

export const activityTypeIcons: Record<ActivityType, string> = {
  project_created: 'FolderPlus',
  project_updated: 'FolderEdit',
  project_deleted: 'FolderMinus',
  contract_created: 'FilePlus',
  contract_updated: 'FileEdit',
  contract_deleted: 'FileMinus',
  hakedis_created: 'FileText',
  hakedis_approved: 'CheckCircle',
  hakedis_rejected: 'XCircle',
  hakedis_paid: 'Wallet',
  hakedis_deleted: 'FileX',
  user_role_changed: 'UserCog',
};
