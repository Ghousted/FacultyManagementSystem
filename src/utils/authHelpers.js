const isHttpUrl = (value) => {
  if (!value) return false;
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
};

const withResetPath = (baseUrl) => {
  if (!isHttpUrl(baseUrl)) return null;
  const parsed = new URL(baseUrl);
  parsed.hash = '';
  parsed.search = '';
  parsed.pathname = '/reset-password';
  return parsed.toString();
};

const getPasswordResetContinueUrl = () => {
  const configured = import.meta.env.VITE_PASSWORD_RESET_CONTINUE_URL;
  if (isHttpUrl(configured)) {
    return configured;
  }

  if (typeof window !== 'undefined' && window.location && window.location.origin) {
    const originUrl = withResetPath(window.location.origin);
    if (originUrl) return originUrl;
  }

  const authDomain = import.meta.env.VITE_FIREBASE_AUTH_DOMAIN;
  if (authDomain) {
    const authDomainUrl = withResetPath(`https://${String(authDomain).replace(/^https?:\/\//i, '')}`);
    if (authDomainUrl) return authDomainUrl;
  }

  return 'https://tcc-ccs-faculty.web.app/reset-password';
};

export const passwordResetActionCodeSettings = {
  url: getPasswordResetContinueUrl(),
  handleCodeInApp: true
};
