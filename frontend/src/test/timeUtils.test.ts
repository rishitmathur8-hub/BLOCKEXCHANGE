import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  fmtMinutes,
  parseTimeToMinutes,
  minutesToTimeString,
  formatDuration,
} from '../utils/time.ts';

describe('Time Utilities (24-hr IST)', () => {
  it('formats minutes since midnight correctly', () => {
    assert.equal(fmtMinutes(0), '00:00');
    assert.equal(fmtMinutes(630), '10:30');
    assert.equal(fmtMinutes(840), '14:00');
    assert.equal(fmtMinutes(1439), '23:59');
  });

  it('handles next day overflow marker (+1d)', () => {
    assert.equal(fmtMinutes(1440), '00:00 (+1d)');
    assert.equal(fmtMinutes(1500), '01:00 (+1d)');
  });

  it('handles null and undefined gracefully', () => {
    assert.equal(fmtMinutes(null), '--:--');
    assert.equal(fmtMinutes(undefined), '--:--');
  });

  it('parses HH:mm string to minutes', () => {
    assert.equal(parseTimeToMinutes('00:00'), 0);
    assert.equal(parseTimeToMinutes('10:30'), 630);
    assert.equal(parseTimeToMinutes('14:45'), 885);
  });

  it('converts minutes to HH:mm string', () => {
    assert.equal(minutesToTimeString(630), '10:30');
    assert.equal(minutesToTimeString(840), '14:00');
  });

  it('formats durations in human-readable terms', () => {
    assert.equal(formatDuration(45), '45m');
    assert.equal(formatDuration(60), '1h');
    assert.equal(formatDuration(90), '1h 30m');
    assert.equal(formatDuration(120), '2h');
  });
});
