import test from 'node:test';
import assert from 'node:assert/strict';
import { easternDateTimeMs } from '../lib/time.ts';
test('winter Eastern uses UTC-5', () => assert.equal(new Date(easternDateTimeMs('2026-01-15','12:00')).toISOString(), '2026-01-15T17:00:00.000Z'));
test('summer Eastern uses UTC-4', () => assert.equal(new Date(easternDateTimeMs('2026-07-15','12:00')).toISOString(), '2026-07-15T16:00:00.000Z'));
test('spring forward gap is rejected', () => assert.equal(easternDateTimeMs('2026-03-08','02:30'), null));
test('fall back picks earlier valid occurrence', () => assert.equal(new Date(easternDateTimeMs('2026-11-01','01:30')).toISOString(), '2026-11-01T05:30:00.000Z'));
test('invalid date is rejected', () => assert.equal(easternDateTimeMs('2026-02-30','12:00'), null));
