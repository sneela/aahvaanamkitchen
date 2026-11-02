import test from 'node:test';
import assert from 'node:assert/strict';
import { isoToLocalDateTimeInput, localDateTimeInputToIso } from '../lib/datetime-local.ts';

test('datetime-local shows Eastern winter wall time without shifting the instant', () => {
  const before = process.env.TZ;
  try {
    process.env.TZ = 'America/New_York';
    const instant = '2026-12-20T20:30:00.000Z';
    assert.equal(isoToLocalDateTimeInput(instant), '2026-12-20T15:30');
    assert.equal(localDateTimeInputToIso('2026-12-20T15:30'), instant);
  } finally { if (before === undefined) delete process.env.TZ; else process.env.TZ = before; }
});

test('datetime-local shows Eastern summer wall time without shifting the instant', () => {
  const before = process.env.TZ;
  try {
    process.env.TZ = 'America/New_York';
    const instant = '2026-07-20T20:30:00.000Z';
    assert.equal(isoToLocalDateTimeInput(instant), '2026-07-20T16:30');
    assert.equal(localDateTimeInputToIso('2026-07-20T16:30'), instant);
  } finally { if (before === undefined) delete process.env.TZ; else process.env.TZ = before; }
});

test('empty and invalid values cannot produce a date', () => {
  assert.equal(isoToLocalDateTimeInput(null), '');
  assert.equal(isoToLocalDateTimeInput('not-a-date'), '');
  assert.equal(localDateTimeInputToIso(''), null);
  assert.equal(localDateTimeInputToIso('not-a-date'), null);
});
