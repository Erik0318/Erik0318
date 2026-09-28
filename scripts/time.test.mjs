import test from 'node:test';
import assert from 'node:assert/strict';
import { pacificDate, pacificTimestamp } from './time.mjs';

test('Pacific dates roll back across midnight and year boundaries', () => {
  assert.equal(pacificDate('2026-09-28T06:12:28Z'), '2026-09-27');
  assert.equal(pacificTimestamp('2026-09-28T06:12:28Z'), '2026-09-27 23:12 PDT');
  assert.equal(pacificTimestamp('2026-01-01T07:30:00Z'), '2025-12-31 23:30 PST');
  assert.equal(pacificTimestamp('2026-01-01T08:00:00Z'), '2026-01-01 00:00 PST');
});

test('Pacific timestamps follow both daylight saving transitions', () => {
  assert.equal(pacificTimestamp('2026-03-08T09:59:00Z'), '2026-03-08 01:59 PST');
  assert.equal(pacificTimestamp('2026-03-08T10:00:00Z'), '2026-03-08 03:00 PDT');
  assert.equal(pacificTimestamp('2026-11-01T08:59:00Z'), '2026-11-01 01:59 PDT');
  assert.equal(pacificTimestamp('2026-11-01T09:00:00Z'), '2026-11-01 01:00 PST');
});
