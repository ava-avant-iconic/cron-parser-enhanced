/**
 * Test suite for cron-parser-enhanced
 */

import { describe, it } from 'node:test';
import assert from 'node:assert';
import { parseCron, describeCron, validateCron, calculateNextRuns } from '../dist/index.js';

describe('validateCron', () => {
  it('should validate standard 5-field cron expressions', () => {
    const result = validateCron('0 9 * * *');
    assert.strictEqual(result.valid, true);
    assert.deepStrictEqual(result.errors, []);
  });

  it('should validate with seconds field when includeSeconds is true', () => {
    const result = validateCron('0 0 9 * * *', { includeSeconds: true });
    assert.strictEqual(result.valid, true);
    assert.deepStrictEqual(result.errors, []);
  });

  it('should reject expressions with too few fields', () => {
    const result = validateCron('0 9 * *');
    assert.strictEqual(result.valid, false);
    assert.strictEqual(result.errors.length, 1);
    assert.ok(result.errors[0].includes('Expected 5-6 fields'));
  });

  it('should reject expressions with too many fields', () => {
    const result = validateCron('0 0 0 9 * * *');
    assert.strictEqual(result.valid, false);
    assert.strictEqual(result.errors.length, 1);
  });

  it('should reject invalid minute values', () => {
    const result = validateCron('60 9 * * *');
    assert.strictEqual(result.valid, false);
    assert.ok(result.errors.some(e => e.includes('minutes') || e.includes('Invalid value')));
  });

  it('should reject invalid hour values', () => {
    const result = validateCron('0 24 * * *');
    assert.strictEqual(result.valid, false);
  });

  it('should reject invalid day of month values', () => {
    const result = validateCron('0 9 32 * *');
    assert.strictEqual(result.valid, false);
  });

  it('should reject invalid month values', () => {
    const result = validateCron('0 9 * 13 *');
    assert.strictEqual(result.valid, false);
  });

  it('should reject invalid day of week values', () => {
    const result = validateCron('0 9 * * 7');
    assert.strictEqual(result.valid, false);
  });

  it('should handle empty string', () => {
    const result = validateCron('');
    assert.strictEqual(result.valid, false);
    assert.ok(result.errors[0].includes('non-empty'));
  });
});

describe('parseCron', () => {
  it('should parse simple daily cron', () => {
    const result = parseCron('0 9 * * *');
    assert.strictEqual(result.isValid, true);
    assert.strictEqual(result.description.includes('9'), true);
    assert.strictEqual(result.fields.minutes.length, 1);
    assert.strictEqual(result.fields.minutes[0], 0);
    assert.strictEqual(result.fields.hours.length, 1);
    assert.strictEqual(result.fields.hours[0], 9);
  });

  it('should parse cron with seconds', () => {
    const result = parseCron('0 0 9 * * *', { includeSeconds: true });
    assert.strictEqual(result.isValid, true);
    assert.ok(result.fields.seconds);
    assert.strictEqual(result.fields.seconds.length, 1);
    assert.strictEqual(result.fields.seconds[0], 0);
  });

  it('should parse wildcard expressions', () => {
    const result = parseCron('* * * * *');
    assert.strictEqual(result.isValid, true);
    assert.strictEqual(result.fields.minutes.length, 60);
    assert.strictEqual(result.fields.hours.length, 24);
    assert.strictEqual(result.fields.daysOfMonth.length, 31);
    assert.strictEqual(result.fields.months.length, 12);
    assert.strictEqual(result.fields.daysOfWeek.length, 7);
  });

  it('should parse list expressions', () => {
    const result = parseCron('0,15,30,45 * * * *');
    assert.strictEqual(result.isValid, true);
    assert.deepStrictEqual(result.fields.minutes, [0, 15, 30, 45]);
  });

  it('should parse range expressions', () => {
    const result = parseCron('0 9-17 * * *');
    assert.strictEqual(result.isValid, true);
    assert.strictEqual(result.fields.hours.length, 9);
    assert.strictEqual(result.fields.hours[0], 9);
    assert.strictEqual(result.fields.hours[8], 17);
  });

  it('should parse step expressions', () => {
    const result = parseCron('*/5 * * * *');
    assert.strictEqual(result.isValid, true);
    assert.strictEqual(result.fields.minutes.length, 12);
    assert.strictEqual(result.fields.minutes[0], 0);
    assert.strictEqual(result.fields.minutes[1], 5);
  });

  it('should parse combined range and step', () => {
    const result = parseCron('0-10/2 * * * *');
    assert.strictEqual(result.isValid, true);
    assert.deepStrictEqual(result.fields.minutes, [0, 2, 4, 6, 8, 10]);
  });

  it('should return error for invalid cron', () => {
    const result = parseCron('invalid cron');
    assert.strictEqual(result.isValid, false);
    assert.ok(result.errors.length > 0);
  });
});

describe('describeCron', () => {
  it('should describe daily cron', () => {
    const desc = describeCron('0 9 * * *');
    assert.ok(desc.toLowerCase().includes('9'));
  });

  it('should describe weekly cron', () => {
    const desc = describeCron('0 9 * * 1');
    assert.ok(desc.toLowerCase().includes('monday'));
  });

  it('should describe weekdays cron', () => {
    const desc = describeCron('0 9 * * 1-5');
    assert.ok(desc.toLowerCase().includes('weekday') || desc.toLowerCase().includes('monday'));
  });

  it('should describe weekend cron', () => {
    const desc = describeCron('0 9 * * 0,6');
    assert.ok(desc.toLowerCase().includes('weekend') ||
              desc.toLowerCase().includes('sunday') ||
              desc.toLowerCase().includes('saturday'));
  });

  it('should describe monthly cron', () => {
    const desc = describeCron('0 9 1 * *');
    assert.ok(desc.toLowerCase().includes('1st') || desc.toLowerCase().includes('1'));
  });

  it('should describe every minute', () => {
    const desc = describeCron('* * * * *');
    assert.ok(desc.toLowerCase().includes('minute'));
  });

  it('should describe every 5 minutes', () => {
    const desc = describeCron('*/5 * * * *');
    assert.ok(desc.toLowerCase().includes('5') && desc.toLowerCase().includes('minute'));
  });

  it('should describe specific months', () => {
    const desc = describeCron('0 9 * 1,6,12 *');
    assert.ok(desc.toLowerCase().includes('january') ||
              desc.toLowerCase().includes('june') ||
              desc.toLowerCase().includes('december'));
  });
});

describe('calculateNextRuns', () => {
  it('should calculate next runs for daily schedule', () => {
    const parsed = parseCron('0 9 * * *');
    const nextRuns = calculateNextRuns(parsed.fields, 3);
    assert.strictEqual(nextRuns.length, 3);
    assert.ok(nextRuns.every(date => date instanceof Date));
    assert.ok(nextRuns[0] > new Date());
  });

  it('should calculate next runs for every minute', () => {
    const parsed = parseCron('* * * * *');
    const nextRuns = calculateNextRuns(parsed.fields, 5);
    assert.strictEqual(nextRuns.length, 5);
    // Check they are roughly 1 minute apart (allowing some margin)
    for (let i = 1; i < nextRuns.length; i++) {
      const diff = nextRuns[i].getTime() - nextRuns[i - 1].getTime();
      assert.ok(diff >= 59000 && diff <= 61000 || diff === 60000,
                `Expected ~60s, got ${diff}ms`);
    }
  });

  it('should calculate next runs with seconds', () => {
    const parsed = parseCron('0 0 9 * * *', { includeSeconds: true });
    const nextRuns = calculateNextRuns(parsed.fields, 2);
    assert.strictEqual(nextRuns.length, 2);
    assert.ok(nextRuns.every(date => date.getSeconds() === 0));
    assert.ok(nextRuns.every(date => date.getMinutes() === 0));
    assert.ok(nextRuns.every(date => date.getHours() === 9));
  });

  it('should handle impossible schedules', () => {
    const fields = {
      minutes: [0],
      hours: [25], // Invalid hour, but let's test the timeout
      daysOfMonth: [1],
      months: [1],
      daysOfWeek: [0]
    };
    const nextRuns = calculateNextRuns(fields, 5);
    // Should return empty or very limited for impossible schedule
    assert.ok(nextRuns.length < 100);
  });
});

describe('Edge Cases', () => {
  it('should handle range with step', () => {
    const result = parseCron('0-20/5 * * * *');
    assert.strictEqual(result.isValid, true);
    assert.deepStrictEqual(result.fields.minutes, [0, 5, 10, 15, 20]);
  });

  it('should handle midnight', () => {
    const result = parseCron('0 0 * * *');
    assert.strictEqual(result.isValid, true);
    assert.strictEqual(result.fields.hours[0], 0);
  });

  it('should handle end of day', () => {
    const result = parseCron('0 23 * * *');
    assert.strictEqual(result.isValid, true);
    assert.strictEqual(result.fields.hours[0], 23);
  });

  it('should handle multiple specific days', () => {
    const result = parseCron('0 9 1,15 * *');
    assert.strictEqual(result.isValid, true);
    assert.deepStrictEqual(result.fields.daysOfMonth, [1, 15]);
  });

  it('should handle Sunday (0) and Saturday (6)', () => {
    const result = parseCron('0 9 * * 0,6');
    assert.strictEqual(result.isValid, true);
    assert.deepStrictEqual(result.fields.daysOfWeek, [0, 6]);
  });

  it('should handle complex expression', () => {
    const result = parseCron('30 9-17/2 * * 1-5');
    assert.strictEqual(result.isValid, true);
    assert.strictEqual(result.fields.minutes[0], 30);
    assert.ok(result.fields.hours.includes(9));
    assert.ok(result.fields.hours.includes(17));
    assert.ok(result.fields.daysOfWeek.includes(1));
    assert.ok(result.fields.daysOfWeek.includes(5));
  });

  it('should handle whitespace variations', () => {
    const result1 = parseCron('0 9 * * *');
    const result2 = parseCron('0  9  *  *  *');
    assert.strictEqual(result1.isValid, result2.isValid);
    assert.deepStrictEqual(result1.fields, result2.fields);
  });

  it('should handle trailing whitespace', () => {
    const result = parseCron('0 9 * * *   ');
    assert.strictEqual(result.isValid, true);
  });
});
