/**
 * Jira API client wrapper (V3)
 */

import { Version3Client } from 'jira.js';
import { loadAtlassianConfig, type AtlassianConfig } from './atlassian.ts';
import { log } from '@uncskit/shared';

const STORY_POINTS_FIELD = process.env.JIRA_STORY_POINTS_FIELD ?? "customfield_10031";

export type JiraConfig = AtlassianConfig;

export interface IssueInfo {
  id: string;
  key: string;
  summary: string;
  status: string;
  issueType: string;
  priority?: string;
  assignee?: string;
  reporter?: string;
  description?: string;
  created?: string;
  updated?: string;
  labels?: string[];
  storyPoints?: number;
  url: string;
}

export interface ProjectInfo {
  id: string;
  key: string;
  name: string;
  issueTypes: { id: string; name: string }[];
}

export interface SearchResult {
  total: number;
  issues: IssueInfo[];
}

export interface CreateIssueParams {
  projectKey: string;
  issueType: string;
  summary: string;
  description?: string | object; // string for plain text, object for ADF
  priority?: string;
  labels?: string[];
  assigneeAccountId?: string;
  parentKey?: string; // Parent issue key (epic for stories, story for subtasks)
  storyPoints?: number; // Story points (custom field)
}

/**
 * Load config from environment variables
 */
export const loadConfig = loadAtlassianConfig;

/**
 * Create Jira V3 client instance
 */
export function createClient(config: JiraConfig): Version3Client {
  return new Version3Client({
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
 * Convert markdown to ADF (Atlassian Document Format)
 * Simple conversion for common elements
 */
export function markdownToAdf(markdown: string): object {
  const lines = markdown.split('\n');
  const content: object[] = [];
  let inCodeBlock = false;
  let codeBlockContent: string[] = [];
  let codeBlockLang = '';
  let currentBulletList: object[] | null = null;

  const flushBulletList = () => {
    if (currentBulletList && currentBulletList.length > 0) {
      content.push({
        type: 'bulletList',
        content: currentBulletList,
      });
      currentBulletList = null;
    }
  };

  for (const line of lines) {
    // Code block start/end
    if (line.startsWith('```')) {
      flushBulletList();
      if (inCodeBlock) {
        // End code block
        content.push({
          type: 'codeBlock',
          attrs: { language: codeBlockLang || 'text' },
          content: [{ type: 'text', text: codeBlockContent.join('\n') }],
        });
        codeBlockContent = [];
        codeBlockLang = '';
        inCodeBlock = false;
      } else {
        // Start code block
        inCodeBlock = true;
        codeBlockLang = line.slice(3).trim();
      }
      continue;
    }

    if (inCodeBlock) {
      codeBlockContent.push(line);
      continue;
    }

    // Empty line = paragraph break (and ends bullet list)
    if (line.trim() === '') {
      flushBulletList();
      continue;
    }

    // Headers
    const h1Match = line.match(/^# (.+)$/);
    const h2Match = line.match(/^## (.+)$/);
    const h3Match = line.match(/^### (.+)$/);

    if (h1Match) {
      flushBulletList();
      content.push({
        type: 'heading',
        attrs: { level: 1 },
        content: [{ type: 'text', text: h1Match[1] }],
      });
      continue;
    }
    if (h2Match) {
      flushBulletList();
      content.push({
        type: 'heading',
        attrs: { level: 2 },
        content: [{ type: 'text', text: h2Match[1] }],
      });
      continue;
    }
    if (h3Match) {
      flushBulletList();
      content.push({
        type: 'heading',
        attrs: { level: 3 },
        content: [{ type: 'text', text: h3Match[1] }],
      });
      continue;
    }

    // Bullet list item - accumulate into single list
    const bulletMatch = line.match(/^[-*] (.+)$/);
    if (bulletMatch) {
      if (!currentBulletList) {
        currentBulletList = [];
      }
      currentBulletList.push({
        type: 'listItem',
        content: [
          {
            type: 'paragraph',
            content: parseInlineContent(bulletMatch[1]!),
          },
        ],
      });
      continue;
    }

    // Regular paragraph (ends bullet list)
    flushBulletList();
    content.push({
      type: 'paragraph',
      content: parseInlineContent(line),
    });
  }

  // Flush any remaining bullet list
  flushBulletList();

  return {
    type: 'doc',
    version: 1,
    content,
  };
}

/**
 * Parse inline markdown content (bold, italic, code, links)
 */
function parseInlineContent(text: string): object[] {
  const result: object[] = [];
  let remaining = text;

  while (remaining.length > 0) {
    // Inline code
    const codeMatch = remaining.match(/^`([^`]+)`/);
    if (codeMatch) {
      result.push({
        type: 'text',
        text: codeMatch[1],
        marks: [{ type: 'code' }],
      });
      remaining = remaining.slice(codeMatch[0].length);
      continue;
    }

    // Bold
    const boldMatch = remaining.match(/^\*\*([^*]+)\*\*/);
    if (boldMatch) {
      result.push({
        type: 'text',
        text: boldMatch[1],
        marks: [{ type: 'strong' }],
      });
      remaining = remaining.slice(boldMatch[0].length);
      continue;
    }

    // Link
    const linkMatch = remaining.match(/^\[([^\]]+)\]\(([^)]+)\)/);
    if (linkMatch) {
      result.push({
        type: 'text',
        text: linkMatch[1],
        marks: [{ type: 'link', attrs: { href: linkMatch[2] } }],
      });
      remaining = remaining.slice(linkMatch[0].length);
      continue;
    }

    // Plain text (up to next special char or end)
    const plainMatch = remaining.match(/^[^`*\[]+/);
    if (plainMatch) {
      result.push({ type: 'text', text: plainMatch[0] });
      remaining = remaining.slice(plainMatch[0].length);
      continue;
    }

    // Single special char that didn't match a pattern
    result.push({ type: 'text', text: remaining[0] });
    remaining = remaining.slice(1);
  }

  return result.length > 0 ? result : [{ type: 'text', text: ' ' }];
}

/**
 * Get a single issue by key or ID
 */
export async function getIssue(
  client: Version3Client,
  issueIdOrKey: string
): Promise<IssueInfo | null> {
  try {
    const issue = await client.issues.getIssue({
      issueIdOrKey,
      fields: [
        'summary',
        'status',
        'issuetype',
        'priority',
        'assignee',
        'reporter',
        'description',
        'created',
        'updated',
        'labels',
        STORY_POINTS_FIELD, // Story points
      ],
    });

    const config = loadConfig();

    return {
      id: issue.id || issueIdOrKey,
      key: issue.key || issueIdOrKey,
      summary: issue.fields?.summary || 'No summary',
      status: issue.fields?.status?.name || 'Unknown',
      issueType: issue.fields?.issuetype?.name || 'Unknown',
      priority: issue.fields?.priority?.name,
      assignee: issue.fields?.assignee?.displayName,
      reporter: issue.fields?.reporter?.displayName,
      description: extractTextFromAdf(issue.fields?.description),
      created: issue.fields?.created,
      updated: issue.fields?.updated,
      labels: issue.fields?.labels,
      storyPoints: (issue.fields as Record<string, unknown>)?.[STORY_POINTS_FIELD] as number | undefined,
      url: `https://${config.site}/browse/${issue.key}`,
    };
  } catch {
    return null;
  }
}

/**
 * Extract plain text from ADF content
 */
function extractTextFromAdf(adf: unknown): string | undefined {
  if (!adf || typeof adf !== 'object') return undefined;

  const doc = adf as { content?: unknown[] };
  if (!doc.content) return undefined;

  const extractNode = (node: unknown, depth = 0): string => {
    if (!node || typeof node !== 'object') return '';
    const n = node as { type?: string; text?: string; content?: unknown[] };

    if (n.type === 'text' && n.text) return n.text;

    if (n.type === 'bulletList' && n.content) {
      return n.content.map((item) => '- ' + extractNode(item, depth + 1)).join('\n') + '\n';
    }

    if (n.type === 'listItem' && n.content) {
      return n.content.map((c) => extractNode(c, depth)).join('').trim();
    }

    if (n.type === 'paragraph' && n.content) {
      return n.content.map((c) => extractNode(c, depth)).join('');
    }

    if (n.type === 'heading' && n.content) {
      return n.content.map((c) => extractNode(c, depth)).join('');
    }

    if (n.content) return n.content.map((c) => extractNode(c, depth)).join('');
    return '';
  };

  return doc.content
    .map((node) => {
      const n = node as { type?: string };
      const text = extractNode(node);
      if (n.type === 'paragraph' || n.type === 'heading') return text + '\n';
      if (n.type === 'bulletList') return text;
      return text;
    })
    .join('')
    .trim();
}

/**
 * Search issues using JQL
 */
export async function searchIssues(
  client: Version3Client,
  jql: string,
  maxResults = 50
): Promise<SearchResult> {
  try {
    // Use the new enhanced search endpoint (replaces deprecated /search)
    const response = await client.issueSearch.searchForIssuesUsingJqlEnhancedSearchPost({
      jql,
      maxResults,
      fields: ['summary', 'status', 'issuetype', 'priority', 'assignee', 'created', 'labels'],
    });

    const config = loadConfig();
    const issues: IssueInfo[] = (response.issues || []).map((issue) => ({
      id: String(issue.id || ''),
      key: issue.key || '',
      summary: issue.fields?.summary || 'No summary',
      status: issue.fields?.status?.name || 'Unknown',
      issueType: issue.fields?.issuetype?.name || 'Unknown',
      priority: issue.fields?.priority?.name,
      assignee: issue.fields?.assignee?.displayName,
      created: issue.fields?.created,
      labels: issue.fields?.labels as string[] | undefined,
      url: `https://${config.site}/browse/${issue.key}`,
    }));

    return {
      total: issues.length, // New API doesn't return total, use issue count
      issues,
    };
  } catch (error) {
    const err = error as Error & { response?: { data?: unknown } };
    log.error(`Search failed: ${err.message}`);
    if (err.response?.data) {
      log.dim(JSON.stringify(err.response.data, null, 2));
    }
    return { total: 0, issues: [] };
  }
}

/**
 * Get visible projects
 */
export async function getProjects(client: Version3Client): Promise<ProjectInfo[]> {
  try {
    const response = await client.projects.searchProjects({
      maxResults: 100,
      expand: 'issueTypes',
    });

    return (response.values || []).map((project) => ({
      id: project.id || '',
      key: project.key || '',
      name: project.name || '',
      issueTypes: (project.issueTypes || []).map((it) => ({
        id: it.id || '',
        name: it.name || '',
      })),
    }));
  } catch {
    return [];
  }
}

/**
 * Create a new issue
 */
export async function createIssue(
  client: Version3Client,
  params: CreateIssueParams
): Promise<IssueInfo | null> {
  try {
    const fields: Record<string, unknown> = {
      project: { key: params.projectKey },
      issuetype: { name: params.issueType },
      summary: params.summary,
    };

    if (params.description) {
      fields.description =
        typeof params.description === 'string'
          ? markdownToAdf(params.description)
          : params.description;
    }

    if (params.priority) {
      fields.priority = { name: params.priority };
    }

    if (params.labels && params.labels.length > 0) {
      fields.labels = params.labels;
    }

    if (params.assigneeAccountId) {
      fields.assignee = { accountId: params.assigneeAccountId };
    }

    if (params.parentKey) {
      fields.parent = { key: params.parentKey };
    }

    if (params.storyPoints !== undefined) {
      fields[STORY_POINTS_FIELD] = params.storyPoints;
    }

    const response = await client.issues.createIssue({
      fields: fields as Parameters<typeof client.issues.createIssue>[0]['fields'],
    });

    if (response.key) {
      return getIssue(client, response.key);
    }

    return null;
  } catch (error) {
    const err = error as Error;
    log.error(`Failed to create issue: ${err.message}`);
    return null;
  }
}

/**
 * Lookup user account ID by email or name
 */
export async function findUser(
  client: Version3Client,
  query: string
): Promise<{ accountId: string; displayName: string; email?: string } | null> {
  try {
    const users = await client.userSearch.findUsers({ query, maxResults: 1 });
    const user = users[0];
    if (!user) return null;

    return {
      accountId: user.accountId || '',
      displayName: user.displayName || '',
      email: user.emailAddress,
    };
  } catch {
    return null;
  }
}


/**
 * Delete an issue
 */
export async function deleteIssue(
  client: Version3Client,
  issueIdOrKey: string
): Promise<boolean> {
  try {
    await client.issues.deleteIssue({ issueIdOrKey });
    return true;
  } catch (error) {
    const err = error as Error;
    log.error(`Failed to delete issue: ${err.message}`);
    return false;
  }
}


export interface UpdateIssueParams {
  summary?: string;
  description?: string | object;
  priority?: string;
  labels?: string[];
  assigneeAccountId?: string | null; // null to unassign
  storyPoints?: number;
}

/**
 * Update an existing issue
 */
export async function updateIssue(
  client: Version3Client,
  issueIdOrKey: string,
  params: UpdateIssueParams
): Promise<boolean> {
  try {
    const fields: Record<string, unknown> = {};

    if (params.summary) {
      fields.summary = params.summary;
    }

    if (params.description) {
      fields.description =
        typeof params.description === 'string'
          ? markdownToAdf(params.description)
          : params.description;
    }

    if (params.priority) {
      fields.priority = { name: params.priority };
    }

    if (params.labels !== undefined) {
      fields.labels = params.labels;
    }

    if (params.assigneeAccountId !== undefined) {
      fields.assignee = params.assigneeAccountId ? { accountId: params.assigneeAccountId } : null;
    }

    if (params.storyPoints !== undefined) {
      fields[STORY_POINTS_FIELD] = params.storyPoints;
    }

    await client.issues.editIssue({ issueIdOrKey, fields });
    return true;
  } catch (error) {
    const err = error as Error;
    log.error(`Failed to update issue: ${err.message}`);
    return false;
  }
}
