import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { GoogleOAuthProvider, GoogleLogin } from '@react-oauth/google';
import { useAuthStore } from '../stores/authStore';
import { apiClient } from '../lib/api';

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID as string || '';

export default function Login() {
  const navigate = useNavigate();
  const setAuth = useAuthStore((state) => state.setAuth);

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Force password change states
  const [mustChangePassword, setMustChangePassword] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [changingPassword, setChangingPassword] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await apiClient.login({ username, password });

      if (response.success && response.data) {
        const { user, accessToken, refreshToken, must_change_password } = response.data;
        setAuth(user, accessToken, refreshToken);

        if (must_change_password) {
          setCurrentPassword(password);
          setMustChangePassword(true);
        } else {
          navigate('/');
        }
      } else {
        setError(response.error || 'Giris basarisiz');
      }
    } catch (err: unknown) {
      const error = err as { error?: string };
      setError(error.error || 'Giris sirasinda bir hata olustu');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async (credentialResponse: { credential?: string }) => {
    if (!credentialResponse.credential) {
      setError('Google giris basarisiz');
      return;
    }

    setError('');
    setLoading(true);

    try {
      const response = await apiClient.googleLogin({
        credential: credentialResponse.credential,
      });

      if (response.success && response.data) {
        const { user, accessToken, refreshToken } = response.data;
        setAuth(user, accessToken, refreshToken);
        navigate('/');
      } else {
        setError(response.error || 'Google ile giris basarisiz');
      }
    } catch (err: unknown) {
      const error = err as { error?: string };
      setError(error.error || 'Google giris sirasinda bir hata olustu');
    } finally {
      setLoading(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (newPassword.length < 6) {
      setError('Yeni sifre en az 6 karakter olmali');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('Sifreler eslemiyor');
      return;
    }

    setChangingPassword(true);

    try {
      const response = await apiClient.changePassword({
        currentPassword,
        newPassword,
      });

      if (response.success) {
        // Password changed successfully - tokens are revoked, need to re-login
        // Clear auth state
        const { clearAuth } = useAuthStore.getState();
        clearAuth();

        // Re-login with new password
        const loginResponse = await apiClient.login({
          username,
          password: newPassword
        });

        if (loginResponse.success && loginResponse.data) {
          const { user, accessToken, refreshToken } = loginResponse.data;
          setAuth(user, accessToken, refreshToken);
          navigate('/');
        } else {
          // If re-login fails, go to login page
          navigate('/login');
        }
      } else {
        setError(response.error || 'Sifre degistirme basarisiz');
      }
    } catch (err: unknown) {
      const error = err as { error?: string };
      setError(error.error || 'Sifre degistirirken bir hata olustu');
    } finally {
      setChangingPassword(false);
    }
  };

  // Force Password Change Form
  if (mustChangePassword) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        padding: '20px'
      }}>
        <div style={{
          maxWidth: '420px',
          width: '100%',
          background: 'white',
          borderRadius: '16px',
          boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
          padding: '40px',
        }}>
          <div style={{ textAlign: 'center', marginBottom: '32px' }}>
            <h1 style={{
              fontSize: '24px',
              fontWeight: 'bold',
              color: '#374151',
              marginBottom: '8px'
            }}>
              Sifre Degistir
            </h1>
            <p style={{ color: '#6b7280', fontSize: '14px' }}>
              Ilk giris icin sifrenizi degistirmeniz gerekiyor
            </p>
          </div>

          <form onSubmit={handleChangePassword} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {error && (
              <div style={{
                padding: '12px 16px',
                background: '#fee2e2',
                border: '1px solid #fca5a5',
                borderRadius: '8px',
                color: '#991b1b',
                fontSize: '14px'
              }}>
                {error}
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label htmlFor="newPassword" style={{ display: 'block', marginBottom: '6px', fontSize: '14px', fontWeight: '500', color: '#374151' }}>
                  Yeni Sifre
                </label>
                <input
                  id="newPassword"
                  type="password"
                  required
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '12px',
                    border: '2px solid #e5e7eb',
                    borderRadius: '8px',
                    fontSize: '14px',
                    outline: 'none',
                    transition: 'all 0.2s'
                  }}
                  onFocus={(e) => e.target.style.borderColor = '#667eea'}
                  onBlur={(e) => e.target.style.borderColor = '#e5e7eb'}
                  placeholder="Yeni sifrenizi girin"
                  disabled={changingPassword}
                />
              </div>
              <div>
                <label htmlFor="confirmPassword" style={{ display: 'block', marginBottom: '6px', fontSize: '14px', fontWeight: '500', color: '#374151' }}>
                  Sifre Tekrar
                </label>
                <input
                  id="confirmPassword"
                  type="password"
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '12px',
                    border: '2px solid #e5e7eb',
                    borderRadius: '8px',
                    fontSize: '14px',
                    outline: 'none',
                    transition: 'all 0.2s'
                  }}
                  onFocus={(e) => e.target.style.borderColor = '#667eea'}
                  onBlur={(e) => e.target.style.borderColor = '#e5e7eb'}
                  placeholder="Sifrenizi tekrar girin"
                  disabled={changingPassword}
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={changingPassword}
              style={{
                width: '100%',
                padding: '14px',
                background: changingPassword ? '#9ca3af' : 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                fontSize: '16px',
                fontWeight: '600',
                cursor: changingPassword ? 'not-allowed' : 'pointer',
                transition: 'all 0.3s',
                marginTop: '8px'
              }}
            >
              {changingPassword ? 'Degistiriliyor...' : 'Sifreyi Degistir'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      padding: '20px'
    }}>
      <div style={{
        maxWidth: '420px',
        width: '100%',
        background: 'white',
        borderRadius: '16px',
        boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
        padding: '40px',
      }}>
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <h1 style={{
            fontSize: '32px',
            fontWeight: 'bold',
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            marginBottom: '8px'
          }}>
            SWIFTSTOCK
          </h1>
          <p style={{ color: '#6b7280', fontSize: '14px' }}>
            Warehouse Management System
          </p>
        </div>

        <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {error && (
            <div style={{
              padding: '12px 16px',
              background: '#fee2e2',
              border: '1px solid #fca5a5',
              borderRadius: '8px',
              color: '#991b1b',
              fontSize: '14px'
            }}>
              {error}
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div>
              <label htmlFor="username" style={{ display: 'block', marginBottom: '6px', fontSize: '14px', fontWeight: '500', color: '#374151' }}>
                Username
              </label>
              <input
                id="username"
                name="username"
                type="text"
                autoComplete="username"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                style={{
                  width: '100%',
                  padding: '12px',
                  border: '2px solid #e5e7eb',
                  borderRadius: '8px',
                  fontSize: '14px',
                  outline: 'none',
                  transition: 'all 0.2s'
                }}
                onFocus={(e) => e.target.style.borderColor = '#667eea'}
                onBlur={(e) => e.target.style.borderColor = '#e5e7eb'}
                placeholder="Enter username"
                disabled={loading}
              />
            </div>
            <div>
              <label htmlFor="password" style={{ display: 'block', marginBottom: '6px', fontSize: '14px', fontWeight: '500', color: '#374151' }}>
                Password
              </label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                style={{
                  width: '100%',
                  padding: '12px',
                  border: '2px solid #e5e7eb',
                  borderRadius: '8px',
                  fontSize: '14px',
                  outline: 'none',
                  transition: 'all 0.2s'
                }}
                onFocus={(e) => e.target.style.borderColor = '#667eea'}
                onBlur={(e) => e.target.style.borderColor = '#e5e7eb'}
                placeholder="Enter password"
                disabled={loading}
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%',
              padding: '14px',
              background: loading ? '#9ca3af' : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              fontSize: '16px',
              fontWeight: '600',
              cursor: loading ? 'not-allowed' : 'pointer',
              transition: 'all 0.3s',
              marginTop: '8px'
            }}
          >
            {loading ? 'Logging in...' : 'Sign In'}
          </button>

          {/* Google Sign-In */}
          {GOOGLE_CLIENT_ID && (
            <>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                margin: '16px 0'
              }}>
                <div style={{ flex: 1, height: '1px', background: '#e5e7eb' }} />
                <span style={{ fontSize: '12px', color: '#9ca3af' }}>veya</span>
                <div style={{ flex: 1, height: '1px', background: '#e5e7eb' }} />
              </div>

              <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
                <div style={{ display: 'flex', justifyContent: 'center' }}>
                  <GoogleLogin
                    onSuccess={handleGoogleLogin}
                    onError={() => setError('Google giris basarisiz')}
                    theme="outline"
                    size="large"
                    text="signin_with"
                    shape="rectangular"
                    width="100%"
                  />
                </div>
              </GoogleOAuthProvider>
            </>
          )}

          <div style={{
            textAlign: 'center',
            padding: '16px',
            background: '#f9fafb',
            borderRadius: '8px',
            marginTop: '8px'
          }}>
            <p style={{ fontSize: '12px', color: '#6b7280', marginBottom: '8px', fontWeight: '600' }}>
              Demo Accounts
            </p>
            <p style={{ fontSize: '11px', color: '#9ca3af' }}>
              <strong>Admin:</strong> admin / admin123
            </p>
          </div>
        </form>
      </div>
    </div>
  );
}
