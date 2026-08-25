import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

export default function AutoLogout() {
  const navigate = useNavigate();

  useEffect(() => {
    const enabled = () => {
      try {
        const s = JSON.parse(localStorage.getItem('batprox-settings') || '{}');
        return s.autoLoginPage !== false;
      } catch {
        return true;
      }
    };
    const logoutAndRedirect = () => {
      if (!enabled()) return;
      if (!localStorage.getItem('batprox-token')) return;
      localStorage.removeItem('batprox-token');
      localStorage.removeItem('batprox-user');
      navigate('/');
    };
    const onVisibility = () => {
      if (document.hidden) logoutAndRedirect();
    };
    const onFreeze = () => logoutAndRedirect();
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('pagehide', logoutAndRedirect);
    window.addEventListener('blur', logoutAndRedirect);
    document.addEventListener('freeze', onFreeze);
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('pagehide', logoutAndRedirect);
      window.removeEventListener('blur', logoutAndRedirect);
      document.removeEventListener('freeze', onFreeze);
    };
  }, [navigate]);

  return null;
}
