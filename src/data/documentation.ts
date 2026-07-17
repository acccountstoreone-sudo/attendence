export type DocSection = {
  id: string;
  title: string;
  category: 'admin' | 'manager';
  tags: string[];
  content: string; // Markdown/HTML string
};

export const documentationData: DocSection[] = [
  // --- ADMIN GUIDES ---
  {
    id: 'admin-dashboard-overview',
    title: 'Dashboard Overview',
    category: 'admin',
    tags: ['dashboard', 'stats', 'overview', 'home', 'metrics'],
    content: `
## Admin Dashboard
The dashboard provides a high-level overview of the entire organization's daily metrics.

### Key Metrics
- **Total Employees:** Total registered employees across all branches.
- **Present Today:** Employees who have successfully checked in today.
- **On Leave:** Employees on approved leave today.
- **Pending Approvals:** Gate passes, manual corrections, or leaves awaiting admin review.

### Usage
- Hover over the charts to see specific daily attendance trends.
- Use the quick action buttons to immediately navigate to Pending Approvals or Live Maps.
    `,
  },
  {
    id: 'admin-attendance-tracking',
    title: 'Attendance Tracking',
    category: 'admin',
    tags: ['attendance', 'check-in', 'check-out', 'live location', 'geo-fencing'],
    content: `
## Attendance & Live Tracking
This module allows administrators to monitor real-time workforce presence.

### Live Location Map
- Navigate to **Attendance > Live Map**.
- You will see a real-time cluster map of all checked-in employees.
- Click on any pin to view the employee's name, branch, and exact check-in time.

### Viewing Attendance History
- Navigate to **Attendance > History**.
- Use the date picker and branch filters to view historical attendance logs.
- Export data as PDF or Excel directly from this page for payroll processing.
    `,
  },
  {
    id: 'admin-employee-management',
    title: 'Employee & Biometrics Management',
    category: 'admin',
    tags: ['employee', 'biometrics', 'fingerprint', 'face', 'kyc', 'enrollment'],
    content: `
## Employee Management
Manage all staff members, their roles, and their biometric credentials.

### Adding a New Employee
1. Go to **Employees > Add New**.
2. Fill in the required details (Name, Branch, Role, Base Salary).
3. Save the profile.

### Enrolling Biometrics (Face & Fingerprint)
- **FaceID:** From the employee profile, click "Enroll Face". The system will use the camera to capture a 3D depth map. Ensure good lighting.
- **Fingerprint (WebAuthn):** Click "Register Device/Fingerprint" while on the device the employee will use. This binds the device's hardware security module to the employee's account.
- **Important:** Biometrics are encrypted. You cannot view the actual facial map or fingerprint data once saved.
    `,
  },
  {
    id: 'admin-branches-shifts',
    title: 'Branches & Shifts Setup',
    category: 'admin',
    tags: ['branch', 'shifts', 'geo-coordinates', 'radius', 'schedule'],
    content: `
## Setting up Branches & Shifts

### Branch Setup
1. Go to **Branches > Add Branch**.
2. Enter the **Latitude and Longitude** of the branch office. You can use the built-in map picker.
3. Set the **Radius (in meters)**. E.g., 50 meters. Employees can only check in if their device's GPS is within this radius.

### Shift Management
- Navigate to **Duty Hours & Shifts**.
- Create standard shifts (e.g., 9 AM to 5 PM) or rotational shifts.
- You can assign a global shift to a branch or override it for specific employees.
    `,
  },
  {
    id: 'admin-leaves-holidays',
    title: 'Leaves & Holidays',
    category: 'admin',
    tags: ['leave', 'holiday', 'approval', 'balance'],
    content: `
## Leaves & Holidays

### Managing Leaves
- When an employee applies for leave, it appears in **Pending Approvals**.
- Admins can **Approve** or **Reject** the leave. If approved, the employee's leave balance is automatically deducted.
- To view an employee's remaining leave balance, visit their profile under the **Employees** tab.

### Setting Holidays
- Go to **Holidays**.
- Add upcoming public holidays.
- If an employee works on a registered holiday, the system automatically applies the **Holiday Overtime Multiplier** (configurable in Payroll Settings).
    `,
  },
  {
    id: 'admin-payroll',
    title: 'Payroll & Salary Settings',
    category: 'admin',
    tags: ['payroll', 'salary', 'payslip', 'overtime', 'deductions'],
    content: `
## Payroll Processing

### Global Salary Settings
- Navigate to **Salary Settings**.
- Configure the **Overtime Rate** (e.g., 1.5x hourly wage) and **Late Deduction Rules** (e.g., deduct 1 hour's wage if late by more than 30 minutes).

### Generating Payroll
1. Go to **Payroll**.
2. Select the Month and Branch (or All Branches).
3. Click **Generate Payroll**.
4. The system calculates total hours worked, overtime, late penalties, and unpaid leaves to generate the final payable amount.
5. You can export these reports as standard Payslips.
    `,
  },
  
  // --- MANAGER GUIDES ---
  {
    id: 'manager-branch-dashboard',
    title: 'Branch Dashboard Overview',
    category: 'manager',
    tags: ['manager', 'branch', 'dashboard', 'stats'],
    content: `
## Manager Dashboard
As a Branch Manager, your dashboard is localized to show only data for your assigned branch.

### Key Metrics
- You will see the total staff assigned to your branch.
- Quick statistics on who is present, absent, or on leave today.
- Your dashboard will not show financial or payroll data unless specifically granted by the Admin.
    `,
  },
  {
    id: 'manager-approvals',
    title: 'Gate Passes & Local Approvals',
    category: 'manager',
    tags: ['manager', 'gate pass', 'approval', 'leave'],
    content: `
## Managing Local Requests

### Gate Passes
- Employees in your branch may request temporary Gate Passes for official errands.
- Navigate to **Gate Passes** in your panel.
- Review the reason and duration.
- Once approved, the employee can temporarily leave the geo-fenced area without being marked absent.

### Duty Reports
- Managers can view daily **Duty Reports** for all staff in their branch to ensure adequate coverage.
- If someone forgets to check out, managers can initiate a **Manual Correction Request** on behalf of the employee, which will be sent to the Admin for final approval.
    `,
  }
];
