#!/usr/bin/env node

import { Command } from 'commander';
import { describeCron, parseCron, validateCron, calculateNextRuns } from './index.js';

const program = new Command();

program
  .name('cron-enhanced')
  .description('Enhanced cron parser with natural language descriptions')
  .version('1.0.0');

// Command: describe
program
  .command('describe <expression>')
  .description('Get human-readable description of a cron expression')
  .option('-s, --seconds', 'Include seconds field')
  .option('-j, --json', 'Output as JSON')
  .action(async (expression, options) => {
    try {
      const opts = options.seconds ? { includeSeconds: true } : {};
      const description = describeCron(expression, opts);

      if (options.json) {
        const parsed = parseCron(expression, opts);
        console.log(JSON.stringify({
          expression,
          description,
          nextRuns: parsed.nextRuns,
          isValid: parsed.isValid,
          errors: parsed.errors
        }, null, 2));
      } else {
        console.log(description);
      }
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      console.error(`Error: ${error.message}`);
      process.exit(1);
    }
  });

// Command: validate
program
  .command('validate <expression>')
  .description('Validate a cron expression')
  .option('-s, --seconds', 'Include seconds field')
  .option('-v, --verbose', 'Show detailed error messages')
  .action(async (expression, options) => {
    try {
      const opts = options.seconds ? { includeSeconds: true } : {};
      const result = validateCron(expression, opts);

      if (result.valid) {
        console.log('✅ Valid cron expression');
        process.exit(0);
      } else {
        console.error('❌ Invalid cron expression:');
        for (const error of result.errors) {
          console.error(`  • ${error}`);
        }
        process.exit(1);
      }
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      console.error(`Error: ${error.message}`);
      process.exit(1);
    }
  });

// Command: next
program
  .command('next <expression>')
  .description('Calculate next N run times')
  .option('-n, --count <number>', 'Number of next runs to calculate', '5')
  .option('-s, --seconds', 'Include seconds field')
  .option('-f, --format <format>', 'Output format (text, json)', 'text')
  .action(async (expression, options) => {
    try {
      const count = parseInt(options.count, 10);
      if (isNaN(count) || count < 1) {
        console.error('Error: Count must be a positive number');
        process.exit(1);
      }

      const opts = options.seconds ? { includeSeconds: true } : {};
      const parsed = parseCron(expression, opts);

      if (!parsed.isValid) {
        console.error('Invalid cron expression:');
        for (const error of parsed.errors) {
          console.error(`  • ${error}`);
        }
        process.exit(1);
      }

      const nextRuns = calculateNextRuns(parsed.fields, count);

      if (options.format === 'json') {
        console.log(JSON.stringify({
          expression,
          description: parsed.description,
          nextRuns
        }, null, 2));
      } else {
        console.log(`Expression: ${expression}`);
        console.log(`Description: ${parsed.description}`);
        console.log(`\nNext ${nextRuns.length} runs:`);
        nextRuns.forEach((run, i) => {
          console.log(`  ${i + 1}. ${run.toLocaleString()}`);
        });
      }
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      console.error(`Error: ${error.message}`);
      process.exit(1);
    }
  });

// Command: parse
program
  .command('parse <expression>')
  .description('Parse a cron expression and show all information')
  .option('-s, --seconds', 'Include seconds field')
  .option('-j, --json', 'Output as JSON')
  .action(async (expression, options) => {
    try {
      const opts = options.seconds ? { includeSeconds: true } : {};
      const parsed = parseCron(expression, opts);

      if (options.json) {
        console.log(JSON.stringify(parsed, null, 2));
      } else {
        console.log(`Expression: ${expression}`);
        console.log(`Description: ${parsed.description}`);

        if (parsed.isValid) {
          console.log(`\nFields:`);
          if (parsed.fields.seconds) {
            console.log(`  Seconds: ${parsed.fields.seconds.join(', ')}`);
          }
          console.log(`  Minutes: ${parsed.fields.minutes.join(', ')}`);
          console.log(`  Hours: ${parsed.fields.hours.join(', ')}`);
          console.log(`  Days of month: ${parsed.fields.daysOfMonth.join(', ')}`);
          console.log(`  Months: ${parsed.fields.months.join(', ')}`);
          console.log(`  Days of week: ${parsed.fields.daysOfWeek.join(', ')}`);

          console.log(`\nNext 5 runs:`);
          parsed.nextRuns.forEach((run, i) => {
            console.log(`  ${i + 1}. ${run.toLocaleString()}`);
          });
        } else {
          console.error('\nErrors:');
          for (const error of parsed.errors) {
            console.error(`  • ${error}`);
          }
        }
      }
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      console.error(`Error: ${error.message}`);
      process.exit(1);
    }
  });

program.parse(process.argv);
