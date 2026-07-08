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
}

export interface BranchEmployee {
  id: string;
  role: string;
  full_name: string;
  email: string;
  phone?: string;
  profile_picture?: string;
  employee_id?: string;
  is_active?: boolean;
  is_present_today?: boolean;
}
