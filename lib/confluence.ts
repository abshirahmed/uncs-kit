/**
 * Confluence API client wrapper
 */

import { ConfluenceClient } from 'confluence.js';
import { loadAtlassianConfig, type AtlassianConfig } from './atlassian';

export type ConfluenceConfig = AtlassianConfig;

export interface PageInfo {
  id: string;
  title: string;
  body: string;
  version?: number;
  spaceKey?: string;
}

export interface SearchResult {
  id: string;
  title: string;
  spaceKey?: string;
}

/**
 * Load config from environment variables
 */
export const loadConfig = loadAtlassianConfig;

/**
 * Create Confluence client instance
 */
export function createClient(config: ConfluenceConfig): ConfluenceClient {
  return new ConfluenceClient({
    host: `https://${config.site}`,
    authentication: {
      basic: {
        email: config.email,
        apiToken: config.apiToken,
      },
    },
  });
}

/**
 * Get a single page by ID
 */
export async function getPage(
  client: ConfluenceClient,
  pageId: string
): Promise<PageInfo | null> {
  try {
    const page = await client.content.getContentById({
      id: pageId,
      expand: ['body.storage', 'version', 'space'],
    });

    return {
      id: page.id || pageId,
      title: page.title || 'Untitled',
      body: page.body?.storage?.value || '',
      version: page.version?.number,
      spaceKey: page.space?.key,
    };
  } catch {
    return null;
  }
}

/**
 * Search pages by query
 */
export async function searchPages(
  client: ConfluenceClient,
  query: string,
  limit = 25
): Promise<SearchResult[]> {
  try {
    const results = await client.content.searchContentByCQL({
      cql: `text ~ "${query}"`,
      limit,
    });

    return (results.results || []).map((page) => ({
      id: page.id || '',
      title: page.title || 'Untitled',
      spaceKey: page.space?.key,
    }));
  } catch {
    return [];
  }
}

/**
 * Get all pages in a space
 */
export async function getSpacePages(
  client: ConfluenceClient,
  spaceKey: string,
  limit = 25
): Promise<SearchResult[]> {
  try {
    const content = await client.content.getContent({
      spaceKey,
      type: 'page',
      limit,
    });

    return (content.results || []).map((page) => ({
      id: page.id || '',
      title: page.title || 'Untitled',
      spaceKey: page.space?.key,
    }));
  } catch {
    return [];
  }
}

/**
 * Get space info
 */
export async function getSpace(
  client: ConfluenceClient,
  spaceKey: string
): Promise<{ key: string; name: string } | null> {
  try {
    const spaces = await client.space.getSpaces({
      spaceKey: [spaceKey],
      limit: 1,
    });

    const space = spaces.results?.[0];
    if (!space) return null;

    return {
      key: space.key || spaceKey,
      name: space.name || spaceKey,
    };
  } catch {
    return null;
  }
}


export interface CreatePageParams {
  spaceKey: string;
  title: string;
  body: string; // HTML or storage format
  parentId?: string;
}

/**
 * Create a new page
 */
export async function createPage(
  client: ConfluenceClient,
  params: CreatePageParams
): Promise<PageInfo | null> {
  try {
    const result = await client.content.createContent({
      type: 'page',
      title: params.title,
      space: { key: params.spaceKey },
      body: {
        storage: {
          value: params.body,
          representation: 'storage',
        },
      },
      ancestors: params.parentId ? [{ id: params.parentId }] : undefined,
    });

    return {
      id: result.id || '',
      title: result.title || params.title,
      body: params.body,
      version: result.version?.number,
      spaceKey: params.spaceKey,
    };
  } catch (error) {
    const err = error as Error;
    log.error(`Failed to create page: ${err.message}`);
    return null;
  }
}

export interface UpdatePageParams {
  title?: string;
  body?: string;
}

/**
 * Update an existing page
 */
export async function updatePage(
  client: ConfluenceClient,
  pageId: string,
  params: UpdatePageParams
): Promise<PageInfo | null> {
  try {
    // First get current page to get version number
    const current = await getPage(client, pageId);
    if (!current) {
      log.error('Page not found');
      return null;
    }

    const result = await client.content.updateContent({
      id: pageId,
      type: 'page',
      title: params.title || current.title,
      version: { number: (current.version || 0) + 1 },
      body: params.body
        ? {
            storage: {
              value: params.body,
              representation: 'storage',
            },
          }
        : undefined,
    });

    return {
      id: result.id || pageId,
      title: result.title || current.title,
      body: params.body || current.body,
      version: result.version?.number,
      spaceKey: current.spaceKey,
    };
  } catch (error) {
    const err = error as Error;
    log.error(`Failed to update page: ${err.message}`);
    return null;
  }
}

/**
 * Delete a page
 */
export async function deletePage(
  client: ConfluenceClient,
  pageId: string
): Promise<boolean> {
  try {
    await client.content.deleteContent({ id: pageId });
    return true;
  } catch (error) {
    const err = error as Error;
    log.error(`Failed to delete page: ${err.message}`);
    return false;
  }
}
