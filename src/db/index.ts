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
   * Search icons by name or tags
   */
  searchIcons(query: string, options: { set?: string; groupId?: number; setId?: number; limit?: number } = {}): Icon[] {
    const { set, groupId, setId, limit = 50 } = options;

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
        s.title as set_title
      FROM icons i
      LEFT JOIN sets s ON i.set_id = s.id
      WHERE (
        i.name LIKE ?
        OR i.tags LIKE ?
        OR i.nucleo_tags LIKE ?
      )
    `;

    const params: any[] = [`%${query}%`, `%${query}%`, `%${query}%`];

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

    sql += ` ORDER BY i.name LIMIT ?`;
    params.push(limit);

    const stmt = this.db.prepare(sql);
    return stmt.all(...params) as Icon[];
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
   * Get icon by exact name
   */
  getIconByName(name: string): Icon | undefined {
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
      WHERE i.name = ?
      LIMIT 1
    `);
    return stmt.get(name) as Icon | undefined;
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
