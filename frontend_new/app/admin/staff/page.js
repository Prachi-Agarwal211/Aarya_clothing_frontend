'use client';

/**
 * Staff Account Management Page
 * Create and manage staff accounts with granular permissions
 */

import { useState, useEffect } from 'react';
import { staffManagementApi } from '@/lib/adminApi';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import {
  Checkbox
} from '@/components/ui/checkbox';
import {
  Users,
  UserPlus,
  Shield,
  Key,
  Clock,
  Monitor,
  FileText,
  Search,
  Edit,
  Trash2,
  MoreHorizontal,
  CheckCircle,
  XCircle,
  AlertCircle,
  RefreshCw,
  Download,
  Eye,
  LogOut,
  Smartphone,
  MapPin,
  Calendar,
} from 'lucide-react';

const PERMISSION_MODULES = [
  { value: 'products', label: 'Products' },
  { value: 'orders', label: 'Orders' },
  { value: 'customers', label: 'Customers' },
  { value: 'inventory', label: 'Inventory' },
  { value: 'analytics', label: 'Analytics' },
  { value: 'staff', label: 'Staff' },
  { value: 'settings', label: 'Settings' },
  { value: 'landing', label: 'Landing Pages' },
  { value: 'collections', label: 'Collections' },
  { value: 'chat', label: 'Chat' },
  { value: 'returns', label: 'Returns' },
  { value: 'ai_dashboard', label: 'AI Dashboard' },
  { value: 'ai_monitoring', label: 'AI Monitoring' },
  { value: 'ai_settings', label: 'AI Settings' },
];

const PERMISSION_ACTIONS = [
  { value: 'view', label: 'View' },
  { value: 'create', label: 'Create' },
  { value: 'edit', label: 'Edit' },
  { value: 'delete', label: 'Delete' },
  { value: 'export', label: 'Export' },
  { value: 'bulk_operations', label: 'Bulk Operations' },
  { value: 'approve', label: 'Approve' },
];

const DEFAULT_ROLE_PRESETS = {
  staff: [
    { module: 'products', actions: ['view'] },
    { module: 'orders', actions: ['view', 'edit'] },
    { module: 'customers', actions: ['view'] },
    { module: 'inventory', actions: ['view'] },
    { module: 'analytics', actions: ['view'] },
  ],
  admin: [
    { module: 'products', actions: ['view', 'create', 'edit', 'delete', 'bulk_operations'] },
    { module: 'orders', actions: ['view', 'create', 'edit', 'delete', 'bulk_operations', 'approve'] },
    { module: 'customers', actions: ['view', 'create', 'edit', 'delete'] },
    { module: 'inventory', actions: ['view', 'create', 'edit', 'delete', 'bulk_operations'] },
    { module: 'analytics', actions: ['view', 'export'] },
    { module: 'staff', actions: ['view', 'create', 'edit'] },
    { module: 'settings', actions: ['view', 'edit'] },
  ],
};

export default function StaffManagementPage() {
  // State
  const [accounts, setAccounts] = useState([]);
  const [roles, setRoles] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isRoleDialogOpen, setIsRoleDialogOpen] = useState(false);
  const [selectedAccount, setSelectedAccount] = useState(null);
  const [activeTab, setActiveTab] = useState('accounts');

  // Form state
  const [formData, setFormData] = useState({
    email: '',
    username: '',
    full_name: '',
    password: '',
    role: 'staff',
    custom_role_id: null,
    phone: '',
    department: '',
    is_active: true,
  });

  const [roleFormData, setRoleFormData] = useState({
    name: '',
    description: '',
    permissions: [],
  });

  // Load data
  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setIsLoading(true);
      const [accountsRes, rolesRes] = await Promise.all([
        staffManagementApi.listAccounts(),
        staffManagementApi.listRoles(),
      ]);
      setAccounts(accountsRes || []);
      setRoles(rolesRes || []);
    } catch (error) {
      console.error('Failed to load data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateAccount = async () => {
    try {
      await staffManagementApi.createAccount(formData);
      setIsCreateDialogOpen(false);
      setFormData({
        email: '',
        username: '',
        full_name: '',
        password: '',
        role: 'staff',
        custom_role_id: null,
        phone: '',
        department: '',
        is_active: true,
      });
      loadData();
    } catch (error) {
      alert('Failed to create account: ' + (error.message || 'Unknown error'));
    }
  };

  const handleCreateRole = async () => {
    try {
      await staffManagementApi.createRole(roleFormData);
      setIsRoleDialogOpen(false);
      setRoleFormData({ name: '', description: '', permissions: [] });
      loadData();
    } catch (error) {
      alert('Failed to create role: ' + (error.message || 'Unknown error'));
    }
  };

  const handleDeactivateAccount = async (userId) => {
    if (!confirm('Are you sure you want to deactivate this account?')) return;
    try {
      await staffManagementApi.deactivateAccount(userId);
      loadData();
    } catch (error) {
      alert('Failed to deactivate account: ' + (error.message || 'Unknown error'));
    }
  };

  const handleDeleteRole = async (roleId) => {
    if (!confirm('Are you sure you want to delete this role?')) return;
    try {
      await staffManagementApi.deleteRole(roleId);
      loadData();
    } catch (error) {
      alert('Failed to delete role: ' + (error.message || 'Unknown error'));
    }
  };

  const togglePermission = (module, action) => {
    setRoleFormData((prev) => {
      const existing = prev.permissions.find((p) => p.module === module);
      if (existing) {
        const hasAction = existing.actions.includes(action);
        const newActions = hasAction
          ? existing.actions.filter((a) => a !== action)
          : [...existing.actions, action];

        if (newActions.length === 0) {
          return {
            ...prev,
            permissions: prev.permissions.filter((p) => p.module !== module),
          };
        }

        return {
          ...prev,
          permissions: prev.permissions.map((p) =>
            p.module === module ? { ...p, actions: newActions } : p
          ),
        };
      } else {
        return {
          ...prev,
          permissions: [...prev.permissions, { module, actions: [action] }],
        };
      }
    });
  };

  const hasPermission = (module, action) => {
    const perm = roleFormData.permissions.find((p) => p.module === module);
    return perm?.actions.includes(action) || false;
  };

  const loadRolePreset = (presetName) => {
    const preset = DEFAULT_ROLE_PRESETS[presetName];
    if (preset) {
      setRoleFormData((prev) => ({
        ...prev,
        permissions: JSON.parse(JSON.stringify(preset)),
      }));
    }
  };

  return (
    <div className="flex-1 space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Staff Management</h1>
          <p className="text-muted-foreground">
            Manage staff accounts, roles, and permissions
          </p>
        </div>
        <div className="flex gap-2">
          <Dialog open={isRoleDialogOpen} onOpenChange={setIsRoleDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline">
                <Shield className="h-4 w-4 mr-2" />
                Create Custom Role
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-4xl">
              <DialogHeader>
                <DialogTitle>Create Custom Role</DialogTitle>
                <DialogDescription>
                  Define granular permissions for this role
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="role-name">Role Name</Label>
                    <Input
                      id="role-name"
                      value={roleFormData.name}
                      onChange={(e) =>
                        setRoleFormData({ ...roleFormData, name: e.target.value })
                      }
                      placeholder="e.g., Inventory Manager"
                    />
                  </div>
                  <div>
                    <Label htmlFor="role-description">Description</Label>
                    <Input
                      id="role-description"
                      value={roleFormData.description}
                      onChange={(e) =>
                        setRoleFormData({ ...roleFormData, description: e.target.value })
                      }
                      placeholder="Role description"
                    />
                  </div>
                </div>

                <div>
                  <Label>Load Preset</Label>
                  <div className="flex gap-2 mt-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => loadRolePreset('staff')}
                    >
                      Staff Preset
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => loadRolePreset('admin')}
                    >
                      Admin Preset
                    </Button>
                  </div>
                </div>

                <div>
                  <Label>Permissions</Label>
                  <div className="mt-2 border rounded-lg">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-48">Module</TableHead>
                          {PERMISSION_ACTIONS.map((action) => (
                            <TableHead key={action.value} className="text-center">
                              {action.label}
                            </TableHead>
                          ))}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {PERMISSION_MODULES.map((module) => (
                          <TableRow key={module.value}>
                            <TableCell className="font-medium">
                              {module.label}
                            </TableCell>
                            {PERMISSION_ACTIONS.map((action) => (
                              <TableCell key={action.value} className="text-center">
                                <Checkbox
                                  checked={hasPermission(module.value, action.value)}
                                  onCheckedChange={() =>
                                    togglePermission(module.value, action.value)
                                  }
                                />
                              </TableCell>
                            ))}
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>

                <div className="text-sm text-muted-foreground">
                  Selected permissions:{' '}
                  {roleFormData.permissions.reduce(
                    (acc, p) => acc + p.actions.length,
                    0
                  )}{' '}
                  across {roleFormData.permissions.length} modules
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsRoleDialogOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleCreateRole}>Create Role</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <UserPlus className="h-4 w-4 mr-2" />
                Add Staff Account
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create Staff Account</DialogTitle>
                <DialogDescription>
                  Add a new staff member with specific role and permissions
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) =>
                      setFormData({ ...formData, email: e.target.value })
                    }
                    placeholder="staff@aaryaclothing.com"
                  />
                </div>
                <div>
                  <Label htmlFor="username">Username</Label>
                  <Input
                    id="username"
                    value={formData.username}
                    onChange={(e) =>
                      setFormData({ ...formData, username: e.target.value })
                    }
                    placeholder="username"
                  />
                </div>
                <div>
                  <Label htmlFor="full_name">Full Name</Label>
                  <Input
                    id="full_name"
                    value={formData.full_name}
                    onChange={(e) =>
                      setFormData({ ...formData, full_name: e.target.value })
                    }
                    placeholder="Full Name"
                  />
                </div>
                <div>
                  <Label htmlFor="password">Password</Label>
                  <Input
                    id="password"
                    type="password"
                    value={formData.password}
                    onChange={(e) =>
                      setFormData({ ...formData, password: e.target.value })
                    }
                    placeholder="Minimum 8 characters"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="role">Role</Label>
                    <Select
                      value={formData.role}
                      onValueChange={(value) =>
                        setFormData({ ...formData, role: value })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="staff">Staff</SelectItem>
                        <SelectItem value="admin">Admin</SelectItem>
                        <SelectItem value="super_admin">Super Admin</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="department">Department</Label>
                    <Input
                      id="department"
                      value={formData.department}
                      onChange={(e) =>
                        setFormData({ ...formData, department: e.target.value })
                      }
                      placeholder="e.g., Sales, Inventory"
                    />
                  </div>
                </div>
                <div>
                  <Label htmlFor="phone">Phone</Label>
                  <Input
                    id="phone"
                    value={formData.phone}
                    onChange={(e) =>
                      setFormData({ ...formData, phone: e.target.value })
                    }
                    placeholder="+91 98765 43210"
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleCreateAccount}>Create Account</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="accounts">
            <Users className="h-4 w-4 mr-2" />
            Accounts ({accounts.length})
          </TabsTrigger>
          <TabsTrigger value="roles">
            <Shield className="h-4 w-4 mr-2" />
            Custom Roles ({roles.length})
          </TabsTrigger>
          <TabsTrigger value="audit">
            <FileText className="h-4 w-4 mr-2" />
            Audit Logs
          </TabsTrigger>
        </TabsList>

        <TabsContent value="accounts" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Staff Accounts</CardTitle>
              <CardDescription>
                Manage all staff, admin, and super admin accounts
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>User</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Department</TableHead>
                    <TableHead>2FA</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Last Login</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {accounts.map((account) => (
                    <TableRow key={account.id}>
                      <TableCell>
                        <div>
                          <div className="font-medium">{account.full_name}</div>
                          <div className="text-sm text-muted-foreground">
                            {account.email}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            account.role === 'super_admin'
                              ? 'destructive'
                              : account.role === 'admin'
                              ? 'default'
                              : 'secondary'
                          }
                        >
                          {account.role.replace('_', ' ')}
                        </Badge>
                        {account.custom_role_name && (
                          <div className="text-xs text-muted-foreground mt-1">
                            {account.custom_role_name}
                          </div>
                        )}
                      </TableCell>
                      <TableCell>{account.department || '-'}</TableCell>
                      <TableCell>
                        {account.two_factor_enabled ? (
                          <CheckCircle className="h-4 w-4 text-green-600" />
                        ) : (
                          <XCircle className="h-4 w-4 text-muted-foreground" />
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant={account.is_active ? 'default' : 'secondary'}>
                          {account.is_active ? 'Active' : 'Inactive'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {account.last_login
                          ? new Date(account.last_login).toLocaleString()
                          : 'Never'}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button variant="ghost" size="icon">
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon">
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDeactivateAccount(account.id)}
                          >
                            {account.is_active ? (
                              <LogOut className="h-4 w-4" />
                            ) : (
                              <CheckCircle className="h-4 w-4" />
                            )}
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="roles" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Custom Roles</CardTitle>
              <CardDescription>
                Define custom permission sets for specific use cases
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Role Name</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Modules</TableHead>
                    <TableHead>Permissions</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {roles.map((role) => (
                    <TableRow key={role.id}>
                      <TableCell className="font-medium">{role.name}</TableCell>
                      <TableCell>{role.description || '-'}</TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {role.permissions?.slice(0, 5).map((p, idx) => (
                            <Badge key={idx} variant="outline" className="text-xs">
                              {p.module}
                            </Badge>
                          ))}
                          {role.permissions?.length > 5 && (
                            <Badge variant="outline" className="text-xs">
                              +{role.permissions.length - 5}
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {role.permissions?.reduce((acc, p) => acc + p.actions.length, 0)}
                      </TableCell>
                      <TableCell>
                        <Badge variant={role.is_active ? 'default' : 'secondary'}>
                          {role.is_active ? 'Active' : 'Inactive'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {role.created_at
                          ? new Date(role.created_at).toLocaleDateString()
                          : '-'}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button variant="ghost" size="icon">
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon">
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDeleteRole(role.id)}
                          >
                            <Trash2 className="h-4 w-4 text-red-600" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="audit" className="space-y-4">
          <AuditLogsTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// Audit Logs Sub-Component
function AuditLogsTab() {
  const [logs, setLogs] = useState([]);
  const [filters, setFilters] = useState({
    module: '',
    action_type: '',
    start_date: '',
    end_date: '',
  });
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    loadLogs();
  }, []);

  const loadLogs = async () => {
    try {
      setIsLoading(true);
      const params = {};
      if (filters.module) params.module = filters.module;
      if (filters.action_type) params.action_type = filters.action_type;
      if (filters.start_date) params.start_date = filters.start_date;
      if (filters.end_date) params.end_date = filters.end_date;

      const res = await staffManagementApi.getAuditLogs(params);
      setLogs(res || []);
    } catch (error) {
      console.error('Failed to load audit logs:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const exportLogs = () => {
    const url = staffManagementApi.exportAuditLogs(filters);
    window.open(url, '_blank');
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Audit Logs</CardTitle>
              <CardDescription>
                Track all staff actions across the platform
              </CardDescription>
            </div>
            <Button variant="outline" onClick={exportLogs}>
              <Download className="h-4 w-4 mr-2" />
              Export CSV
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {/* Filters */}
          <div className="grid grid-cols-4 gap-4 mb-4">
            <div>
              <Label>Module</Label>
              <Select
                value={filters.module}
                onValueChange={(value) =>
                  setFilters({ ...filters, module: value })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="All modules" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="products">Products</SelectItem>
                  <SelectItem value="orders">Orders</SelectItem>
                  <SelectItem value="customers">Customers</SelectItem>
                  <SelectItem value="inventory">Inventory</SelectItem>
                  <SelectItem value="staff">Staff</SelectItem>
                  <SelectItem value="settings">Settings</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Action Type</Label>
              <Select
                value={filters.action_type}
                onValueChange={(value) =>
                  setFilters({ ...filters, action_type: value })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="All actions" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="CREATE">Create</SelectItem>
                  <SelectItem value="UPDATE">Update</SelectItem>
                  <SelectItem value="DELETE">Delete</SelectItem>
                  <SelectItem value="VIEW">View</SelectItem>
                  <SelectItem value="EXPORT">Export</SelectItem>
                  <SelectItem value="LOGIN">Login</SelectItem>
                  <SelectItem value="LOGOUT">Logout</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Start Date</Label>
              <Input
                type="date"
                value={filters.start_date}
                onChange={(e) =>
                  setFilters({ ...filters, start_date: e.target.value })
                }
              />
            </div>
            <div>
              <Label>End Date</Label>
              <Input
                type="date"
                value={filters.end_date}
                onChange={(e) =>
                  setFilters({ ...filters, end_date: e.target.value })
                }
              />
            </div>
          </div>

          <Button onClick={loadLogs} variant="outline" size="sm">
            <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>

          {/* Logs Table */}
          <div className="mt-4 border rounded-lg">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Timestamp</TableHead>
                  <TableHead>Staff</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead>Module</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>IP Address</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell className="font-mono text-xs">
                      {new Date(log.created_at).toLocaleString()}
                    </TableCell>
                    <TableCell>
                      <div>
                        <div className="font-medium">{log.staff_name || `ID: ${log.staff_id}`}</div>
                        <div className="text-sm text-muted-foreground">{log.staff_email}</div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          log.action_type === 'CREATE'
                            ? 'default'
                            : log.action_type === 'UPDATE'
                            ? 'secondary'
                            : log.action_type === 'DELETE'
                            ? 'destructive'
                            : 'outline'
                        }
                      >
                        {log.action_type}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{log.module}</Badge>
                    </TableCell>
                    <TableCell className="max-w-md truncate">
                      {log.description}
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      {log.ip_address || '-'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {logs.length === 0 && !isLoading && (
            <div className="text-center py-8 text-muted-foreground">
              <FileText className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p>No audit logs found</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
