import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiClient } from '../lib/api';
import { useStore } from '../stores/appStore';
import { useAuthStore } from '../stores/authStore';
import { translations } from '../i18n/translations';
import './Admin.css';

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
  const { user: currentUser } = useAuthStore();
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
    } catch (err: any) {
      setError(err.error || t.error);
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
    } catch (err: any) {
      alert(err.error || t.error);
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
        const updateData: any = {
          username: form.username,
          email: form.email,
          full_name: form.full_name || null,
          role: form.role,
          warehouse_code: form.warehouse_code || null,
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
    } catch (err: any) {
      alert(err.error || t.error);
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
    } catch (err: any) {
      alert(err.error || t.error);
    }
  };

  const getRoleBadgeClass = (role: string) => {
    switch (role) {
      case 'ADMIN': return 'role-badge admin';
      case 'MANAGER': return 'role-badge manager';
      case 'OPERATOR': return 'role-badge operator';
      case 'VIEWER': return 'role-badge viewer';
      default: return 'role-badge';
    }
  };

  return (
    <div className="admin-page">
      <div className="admin-card">
        <div className="admin-header">
          <button className="back-btn" onClick={() => navigate('/')}>
            ←
          </button>
          <h2>{t.adminUserManagement}</h2>
          {isAdmin && (
            <button className="add-user-btn" onClick={handleAdd}>
              + {t.adminAddUser}
            </button>
          )}
        </div>

        <div className="admin-content">
          {error && <div className="error-message">{error}</div>}

          {loading ? (
            <div className="loading">{t.loading}</div>
          ) : (
            <div className="users-table-container">
              <table className="users-table">
                <thead>
                  <tr>
                    <th>{t.adminUsername}</th>
                    <th>{t.adminFullName}</th>
                    <th>{t.adminEmail}</th>
                    <th>{t.adminRole}</th>
                    <th>{t.adminWarehouse}</th>
                    <th>{t.status}</th>
                    <th>{t.adminLastLogin}</th>
                    {isAdmin && <th>{t.actions}</th>}
                  </tr>
                </thead>
                <tbody>
                  {users.map((user) => (
                    <tr key={user.user_id} className={!user.is_active ? 'inactive-row' : ''}>
                      <td className="username-cell">{user.username}</td>
                      <td>{user.full_name || '-'}</td>
                      <td>{user.email}</td>
                      <td>
                        <span className={getRoleBadgeClass(user.role)}>
                          {(t as Record<string, string>)[`role${user.role.charAt(0) + user.role.slice(1).toLowerCase()}`] || user.role}
                        </span>
                      </td>
                      <td>{user.warehouse_code || t.adminAllWarehouses}</td>
                      <td>
                        <span className={`status-badge ${user.is_active ? 'active' : 'inactive'}`}>
                          {user.is_active ? t.active : t.inactive}
                        </span>
                      </td>
                      <td className="date-cell">
                        {user.last_login
                          ? new Date(user.last_login).toLocaleDateString(language === 'tr' ? 'tr-TR' : 'en-US')
                          : '-'}
                      </td>
                      {isAdmin && (
                        <td className="actions-cell">
                          <button className="action-btn edit" onClick={() => handleEdit(user)} title={t.adminEdit}>
                            ✏️
                          </button>
                          <button
                            className="action-btn password"
                            onClick={() => setResetPasswordUserId(user.user_id)}
                            title={t.adminResetPassword}
                          >
                            🔑
                          </button>
                          {user.user_id !== currentUser?.user_id && (
                            <button
                              className="action-btn delete"
                              onClick={() => handleDelete(user)}
                              title={t.delete}
                            >
                              🗑️
                            </button>
                          )}
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>

              {users.length === 0 && (
                <div className="no-users">{t.adminNoUsers}</div>
              )}
            </div>
          )}

          {/* Add/Edit Modal */}
          {showModal && (
            <div className="modal-overlay" onClick={() => setShowModal(false)}>
              <div className="modal" onClick={(e) => e.stopPropagation()}>
                <h3>{editingUser ? t.adminEditUser : t.adminAddUser}</h3>

                <div className="form-group">
                  <label>{t.adminUsername} *</label>
                  <input
                    type="text"
                    value={form.username}
                    onChange={(e) => setForm({ ...form, username: e.target.value })}
                    placeholder={t.adminUsernamePlaceholder}
                  />
                </div>

                <div className="form-group">
                  <label>{t.adminEmail} *</label>
                  <input
                    type="email"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    placeholder={t.adminEmailPlaceholder}
                  />
                </div>

                {!editingUser && (
                  <div className="form-group">
                    <label>{t.adminPassword} *</label>
                    <input
                      type="password"
                      value={form.password}
                      onChange={(e) => setForm({ ...form, password: e.target.value })}
                      placeholder={t.adminPasswordPlaceholder}
                    />
                  </div>
                )}

                <div className="form-group">
                  <label>{t.adminFullName}</label>
                  <input
                    type="text"
                    value={form.full_name}
                    onChange={(e) => setForm({ ...form, full_name: e.target.value })}
                    placeholder={t.adminFullNamePlaceholder}
                  />
                </div>

                <div className="form-group">
                  <label>{t.adminRole} *</label>
                  <select
                    value={form.role}
                    onChange={(e) => setForm({ ...form, role: e.target.value as any })}
                  >
                    <option value="ADMIN">{t.roleAdmin}</option>
                    <option value="MANAGER">{t.roleManager}</option>
                    <option value="OPERATOR">{t.roleOperator}</option>
                    <option value="VIEWER">{t.roleViewer}</option>
                  </select>
                </div>

                <div className="form-group">
                  <label>{t.adminWarehouse}</label>
                  <select
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
                  <div className="form-group checkbox-group">
                    <label>
                      <input
                        type="checkbox"
                        checked={form.is_active}
                        onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
                      />
                      {t.active}
                    </label>
                  </div>
                )}

                <div className="modal-actions">
                  <button className="cancel-btn" onClick={() => setShowModal(false)}>
                    {t.cancel}
                  </button>
                  <button className="save-btn" onClick={handleSave} disabled={saving}>
                    {saving ? t.loading : t.adminSave}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Reset Password Modal */}
          {resetPasswordUserId && (
            <div className="modal-overlay" onClick={() => setResetPasswordUserId(null)}>
              <div className="modal small" onClick={(e) => e.stopPropagation()}>
                <h3>{t.adminResetPassword}</h3>

                <div className="form-group">
                  <label>{t.adminNewPassword}</label>
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder={t.adminNewPasswordPlaceholder}
                  />
                </div>

                <div className="modal-actions">
                  <button className="cancel-btn" onClick={() => setResetPasswordUserId(null)}>
                    {t.cancel}
                  </button>
                  <button className="save-btn" onClick={handleResetPassword} disabled={!newPassword}>
                    {t.adminResetPassword}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Created Password Modal */}
          {createdPassword && (
            <div className="modal-overlay">
              <div className="modal small">
                <h3>{t.adminUserCreated || 'Kullanici Olusturuldu'}</h3>

                <div className="password-display">
                  <p><strong>{t.adminUsername}:</strong> {createdUsername}</p>
                  <p><strong>{t.adminPassword}:</strong> <code className="password-code">{createdPassword}</code></p>
                </div>

                <p className="password-note">{t.adminPasswordNote || 'Bu sifreyi kaydedin. Kullanici ilk girisinde sifre degistirecek.'}</p>

                <div className="modal-actions">
                  <button className="save-btn" onClick={() => { setCreatedPassword(null); setCreatedUsername(null); }}>
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
