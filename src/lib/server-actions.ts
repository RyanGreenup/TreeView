"use server";

import Database from "better-sqlite3";
import type { TreeNode } from "~/components/tree/types";

let db: Database.Database | null = null;

/*
If the sqlite database is ../../notes.sqlite the schema will be:

```sql
CREATE TABLE notes (
        id TEXT PRIMARY KEY,
        label TEXT NOT NULL,
        parent_id TEXT,
        FOREIGN KEY (parent_id) REFERENCES notes (id)
    );
```
*/
// Initialize the database connection
function getDb(): Database.Database {
  if (!db) {
    const dbPath = process.env.DB_PATH;
    if (!dbPath) {
      throw new Error("DB_PATH environment variable is not set");
    }

    db = new Database(dbPath);
  }
  return db;
}

interface DbNote {
  id: string;
  label: string;
  parent_id: string | null;
}

function hasChildrenInDb(database: Database.Database, parentId: string): boolean {
  const count = database
    .prepare(`SELECT COUNT(*) as count FROM notes WHERE parent_id = ?`)
    .get(parentId) as { count: number };

  return count.count > 0;
}

/**
 * Get all note IDs that match the filter or have descendants that match
 * This includes the full path from root to matching nodes
 */
function getFilteredNoteIds(database: Database.Database, filter: string): Set<string> {
  const matchingIds = new Set<string>();
  
  // First, find all notes that directly match the filter
  const directMatches = database
    .prepare(`SELECT id FROM notes WHERE label LIKE ?`)
    .all(`%${filter.trim()}%`) as { id: string }[];
  
  // Add all direct matches
  directMatches.forEach(match => matchingIds.add(match.id));
  
  // For each matching note, add all its ancestors (parents up to root)
  directMatches.forEach(match => {
    addAncestors(database, match.id, matchingIds);
  });
  
  return matchingIds;
}

/**
 * Recursively add all ancestors of a note to the set
 */
function addAncestors(database: Database.Database, noteId: string, matchingIds: Set<string>): void {
  const parent = database
    .prepare(`SELECT parent_id FROM notes WHERE id = ?`)
    .get(noteId) as { parent_id: string | null } | undefined;
  
  if (parent && parent.parent_id) {
    matchingIds.add(parent.parent_id);
    addAncestors(database, parent.parent_id, matchingIds);
  }
}

/**
 * Check if a node has any filtered children (direct or indirect)
 */
function hasFilteredChildren(database: Database.Database, parentId: string, filteredIds: Set<string>): boolean {
  const children = database
    .prepare(`SELECT id FROM notes WHERE parent_id = ?`)
    .all(parentId) as { id: string }[];
  
  return children.some(child => filteredIds.has(child.id));
}

export async function loadTreeChildren(nodeId: string, filter?: string): Promise<TreeNode[]> {
  const database = getDb();

  // If no filter, use simple query
  if (!filter || !filter.trim()) {
    const parentCondition = nodeId === "__virtual_root__" ? "parent_id IS NULL" : "parent_id = ?";
    const params = nodeId === "__virtual_root__" ? [] : [nodeId];
    
    const notes = database
      .prepare(`
        SELECT * FROM notes
        WHERE ${parentCondition}
        ORDER BY label
      `)
      .all(...params) as DbNote[];

    const result: TreeNode[] = [];

    for (const note of notes) {
      const hasChildren = hasChildrenInDb(database, note.id);
      result.push({
        id: note.id,
        label: note.label || "Untitled",
        hasChildren,
        level: 0,
        type: "note"
      });
    }

    return result;
  }

  // With filter: get all matching nodes and their ancestors
  const filteredIds = getFilteredNoteIds(database, filter);
  
  // Handle virtual root - return top-level items that are in filtered set
  if (nodeId === "__virtual_root__") {
    const notes = database
      .prepare(`
        SELECT * FROM notes
        WHERE parent_id IS NULL
        ORDER BY label
      `)
      .all() as DbNote[];

    const result: TreeNode[] = [];

    for (const note of notes) {
      // Include this node if it's in the filtered set
      if (filteredIds.has(note.id)) {
        // Check if it has children in the filtered set
        const hasChildren = hasFilteredChildren(database, note.id, filteredIds);
        result.push({
          id: note.id,
          label: note.label || "Untitled",
          hasChildren,
          level: 0,
          type: "note"
        });
      }
    }

    return result;
  }

  // Find children for a specific parent that are in the filtered set
  const notes = database
    .prepare(`
      SELECT * FROM notes
      WHERE parent_id = ?
      ORDER BY label
    `)
    .all(nodeId) as DbNote[];

  const result: TreeNode[] = [];

  for (const note of notes) {
    // Include this node if it's in the filtered set
    if (filteredIds.has(note.id)) {
      // Check if it has children in the filtered set
      const hasChildren = hasFilteredChildren(database, note.id, filteredIds);
      result.push({
        id: note.id,
        label: note.label || "Untitled",
        hasChildren,
        level: 0,
        type: "note"
      });
    }
  }

  return result;
}

export async function moveItem(sourceId: string, targetId: string): Promise<boolean> {
  const database = getDb();

  try {
    const newParentId = targetId === "__virtual_root__" ? null : targetId;

    database
      .prepare(`UPDATE notes SET parent_id = ? WHERE id = ?`)
      .run(newParentId, sourceId);

    return true;
  } catch (error) {
    console.error("Error moving item:", error);
    return false;
  }
}

export async function renameItem(nodeId: string, newLabel: string): Promise<boolean> {
  const database = getDb();

  try {
    database
      .prepare(`UPDATE notes SET label = ? WHERE id = ?`)
      .run(newLabel.trim(), nodeId);

    return true;
  } catch (error) {
    console.error("Error renaming item:", error);
    return false;
  }
}

export async function createNewItem(parentId: string, type: "folder" | "note" = "note"): Promise<string | null> {
  const database = getDb();

  try {
    const id = `new-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const newParentId = parentId === "__virtual_root__" ? null : parentId;

    database
      .prepare(`
        INSERT INTO notes (id, label, parent_id)
        VALUES (?, ?, ?)
      `)
      .run(id, "New Note", newParentId);

    return id;
  } catch (error) {
    console.error("Error creating new item:", error);
    return null;
  }
}

export async function deleteItem(nodeId: string): Promise<boolean> {
  const database = getDb();

  try {
    // Delete all descendants first
    await deleteDescendants(database, nodeId);

    // Delete the item itself
    database
      .prepare(`DELETE FROM notes WHERE id = ?`)
      .run(nodeId);

    return true;
  } catch (error) {
    console.error("Error deleting item:", error);
    return false;
  }
}

async function deleteDescendants(database: Database.Database, parentId: string): Promise<void> {
  // Get all children
  const children = database
    .prepare(`SELECT id FROM notes WHERE parent_id = ?`)
    .all(parentId) as { id: string }[];

  // Recursively delete each child and their descendants
  for (const child of children) {
    await deleteDescendants(database, child.id);
    database
      .prepare(`DELETE FROM notes WHERE id = ?`)
      .run(child.id);
  }
}
