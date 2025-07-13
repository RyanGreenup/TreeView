import Database from "better-sqlite3";
import type { TreeNode } from "~/components/tree/types";

let db: Database.Database | null = null;

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
  parent_id: string;
  title: string;
  body: string;
  created_time: number;
  updated_time: number;
  is_conflict: number;
  latitude: number;
  longitude: number;
  altitude: number;
  author: string;
  source_url: string;
  is_todo: number;
  todo_due: number;
  todo_completed: number;
  source: string;
  source_application: string;
  application_data: string;
  order: number;
  user_created_time: number;
  user_updated_time: number;
  encryption_cipher_text: string;
  encryption_applied: number;
  markup_language: number;
  is_shared: number;
  share_id: string;
  conflict_original_id: string;
  master_key_id: string;
  user_data: string;
  deleted_time: number;
}

interface DbFolder {
  id: string;
  title: string;
  created_time: number;
  updated_time: number;
  user_created_time: number;
  user_updated_time: number;
  encryption_cipher_text: string;
  encryption_applied: number;
  parent_id: string;
  is_shared: number;
  share_id: string;
  master_key_id: string;
  icon: string;
  user_data: string;
  deleted_time: number;
}

export async function loadTreeChildren(nodeId: string): Promise<TreeNode[]> {
  "use server";
  
  const database = getDb();
  
  // Handle virtual root - return top-level items (both folders and notes with empty parent_id)
  if (nodeId === "__virtual_root__") {
    // Get top-level folders
    const folders = database
      .prepare(`
        SELECT * FROM folders 
        WHERE parent_id = '' AND deleted_time = 0
        ORDER BY title
      `)
      .all() as DbFolder[];
    
    // Get top-level notes
    const notes = database
      .prepare(`
        SELECT * FROM notes 
        WHERE parent_id = '' AND deleted_time = 0
        ORDER BY title
      `)
      .all() as DbNote[];
    
    const result: TreeNode[] = [];
    
    // Add folders first
    for (const folder of folders) {
      const hasChildren = hasChildrenInDb(database, folder.id);
      result.push({
        id: folder.id,
        label: folder.title || "Untitled Folder",
        hasChildren,
        level: 0,
        type: "folder"
      });
    }
    
    // Add notes
    for (const note of notes) {
      result.push({
        id: note.id,
        label: note.title || "Untitled Note",
        hasChildren: false,
        level: 0,
        type: "note"
      });
    }
    
    return result;
  }
  
  // Find children for a specific parent
  const folders = database
    .prepare(`
      SELECT * FROM folders 
      WHERE parent_id = ? AND deleted_time = 0
      ORDER BY title
    `)
    .all(nodeId) as DbFolder[];
  
  const notes = database
    .prepare(`
      SELECT * FROM notes 
      WHERE parent_id = ? AND deleted_time = 0
      ORDER BY title
    `)
    .all(nodeId) as DbNote[];
  
  const result: TreeNode[] = [];
  
  // Add folders first
  for (const folder of folders) {
    const hasChildren = hasChildrenInDb(database, folder.id);
    result.push({
      id: folder.id,
      label: folder.title || "Untitled Folder",
      hasChildren,
      level: 0,
      type: "folder"
    });
  }
  
  // Add notes
  for (const note of notes) {
    result.push({
      id: note.id,
      label: note.title || "Untitled Note", 
      hasChildren: false,
      level: 0,
      type: "note"
    });
  }
  
  return result;
}

function hasChildrenInDb(database: Database.Database, parentId: string): boolean {
  const folderCount = database
    .prepare(`SELECT COUNT(*) as count FROM folders WHERE parent_id = ? AND deleted_time = 0`)
    .get(parentId) as { count: number };
  
  const noteCount = database
    .prepare(`SELECT COUNT(*) as count FROM notes WHERE parent_id = ? AND deleted_time = 0`)
    .get(parentId) as { count: number };
  
  return (folderCount.count + noteCount.count) > 0;
}

export async function moveItem(sourceId: string, targetId: string): Promise<boolean> {
  "use server";
  
  const database = getDb();
  
  try {
    // Check if source is a folder or note
    const folder = database
      .prepare(`SELECT id FROM folders WHERE id = ? AND deleted_time = 0`)
      .get(sourceId);
    
    const newParentId = targetId === "__virtual_root__" ? "" : targetId;
    
    if (folder) {
      // Move folder
      database
        .prepare(`UPDATE folders SET parent_id = ?, updated_time = ? WHERE id = ?`)
        .run(newParentId, Date.now(), sourceId);
    } else {
      // Move note
      database
        .prepare(`UPDATE notes SET parent_id = ?, updated_time = ? WHERE id = ?`)
        .run(newParentId, Date.now(), sourceId);
    }
    
    return true;
  } catch (error) {
    console.error("Error moving item:", error);
    return false;
  }
}

export async function renameItem(nodeId: string, newLabel: string): Promise<boolean> {
  "use server";
  
  const database = getDb();
  
  try {
    // Check if it's a folder or note
    const folder = database
      .prepare(`SELECT id FROM folders WHERE id = ? AND deleted_time = 0`)
      .get(nodeId);
    
    if (folder) {
      // Rename folder
      database
        .prepare(`UPDATE folders SET title = ?, updated_time = ? WHERE id = ?`)
        .run(newLabel.trim(), Date.now(), nodeId);
    } else {
      // Rename note
      database
        .prepare(`UPDATE notes SET title = ?, updated_time = ? WHERE id = ?`)
        .run(newLabel.trim(), Date.now(), nodeId);
    }
    
    return true;
  } catch (error) {
    console.error("Error renaming item:", error);
    return false;
  }
}

export async function createNewItem(parentId: string, type: "folder" | "note" = "note"): Promise<string | null> {
  "use server";
  
  const database = getDb();
  
  try {
    const id = `new-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const now = Date.now();
    const newParentId = parentId === "__virtual_root__" ? "" : parentId;
    
    if (type === "folder") {
      database
        .prepare(`
          INSERT INTO folders (id, title, created_time, updated_time, user_created_time, user_updated_time, parent_id)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `)
        .run(id, "New Folder", now, now, now, now, newParentId);
    } else {
      database
        .prepare(`
          INSERT INTO notes (id, title, body, created_time, updated_time, user_created_time, user_updated_time, parent_id)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `)
        .run(id, "New Note", "", now, now, now, now, newParentId);
    }
    
    return id;
  } catch (error) {
    console.error("Error creating new item:", error);
    return null;
  }
}

export async function deleteItem(nodeId: string): Promise<boolean> {
  "use server";
  
  const database = getDb();
  
  try {
    const now = Date.now();
    
    // Soft delete by setting deleted_time
    // First try folders
    const folderResult = database
      .prepare(`UPDATE folders SET deleted_time = ? WHERE id = ?`)
      .run(now, nodeId);
    
    if (folderResult.changes === 0) {
      // If no folder was updated, try notes
      database
        .prepare(`UPDATE notes SET deleted_time = ? WHERE id = ?`)
        .run(now, nodeId);
    }
    
    // Also delete all descendants recursively
    await deleteDescendants(database, nodeId, now);
    
    return true;
  } catch (error) {
    console.error("Error deleting item:", error);
    return false;
  }
}

async function deleteDescendants(database: Database.Database, parentId: string, deletedTime: number): Promise<void> {
  // Get all folder children
  const folderChildren = database
    .prepare(`SELECT id FROM folders WHERE parent_id = ? AND deleted_time = 0`)
    .all(parentId) as { id: string }[];
  
  // Get all note children
  const noteChildren = database
    .prepare(`SELECT id FROM notes WHERE parent_id = ? AND deleted_time = 0`)
    .all(parentId) as { id: string }[];
  
  // Delete folder children
  for (const child of folderChildren) {
    database
      .prepare(`UPDATE folders SET deleted_time = ? WHERE id = ?`)
      .run(deletedTime, child.id);
    
    // Recursively delete their descendants
    await deleteDescendants(database, child.id, deletedTime);
  }
  
  // Delete note children
  for (const child of noteChildren) {
    database
      .prepare(`UPDATE notes SET deleted_time = ? WHERE id = ?`)
      .run(deletedTime, child.id);
  }
}