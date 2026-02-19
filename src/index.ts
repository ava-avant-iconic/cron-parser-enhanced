/**
 * Enhanced Cron Parser
 * Parses cron expressions and provides natural language descriptions,
 * validation, and next run time calculations.
 */

export interface ParseOptions {
  includeSeconds?: boolean;
}

export interface ParsedCron {
  fields: CronFields;
  description: string;
  nextRuns: Date[];
  isValid: boolean;
  errors: string[];
}

export interface CronFields {
  seconds?: number[];
  minutes: number[];
  hours: number[];
  daysOfMonth: number[];
  months: number[];
  daysOfWeek: number[];
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/**
 * Parse a single cron field (e.g. values 1,2,3 becomes [1,2,3], star/5 becomes [0,5,10,...])
 */
function parseField(field: string, min: number, max: number, name: string): number[] {
  const values = new Set<number>();
  const parts = field.split(',');

  for (const part of parts) {
    const trimmed = part.trim();
    if (!trimmed) continue;

    // Handle wildcard
    if (trimmed === '*') {
      for (let i = min; i <= max; i++) {
        values.add(i);
      }
      continue;
    }

    // Handle step (e.g. */5 or 1-10/2)
    const [range, stepStr] = trimmed.split('/');
    const step = stepStr ? parseInt(stepStr, 10) : 1;

    if (isNaN(step) || step < 1) {
      throw new Error(`Invalid step value in ${name}: ${stepStr}`);
    }

    if (range.includes('-')) {
      // Handle range (e.g. 1-5)
      const [startStr, endStr] = range.split('-');
      const start = parseInt(startStr, 10);
      const end = parseInt(endStr, 10);

      if (isNaN(start) || isNaN(end) || start < min || end > max || start > end) {
        throw new Error(`Invalid range in ${name}: ${range}`);
      }

      for (let i = start; i <= end; i += step) {
        values.add(i);
      }
    } else if (range === '*') {
      for (let i = min; i <= max; i += step) {
        values.add(i);
      }
    } else {
      // Single value
      const value = parseInt(range, 10);
      if (isNaN(value) || value < min || value > max) {
        throw new Error(`Invalid value in ${name}: ${value}`);
      }
      values.add(value);
    }
  }

  return Array.from(values).sort((a, b) => a - b);
}

/**
 * Generate a natural language description of the cron schedule
 */
function generateDescription(fields: CronFields): string {
  const parts: string[] = [];

  // Handle seconds (if present)
  if (fields.seconds && fields.seconds.length > 0) {
    if (fields.seconds.length === 60) {
      parts.push('Every second');
    } else if (fields.seconds.length === 1 && fields.seconds[0] === 0) {
      // At the top of the minute, don't mention it
    } else if (fields.seconds.length <= 3) {
      const secStr = fields.seconds.join(', ');
      parts.push(`At second${fields.seconds.length > 1 ? 's' : ''} ${secStr}`);
    } else {
      parts.push(`At ${fields.seconds.length} different seconds`);
    }
  }

  // Minutes
  if (fields.minutes.length === 60) {
    parts.push('every minute');
  } else if (fields.minutes.length === 1) {
    parts.push(`at minute ${fields.minutes[0]}`);
  } else if (fields.minutes.length === 2 && fields.minutes[1] - fields.minutes[0] === 30) {
    parts.push(`at minute ${fields.minutes[0]} and ${fields.minutes[1]}`);
  } else {
    const step = detectStep(fields.minutes);
    if (step && fields.minutes.length === 60 / step) {
      parts.push(`every ${step} minutes`);
    } else if (fields.minutes.length <= 5) {
      parts.push(`at minutes ${fields.minutes.join(', ')}`);
    } else {
      parts.push(`at ${fields.minutes.length} different minutes`);
    }
  }

  // Hours
  if (fields.hours.length === 24) {
    parts.push('every hour');
  } else if (fields.hours.length === 1) {
    const hour = fields.hours[0];
    const ampm = hour < 12 ? 'am' : 'pm';
    const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
    parts.push(`${displayHour}${ampm}`);
  } else if (fields.hours.length === 2) {
    const h1 = fields.hours[0];
    const h2 = fields.hours[1];
    const ampm1 = h1 < 12 ? 'am' : 'pm';
    const ampm2 = h2 < 12 ? 'am' : 'pm';
    const d1 = h1 === 0 ? 12 : h1 > 12 ? h1 - 12 : h1;
    const d2 = h2 === 0 ? 12 : h2 > 12 ? h2 - 12 : h2;
    parts.push(`${d1}${ampm1} and ${d2}${ampm2}`);
  } else {
    const step = detectStep(fields.hours);
    if (step && fields.hours.length === 24 / step) {
      parts.push(`every ${step} hours`);
    } else if (fields.hours.length <= 5) {
      parts.push(`at hours ${fields.hours.join(', ')}`);
    } else {
      parts.push(`at ${fields.hours.length} different hours`);
    }
  }

  // Days of month vs days of week
  if (fields.daysOfMonth.length === 31 && fields.daysOfWeek.length === 7) {
    parts.push('every day');
  } else if (fields.daysOfMonth.length === 1 && fields.daysOfMonth[0] === 1) {
    parts.push('on the 1st of the month');
  } else if (fields.daysOfMonth.length > 1 && fields.daysOfMonth.length < 31) {
    if (fields.daysOfMonth.length <= 5) {
      parts.push(`on day${fields.daysOfMonth.length > 1 ? 's' : ''} ${formatDaysOfMonth(fields.daysOfMonth)}`);
    } else {
      parts.push(`on ${fields.daysOfMonth.length} days of the month`);
    }
  } else if (fields.daysOfWeek.length < 7) {
    if (fields.daysOfWeek.length === 1) {
      parts.push(`on ${DAY_NAMES[fields.daysOfWeek[0]]}`);
    } else if (fields.daysOfWeek.length === 2) {
      parts.push(`on ${DAY_NAMES[fields.daysOfWeek[0]]} and ${DAY_NAMES[fields.daysOfWeek[1]]}`);
    } else if (fields.daysOfWeek.length === 5 && !fields.daysOfWeek.includes(0) && !fields.daysOfWeek.includes(6)) {
      parts.push('on weekdays');
    } else if (fields.daysOfWeek.length === 2 && fields.daysOfWeek.includes(0) && fields.daysOfWeek.includes(6)) {
      parts.push('on weekends');
    } else {
      const dayStr = fields.daysOfWeek.map(d => DAY_NAMES[d]).join(', ');
      parts.push(`on ${dayStr}`);
    }
  }

  // Months
  if (fields.months.length === 12) {
    // Every month, don't mention
  } else if (fields.months.length === 1) {
    parts.push(`in ${MONTH_NAMES[fields.months[0] - 1]}`);
  } else if (fields.months.length <= 3) {
    const monthStr = fields.months.map(m => MONTH_NAMES[m - 1]).join(', ');
    parts.push(`in ${monthStr}`);
  } else {
    parts.push(`in ${fields.months.length} months`);
  }

  // Capitalize first letter and return
  let desc = parts.join(' ');
  desc = desc.charAt(0).toUpperCase() + desc.slice(1);

  return desc;
}

function detectStep(values: number[]): number | null {
  if (values.length < 2) return null;
  const step = values[1] - values[0];
  for (let i = 1; i < values.length; i++) {
    if (values[i] - values[i - 1] !== step) return null;
  }
  return step;
}

function formatDaysOfMonth(days: number[]): string {
  return days.map(d => {
    if (d === 1 || d === 21 || d === 31) return `${d}st`;
    if (d === 2 || d === 22) return `${d}nd`;
    if (d === 3 || d === 23) return `${d}rd`;
    return `${d}th`;
  }).join(', ');
}

/**
 * Validate a cron expression
 */
export function validateCron(expression: string, options: ParseOptions = {}): ValidationResult {
  const errors: string[] = [];

  if (!expression || typeof expression !== 'string') {
    return { valid: false, errors: ['Expression must be a non-empty string'] };
  }

  const parts = expression.trim().split(/\s+/);

  if (options.includeSeconds) {
    if (parts.length < 6 || parts.length > 7) {
      errors.push(`Expected 6-7 fields with includeSeconds, got ${parts.length}`);
    }
  } else {
    if (parts.length < 5 || parts.length > 6) {
      errors.push(`Expected 5-6 fields, got ${parts.length}`);
    }
  }

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  try {
    if (options.includeSeconds) {
      parseField(parts[0], 0, 59, 'seconds');
    }
    parseField(parts[options.includeSeconds ? 1 : 0], 0, 59, 'minutes');
    parseField(parts[options.includeSeconds ? 2 : 1], 0, 23, 'hours');
    parseField(parts[options.includeSeconds ? 3 : 2], 1, 31, 'day of month');
    parseField(parts[options.includeSeconds ? 4 : 3], 1, 12, 'month');
    parseField(parts[options.includeSeconds ? 5 : 4], 0, 6, 'day of week');
  } catch (e) {
    errors.push(e instanceof Error ? e.message : String(e));
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Parse a cron expression and return structured data
 */
export function parseCron(expression: string, options: ParseOptions = {}): ParsedCron {
  const validation = validateCron(expression, options);

  if (!validation.valid) {
    return {
      fields: { minutes: [], hours: [], daysOfMonth: [], months: [], daysOfWeek: [] },
      description: 'Invalid cron expression',
      nextRuns: [],
      isValid: false,
      errors: validation.errors
    };
  }

  const parts = expression.trim().split(/\s+/);
  let idx = 0;

  const fields: CronFields = {
    minutes: [],
    hours: [],
    daysOfMonth: [],
    months: [],
    daysOfWeek: []
  };

  if (options.includeSeconds) {
    fields.seconds = parseField(parts[idx++], 0, 59, 'seconds');
  }

  fields.minutes = parseField(parts[idx++], 0, 59, 'minutes');
  fields.hours = parseField(parts[idx++], 0, 23, 'hours');
  fields.daysOfMonth = parseField(parts[idx++], 1, 31, 'day of month');
  fields.months = parseField(parts[idx++], 1, 12, 'month');
  fields.daysOfWeek = parseField(parts[idx++], 0, 6, 'day of week');

  const description = generateDescription(fields);
  const nextRuns = calculateNextRuns(fields, 5);

  return {
    fields,
    description,
    nextRuns,
    isValid: true,
    errors: []
  };
}

/**
 * Calculate next n run times from now
 */
export function calculateNextRuns(fields: CronFields, count: number = 5): Date[] {
  const runs: Date[] = [];
  let current = new Date();

  // Move to the next minute/second boundary to avoid including current time
  if (fields.seconds) {
    current.setSeconds(current.getSeconds() + 1);
  } else {
    // For minute-based cron, start at the next minute
    current.setMinutes(current.getMinutes() + 1);
    current.setSeconds(0);
  }

  while (runs.length < count && runs.length < 1000) {
    // Check if current matches the cron fields
    const month = current.getMonth() + 1;
    const dayOfMonth = current.getDate();
    const dayOfWeek = current.getDay();
    const hour = current.getHours();
    const minute = current.getMinutes();
    const second = fields.seconds ? current.getSeconds() : 0;

    const monthMatch = fields.months.includes(month);
    const dayOfMonthMatch = fields.daysOfMonth.includes(dayOfMonth);
    const dayOfWeekMatch = fields.daysOfWeek.includes(dayOfWeek);

    // Standard cron: AND between day of month and day of week
    // (Both must match if both are restricted)
    let dayMatch = false;
    if (fields.daysOfMonth.length === 31 && fields.daysOfWeek.length === 7) {
      dayMatch = true; // Every day
    } else if (fields.daysOfMonth.length === 31) {
      dayMatch = dayOfWeekMatch;
    } else if (fields.daysOfWeek.length === 7) {
      dayMatch = dayOfMonthMatch;
    } else {
      dayMatch = dayOfMonthMatch && dayOfWeekMatch;
    }

    const hourMatch = fields.hours.includes(hour);
    const minuteMatch = fields.minutes.includes(minute);
    const secondMatch = fields.seconds ? fields.seconds.includes(second) : true;

    if (monthMatch && dayMatch && hourMatch && minuteMatch && secondMatch) {
      runs.push(new Date(current));
    }

    // Increment time
    if (fields.seconds) {
      current.setSeconds(current.getSeconds() + 1);
    } else {
      current.setMinutes(current.getMinutes() + 1);
      current.setSeconds(0);
    }

    // Prevent infinite loop for impossible schedules
    if (runs.length === 0 && isFutureTooFar(current)) {
      break;
    }
  }

  return runs;
}

function isFutureTooFar(date: Date): boolean {
  const maxFuture = new Date();
  maxFuture.setFullYear(maxFuture.getFullYear() + 4);
  return date > maxFuture;
}

/**
 * Get a simple description of a cron expression
 */
export function describeCron(expression: string, options: ParseOptions = {}): string {
  const parsed = parseCron(expression, options);
  return parsed.description;
}
