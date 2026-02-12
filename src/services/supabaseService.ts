import { supabase } from '@/integrations/supabase/client';
import type { 
  Project, 
  WorkEntry, 
  SubcontractorHakedis,
  Currency,
  ContractType,
  ApprovalStatus,
  PaymentStatus,
  ProjectStatus,
  PaymentInstallment,
  WorkItemEntry,
  HakedisItem,
  ExtraWorkItem
} from '@/types/hakedis';
import type { ActivityLog, ActivityType } from '@/types/activityLog';

// Helper to convert database row to Project type
const toProject = (row: any): Project => ({
  id: row.id,
  projectName: row.project_name,
  projectCode: row.project_code,
  location: row.location,
  startDate: row.start_date,
  status: row.status as ProjectStatus,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

// Helper to convert database row to WorkEntry type
const toWorkEntry = (row: any): WorkEntry => ({
  id: row.id,
  contractNo: row.contract_no,
  projectId: row.project_id,
  workCategory: row.work_category,
  subcontractor: row.subcontractor,
  contractType: row.contract_type as ContractType,
  contractFile: row.contract_file,
  description: row.description,
  date: row.date,
  currency: row.currency as Currency,
  vatRate: row.vat_rate,
  paymentPlan: row.payment_plan as PaymentInstallment[] | undefined,
  workItemEntries: row.work_item_entries as WorkItemEntry[] | undefined,
  createdBy: row.created_by,
  approvalStatus: row.approval_status as ApprovalStatus,
  approvedBy: row.approved_by,
  approvalDate: row.approval_date,
  rejectionReason: row.rejection_reason,
  totalAmount: Number(row.total_amount),
  paymentStatus: row.payment_status as PaymentStatus,
  paidDate: row.paid_date,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

// Helper to convert database row to SubcontractorHakedis type
const toHakedis = (row: any): SubcontractorHakedis => ({
  id: row.id,
  hakedisNo: row.hakedis_no,
  projectId: row.project_id,
  subcontractor: row.subcontractor,
  contractId: row.contract_id,
  contractNo: row.contract_no,
  contractType: row.contract_type as ContractType,
  currency: row.currency as Currency,
  vatRate: row.vat_rate,
  date: row.date,
  description: row.description,
  paymentAmount: row.payment_amount ? Number(row.payment_amount) : undefined,
  hakedisItems: row.hakedis_items as HakedisItem[] | undefined,
  extraItems: row.extra_items as ExtraWorkItem[] | undefined,
  totalAmount: Number(row.total_amount),
  paidAmount: Number(row.paid_amount || 0),
  createdBy: row.created_by,
  approvalStatus: row.approval_status as ApprovalStatus,
  approvedBy: row.approved_by,
  approvalDate: row.approval_date,
  rejectionReason: row.rejection_reason,
  paymentStatus: row.payment_status as PaymentStatus,
  paidDate: row.paid_date,
  contractExceededNote: row.contract_exceeded_note,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

// Helper to convert database row to ActivityLog type
const toActivityLog = (row: any): ActivityLog => ({
  id: row.id,
  type: row.type as ActivityType,
  userId: '',
  userName: '',
  userRole: row.user_role,
  description: row.description,
  details: row.details,
  entityId: row.entity_id,
  entityType: row.entity_type as 'project' | 'contract' | 'hakedis' | undefined,
  timestamp: row.timestamp,
});

// Projects
export const fetchProjects = async (): Promise<Project[]> => {
  const { data, error } = await supabase
    .from('projects')
    .select('*')
    .order('created_at', { ascending: false });
  
  if (error) throw error;
  return (data || []).map(toProject);
};

export const createProject = async (project: Omit<Project, 'id' | 'createdAt' | 'updatedAt'>): Promise<Project> => {
  const { data, error } = await supabase
    .from('projects')
    .insert({
      project_name: project.projectName,
      project_code: project.projectCode,
      location: project.location,
      start_date: project.startDate,
      status: project.status,
    })
    .select()
    .single();
  
  if (error) throw error;
  return toProject(data);
};

export const updateProject = async (id: string, updates: Partial<Project>): Promise<void> => {
  const dbUpdates: any = {};
  if (updates.projectName !== undefined) dbUpdates.project_name = updates.projectName;
  if (updates.projectCode !== undefined) dbUpdates.project_code = updates.projectCode;
  if (updates.location !== undefined) dbUpdates.location = updates.location;
  if (updates.startDate !== undefined) dbUpdates.start_date = updates.startDate;
  if (updates.status !== undefined) dbUpdates.status = updates.status;

  const { error } = await supabase
    .from('projects')
    .update(dbUpdates)
    .eq('id', id);
  
  if (error) throw error;
};

export const deleteProject = async (id: string): Promise<void> => {
  const { error } = await supabase
    .from('projects')
    .delete()
    .eq('id', id);
  
  if (error) throw error;
};

// Contracts (Work Entries)
export const fetchContracts = async (): Promise<WorkEntry[]> => {
  const { data, error } = await supabase
    .from('contracts')
    .select('*')
    .order('created_at', { ascending: false });
  
  if (error) throw error;
  return (data || []).map(toWorkEntry);
};

export const createContract = async (entry: Omit<WorkEntry, 'id' | 'createdAt' | 'updatedAt'>): Promise<WorkEntry> => {
  const { data, error } = await supabase
    .from('contracts')
    .insert({
      contract_no: entry.contractNo,
      project_id: entry.projectId,
      work_category: entry.workCategory,
      subcontractor: entry.subcontractor,
      contract_type: entry.contractType,
      contract_file: entry.contractFile,
      description: entry.description,
      date: entry.date,
      currency: entry.currency,
      vat_rate: entry.vatRate,
      payment_plan: entry.paymentPlan as any,
      work_item_entries: entry.workItemEntries as any,
      created_by: entry.createdBy,
      approval_status: entry.approvalStatus,
      total_amount: entry.totalAmount,
      payment_status: entry.paymentStatus,
    })
    .select()
    .single();
  
  if (error) throw error;
  return toWorkEntry(data);
};

export const updateContract = async (id: string, updates: Partial<WorkEntry>): Promise<void> => {
  const dbUpdates: any = {};
  if (updates.projectId !== undefined) dbUpdates.project_id = updates.projectId;
  if (updates.workCategory !== undefined) dbUpdates.work_category = updates.workCategory;
  if (updates.subcontractor !== undefined) dbUpdates.subcontractor = updates.subcontractor;
  if (updates.contractType !== undefined) dbUpdates.contract_type = updates.contractType;
  if (updates.contractFile !== undefined) dbUpdates.contract_file = updates.contractFile;
  if (updates.description !== undefined) dbUpdates.description = updates.description;
  if (updates.date !== undefined) dbUpdates.date = updates.date;
  if (updates.currency !== undefined) dbUpdates.currency = updates.currency;
  if (updates.vatRate !== undefined) dbUpdates.vat_rate = updates.vatRate;
  if (updates.paymentPlan !== undefined) dbUpdates.payment_plan = updates.paymentPlan;
  if (updates.workItemEntries !== undefined) dbUpdates.work_item_entries = updates.workItemEntries;
  if (updates.approvalStatus !== undefined) dbUpdates.approval_status = updates.approvalStatus;
  if (updates.approvedBy !== undefined) dbUpdates.approved_by = updates.approvedBy;
  if (updates.approvalDate !== undefined) dbUpdates.approval_date = updates.approvalDate;
  if (updates.rejectionReason !== undefined) dbUpdates.rejection_reason = updates.rejectionReason;
  if (updates.totalAmount !== undefined) dbUpdates.total_amount = updates.totalAmount;
  if (updates.paymentStatus !== undefined) dbUpdates.payment_status = updates.paymentStatus;
  if (updates.paidDate !== undefined) dbUpdates.paid_date = updates.paidDate;

  const { error } = await supabase
    .from('contracts')
    .update(dbUpdates)
    .eq('id', id);
  
  if (error) throw error;
};

export const deleteContract = async (id: string): Promise<void> => {
  const { error } = await supabase
    .from('contracts')
    .delete()
    .eq('id', id);
  
  if (error) throw error;
};

// Hakedisler
export const fetchHakedisler = async (): Promise<SubcontractorHakedis[]> => {
  const { data, error } = await supabase
    .from('hakedisler')
    .select('*')
    .order('created_at', { ascending: false });
  
  if (error) throw error;
  return (data || []).map(toHakedis);
};

export const createHakedis = async (hakedis: Omit<SubcontractorHakedis, 'id' | 'createdAt' | 'updatedAt'>): Promise<SubcontractorHakedis> => {
  const { data, error } = await supabase
    .from('hakedisler')
    .insert({
      hakedis_no: hakedis.hakedisNo,
      project_id: hakedis.projectId,
      subcontractor: hakedis.subcontractor,
      contract_id: hakedis.contractId,
      contract_no: hakedis.contractNo,
      contract_type: hakedis.contractType,
      currency: hakedis.currency,
      vat_rate: hakedis.vatRate,
      date: hakedis.date,
      description: hakedis.description,
      payment_amount: hakedis.paymentAmount,
      hakedis_items: hakedis.hakedisItems as any,
      extra_items: hakedis.extraItems as any,
      total_amount: hakedis.totalAmount,
      created_by: hakedis.createdBy,
      approval_status: hakedis.approvalStatus,
      payment_status: hakedis.paymentStatus,
      paid_amount: hakedis.paidAmount || 0,
      contract_exceeded_note: hakedis.contractExceededNote,
    })
    .select()
    .single();
  
  if (error) throw error;
  return toHakedis(data);
};

export const updateHakedis = async (id: string, updates: Partial<SubcontractorHakedis>): Promise<void> => {
  const dbUpdates: any = {};
  if (updates.projectId !== undefined) dbUpdates.project_id = updates.projectId;
  if (updates.subcontractor !== undefined) dbUpdates.subcontractor = updates.subcontractor;
  if (updates.contractId !== undefined) dbUpdates.contract_id = updates.contractId;
  if (updates.contractNo !== undefined) dbUpdates.contract_no = updates.contractNo;
  if (updates.contractType !== undefined) dbUpdates.contract_type = updates.contractType;
  if (updates.currency !== undefined) dbUpdates.currency = updates.currency;
  if (updates.vatRate !== undefined) dbUpdates.vat_rate = updates.vatRate;
  if (updates.date !== undefined) dbUpdates.date = updates.date;
  if (updates.description !== undefined) dbUpdates.description = updates.description;
  if (updates.paymentAmount !== undefined) dbUpdates.payment_amount = updates.paymentAmount;
  if (updates.hakedisItems !== undefined) dbUpdates.hakedis_items = updates.hakedisItems;
  if (updates.extraItems !== undefined) dbUpdates.extra_items = updates.extraItems;
  if (updates.totalAmount !== undefined) dbUpdates.total_amount = updates.totalAmount;
  if (updates.approvalStatus !== undefined) dbUpdates.approval_status = updates.approvalStatus;
  if (updates.approvedBy !== undefined) dbUpdates.approved_by = updates.approvedBy;
  if (updates.approvalDate !== undefined) dbUpdates.approval_date = updates.approvalDate;
  if (updates.rejectionReason !== undefined) dbUpdates.rejection_reason = updates.rejectionReason;
  if (updates.paymentStatus !== undefined) dbUpdates.payment_status = updates.paymentStatus;
  if (updates.paidAmount !== undefined) dbUpdates.paid_amount = updates.paidAmount;
  if (updates.paidDate !== undefined) dbUpdates.paid_date = updates.paidDate;
  if (updates.contractExceededNote !== undefined) dbUpdates.contract_exceeded_note = updates.contractExceededNote;

  const { error } = await supabase
    .from('hakedisler')
    .update(dbUpdates)
    .eq('id', id);
  
  if (error) throw error;
};

export const deleteHakedis = async (id: string): Promise<void> => {
  const { error } = await supabase
    .from('hakedisler')
    .delete()
    .eq('id', id);
  
  if (error) throw error;
};

// Subcontractors
export interface SubcontractorRecord {
  name: string;
  workCategory: string;
}

export const fetchSubcontractors = async (): Promise<SubcontractorRecord[]> => {
  const { data, error } = await supabase
    .from('subcontractors')
    .select('name, work_category')
    .order('name');
  
  if (error) throw error;
  return (data || []).map(row => ({ name: row.name, workCategory: row.work_category || '' }));
};

export const addSubcontractor = async (name: string, workCategory?: string): Promise<void> => {
  const insertData: any = { name };
  if (workCategory) insertData.work_category = workCategory;
  const { error } = await supabase
    .from('subcontractors')
    .insert(insertData);
  
  if (error && !error.message.includes('duplicate')) throw error;
};

// Activity Logs
export const fetchActivityLogs = async (): Promise<ActivityLog[]> => {
  const { data, error } = await supabase
    .from('activity_logs')
    .select('*')
    .order('timestamp', { ascending: false });
  
  if (error) throw error;
  return (data || []).map(toActivityLog);
};

export const createActivityLog = async (
  type: ActivityType,
  userRole: string,
  description: string,
  details?: string,
  entityId?: string,
  entityType?: 'project' | 'contract' | 'hakedis'
): Promise<void> => {
  const { error } = await supabase
    .from('activity_logs')
    .insert({
      type,
      user_role: userRole,
      description,
      details,
      entity_id: entityId,
      entity_type: entityType,
    });
  
  if (error) throw error;
};

// Counters
export const getNextContractNo = async (): Promise<string> => {
  const { data, error } = await supabase
    .from('counters')
    .select('value')
    .eq('id', 'contract')
    .single();
  
  if (error) throw error;
  
  const nextValue = (data?.value || 1005) + 1;
  
  await supabase
    .from('counters')
    .update({ value: nextValue })
    .eq('id', 'contract');
  
  return `SZ-${nextValue}`;
};

export const getNextHakedisNo = async (): Promise<string> => {
  const { data, error } = await supabase
    .from('counters')
    .select('value')
    .eq('id', 'hakedis')
    .single();
  
  if (error) throw error;
  
  const nextValue = (data?.value || 1000) + 1;
  
  await supabase
    .from('counters')
    .update({ value: nextValue })
    .eq('id', 'hakedis');
  
  return `HKD-${nextValue}`;
};

// Initialize default subcontractors
export const initializeSubcontractors = async (defaultList: string[]): Promise<void> => {
  // No longer needed - subcontractors are managed in the database with work categories
};
