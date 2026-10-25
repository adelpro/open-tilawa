export type TokenPayload = {
  id: string | number;
  email: string;
  role: string;
  isActivated: boolean;
  isTwoFAEnabled: boolean;
  isDeviceTrusted: boolean;
  /**
   * A unique id per issuance.
   *
   * Without it, two sign-ins for the same user **in the same second** produce a
   * byte-identical JWT — the payload carries no timestamp of its own and `iat`
   * has one-second resolution. `sessions.token_hash` is UNIQUE, so the second
   * one failed with SQLITE_CONSTRAINT_UNIQUE: a 500 on the most ordinary action
   * in the product. Found by signing in twice, for two devices, in a test.
   */
  jti: string;
};
