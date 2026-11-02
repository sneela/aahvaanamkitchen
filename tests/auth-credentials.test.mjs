import { test } from 'node:test';
import assert from 'node:assert/strict';
import { scryptSync } from 'node:crypto';
import { checkAdminCredentialsAgainst } from '../lib/auth/credentials.ts';

const salt = 'ab'.repeat(32);
const password = 'correct horse battery staple';
const hash = `${salt}:${scryptSync(password, Buffer.from(salt, 'hex'), 64).toString('hex')}`;

test('correct admin credentials authenticate without MongoDB', () => {
  assert.equal(checkAdminCredentialsAgainst('admin@example.com', password, 'admin@example.com', hash), 'ok');
});
test('email comparison ignores case and surrounding whitespace', () => {
  assert.equal(checkAdminCredentialsAgainst(' Admin@Example.com ', password, 'admin@example.com ', ` ${hash} `), 'ok');
});
test('password is byte-sensitive and never trimmed', () => {
  assert.equal(checkAdminCredentialsAgainst('admin@example.com', ` ${password}`, 'admin@example.com', hash), 'password_mismatch');
  assert.equal(checkAdminCredentialsAgainst('admin@example.com', `${password} `, 'admin@example.com', hash), 'password_mismatch');
});
test('correct password but different email reports email mismatch', () => {
  assert.equal(checkAdminCredentialsAgainst('wrong@example.com', password, 'admin@example.com', hash), 'email_mismatch');
});
test('malformed hash is detected without revealing secrets', () => {
  assert.equal(checkAdminCredentialsAgainst('admin@example.com', password, 'admin@example.com', 'not-a-hash'), 'hash_format_invalid');
  assert.equal(checkAdminCredentialsAgainst('admin@example.com', password, 'admin@example.com', `${salt}:`), 'hash_format_invalid');
  assert.equal(checkAdminCredentialsAgainst('admin@example.com', password, 'admin@example.com', `${hash}:extra`), 'hash_format_invalid');
});
