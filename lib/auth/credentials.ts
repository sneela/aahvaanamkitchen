import { scryptSync, timingSafeEqual } from 'node:crypto';

/** Pure credential check; does not access the network, cookies, or environment. */
export type AdminCredentialCheck = 'ok' | 'email_mismatch' | 'password_mismatch' | 'hash_format_invalid';

export function checkAdminCredentialsAgainst(
  email: string,
  password: string,
  configuredEmail: string,
  configuredHash: string,
): AdminCredentialCheck {
  const hash = configuredHash.trim();
  const [salt, hex, extra] = hash.split(':');
  if (!salt || !hex || extra || !/^[a-f0-9]{32,128}$/.test(salt) || !/^[a-f0-9]{128}$/.test(hex)) {
    return 'hash_format_invalid';
  }
  // Verify the password before comparing email, avoiding an email-existence timing oracle.
  const calculated = scryptSync(password, Buffer.from(salt, 'hex'), 64);
  if (!timingSafeEqual(calculated, Buffer.from(hex, 'hex'))) return 'password_mismatch';
  return email.trim().toLowerCase() === configuredEmail.trim().toLowerCase() ? 'ok' : 'email_mismatch';
}
