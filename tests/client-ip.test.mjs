import test from 'node:test';
import assert from 'node:assert/strict';
import { clientIp } from '../lib/mongodb/client-ip.ts';

test('Netlify edge client IP wins over forwarded and real-IP headers', () => {
  const headers = new Headers({
    'x-nf-client-connection-ip': '2001:db8::1',
    'x-real-ip': '192.0.2.8',
    'x-forwarded-for': '203.0.113.3, 192.0.2.8',
  });
  assert.equal(clientIp(headers), '2001:db8::1');
});

test('falls back to a valid proxy header', () => {
  assert.equal(clientIp(new Headers({ 'x-forwarded-for': '203.0.113.2, 192.0.2.1' })), '203.0.113.2');
  assert.equal(clientIp(new Headers({ 'x-real-ip': '192.0.2.5' })), '192.0.2.5');
});

test('rejects arbitrary spoofing strings and uses one unknown bucket', () => {
  const headers = new Headers({ 'x-nf-client-connection-ip': 'attacker', 'x-forwarded-for': 'not-an-ip, 203.0.113.3' });
  assert.equal(clientIp(headers), 'unknown');
  assert.equal(clientIp(new Headers()), 'unknown');
});

test('ignores invalid preferred header and accepts valid lower-priority header', () => {
  const headers = new Headers({ 'x-nf-client-connection-ip': '1.2.3.4:5678', 'x-real-ip': '198.51.100.42' });
  assert.equal(clientIp(headers), '198.51.100.42');
});
