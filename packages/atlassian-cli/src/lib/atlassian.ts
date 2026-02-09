/**
 * Shared Atlassian configuration for Jira and Confluence
 */

import { log } from '@uncskit/shared';

export interface AtlassianConfig {
  site: string;
  email: string;
  apiToken: string;
}

/**
 * Load Atlassian config from environment variables
 */
export function loadAtlassianConfig(): AtlassianConfig {
  const site = process.env.ATLASSIAN_SITE || '';
  const email = process.env.ATLASSIAN_EMAIL || '';
  const apiToken = process.env.ATLASSIAN_API_TOKEN || '';

  if (!site || !email || !apiToken) {
    log.error('Missing Atlassian credentials');
    log.blank();
    log.dim('  ATLASSIAN_SITE=your-site.atlassian.net');
    log.dim('  ATLASSIAN_EMAIL=you@example.com');
    log.dim('  ATLASSIAN_API_TOKEN=<token>');
    log.blank();
    log.dim('https://id.atlassian.com/manage-profile/security/api-tokens');
    process.exit(1);
  }

  return { site, email, apiToken };
}
