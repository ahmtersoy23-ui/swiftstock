import { useSSOStore } from '../stores/ssoStore';

const SSO_BASE_URL = 'https://apps.iwa.web.tr';
const APP_CODE = 'swiftstock';

interface VerifyResponse {
  success: boolean;
  data?: {
    user: {
      id: string;
      email: string;
      name: string;
      picture?: string;
    };
    role: 'admin' | 'editor' | 'viewer';
    apps: Record<string, string>;
  };
  error?: string;
}

export const useSSO = () => {
  const { user, role, accessToken, setUser, setRole, setAccessToken, clearAuth } = useSSOStore();

  // Token'ı URL'den veya localStorage'dan al
  const getAccessToken = (): string | null => {
    // URL'den token geliyorsa (ilk login)
    const params = new URLSearchParams(window.location.search);
    const urlToken = params.get('token');

    if (urlToken) {
      // URL'i temizle
      window.history.replaceState({}, '', window.location.pathname);
      return urlToken;
    }

    // Store'dan token oku
    return accessToken;
  };

  // Token doğrulama
  const verifyToken = async (token: string): Promise<VerifyResponse | null> => {
    try {
      const response = await fetch(`${SSO_BASE_URL}/api/auth/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, app_code: APP_CODE })
      });

      if (!response.ok) {
        return null;
      }

      const data: VerifyResponse = await response.json();
      return data;
    } catch (error) {
      console.error('Token verification failed:', error);
      return null;
    }
  };

  // Auth initialization
  const initAuth = async () => {
    const token = getAccessToken();

    if (!token) {
      // Token yok - SSO'ya yönlendir
      redirectToSSO();
      return;
    }

    // Token'ı store'a kaydet
    setAccessToken(token);

    // Token'ı doğrula
    const result = await verifyToken(token);

    if (result?.success && result.data) {
      setUser(result.data.user);
      setRole(result.data.role);
    } else {
      // Token geçersiz - SSO'ya yönlendir
      clearAuth();
      redirectToSSO();
    }
  };

  // SSO portal'a yönlendir
  const redirectToSSO = () => {
    const returnUrl = encodeURIComponent(window.location.href);
    window.location.href = `${SSO_BASE_URL}?returnUrl=${returnUrl}&app=${APP_CODE}`;
  };

  // Logout
  const logout = async () => {
    try {
      if (accessToken) {
        await fetch(`${SSO_BASE_URL}/api/auth/logout`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          }
        });
      }
    } catch (error) {
      console.error('Logout error:', error);
    }

    clearAuth();
    redirectToSSO();
  };

  // Check if user has role
  const hasRole = (allowedRoles: string[]): boolean => {
    return role ? allowedRoles.includes(role) : false;
  };

  return {
    user,
    role,
    accessToken,
    isAuthenticated: !!user && !!accessToken,
    initAuth,
    logout,
    hasRole,
  };
};
