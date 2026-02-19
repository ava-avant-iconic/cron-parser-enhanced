/**
 * Enhanced Cron Parser
 * Parses cron expressions, validates syntax, generates human-readable descriptions,
 * and calculates next run times.
 */

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June',
                     'July', 'August', 'September', 'October', 'November', 'December'];
const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const DAY_NAMES_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/**
 * Check for unsupported notations in a cron field
 * @param {string} value - Field value
 * @param {string} fieldName - Name of the field
 * @throws {Error} If unsupported notation is found
 */
function checkUnsupportedNotations(value, fieldName) {
  // L (last day) notation
  if (value.includes('L')) {
    throw new Error(`Unsupported notation 'L' in ${fieldName} field`);
  }
  // W (weekday) notation
  if (value.includes('W')) {
    throw new Error(`Unsupported notation 'W' in ${fieldName} field`);
  }
  // # (nth weekday) notation
  if (value.includes('#')) {
    throw new Error(`Unsupported notation '#' in ${fieldName} field`);
  }
  // ? (question mark for day/weekday conflicts)
  if (value.includes('?')) {
    throw new Error(`Unsupported notation '?' in ${fieldName} field`);
  }
}

/**
 * Parse and validate a cron expression
 * @param {string} expression - Cron expression (with optional seconds field)
 * @returns {object} Parsed cron object with fields and metadata
 * @throws {Error} If expression is invalid
 */
export function parse(expression) {
  if (!expression || typeof expression !== 'string') {
    throw new Error('Cron expression must be a non-empty string');
  }

  // Trim and split
  const parts = expression.trim().split(/\s+/);
  let hasSeconds = false;

  // Determine format (5 or 6 fields)
  if (parts.length === 6) {
    hasSeconds = true;
  } else if (parts.length !== 5) {
    throw new Error('Cron expression must have 5 or 6 fields (optional seconds)');
  }

  // Map parts to fields
  const fields = hasSeconds
    ? { second: parts[0], minute: parts[1], hour: parts[2], day: parts[3], month: parts[4], weekday: parts[5] }
    : { second: '0', minute: parts[0], hour: parts[1], day: parts[2], month: parts[3], weekday: parts[4] };

  // Validate each field
  const parsed = {};
  const fieldConfigs = [
    { name: 'second', min: 0, max: 59 },
    { name: 'minute', min: 0, max: 59 },
    { name: 'hour', min: 0, max: 23 },
    { name: 'day', min: 1, max: 31 },
    { name: 'month', min: 1, max: 12 },
    { name: 'weekday', min: 0, max: 6 }
  ];

  for (const config of fieldConfigs) {
    parsed[config.name] = parseField(fields[config.name], config.name, config.min, config.max);
  }

  return {
    original: expression,
    hasSeconds,
    fields: parsed
  };
}

/**
 * Parse a single cron field
 * @param {string} value - Field value
 * @param {string} fieldName - Name of the field
 * @param {number} min - Minimum valid value
 * @param {number} max - Maximum valid value
 * @returns {object} Parsed field info
 */
function parseField(value, fieldName, min, max) {
  // Check for unsupported notations
  checkUnsupportedNotations(value, fieldName);

  const result = {
    raw: value,
    isAll: value === '*',
    isRange: value.includes('-'),
    isList: value.includes(','),
    isStep: value.includes('/'),
    values: []
  };

  // Handle lists first (comma-separated)
  if (result.isList) {
    const items = value.split(',');
    for (const item of items) {
      const itemResult = parseSingleItem(item.trim(), fieldName, min, max);
      result.values.push(...itemResult.values);
      if (itemResult.step) result.step = itemResult.step;
    }
  } else {
    const itemResult = parseSingleItem(value, fieldName, min, max);
    result.values = itemResult.values;
    result.step = itemResult.step;
  }

  // Sort and deduplicate values
  result.values = [...new Set(result.values)].sort((a, b) => a - b);

  return result;
}

/**
 * Parse a single cron field item (no lists)
 * @param {string} item - Field item
 * @param {string} fieldName - Name of the field
 * @param {number} min - Minimum valid value
 * @param {number} max - Maximum valid value
 * @returns {object} Parsed item info
 */
function parseSingleItem(item, fieldName, min, max) {
  const result = { values: [], step: null };

  // Handle wildcard
  if (item === '*') {
    for (let i = min; i <= max; i++) {
      result.values.push(i);
    }
    return result;
  }

  // Handle step (e.g., */5, 0-10/2)
  if (item.includes('/')) {
    const [base, step] = item.split('/');
    result.step = parseInt(step, 10);

    if (isNaN(result.step) || result.step < 1) {
      throw new Error(`Invalid step value in ${fieldName}: ${step}`);
    }

    const baseParsed = parseSingleItem(base || '*', fieldName, min, max);
    result.values = baseParsed.values.filter((_, i) => i % result.step === 0);
    return result;
  }

  // Handle range (e.g., 1-5)
  if (item.includes('-')) {
    const [start, end] = item.split('-');
    const startNum = parseInt(start, 10);
    const endNum = parseInt(end, 10);

    if (isNaN(startNum) || isNaN(endNum)) {
      throw new Error(`Invalid range in ${fieldName}: ${item}`);
    }

    if (startNum < min || startNum > max) {
      throw new Error(`${fieldName} value out of range (${min}-${max}): ${startNum}`);
    }
    if (endNum < min || endNum > max) {
      throw new Error(`${fieldName} value out of range (${min}-${max}): ${endNum}`);
    }

    for (let i = startNum; i <= endNum; i++) {
      result.values.push(i);
    }
    return result;
  }

  // Handle month names (must check before treating as invalid number)
  if (fieldName === 'month') {
    const monthLower = item.toLowerCase();
    if (!item.match(/^\d+$/)) {
      const monthIndex = MONTH_NAMES.findIndex(m => m.toLowerCase() === monthLower ||
        m.toLowerCase().startsWith(monthLower));
      if (monthIndex === -1) {
        throw new Error(`Invalid month name: ${item}`);
      }
      result.values.push(monthIndex + 1);
      return result;
    }
  }

  // Handle day names (must check before treating as invalid number)
  if (fieldName === 'weekday') {
    const dayLower = item.toLowerCase();
    if (!item.match(/^\d+$/)) {
      const dayIndex = DAY_NAMES.findIndex(d => d.toLowerCase() === dayLower ||
        d.toLowerCase().startsWith(dayLower) ||
        DAY_NAMES_SHORT.some(s => s.toLowerCase() === dayLower || s.toLowerCase().startsWith(dayLower)));
      if (dayIndex === -1) {
        throw new Error(`Invalid weekday name: ${item}`);
      }
      result.values.push(dayIndex);
      return result;
    }
  }

  // Handle single value
  const num = parseInt(item, 10);
  if (isNaN(num)) {
    throw new Error(`Invalid ${fieldName} value: ${item}`);
  }

  if (num < min || num > max) {
    throw new Error(`${fieldName} value out of range (${min}-${max}): ${num}`);
  }

  result.values.push(num);
  return result;
}

/**
 * Check if minute values form a regular interval
 * @param {number[]} values - Minute values
 * @returns {object|null} Interval info or null if not regular
 */
function detectMinuteInterval(values) {
  if (values.length < 2) return null;

  const sorted = [...values].sort((a, b) => a - b);
  const diff = sorted[1] - sorted[0];
  if (diff === 0) return null;

  // Check if all differences are the same
  for (let i = 1; i < sorted.length - 1; i++) {
    if (sorted[i + 1] - sorted[i] !== diff) return null;
  }

  // Check if it starts from 0
  if (sorted[0] === 0) {
    return { type: 'interval', step: diff, count: values.length };
  }

  return null;
}

/**
 * Check if hour values form a regular interval
 * @param {number[]} values - Hour values
 * @returns {object|null} Interval info or null if not regular
 */
function detectHourInterval(values) {
  if (values.length < 2) return null;

  const sorted = [...values].sort((a, b) => a - b);
  const diff = sorted[1] - sorted[0];
  if (diff === 0) return null;

  // Check if all differences are the same
  for (let i = 1; i < sorted.length - 1; i++) {
    if (sorted[i + 1] - sorted[i] !== diff) return null;
  }

  // Check if it starts from 0
  if (sorted[0] === 0) {
    return { type: 'interval', step: diff, count: values.length };
  }

  return null;
}

/**
 * Generate a human-readable description of a cron expression
 * @param {string} expression - Cron expression
 * @returns {string} Human-readable description
 */
export function describe(expression) {
  const parsed = parse(expression);

  const { second, minute, hour, day, month, weekday } = parsed.fields;

  // Determine frequency
  let timeStr = '';
  let dateStr = '';
  let frequency = '';

  // Time description
  if (hour.isAll && minute.isAll && (!parsed.hasSeconds || second.isAll)) {
    timeStr = 'every minute';
  } else if (hour.isAll && !minute.isAll) {
    const interval = detectMinuteInterval(minute.values);
    if (interval) {
      timeStr = `every ${interval.step} minutes`;
    } else if (minute.values.length === 1) {
      timeStr = `at ${minute.values[0]} minutes past every hour`;
    } else {
      timeStr = `at ${minute.values.join(', ')} minutes past every hour`;
    }
  } else if (!hour.isAll && minute.isAll) {
    const interval = detectHourInterval(hour.values);
    if (interval) {
      timeStr = `every ${interval.step} hours`;
    } else if (hour.values.length === 1) {
      timeStr = `every minute past ${formatHour(hour.values[0])}`;
    } else {
      timeStr = `every minute at hours ${hour.values.map(formatHour).join(', ')}`;
    }
  } else {
    if (hour.values.length === 1 && minute.values.length === 1) {
      timeStr = `at ${formatTime(hour.values[0], minute.values[0], second.values[0] || 0, parsed.hasSeconds)}`;
    } else {
      const times = [];
      for (const h of hour.values) {
        for (const m of minute.values) {
          const s = parsed.hasSeconds ? second.values[0] || 0 : 0;
          times.push(formatTime(h, m, s, parsed.hasSeconds));
        }
      }
      timeStr = `at ${times.join(', ')}`;
    }
  }

  // Day/Weekday description
  if (day.isAll && weekday.isAll) {
    dateStr = 'every day';
  } else if (!day.isAll && weekday.isAll) {
    if (day.values.length === 1 && day.values[0] === 1) {
      dateStr = 'on the 1st of every month';
    } else if (day.values.length === 1 && day.values[0] === 31) {
      dateStr = 'on the last day of every month';
    } else {
      const ordinals = day.values.map(d => `${d}${getOrdinal(d)}`);
      dateStr = `on the ${ordinals.join(', ')} of every month`;
    }
  } else if (day.isAll && !weekday.isAll) {
    const dayNames = weekday.values.map(d => DAY_NAMES[d]);
    if (dayNames.length === 1) {
      dateStr = `every ${dayNames[0]}`;
    } else if (dayNames.length === 2 && dayNames.includes('Sunday') && dayNames.includes('Saturday')) {
      dateStr = 'every weekend';
    } else {
      dateStr = `every ${dayNames.join(', ')}`;
    }
  } else {
    // Both day and weekday specified (AND logic - both must match)
    const dayNames = weekday.values.map(d => DAY_NAMES[d]);
    const ordinals = day.values.map(d => `${d}${getOrdinal(d)}`);
    dateStr = `on the ${ordinals.join(', ')} when it's ${dayNames.join(' or ')}`;
  }

  // Month description
  if (month.isAll) {
    frequency = timeStr + ' ' + dateStr;
  } else {
    const monthNames = month.values.map(m => MONTH_NAMES[m - 1]);
    frequency = `${timeStr} ${dateStr} in ${monthNames.join(', ')}`;
  }

  return capitalizeFirst(frequency.trim());
}

/**
 * Format hour in 12-hour format
 * @param {number} hour - Hour (0-23)
 * @returns {string} Formatted hour
 */
function formatHour(hour) {
  if (hour === 0) return '12am';
  if (hour === 12) return '12pm';
  return hour > 12 ? `${hour - 12}pm` : `${hour}am`;
}

/**
 * Format time in 12-hour format
 * @param {number} hour - Hour (0-23)
 * @param {number} minute - Minute (0-59)
 * @param {number} second - Second (0-59)
 * @param {boolean} includeSeconds - Whether to include seconds
 * @returns {string} Formatted time
 */
function formatTime(hour, minute, second = 0, includeSeconds = false) {
  const ampm = hour >= 12 ? 'pm' : 'am';
  const hour12 = hour % 12 || 12;
  const minStr = minute.toString().padStart(2, '0');
  if (includeSeconds) {
    const secStr = second.toString().padStart(2, '0');
    return `${hour12}:${minStr}:${secStr}${ampm}`;
  }
  return `${hour12}:${minStr}${ampm}`;
}

/**
 * Get ordinal suffix for a number
 * @param {number} n - Number
 * @returns {string} Ordinal suffix
 */
function getOrdinal(n) {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return s[(v - 20) % 10] || s[v] || s[0];
}

/**
 * Capitalize first letter of a string
 * @param {string} str - String
 * @returns {string} Capitalized string
 */
function capitalizeFirst(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

/**
 * Calculate the next run time(s) for a cron expression
 * @param {string} expression - Cron expression
 * @param {Date} fromDate - Start date (default: now)
 * @param {number} count - Number of next runs to calculate (default: 1)
 * @returns {Date[]} Array of next run times
 */
export function nextRuns(expression, fromDate = new Date(), count = 1) {
  const parsed = parse(expression);
  const { second, minute, hour, day, month, weekday } = parsed.fields;

  const results = [];
  let currentDate = new Date(fromDate);

  // Move to next second if needed
  if (!second.isAll || count > 1) {
    currentDate.setSeconds(currentDate.getSeconds() + 1);
  }

  // Limit iterations to prevent infinite loops
  let maxIterations = count * 10000;
  let iterations = 0;

  while (results.length < count && iterations < maxIterations) {
    iterations++;

    const currentSecond = currentDate.getSeconds();
    const currentMinute = currentDate.getMinutes();
    const currentHour = currentDate.getHours();
    const currentDay = currentDate.getDate();
    const currentMonth = currentDate.getMonth() + 1;
    const currentWeekday = currentDate.getDay();

    // Check if current time matches cron expression
    const matchesSecond = second.values.includes(currentSecond);
    const matchesMinute = minute.values.includes(currentMinute);
    const matchesHour = hour.values.includes(currentHour);
    const matchesMonth = month.values.includes(currentMonth);

    // Day of month OR day of week must match
    const matchesDay = day.values.includes(currentDay);
    const matchesWeekday = weekday.values.includes(currentWeekday);

    // Check if both day and weekday are restricted (special case)
    const bothDayRestricted = !day.isAll && !weekday.isAll;
    const matchesDayCondition = bothDayRestricted
      ? (matchesDay && matchesWeekday)
      : (day.isAll || matchesDay) && (weekday.isAll || matchesWeekday);

    if (matchesSecond && matchesMinute && matchesHour && matchesMonth && matchesDayCondition) {
      results.push(new Date(currentDate));
      // Move to next minute to avoid duplicates
      currentDate.setMinutes(currentDate.getMinutes() + 1);
      currentDate.setSeconds(0);
      continue;
    }

    // Advance time
    if (!matchesSecond) {
      const nextSecond = second.values.find(s => s > currentSecond);
      if (nextSecond !== undefined) {
        currentDate.setSeconds(nextSecond);
      } else {
        currentDate.setSeconds(second.values[0]);
        currentDate.setMinutes(currentMinute + 1);
      }
    } else if (!matchesMinute) {
      const nextMinute = minute.values.find(m => m > currentMinute);
      if (nextMinute !== undefined) {
        currentDate.setMinutes(nextMinute);
        currentDate.setSeconds(second.values[0]);
      } else {
        currentDate.setMinutes(minute.values[0]);
        currentDate.setHours(currentHour + 1);
        currentDate.setSeconds(second.values[0]);
      }
    } else if (!matchesHour) {
      const nextHour = hour.values.find(h => h > currentHour);
      if (nextHour !== undefined) {
        currentDate.setHours(nextHour);
        currentDate.setMinutes(minute.values[0]);
        currentDate.setSeconds(second.values[0]);
      } else {
        currentDate.setHours(hour.values[0]);
        currentDate.setDate(currentDay + 1);
        currentDate.setMinutes(minute.values[0]);
        currentDate.setSeconds(second.values[0]);
      }
    } else if (!matchesMonth) {
      const nextMonth = month.values.find(m => m > currentMonth);
      if (nextMonth !== undefined) {
        currentDate.setMonth(nextMonth - 1);
        currentDate.setDate(1);
        currentDate.setHours(hour.values[0]);
        currentDate.setMinutes(minute.values[0]);
        currentDate.setSeconds(second.values[0]);
      } else {
        currentDate.setFullYear(currentDate.getFullYear() + 1);
        currentDate.setMonth(month.values[0] - 1);
        currentDate.setDate(1);
        currentDate.setHours(hour.values[0]);
        currentDate.setMinutes(minute.values[0]);
        currentDate.setSeconds(second.values[0]);
      }
    } else {
      // Advance to next day
      currentDate.setDate(currentDay + 1);
      currentDate.setHours(hour.values[0]);
      currentDate.setMinutes(minute.values[0]);
      currentDate.setSeconds(second.values[0]);
    }
  }

  return results;
}

/**
 * Validate a cron expression without throwing
 * @param {string} expression - Cron expression
 * @returns {object} Validation result with isValid flag and error message
 */
export function validate(expression) {
  try {
    parse(expression);
    return { isValid: true, error: null };
  } catch (error) {
    return { isValid: false, error: error.message };
  }
}

/**
 * Get all possible values for a field in a cron expression
 * @param {string} expression - Cron expression
 * @param {string} fieldName - Name of the field (second, minute, hour, day, month, weekday)
 * @returns {number[]} Array of possible values
 */
export function getFieldValues(expression, fieldName) {
  const parsed = parse(expression);
  if (!parsed.fields[fieldName]) {
    throw new Error(`Invalid field name: ${fieldName}`);
  }
  return [...parsed.fields[fieldName].values];
}

export default {
  parse,
  describe,
  nextRuns,
  validate,
  getFieldValues
};
