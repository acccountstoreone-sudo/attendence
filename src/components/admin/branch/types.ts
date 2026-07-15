export interface Branch {
  id: string;
  name: string;
  code: string;
  address?: string;
  city?: string;
  phone?: string;
  is_active: boolean;
  latitude?: number;
  longitude?: number;
  geofence_radius_meters: number;
  manager_id?: string;
  office_start_time?: string;
  office_end_time?: string;
  grace_time_minutes?: number;
  late_rules?: string;
  overtime_rules?: string;
}

export interface BranchEmployee {
  id: string;
  role: string;
  full_name: string;
  email: string;
  phone?: string;
  whatsapp_number?: string;
  branch_name?: string;
  branches?: { name?: string; code?: string };
  profile_picture?: string;
  photo_url?: string;
  employee_id?: string;
  is_active?: boolean;
  is_present_today?: boolean;
  today_status?: string;
  check_in_time?: string | null;
  check_out_time?: string | null;
  today_working_minutes?: number;
  today_overtime_minutes?: number;
}

