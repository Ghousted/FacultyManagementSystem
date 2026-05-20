const getPasswordResetContinueUrl = () => {
  if (typeof window !== 'undefined' && window.location && window.location.origin) {
    return `${window.location.origin}/#/reset-password`;
  }
  return 'https://tcc-ccs-faculty.web.app/#/reset-password';
};

export const passwordResetActionCodeSettings = {
  url: getPasswordResetContinueUrl(),
  handleCodeInApp: true
};
