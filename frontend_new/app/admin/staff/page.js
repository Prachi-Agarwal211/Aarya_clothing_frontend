'use client';

import { useState, useEffect } from 'react';
import { staffManagementApi } from '@/lib/adminApi';
import {
  Users, UserPlus, Shield, FileText, CheckCircle, XCircle,
  RefreshCw, Download, Eye, Edit, Trash2, LogOut, X,
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

  const inputCls = "w-full px-3 py-2.5 bg-[#0B0608]/60 border border-[#B76E79]/20 rounded-xl text-[#EAE0D5] placeholder-[#EAE0D5]/30 focus:outline-none focus:border-[#B76E79]/40 text-sm";
  const labelCls = "block text-xs text-[#EAE0D5]/60 mb-1.5 uppercase tracking-wider";
  const roleBadge = (role) => {
    const map = { super_admin: 'bg-red-500/20 text-red-300', admin: 'bg-[#7A2F57]/30 text-[#F2C29A]', staff: 'bg-[#B76E79]/15 text-[#EAE0D5]/70' };
    return map[role] || map.staff;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-[#F2C29A]" style={{ fontFamily: 'Cinzel, serif' }}>Staff Management</h1>
          <p className="text-[#EAE0D5]/60 mt-1">Manage staff accounts, roles, and permissions</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => setIsRoleDialogOpen(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl border border-[#B76E79]/20 text-[#EAE0D5]/70 hover:bg-[#B76E79]/10 transition-colors text-sm"
          >
            <Shield className="w-4 h-4" /> Create Role
          </button>
          <button
            onClick={() => setIsCreateDialogOpen(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-[#7A2F57] to-[#B76E79] text-white font-medium hover:opacity-90 transition-opacity text-sm"
          >
            <UserPlus className="w-4 h-4" /> Add Staff
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-[#0B0608]/60 border border-[#B76E79]/15 rounded-2xl w-fit">
        {[{ id: 'accounts', label: `Accounts (${accounts.length})`, icon: Users }, { id: 'roles', label: `Roles (${roles.length})`, icon: Shield }, { id: 'audit', label: 'Audit Logs', icon: FileText }].map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm transition-all ${
              activeTab === tab.id ? 'bg-[#7A2F57]/40 text-[#F2C29A] font-medium' : 'text-[#EAE0D5]/50 hover:text-[#EAE0D5]/80'
            }`}>
            <tab.icon className="w-4 h-4" />{tab.label}
          </button>
        ))}
      </div>

      {/* Accounts Tab */}
      {activeTab === 'accounts' && (
        <div className="bg-[#0B0608]/40 backdrop-blur-md border border-[#B76E79]/15 rounded-2xl overflow-hidden">
          <div className="p-4 border-b border-[#B76E79]/10">
            <h3 className="text-[#F2C29A] font-medium">Staff Accounts</h3>
            <p className="text-xs text-[#EAE0D5]/50 mt-0.5">Manage all staff, admin, and super admin accounts</p>
          </div>
          {isLoading ? (
            <div className="p-8 text-center"><RefreshCw className="w-6 h-6 animate-spin text-[#B76E79] mx-auto" /></div>
          ) : accounts.length === 0 ? (
            <div className="p-12 text-center"><Users className="w-10 h-10 text-[#B76E79]/30 mx-auto mb-3" /><p className="text-[#EAE0D5]/40">No staff accounts found</p></div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[#B76E79]/10">
                    {['User', 'Role', 'Department', '2FA', 'Status', 'Last Login', 'Actions'].map(h => (
                      <th key={h} className="px-4 py-3 text-left text-xs text-[#EAE0D5]/40 uppercase tracking-wider font-medium">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {accounts.map((account) => (
                    <tr key={account.id} className="border-b border-[#B76E79]/5 hover:bg-[#B76E79]/5 transition-colors">
                      <td className="px-4 py-3">
                        <p className="font-medium text-[#EAE0D5]">{account.full_name || account.username}</p>
                        <p className="text-xs text-[#EAE0D5]/50">{account.email}</p>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${roleBadge(account.role)}`}>
                          {account.role.replace('_', ' ')}
                        </span>
                        {account.custom_role_name && <p className="text-xs text-[#EAE0D5]/40 mt-0.5">{account.custom_role_name}</p>}
                      </td>
                      <td className="px-4 py-3 text-[#EAE0D5]/60">{account.department || '—'}</td>
                      <td className="px-4 py-3">
                        {account.two_factor_enabled
                          ? <CheckCircle className="w-4 h-4 text-green-400" />
                          : <XCircle className="w-4 h-4 text-[#EAE0D5]/20" />}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${
                          account.is_active ? 'bg-green-500/15 text-green-400' : 'bg-[#EAE0D5]/5 text-[#EAE0D5]/30'
                        }`}>{account.is_active ? 'Active' : 'Inactive'}</span>
                      </td>
                      <td className="px-4 py-3 text-xs text-[#EAE0D5]/50">
                        {account.last_login ? new Date(account.last_login).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : 'Never'}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-1">
                          <button className="p-1.5 rounded-lg hover:bg-[#B76E79]/10 text-[#EAE0D5]/50 hover:text-[#EAE0D5] transition-colors" title="View"><Eye className="w-4 h-4" /></button>
                          <button
                            onClick={() => handleDeactivateAccount(account.id)}
                            className="p-1.5 rounded-lg hover:bg-[#B76E79]/10 text-[#EAE0D5]/50 hover:text-orange-400 transition-colors"
                            title={account.is_active ? 'Deactivate' : 'Activate'}
                          >
                            {account.is_active ? <LogOut className="w-4 h-4" /> : <CheckCircle className="w-4 h-4" />}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Roles Tab */}
      {activeTab === 'roles' && (
        <div className="bg-[#0B0608]/40 backdrop-blur-md border border-[#B76E79]/15 rounded-2xl overflow-hidden">
          <div className="p-4 border-b border-[#B76E79]/10">
            <h3 className="text-[#F2C29A] font-medium">Custom Roles</h3>
            <p className="text-xs text-[#EAE0D5]/50 mt-0.5">Define custom permission sets for specific use cases</p>
          </div>
          {roles.length === 0 ? (
            <div className="p-12 text-center"><Shield className="w-10 h-10 text-[#B76E79]/30 mx-auto mb-3" /><p className="text-[#EAE0D5]/40">No custom roles defined</p></div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[#B76E79]/10">
                    {['Role Name', 'Description', 'Modules', 'Permissions', 'Status', 'Created', 'Actions'].map(h => (
                      <th key={h} className="px-4 py-3 text-left text-xs text-[#EAE0D5]/40 uppercase tracking-wider font-medium">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {roles.map((role) => (
                    <tr key={role.id} className="border-b border-[#B76E79]/5 hover:bg-[#B76E79]/5 transition-colors">
                      <td className="px-4 py-3 font-medium text-[#F2C29A]">{role.name}</td>
                      <td className="px-4 py-3 text-[#EAE0D5]/60 max-w-xs truncate">{role.description || '—'}</td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1">
                          {role.permissions?.slice(0, 4).map((p, idx) => (
                            <span key={idx} className="px-1.5 py-0.5 bg-[#7A2F57]/20 text-[#EAE0D5]/60 text-xs rounded">{p.module}</span>
                          ))}
                          {role.permissions?.length > 4 && <span className="px-1.5 py-0.5 bg-[#7A2F57]/20 text-[#EAE0D5]/40 text-xs rounded">+{role.permissions.length - 4}</span>}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-[#EAE0D5]/60">{role.permissions?.reduce((acc, p) => acc + p.actions.length, 0) || 0}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${
                          role.is_active ? 'bg-green-500/15 text-green-400' : 'bg-[#EAE0D5]/5 text-[#EAE0D5]/30'
                        }`}>{role.is_active ? 'Active' : 'Inactive'}</span>
                      </td>
                      <td className="px-4 py-3 text-xs text-[#EAE0D5]/50">{role.created_at ? new Date(role.created_at).toLocaleDateString('en-IN') : '—'}</td>
                      <td className="px-4 py-3">
                        <button onClick={() => handleDeleteRole(role.id)} className="p-1.5 rounded-lg hover:bg-red-500/10 text-[#EAE0D5]/40 hover:text-red-400 transition-colors" title="Delete">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Audit Tab */}
      {activeTab === 'audit' && <AuditLogsTab />}

      {/* Create Account Modal */}
      {isCreateDialogOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60" onClick={() => setIsCreateDialogOpen(false)} />
          <div className="relative bg-[#0B0608]/95 backdrop-blur-xl border border-[#B76E79]/20 rounded-2xl p-6 w-full max-w-md">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-xl font-semibold text-[#F2C29A]" style={{ fontFamily: 'Cinzel, serif' }}>Add Staff Account</h3>
              <button onClick={() => setIsCreateDialogOpen(false)} className="p-1 rounded-lg hover:bg-[#B76E79]/10"><X className="w-5 h-5 text-[#EAE0D5]/50" /></button>
            </div>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div><label className={labelCls}>Email</label><input type="email" placeholder="staff@aaryaclothing.com" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} className={inputCls} /></div>
                <div><label className={labelCls}>Username</label><input placeholder="username" value={formData.username} onChange={e => setFormData({...formData, username: e.target.value})} className={inputCls} /></div>
              </div>
              <div><label className={labelCls}>Full Name</label><input placeholder="Full Name" value={formData.full_name} onChange={e => setFormData({...formData, full_name: e.target.value})} className={inputCls} /></div>
              <div><label className={labelCls}>Password</label><input type="password" placeholder="Minimum 8 characters" value={formData.password} onChange={e => setFormData({...formData, password: e.target.value})} className={inputCls} /></div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}>Role</label>
                  <select value={formData.role} onChange={e => setFormData({...formData, role: e.target.value})} className={inputCls}>
                    <option value="staff">Staff</option>
                    <option value="admin">Admin</option>
                    <option value="super_admin">Super Admin</option>
                  </select>
                </div>
                <div><label className={labelCls}>Department</label><input placeholder="e.g., Sales" value={formData.department} onChange={e => setFormData({...formData, department: e.target.value})} className={inputCls} /></div>
              </div>
              <div><label className={labelCls}>Phone</label><input placeholder="+91 98765 43210" value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} className={inputCls} /></div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => setIsCreateDialogOpen(false)} className="flex-1 px-4 py-2.5 border border-[#B76E79]/20 rounded-xl text-[#EAE0D5]/70 hover:bg-[#B76E79]/10 transition-colors">Cancel</button>
              <button onClick={handleCreateAccount} className="flex-1 px-4 py-2.5 bg-gradient-to-r from-[#7A2F57] to-[#B76E79] rounded-xl text-white font-semibold hover:opacity-90 transition-opacity">Create Account</button>
            </div>
          </div>
        </div>
      )}

      {/* Create Role Modal */}
      {isRoleDialogOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60" onClick={() => setIsRoleDialogOpen(false)} />
          <div className="relative bg-[#0B0608]/95 backdrop-blur-xl border border-[#B76E79]/20 rounded-2xl p-6 w-full max-w-4xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-xl font-semibold text-[#F2C29A]" style={{ fontFamily: 'Cinzel, serif' }}>Create Custom Role</h3>
              <button onClick={() => setIsRoleDialogOpen(false)} className="p-1 rounded-lg hover:bg-[#B76E79]/10"><X className="w-5 h-5 text-[#EAE0D5]/50" /></button>
            </div>
            <div className="space-y-5">
              <div className="grid grid-cols-2 gap-4">
                <div><label className={labelCls}>Role Name</label><input placeholder="e.g., Inventory Manager" value={roleFormData.name} onChange={e => setRoleFormData({...roleFormData, name: e.target.value})} className={inputCls} /></div>
                <div><label className={labelCls}>Description</label><input placeholder="Role description" value={roleFormData.description} onChange={e => setRoleFormData({...roleFormData, description: e.target.value})} className={inputCls} /></div>
              </div>
              <div>
                <label className={labelCls}>Load Preset</label>
                <div className="flex gap-2 mt-1">
                  <button onClick={() => loadRolePreset('staff')} className="px-3 py-1.5 border border-[#B76E79]/20 rounded-lg text-xs text-[#EAE0D5]/70 hover:bg-[#B76E79]/10 transition-colors">Staff Preset</button>
                  <button onClick={() => loadRolePreset('admin')} className="px-3 py-1.5 border border-[#B76E79]/20 rounded-lg text-xs text-[#EAE0D5]/70 hover:bg-[#B76E79]/10 transition-colors">Admin Preset</button>
                </div>
              </div>
              <div>
                <label className={labelCls}>Permissions</label>
                <div className="mt-2 border border-[#B76E79]/15 rounded-xl overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-[#B76E79]/10">
                        <th className="px-4 py-2.5 text-left text-xs text-[#EAE0D5]/50 font-medium w-40">Module</th>
                        {PERMISSION_ACTIONS.map(a => (
                          <th key={a.value} className="px-3 py-2.5 text-center text-xs text-[#EAE0D5]/50 font-medium">{a.label}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {PERMISSION_MODULES.map(module => (
                        <tr key={module.value} className="border-b border-[#B76E79]/5 hover:bg-[#B76E79]/5">
                          <td className="px-4 py-2.5 text-[#EAE0D5]/80 font-medium">{module.label}</td>
                          {PERMISSION_ACTIONS.map(action => (
                            <td key={action.value} className="px-3 py-2.5 text-center">
                              <input
                                type="checkbox"
                                checked={hasPermission(module.value, action.value)}
                                onChange={() => togglePermission(module.value, action.value)}
                                className="w-4 h-4 rounded border-[#B76E79]/30 bg-[#0B0608]/60 accent-[#B76E79] cursor-pointer"
                              />
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="text-xs text-[#EAE0D5]/40 mt-2">
                  {roleFormData.permissions.reduce((acc, p) => acc + p.actions.length, 0)} permissions across {roleFormData.permissions.length} modules selected
                </p>
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => setIsRoleDialogOpen(false)} className="flex-1 px-4 py-2.5 border border-[#B76E79]/20 rounded-xl text-[#EAE0D5]/70 hover:bg-[#B76E79]/10 transition-colors">Cancel</button>
              <button onClick={handleCreateRole} className="flex-1 px-4 py-2.5 bg-gradient-to-r from-[#7A2F57] to-[#B76E79] rounded-xl text-white font-semibold hover:opacity-90 transition-opacity">Create Role</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Audit Logs Sub-Component
function AuditLogsTab() {
  const [logs, setLogs] = useState([]);
  const [filters, setFilters] = useState({ module: '', action_type: '', start_date: '', end_date: '' });
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => { loadLogs(); }, []);

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

  const actionColor = (type) => {
    const map = { CREATE: 'bg-green-500/15 text-green-400', UPDATE: 'bg-blue-500/15 text-blue-400', DELETE: 'bg-red-500/15 text-red-400', LOGIN: 'bg-[#7A2F57]/20 text-[#F2C29A]', LOGOUT: 'bg-[#EAE0D5]/5 text-[#EAE0D5]/40' };
    return map[type] || 'bg-[#B76E79]/10 text-[#EAE0D5]/60';
  };

  const cls = "w-full px-3 py-2 bg-[#0B0608]/60 border border-[#B76E79]/20 rounded-xl text-[#EAE0D5] focus:outline-none focus:border-[#B76E79]/40 text-sm";

  return (
    <div className="bg-[#0B0608]/40 backdrop-blur-md border border-[#B76E79]/15 rounded-2xl overflow-hidden">
      <div className="p-4 border-b border-[#B76E79]/10 flex items-center justify-between">
        <div>
          <h3 className="text-[#F2C29A] font-medium">Audit Logs</h3>
          <p className="text-xs text-[#EAE0D5]/50 mt-0.5">Track all staff actions across the platform</p>
        </div>
        <div className="flex gap-2">
          <button onClick={loadLogs} className="p-2 rounded-xl border border-[#B76E79]/20 text-[#EAE0D5]/60 hover:bg-[#B76E79]/10 transition-colors">
            <RefreshCw className={isLoading ? 'w-4 h-4 animate-spin' : 'w-4 h-4'} />
          </button>
          <button onClick={exportLogs} className="flex items-center gap-2 px-3 py-1.5 border border-[#B76E79]/20 rounded-xl text-[#EAE0D5]/70 hover:bg-[#B76E79]/10 transition-colors text-sm">
            <Download className="w-4 h-4" /> Export CSV
          </button>
        </div>
      </div>
      <div className="p-4 border-b border-[#B76E79]/10 grid grid-cols-2 md:grid-cols-4 gap-3">
        <div>
          <p className="text-xs text-[#EAE0D5]/50 mb-1 uppercase tracking-wider">Module</p>
          <select value={filters.module} onChange={e => setFilters({...filters, module: e.target.value})} className={cls}>
            <option value="">All modules</option>
            {['products','orders','customers','inventory','staff','settings'].map(m => <option key={m} value={m}>{m}</option>)}
          </select>
        </div>
        <div>
          <p className="text-xs text-[#EAE0D5]/50 mb-1 uppercase tracking-wider">Action Type</p>
          <select value={filters.action_type} onChange={e => setFilters({...filters, action_type: e.target.value})} className={cls}>
            <option value="">All actions</option>
            {['CREATE','UPDATE','DELETE','VIEW','EXPORT','LOGIN','LOGOUT'].map(a => <option key={a} value={a}>{a}</option>)}
          </select>
        </div>
        <div>
          <p className="text-xs text-[#EAE0D5]/50 mb-1 uppercase tracking-wider">Start Date</p>
          <input type="date" value={filters.start_date} onChange={e => setFilters({...filters, start_date: e.target.value})} className={cls} />
        </div>
        <div>
          <p className="text-xs text-[#EAE0D5]/50 mb-1 uppercase tracking-wider">End Date</p>
          <input type="date" value={filters.end_date} onChange={e => setFilters({...filters, end_date: e.target.value})} className={cls} />
        </div>
      </div>
      <div className="overflow-x-auto">
        {isLoading ? (
          <div className="p-8 text-center"><RefreshCw className="w-6 h-6 animate-spin text-[#B76E79] mx-auto" /></div>
        ) : logs.length === 0 ? (
          <div className="p-12 text-center">
            <FileText className="w-10 h-10 text-[#B76E79]/30 mx-auto mb-3" />
            <p className="text-[#EAE0D5]/40">No audit logs found</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#B76E79]/10">
                {['Timestamp','Staff','Action','Module','Description','IP Address'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs text-[#EAE0D5]/40 uppercase tracking-wider font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => (
                <tr key={log.id} className="border-b border-[#B76E79]/5 hover:bg-[#B76E79]/5 transition-colors">
                  <td className="px-4 py-3 font-mono text-xs text-[#EAE0D5]/60">{new Date(log.created_at).toLocaleString('en-IN')}</td>
                  <td className="px-4 py-3">
                    <p className="font-medium text-[#EAE0D5] text-xs">{log.staff_name || `ID: ${log.staff_id}`}</p>
                    <p className="text-xs text-[#EAE0D5]/40">{log.staff_email}</p>
                  </td>
                  <td className="px-4 py-3">
                    <span className={'px-2 py-0.5 rounded-full text-xs font-medium ' + actionColor(log.action_type)}>{log.action_type}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="px-2 py-0.5 bg-[#B76E79]/10 text-[#EAE0D5]/60 text-xs rounded">{log.module}</span>
                  </td>
                  <td className="px-4 py-3 text-xs text-[#EAE0D5]/70 max-w-xs truncate">{log.description}</td>
                  <td className="px-4 py-3 font-mono text-xs text-[#EAE0D5]/40">{log.ip_address || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
