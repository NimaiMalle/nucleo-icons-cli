import Database from 'better-sqlite3';
import { homedir } from 'os';
import { join } from 'path';

const NUCLEO_DB_PATH = join(
  homedir(),
  'Library/Application Support/Nucleo/icons/data.sqlite3'
);

const NUCLEO_ICONS_PATH = join(
  homedir(),
  'Library/Application Support/Nucleo/icons/sets'
);

export interface Icon {
  id: number;
  name: string;
  tags: string;
  nucleo_tags: string;
  set_id: number;
  favourite: boolean;
  width: number;
  height: number;
  set_title?: string;
  group_title?: string;
}

export interface IconWithRelevance extends Icon {
  relevance: number;
}

export interface ClusteredIcon {
  name: string;
  tags: string;
  styles: { group_title: string; set_title: string; id: number; set_id: number; path: string }[];
  relevance: number;
}

export interface IconSet {
  id: number;
  title: string;
  icons_count: number;
  local: boolean;
  demo: boolean;
  group_id?: number;
}

export interface IconGroup {
  id: number;
  title: string;
  sizes: string;
  icons_count: number;
}

export class NucleoDatabase {
  private db: Database.Database;

  constructor(dbPath: string = NUCLEO_DB_PATH) {
    try {
      this.db = new Database(dbPath, { readonly: true, fileMustExist: true });
    } catch (error) {
      throw new Error(
        `Failed to open Nucleo database at ${dbPath}. ` +
        `Make sure the Nucleo app is installed and you have downloaded the icon library.`
      );
    }
  }

  /**
   * Parse query into positive and negative terms
   * Terms starting with - are negated
   */
  private parseQuery(query: string): { positive: string[]; negative: string[] } {
    const terms = query.toLowerCase().split(/\s+/).filter(t => t.length > 0);
    const positive: string[] = [];
    const negative: string[] = [];

    for (const term of terms) {
      if (term.startsWith('-') && term.length > 1) {
        negative.push(term.slice(1));
      } else {
        positive.push(term);
      }
    }

    return { positive, negative };
  }

  /**
   * Check if a term matches anywhere in the icon's searchable fields
   */
  private termMatchesIcon(icon: Icon, term: string): boolean {
    const name = icon.name.toLowerCase();
    const tags = (icon.tags || '').toLowerCase();
    const nucleoTags = (icon.nucleo_tags || '').toLowerCase();
    const setTitle = (icon.set_title || '').toLowerCase();
    const groupTitle = (icon.group_title || '').toLowerCase();

    return name.includes(term) ||
           tags.includes(term) ||
           nucleoTags.includes(term) ||
           setTitle.includes(term) ||
           groupTitle.includes(term);
  }

  /**
   * Calculate relevance score for an icon based on query terms
   * Higher score = more relevant
   * Scores are based on: (1) how many terms match, (2) quality of match
   */
  private calculateRelevance(icon: Icon, positiveTerms: string[]): number {
    let score = 0;
    let matchCount = 0;
    const name = icon.name.toLowerCase();
    const tags = (icon.tags || '').toLowerCase();
    const nucleoTags = (icon.nucleo_tags || '').toLowerCase();
    const setTitle = (icon.set_title || '').toLowerCase();
    const groupTitle = (icon.group_title || '').toLowerCase();

    for (const term of positiveTerms) {
      let termScore = 0;

      // Exact name match (highest)
      if (name === term) {
        termScore = 100;
      }
      // Name starts with term
      else if (name.startsWith(term + '-') || name.startsWith(term)) {
        termScore = 50;
      }
      // Name contains term
      else if (name.includes(term)) {
        termScore = 30;
      }
      // Tag match
      else if (tags.includes(term) || nucleoTags.includes(term)) {
        termScore = 10;
      }
      // Set/group match (lowest - these are more like filters)
      else if (setTitle.includes(term) || groupTitle.includes(term)) {
        termScore = 5;
      }

      if (termScore > 0) {
        matchCount++;
        score += termScore;
      }
    }

    // Multiply by match count to heavily favor icons matching more terms
    // An icon matching 3 terms should rank much higher than one matching 1
    if (positiveTerms.length > 1 && matchCount > 0) {
      score *= matchCount;
    }

    return score;
  }

  /**
   * Search icons by name, tags, set title, or group title
   * Uses OR matching - icons matching ANY term are returned, ranked by match count
   * Supports negation with - prefix (e.g., "arrow -circle")
   * Returns results with relevance scoring
   */
  searchIcons(query: string, options: { set?: string; groupId?: number; setId?: number; limit?: number } = {}): IconWithRelevance[] {
    const { set, groupId, setId, limit = 50 } = options;
    const { positive, negative } = this.parseQuery(query);

    let sql = `
      SELECT
        i.id,
        i.name,
        i.tags,
        i.nucleo_tags,
        i.set_id,
        i.favourite,
        i.width,
        i.height,
        s.title as set_title,
        g.title as group_title
      FROM icons i
      LEFT JOIN sets s ON i.set_id = s.id
      LEFT JOIN groups g ON s.group_id = g.id
    `;

    const params: any[] = [];
    const whereClauses: string[] = [];

    // Build WHERE clause - match ANY positive term (OR), ranked by match count later
    if (positive.length > 0) {
      const termClauses = positive.map(() => `(
        i.name LIKE ?
        OR i.tags LIKE ?
        OR i.nucleo_tags LIKE ?
        OR s.title LIKE ?
        OR g.title LIKE ?
      )`);
      // Use OR between terms - any term matching is enough
      whereClauses.push(`(${termClauses.join(' OR ')})`);

      for (const term of positive) {
        const likeTerm = `%${term}%`;
        params.push(likeTerm, likeTerm, likeTerm, likeTerm, likeTerm);
      }
    }

    // Negative terms must NOT match anywhere (still AND for exclusions)
    for (const term of negative) {
      const likeTerm = `%${term}%`;
      whereClauses.push(`(
        i.name NOT LIKE ?
        AND (i.tags IS NULL OR i.tags NOT LIKE ?)
        AND (i.nucleo_tags IS NULL OR i.nucleo_tags NOT LIKE ?)
        AND (s.title IS NULL OR s.title NOT LIKE ?)
        AND (g.title IS NULL OR g.title NOT LIKE ?)
      )`);
      params.push(likeTerm, likeTerm, likeTerm, likeTerm, likeTerm);
    }

    if (whereClauses.length > 0) {
      sql += ` WHERE ${whereClauses.join(' AND ')}`;
    } else {
      sql += ` WHERE 1=1`;
    }

    if (set) {
      sql += ` AND s.title LIKE ?`;
      params.push(`%${set}%`);
    }

    if (groupId) {
      sql += ` AND s.group_id = ?`;
      params.push(groupId);
    }

    if (setId) {
      sql += ` AND i.set_id = ?`;
      params.push(setId);
    }

    // Get more results than limit to allow for relevance sorting
    sql += ` LIMIT ?`;
    params.push(limit * 20);

    const stmt = this.db.prepare(sql);
    const results = stmt.all(...params) as Icon[];

    // Calculate relevance and sort
    const withRelevance: IconWithRelevance[] = results.map(icon => ({
      ...icon,
      relevance: this.calculateRelevance(icon, positive)
    }));

    // Sort by relevance (descending), then by name
    withRelevance.sort((a, b) => {
      if (b.relevance !== a.relevance) {
        return b.relevance - a.relevance;
      }
      return a.name.localeCompare(b.name);
    });

    return withRelevance.slice(0, limit);
  }

  /**
   * Search and cluster results by icon name
   * Returns unique icon names with all available styles
   */
  searchIconsClustered(query: string, options: { set?: string; groupId?: number; setId?: number; limit?: number } = {}): ClusteredIcon[] {
    // Get more results to cluster from
    const results = this.searchIcons(query, { ...options, limit: (options.limit || 50) * 5 });

    // Group by icon name
    const clusters = new Map<string, ClusteredIcon>();

    for (const icon of results) {
      const existing = clusters.get(icon.name);
      // For ungrouped sets (specialty collections), use set title as group
      const groupTitle = icon.group_title || icon.set_title || `Set ${icon.set_id}`;
      if (existing) {
        // Add this style variant if not already present
        const hasStyle = existing.styles.some(s =>
          s.group_title === groupTitle && s.set_title === icon.set_title
        );
        if (!hasStyle) {
          existing.styles.push({
            group_title: groupTitle,
            set_title: icon.set_title || `Set ${icon.set_id}`,
            id: icon.id,
            set_id: icon.set_id,
            path: this.getIconPath(icon)
          });
        }
        // Keep highest relevance score
        if (icon.relevance > existing.relevance) {
          existing.relevance = icon.relevance;
        }
      } else {
        // Combine tags, prefer user tags over nucleo_tags
        const tags = icon.tags || icon.nucleo_tags || '';
        // For ungrouped sets (specialty collections), use set title as group
        const groupTitle = icon.group_title || icon.set_title || `Set ${icon.set_id}`;
        clusters.set(icon.name, {
          name: icon.name,
          tags,
          styles: [{
            group_title: groupTitle,
            set_title: icon.set_title || `Set ${icon.set_id}`,
            id: icon.id,
            set_id: icon.set_id,
            path: this.getIconPath(icon)
          }],
          relevance: icon.relevance
        });
      }
    }

    // Convert to array and sort by relevance
    const clustered = Array.from(clusters.values());
    clustered.sort((a, b) => {
      if (b.relevance !== a.relevance) {
        return b.relevance - a.relevance;
      }
      return a.name.localeCompare(b.name);
    });

    return clustered.slice(0, options.limit || 50);
  }

  /**
   * Get all icon sets
   */
  getSets(groupId?: number): IconSet[] {
    if (groupId) {
      const stmt = this.db.prepare(`
        SELECT id, title, icons_count, local, demo, group_id
        FROM sets
        WHERE group_id = ?
        ORDER BY title
      `);
      return stmt.all(groupId) as IconSet[];
    }

    const stmt = this.db.prepare(`
      SELECT id, title, icons_count, local, demo, group_id
      FROM sets
      ORDER BY title
    `);
    return stmt.all() as IconSet[];
  }

  /**
   * Get all icon groups (styles)
   */
  getGroups(): IconGroup[] {
    const stmt = this.db.prepare(`
      SELECT id, title, sizes, icons_count
      FROM groups
      ORDER BY title
    `);
    return stmt.all() as IconGroup[];
  }

  /**
   * Get sets that don't belong to any group (specialty collections)
   */
  getUngroupedSets(): IconSet[] {
    const stmt = this.db.prepare(`
      SELECT id, title, icons_count, local, demo, group_id
      FROM sets
      WHERE group_id IS NULL OR group_id = ''
      ORDER BY title
    `);
    return stmt.all() as IconSet[];
  }

  /**
   * Get icons from a specific set
   */
  getIconsFromSet(setId: number, limit: number = 100): Icon[] {
    const stmt = this.db.prepare(`
      SELECT
        i.id,
        i.name,
        i.tags,
        i.nucleo_tags,
        i.set_id,
        i.favourite,
        i.width,
        i.height,
        s.title as set_title
      FROM icons i
      LEFT JOIN sets s ON i.set_id = s.id
      WHERE i.set_id = ?
      ORDER BY i.name
      LIMIT ?
    `);
    return stmt.all(setId, limit) as Icon[];
  }

  /**
   * Get icon by exact name, optionally filtered by group or set
   */
  getIconByName(name: string, options: { groupId?: number; setId?: number } = {}): Icon | undefined {
    const { groupId, setId } = options;

    let sql = `
      SELECT
        i.id,
        i.name,
        i.tags,
        i.nucleo_tags,
        i.set_id,
        i.favourite,
        i.width,
        i.height,
        s.title as set_title,
        g.title as group_title
      FROM icons i
      LEFT JOIN sets s ON i.set_id = s.id
      LEFT JOIN groups g ON s.group_id = g.id
      WHERE i.name = ?
    `;
    const params: any[] = [name];

    if (groupId) {
      sql += ` AND s.group_id = ?`;
      params.push(groupId);
    }

    if (setId) {
      sql += ` AND i.set_id = ?`;
      params.push(setId);
    }

    sql += ` LIMIT 1`;

    const stmt = this.db.prepare(sql);
    return stmt.get(...params) as Icon | undefined;
  }

  /**
   * Get icon by ID
   */
  getIconById(id: number): Icon | undefined {
    const stmt = this.db.prepare(`
      SELECT
        i.id,
        i.name,
        i.tags,
        i.nucleo_tags,
        i.set_id,
        i.favourite,
        i.width,
        i.height,
        s.title as set_title,
        g.title as group_title
      FROM icons i
      LEFT JOIN sets s ON i.set_id = s.id
      LEFT JOIN groups g ON s.group_id = g.id
      WHERE i.id = ?
      LIMIT 1
    `);
    return stmt.get(id) as Icon | undefined;
  }

  /**
   * Get SVG file path for an icon
   */
  getIconPath(icon: Icon): string {
    return join(NUCLEO_ICONS_PATH, String(icon.set_id), `${icon.id}.svg`);
  }

  /**
   * Get statistics
   */
  getStats(groupId?: number): { totalIcons: number; totalSets: number } {
    if (groupId) {
      const icons = this.db.prepare(`
        SELECT COUNT(*) as count FROM icons i
        JOIN sets s ON i.set_id = s.id
        WHERE s.group_id = ?
      `).get(groupId) as { count: number };
      const sets = this.db.prepare('SELECT COUNT(*) as count FROM sets WHERE group_id = ?').get(groupId) as { count: number };

      return {
        totalIcons: icons.count,
        totalSets: sets.count
      };
    }

    const icons = this.db.prepare('SELECT COUNT(*) as count FROM icons').get() as { count: number };
    const sets = this.db.prepare('SELECT COUNT(*) as count FROM sets').get() as { count: number };

    return {
      totalIcons: icons.count,
      totalSets: sets.count
    };
  }

  close(): void {
    this.db.close();
  }
}

export const getNucleoDb = () => new NucleoDatabase();
