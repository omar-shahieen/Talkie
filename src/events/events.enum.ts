export enum AppEvents {
  USER_LOGIN = 'user.login',
  USER_LOGIN_FAILED = 'user.login.failed',
  USER_SIGNUP = 'user.signup',
  USER_LOGOUT = 'user.logout',
  USER_TFA_ENABLED = 'user.tfa.enabled',
  USER_TFA_DISABLED = 'user.tfa.disabled',
  USER_TFA_FAILED = 'user.tfa.failed',
  PERMISSION_DENIED = 'permission.denied',
  PAYMENT_SUCCESS = 'payment.success',
}
