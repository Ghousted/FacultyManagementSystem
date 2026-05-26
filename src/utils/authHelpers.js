const getPasswordResetContinueUrl = () => {
  if (typeof window !== 'undefined' && window.location && window.location.origin) {
    const { origin, protocol } = window.location;

    if (protocol === 'http:' || protocol === 'https:') {
      return `${origin}/#/reset-password`;
    }
  }
  return 'https://tcc-ccs-faculty.web.app/#/reset-password';
};

export const passwordResetActionCodeSettings = {
  url: getPasswordResetContinueUrl(),
  handleCodeInApp: true
};
