export type Department = 'Engineering' | 'S&T' | 'OHE' | 'General';

export type BlockStatus =
  | 'requested'
  | 'proposed'
  | 'approved'
  | 'started'
  | 'completed'
  | 'overrun'
  | 'cancelled';

export type TrainCategory = 'Rajdhani' | 'Express' | 'Passenger' | 'Freight';

export interface Train {
  id: number;
  number: string;
  section_id: number;
  category: TrainCategory;
  entry_time: number; // minutes from midnight
  exit_time: number;  // minutes from midnight
  weight: number;
}

export interface Section {
  id: number;
  name: string;
  from_station: string;
  to_station: string;
  length_km: number;
}

export interface BlockRequest {
  id: number;
  dept: Department | string;
  section_id: number;
  km_from: number;
  km_to: number;
  duration_min: number;
  window_start: number;
  window_end: number;
  work_type: string;
  needs_power_block: boolean;
  block_id?: number | null;
}

export interface BlockEvent {
  id: number;
  block_id: number;
  planned_duration: number;
  granted_duration: number;
  actual_start?: number | null;
  actual_end?: number | null;
  overrun_reason?: string | null;
}

export interface BlockItem {
  id: number;
  section_id: number;
  section_name?: string;
  start: number;
  end: number;
  status: BlockStatus;
  request_ids: number[];
  requests?: BlockRequest[];
  event?: BlockEvent | null;
  overrun_min?: number;
}

export interface MergeProposal {
  block_id: number;
  section_id: number;
  start: number;
  end: number;
  depts: string[];
  needs_power_block: boolean;
  requests: BlockRequest[];
}

export interface TrainDelayImpact {
  train: string;
  category: TrainCategory | string;
  delay_min: number;
}

export interface SlotOption {
  start: number;
  end: number;
  start_hhmm: string;
  end_hhmm: string;
  cost: number;
  delay_minutes: number;
  trains_hit: number;
  affected: TrainDelayImpact[];
  recommended: boolean;
}

export interface OverrunAnalysis {
  block_id: number;
  section_id: number;
  status: BlockStatus;
  primary_work_type: string;
  departments: string[];
  planned_start: number;
  planned_end: number;
  actual_start?: number | null;
  expected_buffer_min: number;
  predicted_end: number;
  predicted_overrun_min: number;
  risk: 'LOW' | 'MEDIUM' | 'HIGH';
  confidence: 'LOW' | 'MEDIUM' | 'HIGH';
  reason: string;
  replan?: {
    suggested_start: number;
    suggested_end: number;
    start_hhmm: string;
    end_hhmm: string;
    delay_minutes: number;
    trains_hit: number;
    cost: number;
    reason: string;
  } | null;
}

export interface AuditEntry {
  id: number;
  timestamp: string;
  user_role: string;
  user_name: string;
  action: string;
  entity_type: string;
  entity_id: string;
  reason?: string | null;
  details?: string | null;
}

export interface OverlapCheckResult {
  has_overlaps: boolean;
  overlapping_requests: BlockRequest[];
  overlapping_blocks: BlockItem[];
  merge_candidate: boolean;
  reason: string;
}

export type UserRole =
  | 'Section Controller'
  | 'Field Supervisor'
  | 'Engineering Officer'
  | 'S&T Officer'
  | 'Electrical (OHE) Officer';
