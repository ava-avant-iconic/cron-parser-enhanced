# cron-parser-enhanced

Enhanced cron expression parser with natural language descriptions, validation, and next run time calculations.

## Features

- ✅ Parse standard 5-field cron expressions
- ✅ Optional 6-field support (seconds)
- ✅ Natural language descriptions (e.g., "Every Monday at 9am")
- ✅ Syntax validation with detailed error messages
- ✅ Calculate next run times
- ✅ TypeScript support
- ✅ Zero dependencies
- ✅ Node.js built-in test runner

## Installation

```bash
npm install cron-parser-enhanced
```

## Quick Start

```javascript
import { parseCron, describeCron, validateCron } from 'cron-parser-enhanced';

// Parse a cron expression
const result = parseCron('0 9 * * *');
console.log(result.description);
// Output: "At minute 0 9am every day"

console.log(result.nextRuns);
// Output: Array of next 5 Date objects

// Just get a description
const desc = describeCron('0 9 * * 1');
console.log(desc);
// Output: "At minute 0 9am on Monday"

// Validate before parsing
const validation = validateCron('invalid cron');
if (!validation.valid) {
  console.error('Errors:', validation.errors);
}
```

## API

### `parseCron(expression, options?)`

Parse a cron expression and return structured data.

```typescript
import { parseCron } from 'cron-parser-enhanced';

const result = parseCron('0 9 * * *');

// result.isValid: boolean
// result.description: string
// result.fields: CronFields
// result.nextRuns: Date[]
// result.errors: string[]
```

**Options:**
- `includeSeconds` (boolean): Parse 6-field cron with seconds (default: `false`)

### `describeCron(expression, options?)`

Get a natural language description of a cron expression.

```typescript
import { describeCron } from 'cron-parser-enhanced';

console.log(describeCron('0 9 * * *'));
// "At minute 0 9am every day"

console.log(describeCron('0 9 * * 1'));
// "At minute 0 9am on Monday"

console.log(describeCron('*/5 * * * *'));
// "Every 5 minutes every hour"

console.log(describeCron('0 9-17 * * 1-5'));
// "At minute 0 at hours 9, 10, 11, 12, 13, 14, 15, 16, 17 on weekdays"
```

### `validateCron(expression, options?)`

Validate a cron expression and get detailed error messages.

```typescript
import { validateCron } from 'cron-parser-enhanced';

const result = validateCron('0 9 * * *');
console.log(result.valid); // true

const invalid = validateCron('60 9 * * *');
console.log(invalid.valid); // false
console.log(invalid.errors); // ["Invalid value in minutes: 60"]
```

### `calculateNextRuns(fields, count?)`

Calculate the next N run times from now.

```typescript
import { calculateNextRuns, parseCron } from 'cron-parser-enhanced';

const parsed = parseCron('0 9 * * *');
const nextRuns = calculateNextRuns(parsed.fields, 10);

nextRuns.forEach(date => {
  console.log(date.toISOString());
});
```

## Cron Expression Format

### Standard 5-Field Format

```
┌───────────── minute (0 - 59)
│ ┌─────────── hour (0 - 23)
│ │ ┌───────── day of month (1 - 31)
│ │ │ ┌─────── month (1 - 12)
│ │ │ │ ┌───── day of week (0 - 6, Sunday = 0)
│ │ │ │ │
* * * * *
```

### Optional 6-Field Format (with seconds)

```
┌────────────── second (0 - 59)
│ ┌──────────── minute (0 - 59)
│ │ ┌────────── hour (0 - 23)
│ │ │ ┌──────── day of month (1 - 31)
│ │ │ │ ┌────── month (1 - 12)
│ │ │ │ │ ┌──── day of week (0 - 6, Sunday = 0)
│ │ │ │ │ │
* * * * * *
```

## Supported Syntax

### Wildcard (`*`)

```
* * * * *  # Every minute
```

### Lists

```
0,15,30,45 * * * *  # At minutes 0, 15, 30, and 45
```

### Ranges

```
0 9-17 * * *  # At minute 0 past every hour from 9am through 5pm
```

### Steps

```
*/5 * * * *  # Every 5 minutes
0 */2 * * *  # Every 2 hours
```

### Combined Range + Step

```
0-10/2 * * * *  # Every 2 minutes from 0 through 10
```

### Special Values

- **Day of week**: `0` (Sunday) through `6` (Saturday)
- **Month**: `1` (January) through `12` (December)

## Examples

| Cron Expression | Description |
|----------------|-------------|
| `0 9 * * *` | Every day at 9am |
| `0 0 * * *` | Every day at midnight |
| `*/5 * * * *` | Every 5 minutes |
| `0 * * * *` | Every hour |
| `0 9 * * 1` | Every Monday at 9am |
| `0 9 * * 1-5` | Every weekday at 9am |
| `0 9 * * 0,6` | Every weekend day at 9am |
| `0 9 1 * *` | On the 1st of every month at 9am |
| `0 9 1,15 * *` | On the 1st and 15th of every month at 9am |
| `0 9-17 * * *` | Every hour from 9am to 5pm |
| `0 9-17/2 * * *` | Every 2 hours from 9am to 5pm |
| `30 9 * * 1,3,5` | At 9:30am on Monday, Wednesday, and Friday |
| `0 0 * * 1` | Every Monday at midnight |
| `0 9 * * 1,6,12` | At 9am in January, June, and December |
| `30 0 9 * * *` | At second 30 of minute 0 at 9am (with seconds) |

## TypeScript

Full TypeScript support with type definitions included.

```typescript
import {
  parseCron,
  ParsedCron,
  CronFields,
  ParseOptions
} from 'cron-parser-enhanced';

const options: ParseOptions = { includeSeconds: true };
const result: ParsedCron = parseCron('0 0 9 * * *', options);

console.log(result.fields.hours); // number[]
```

## Testing

Run the test suite:

```bash
npm test
```

Run tests in watch mode:

```bash
npm run test:watch
```

## Build

Build the TypeScript project:

```bash
npm run build
```

## License

MIT

## Contributing

Contributions are welcome! Please ensure tests pass before submitting PRs.
