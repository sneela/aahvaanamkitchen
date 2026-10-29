import { randomBytes, scryptSync } from 'node:crypto';
import { createInterface } from 'node:readline/promises';
const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: true });
try {
  const password = await rl.question('Administrator password (input visible in this terminal): ');
  if (password.length < 14) throw new Error('Use at least 14 characters');
  const salt = randomBytes(32);
  console.log('ADMIN_PASSWORD_HASH=' + salt.toString('hex') + ':' + scryptSync(password, salt, 64).toString('hex'));
  console.log('SESSION_SECRET=' + randomBytes(48).toString('hex'));
  console.log('Save these only in your hosting environment. Never commit them.');
} finally { rl.close(); }
