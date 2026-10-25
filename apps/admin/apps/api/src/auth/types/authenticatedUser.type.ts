export type AuthenticatedUser = {
  id: string | number;
  email: string;
  name: string;
  about?: string;
  role?: string;
  /** True for the one Owner; display only, never an authorization input. */
  isOwner?: boolean;
  profileImage?: string;
  isActivated?: boolean;
  isTwoFAEnabled?: boolean;
  /** Set when the account has an uploaded avatar; the SPA uses it as a cache key. */
  avatarUpdatedAt?: string | null;
  token: string;
};
