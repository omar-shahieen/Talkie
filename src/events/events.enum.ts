export enum AppEvents {
  USER_LOGIN = 'user.login',
  USER_SIGNUP = 'user.signup',
  USER_LOGOUT = 'user.logout',
  PAYMENT_SUCCESS = 'payment.success',
  MESSAGE_CREATED = 'message.created',
  MESSAGE_UPDATED = 'message.updated',
  MESSAGE_DELETED = 'message.deleted',
  MESSAGE_REACTION_ADDED = 'message.reaction.added',
  MESSAGE_REACTION_REMOVED = 'message.reaction.removed',
  TYPING_STARTED = 'channel.typing.started',
  TYPING_STOPPED = 'channel.typing.stopped',
  PRESENCE_UPDATED = 'presence.updated',
}
