import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiClient } from '../lib/api';
import { useStore } from '../stores/appStore';
import { useSSOStore } from '../stores/ssoStore';
import { translations } from '../i18n/translations';

interface User {
  user_id: number;
  username: string;
  email: string;
  full_name: string | null;
  role: 'ADMIN' | 'MANAGER' | 'OPERATOR' | 'VIEWER';
  warehouse_code: string | null;
  is_active: boolean;
  created_at: string;
  last_login: string | null;
}

interface UserForm {
  username: string;
  email: string;
  password: string;
  full_name: string;
  role: 'ADMIN' | 'MANAGER' | 'OPERATOR' | 'VIEWER';
  warehouse_code: string;
  is_active: boolean;
}

const emptyForm: UserForm = {
  username: '',
  email: '',
  password: '',
  full_name: '',
  role: 'OPERATOR',
  warehouse_code: '',
  is_active: true,
};

function Admin() {
  const navigate = useNavigate();
  const { language } = useStore();
  const { wmsUser: currentUser } = useSSOStore();
  const t = translations[language];

  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [form, setForm] = useState<UserForm>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [resetPasswordUserId, setResetPasswordUserId] = useState<number | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [createdPassword, setCreatedPassword] = useState<string | null>(null);
  const [createdUsername, setCreatedUsername] = useState<string | null>(null);

  // Generate cryptographically secure random password
  const generatePassword = (): string => {
    const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%&*';
    const length = 12;
    const randomValues = new Uint32Array(length);
    crypto.getRandomValues(randomValues);
    return Array.from(randomValues, (val) => chars[val % chars.length]).join('');
  };

  // Check if current user is admin
  const isAdmin = currentUser?.role === 'ADMIN';

  const loadUsers = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await apiClient.getAllUsers();
      if (response.success) {
        setUsers(response.data || []);
      } else {
        setError(response.error || t.error);
      }
    } catch (err: unknown) {
      setError((err as { error?: string }).error || t.error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, []);

  const handleAdd = () => {
    setEditingUser(null);
    const generatedPwd = generatePassword();
    setForm({ ...emptyForm, password: generatedPwd });
    setShowModal(true);
  };

  const handleEdit = (user: User) => {
    setEditingUser(user);
    setForm({
      username: user.username,
      email: user.email,
      password: '',
      full_name: user.full_name || '',
      role: user.role,
      warehouse_code: user.warehouse_code || '',
      is_active: user.is_active,
    });
    setShowModal(true);
  };

  const handleDelete = async (user: User) => {
    if (!confirm(`${user.username} ${t.adminDeleteConfirm}`)) return;

    try {
      const response = await apiClient.deleteUser(user.user_id);
      if (response.success) {
        loadUsers();
      } else {
        alert(response.error || t.error);
      }
    } catch (err: unknown) {
      alert((err as { error?: string }).error || t.error);
    }
  };

  const handleSave = async () => {
    if (!form.username || !form.email) {
      alert(t.adminFillRequired);
      return;
    }

    if (!editingUser && !form.password) {
      alert(t.adminPasswordRequired);
      return;
    }

    setSaving(true);
    try {
      if (editingUser) {
        const updateData = {
          username: form.username,
          email: form.email,
          full_name: form.full_name || undefined,
          role: form.role,
          warehouse_code: form.warehouse_code || undefined,
          is_active: form.is_active,
        };
        const response = await apiClient.updateUser(editingUser.user_id, updateData);
        if (response.success) {
          setShowModal(false);
          loadUsers();
        } else {
          alert(response.error || t.error);
        }
      } else {
        const response = await apiClient.createUser({
          username: form.username,
          email: form.email,
          password: form.password,
          full_name: form.full_name || undefined,
          role: form.role,
          warehouse_code: form.warehouse_code || undefined,
        });
        if (response.success) {
          setShowModal(false);
          setCreatedUsername(form.username);
          setCreatedPassword(form.password);
          loadUsers();
        } else {
          alert(response.error || t.error);
        }
      }
    } catch (err: unknown) {
      alert((err as { error?: string }).error || t.error);
    } finally {
      setSaving(false);
    }
  };

  const handleResetPassword = async () => {
    if (!resetPasswordUserId || !newPassword) return;

    try {
      const response = await apiClient.resetUserPassword(resetPasswordUserId, newPassword);
      if (response.success) {
        setResetPasswordUserId(null);
        setNewPassword('');
        alert(t.adminPasswordReset);
      } else {
        alert(response.error || t.error);
      }
    } catch (err: unknown) {
      alert((err as { error?: string }).error || t.error);
    }
  };

  const roleBadgeClass = (role: string) => {
    const map: Record<string, string> = {
      ADMIN: 'bg-amber-100 text-amber-700',
      MANAGER: 'bg-blue-100 text-blue-700',
      OPERATOR: 'bg-green-100 text-green-600',
      VIEWER: 'bg-slate-100 text-slate-500',
    };
    return `inline-block px-2 py-1 rounded-full text-[0.7rem] font-semibold ${map[role] || ''}`;
  };

  return (
    <div className="min-h-[calc(100vh-120px)] bg-slate-100 p-4">
      <div className="max-w-[800px] mx-auto bg-white rounded-2xl shadow-lg overflow-hidden">
        {/* Header */}
        <div className="bg-linear-to-br from-blue-500 to-blue-700 text-white px-5 py-5 flex items-center gap-3 max-md:flex-col max-md:gap-3 max-md:items-stretch max-md:text-center">
          <button
            className="bg-white/20 border-none text-white w-9 h-9 rounded-lg text-lg cursor-pointer flex items-center justify-center transition-all duration-200 hover:bg-white/30 max-md:self-start"
            onClick={() => navigate('/')}
          >
            ←
          </button>
          <h2 className="m-0 text-white text-xl font-bold flex-1 leading-none">
            {t.adminUserManagement}
          </h2>
          {isAdmin && (
            <button
              className="px-4 py-2.5 bg-white/20 text-white border-2 border-white/30 rounded-lg font-semibold cursor-pointer transition-all duration-200 text-sm hover:bg-white/30 hover:border-white/50 max-md:w-full"
              onClick={handleAdd}
            >
              + {t.adminAddUser}
            </button>
          )}
        </div>

        {/* Content */}
        <div className="p-4">
          {error && (
            <div className="p-4 bg-red-50 text-red-600 rounded-lg m-4">
              {error}
            </div>
          )}

          {loading ? (
            <div className="text-center p-8 text-slate-500">{t.loading}</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse max-md:min-w-[700px]">
                <thead>
                  <tr>
                    <th className="bg-slate-50 px-2.5 py-3 text-left font-semibold text-slate-600 border-b-2 border-slate-200 text-xs whitespace-nowrap max-md:px-2">{t.adminUsername}</th>
                    <th className="bg-slate-50 px-2.5 py-3 text-left font-semibold text-slate-600 border-b-2 border-slate-200 text-xs whitespace-nowrap max-md:px-2">{t.adminFullName}</th>
                    <th className="bg-slate-50 px-2.5 py-3 text-left font-semibold text-slate-600 border-b-2 border-slate-200 text-xs whitespace-nowrap max-md:px-2">{t.adminEmail}</th>
                    <th className="bg-slate-50 px-2.5 py-3 text-left font-semibold text-slate-600 border-b-2 border-slate-200 text-xs whitespace-nowrap max-md:px-2">{t.adminRole}</th>
                    <th className="bg-slate-50 px-2.5 py-3 text-left font-semibold text-slate-600 border-b-2 border-slate-200 text-xs whitespace-nowrap max-md:px-2">{t.adminWarehouse}</th>
                    <th className="bg-slate-50 px-2.5 py-3 text-left font-semibold text-slate-600 border-b-2 border-slate-200 text-xs whitespace-nowrap max-md:px-2">{t.status}</th>
                    <th className="bg-slate-50 px-2.5 py-3 text-left font-semibold text-slate-600 border-b-2 border-slate-200 text-xs whitespace-nowrap max-md:px-2">{t.adminLastLogin}</th>
                    {isAdmin && <th className="bg-slate-50 px-2.5 py-3 text-left font-semibold text-slate-600 border-b-2 border-slate-200 text-xs whitespace-nowrap max-md:px-2">{t.actions}</th>}
                  </tr>
                </thead>
                <tbody>
                  {users.map((user) => (
                    <tr
                      key={user.user_id}
                      className={`hover:bg-slate-50 ${!user.is_active ? 'bg-slate-100 opacity-70' : ''}`}
                    >
                      <td className="px-2.5 py-3 border-b border-slate-200 text-sm text-slate-700 font-semibold max-md:px-2">{user.username}</td>
                      <td className="px-2.5 py-3 border-b border-slate-200 text-sm text-slate-700 max-md:px-2">{user.full_name || '-'}</td>
                      <td className="px-2.5 py-3 border-b border-slate-200 text-sm text-slate-700 max-md:px-2">{user.email}</td>
                      <td className="px-2.5 py-3 border-b border-slate-200 text-sm text-slate-700 max-md:px-2">
                        <span className={roleBadgeClass(user.role)}>
                          {(t as Record<string, string>)[`role${user.role.charAt(0) + user.role.slice(1).toLowerCase()}`] || user.role}
                        </span>
                      </td>
                      <td className="px-2.5 py-3 border-b border-slate-200 text-sm text-slate-700 max-md:px-2">{user.warehouse_code || t.adminAllWarehouses}</td>
                      <td className="px-2.5 py-3 border-b border-slate-200 text-sm text-slate-700 max-md:px-2">
                        <span className={`inline-block px-2 py-1 rounded-full text-[0.7rem] font-semibold ${user.is_active ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'}`}>
                          {user.is_active ? t.active : t.inactive}
                        </span>
                      </td>
                      <td className="px-2.5 py-3 border-b border-slate-200 text-xs text-slate-500 max-md:px-2">
                        {user.last_login
                          ? new Date(user.last_login).toLocaleDateString(language === 'tr' ? 'tr-TR' : 'en-US')
                          : '-'}
                      </td>
                      {isAdmin && (
                        <td className="px-2.5 py-3 border-b border-slate-200 max-md:px-2">
                          <div className="flex gap-1.5">
                            <button
                              className="w-7 h-7 border-none rounded-md cursor-pointer transition-all duration-200 text-sm flex items-center justify-center p-0 bg-blue-100 hover:bg-blue-200"
                              onClick={() => handleEdit(user)}
                              title={t.adminEdit}
                            >
                              ✏️
                            </button>
                            <button
                              className="w-7 h-7 border-none rounded-md cursor-pointer transition-all duration-200 text-sm flex items-center justify-center p-0 bg-amber-100 hover:bg-amber-200"
                              onClick={() => setResetPasswordUserId(user.user_id)}
                              title={t.adminResetPassword}
                            >
                              🔑
                            </button>
                            {user.user_id !== currentUser?.user_id && (
                              <button
                                className="w-7 h-7 border-none rounded-md cursor-pointer transition-all duration-200 text-sm flex items-center justify-center p-0 bg-red-100 hover:bg-red-200"
                                onClick={() => handleDelete(user)}
                                title={t.delete}
                              >
                                🗑️
                              </button>
                            )}
                          </div>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>

              {users.length === 0 && (
                <div className="text-center p-8 text-slate-500">{t.adminNoUsers}</div>
              )}
            </div>
          )}

          {/* Add/Edit Modal */}
          {showModal && (
            <div
              className="fixed inset-0 bg-black/50 flex items-center justify-center z-[1000] p-4"
              onClick={() => setShowModal(false)}
            >
              <div
                className="bg-white rounded-xl p-5 w-full max-w-[400px] max-h-[90vh] overflow-y-auto"
                onClick={(e) => e.stopPropagation()}
              >
                <h3 className="m-0 mb-5 text-slate-800 text-lg">
                  {editingUser ? t.adminEditUser : t.adminAddUser}
                </h3>

                <div className="mb-3.5">
                  <label className="block mb-1.5 font-medium text-slate-600 text-sm">{t.adminUsername} *</label>
                  <input
                    type="text"
                    className="w-full px-3 py-2.5 border-2 border-slate-200 rounded-lg text-[0.9375rem] transition-colors duration-200 box-border focus:outline-none focus:border-blue-500"
                    value={form.username}
                    onChange={(e) => setForm({ ...form, username: e.target.value })}
                    placeholder={t.adminUsernamePlaceholder}
                  />
                </div>

                <div className="mb-3.5">
                  <label className="block mb-1.5 font-medium text-slate-600 text-sm">{t.adminEmail} *</label>
                  <input
                    type="email"
                    className="w-full px-3 py-2.5 border-2 border-slate-200 rounded-lg text-[0.9375rem] transition-colors duration-200 box-border focus:outline-none focus:border-blue-500"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    placeholder={t.adminEmailPlaceholder}
                  />
                </div>

                {!editingUser && (
                  <div className="mb-3.5">
                    <label className="block mb-1.5 font-medium text-slate-600 text-sm">{t.adminPassword} *</label>
                    <input
                      type="password"
                      className="w-full px-3 py-2.5 border-2 border-slate-200 rounded-lg text-[0.9375rem] transition-colors duration-200 box-border focus:outline-none focus:border-blue-500"
                      value={form.password}
                      onChange={(e) => setForm({ ...form, password: e.target.value })}
                      placeholder={t.adminPasswordPlaceholder}
                    />
                  </div>
                )}

                <div className="mb-3.5">
                  <label className="block mb-1.5 font-medium text-slate-600 text-sm">{t.adminFullName}</label>
                  <input
                    type="text"
                    className="w-full px-3 py-2.5 border-2 border-slate-200 rounded-lg text-[0.9375rem] transition-colors duration-200 box-border focus:outline-none focus:border-blue-500"
                    value={form.full_name}
                    onChange={(e) => setForm({ ...form, full_name: e.target.value })}
                    placeholder={t.adminFullNamePlaceholder}
                  />
                </div>

                <div className="mb-3.5">
                  <label className="block mb-1.5 font-medium text-slate-600 text-sm">{t.adminRole} *</label>
                  <select
                    className="w-full px-3 py-2.5 border-2 border-slate-200 rounded-lg text-[0.9375rem] transition-colors duration-200 box-border focus:outline-none focus:border-blue-500"
                    value={form.role}
                    onChange={(e) => setForm({ ...form, role: e.target.value as UserForm['role'] })}
                  >
                    <option value="ADMIN">{t.roleAdmin}</option>
                    <option value="MANAGER">{t.roleManager}</option>
                    <option value="OPERATOR">{t.roleOperator}</option>
                    <option value="VIEWER">{t.roleViewer}</option>
                  </select>
                </div>

                <div className="mb-3.5">
                  <label className="block mb-1.5 font-medium text-slate-600 text-sm">{t.adminWarehouse}</label>
                  <select
                    className="w-full px-3 py-2.5 border-2 border-slate-200 rounded-lg text-[0.9375rem] transition-colors duration-200 box-border focus:outline-none focus:border-blue-500"
                    value={form.warehouse_code}
                    onChange={(e) => setForm({ ...form, warehouse_code: e.target.value })}
                  >
                    <option value="">{t.adminAllWarehouses}</option>
                    <option value="USA">USA</option>
                    <option value="TUR">TUR</option>
                    <option value="FAB">FAB</option>
                  </select>
                </div>

                {editingUser && (
                  <div className="mb-3.5">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        className="w-[18px] h-[18px] cursor-pointer"
                        checked={form.is_active}
                        onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
                      />
                      {t.active}
                    </label>
                  </div>
                )}

                <div className="flex gap-3 mt-5 justify-end">
                  <button
                    className="px-4 py-2.5 bg-slate-100 text-slate-500 border-none rounded-lg font-medium cursor-pointer transition-all duration-200 hover:bg-slate-200"
                    onClick={() => setShowModal(false)}
                  >
                    {t.cancel}
                  </button>
                  <button
                    className="px-4 py-2.5 bg-linear-to-br from-emerald-500 to-emerald-600 text-white border-none rounded-lg font-medium cursor-pointer transition-all duration-200 hover:enabled:from-emerald-600 hover:enabled:to-emerald-700 disabled:opacity-60 disabled:cursor-not-allowed"
                    onClick={handleSave}
                    disabled={saving}
                  >
                    {saving ? t.loading : t.adminSave}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Reset Password Modal */}
          {resetPasswordUserId && (
            <div
              className="fixed inset-0 bg-black/50 flex items-center justify-center z-[1000] p-4"
              onClick={() => setResetPasswordUserId(null)}
            >
              <div
                className="bg-white rounded-xl p-5 w-full max-w-[320px] max-h-[90vh] overflow-y-auto"
                onClick={(e) => e.stopPropagation()}
              >
                <h3 className="m-0 mb-5 text-slate-800 text-lg">{t.adminResetPassword}</h3>

                <div className="mb-3.5">
                  <label className="block mb-1.5 font-medium text-slate-600 text-sm">{t.adminNewPassword}</label>
                  <input
                    type="password"
                    className="w-full px-3 py-2.5 border-2 border-slate-200 rounded-lg text-[0.9375rem] transition-colors duration-200 box-border focus:outline-none focus:border-blue-500"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder={t.adminNewPasswordPlaceholder}
                  />
                </div>

                <div className="flex gap-3 mt-5 justify-end">
                  <button
                    className="px-4 py-2.5 bg-slate-100 text-slate-500 border-none rounded-lg font-medium cursor-pointer transition-all duration-200 hover:bg-slate-200"
                    onClick={() => setResetPasswordUserId(null)}
                  >
                    {t.cancel}
                  </button>
                  <button
                    className="px-4 py-2.5 bg-linear-to-br from-emerald-500 to-emerald-600 text-white border-none rounded-lg font-medium cursor-pointer transition-all duration-200 hover:enabled:from-emerald-600 hover:enabled:to-emerald-700 disabled:opacity-60 disabled:cursor-not-allowed"
                    onClick={handleResetPassword}
                    disabled={!newPassword}
                  >
                    {t.adminResetPassword}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Created Password Modal */}
          {createdPassword && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[1000] p-4">
              <div className="bg-white rounded-xl p-5 w-full max-w-[320px]">
                <h3 className="m-0 mb-5 text-slate-800 text-lg">
                  {t.adminUserCreated || 'Kullanici Olusturuldu'}
                </h3>

                <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 mb-4">
                  <p className="my-2 text-slate-700"><strong>{t.adminUsername}:</strong> {createdUsername}</p>
                  <p className="my-2 text-slate-700">
                    <strong>{t.adminPassword}:</strong>{' '}
                    <code className="bg-slate-800 text-emerald-400 px-2 py-0.5 rounded font-mono text-base font-semibold">
                      {createdPassword}
                    </code>
                  </p>
                </div>

                <p className="text-sm text-slate-500 m-0">
                  {t.adminPasswordNote || 'Bu sifreyi kaydedin. Kullanici ilk girisinde sifre degistirecek.'}
                </p>

                <div className="flex gap-3 mt-5 justify-end">
                  <button
                    className="px-4 py-2.5 bg-linear-to-br from-emerald-500 to-emerald-600 text-white border-none rounded-lg font-medium cursor-pointer transition-all duration-200 hover:from-emerald-600 hover:to-emerald-700"
                    onClick={() => { setCreatedPassword(null); setCreatedUsername(null); }}
                  >
                    {t.adminOk || 'Tamam'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default Admin;
