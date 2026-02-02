/**
 * HTML to Markdown converter using node-html-markdown
 */

import { NodeHtmlMarkdown } from 'node-html-markdown';

// Configure the converter
const nhm = new NodeHtmlMarkdown(
  {
    bulletMarker: '-',
    codeBlockStyle: 'fenced',
    strongDelimiter: '**',
    emDelimiter: '*',
  },
  // Custom transformers can be added here if needed
);

/**
 * Convert HTML to Markdown
 */
export function htmlToMarkdown(html: string): string {
  return nhm.translate(html);
}

/**
 * Sanitize a string for use as a filename
 */
export function sanitizeFilename(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .substring(0, 100);
}

/**
 * Generate frontmatter for a markdown file
 */
export function generateFrontmatter(metadata: Record<string, string>): string {
  const lines = ['---'];
  for (const [key, value] of Object.entries(metadata)) {
    // Escape quotes in values
    const escapedValue = value.replace(/"/g, '\\"');
    lines.push(`${key}: "${escapedValue}"`);
  }
  lines.push('---', '');
  return lines.join('\n');
}
