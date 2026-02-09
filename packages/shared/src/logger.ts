/**
 * Logger utility for consistent CLI output
 * Based on clickhouse-schema-sync patterns
 */

import chalk from 'chalk';
import Table from 'cli-table3';
import ora, { type Ora } from 'ora';

/**
 * Logger utility for consistent CLI output
 */
export const log = {
  // Headers
  title: (text: string) => console.log(chalk.bold.cyan(`\n${text}`)),
  subtitle: () => console.log(chalk.dim('─'.repeat(50))),

  // Status messages
  info: (text: string) => console.log(chalk.blue('ℹ'), text),
  success: (text: string) => console.log(chalk.green('✓'), text),
  warning: (text: string) => console.log(chalk.yellow('⚠'), text),
  error: (text: string) => console.log(chalk.red('✗'), text),

  // Data display
  dim: (text: string) => console.log(chalk.dim(text)),
  highlight: (text: string) => console.log(chalk.bold.white(text)),

  // Lists
  item: (text: string) => console.log(chalk.gray('  •'), text),
  arrow: (text: string) => console.log(chalk.yellow('   →'), chalk.white(text)),

  // New line
  blank: () => console.log(),

  // Raw output (no formatting)
  raw: (text: string) => console.log(text),

  // Step progress
  step: (current: number, total: number, text: string) =>
    console.log(chalk.cyan(`[${current}/${total}]`), text),
};

/**
 * Create a spinner for async operations
 */
export function spinner(text: string): Ora {
  return ora({
    text,
    color: 'cyan',
    spinner: 'dots',
  });
}

/**
 * Create a table for displaying data
 */
export function createTable(headers: string[]): Table.Table {
  return new Table({
    head: headers.map((header) => chalk.cyan(header)),
    style: {
      head: [],
      border: ['gray'],
    },
  });
}

/**
 * Display a summary box
 */
export function summaryBox(title: string, stats: Record<string, number | string>): void {
  const BOX_WIDTH = 40;

  log.blank();
  console.log(chalk.bold.cyan('┌' + '─'.repeat(BOX_WIDTH) + '┐'));

  const titleText = ` ${title}`;
  const titlePad = BOX_WIDTH - titleText.length;
  console.log(
    chalk.bold.cyan('│') + chalk.bold(titleText) + ' '.repeat(titlePad) + chalk.bold.cyan('│')
  );

  console.log(chalk.bold.cyan('├' + '─'.repeat(BOX_WIDTH) + '┤'));

  Object.entries(stats).forEach(([key, value]) => {
    const isError = key.toLowerCase().includes('fail');
    const valueColor = isError ? chalk.red : chalk.green;
    const line = `  ${key}: ${valueColor(String(value))}`;
    // Account for ANSI codes in padding calculation
    const visibleLength = `  ${key}: ${String(value)}`.length;
    const linePad = BOX_WIDTH - visibleLength;
    console.log(chalk.cyan('│') + line + ' '.repeat(Math.max(0, linePad)) + chalk.cyan('│'));
  });

  console.log(chalk.cyan('└' + '─'.repeat(BOX_WIDTH) + '┘'));
}

/**
 * Display a list of items with a header
 */
export function itemList(header: string, items: string[]): void {
  if (items.length === 0) return;

  log.blank();
  log.highlight(`${header} (${items.length}):`);
  items.forEach((item) => log.arrow(item));
}
