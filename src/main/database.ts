import { app } from 'electron'
import { join } from 'path'
import { existsSync, mkdirSync, writeFileSync, readFileSync } from 'fs'
import { parseFile } from 'music-metadata'

let Database: any = null
try {
  Database = require('better-sqlite3')
} catch (e) {
  // Native module not available in dev mode
  Database = null
}
let db: any = null
const coverDir = join(app.getPath('userData'), 'covers')

// Initialize database with schema
export function initDatabase(): any {
  if (!Database) {
    console.warn('better-sqlite3 not available, using memory-only mode')
    return null
  }
  
  const dbPath = join(app.getPath('userData'), 'music-library.db')
  db = new Database(dbPath)
  
  // Performance optimizations
  db.pragma('journal_mode = WAL')
  db.pragma('cache_size = -64000')
  
  // Create schema
  db.exec(`
    CREATE TABLE IF NOT EXISTS tracks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      file_path TEXT UNIQUE NOT NULL,
      title TEXT,
      artist TEXT,
      album TEXT,
      duration_ms INTEGER,
      cover_cached INTEGER DEFAULT 0,
      mtime INTEGER
    );
    CREATE INDEX IF NOT EXISTS idx_tracks_artist ON tracks(artist);
    CREATE INDEX IF NOT EXISTS idx_tracks_album ON tracks(album);
    CREATE INDEX IF NOT EXISTS idx_tracks_title ON tracks(title);
  `)
  
  // Create cover directory
  if (!existsSync(coverDir)) {
    mkdirSync(coverDir, { recursive: true })
  }
  
  return db
}

export function getDatabase(): Database.Database {
  if (!db) {
    throw new Error('Database not initialized')
  }
  return db
}

function getFileHash(filePath: string): string {
  const crypto = require('crypto')
  return crypto.createHash('md5').update(filePath).digest('hex')
}

// Extract and cache cover image
export async function getSongCover(filePath: string): Promise<string | undefined> {
  try {
    // Parse and extract cover
    const metadata = await parseFile(filePath, { skipCovers: false })
    if (metadata.common.picture && metadata.common.picture.length > 0) {
      const pic = metadata.common.picture[0]
      const coverPath = join(coverDir, `${getFileHash(filePath)}.jpg`)
      
      // Save to file
      writeFileSync(coverPath, pic.data)
      
      // Try to update database (may fail in dev mode)
      if (db) {
        db.prepare('UPDATE tracks SET cover_cached = 1 WHERE file_path = ?').run(filePath)
      }
      
      return `data:image/jpeg;base64,${pic.data.toString('base64')}`
    }
  } catch (e) {
    // Ignore parse errors
  }
  return undefined
}

// Get or create track entry
export function upsertTrack(filePath: string, metadata: any, mtime: number) {
  if (!db) return
  
  const common = metadata.common
  
  const stmt = db.prepare(`
    INSERT OR REPLACE INTO tracks (file_path, title, artist, album, duration_ms, mtime)
    VALUES (?, ?, ?, ?, ?, ?)
  `)
  
  stmt.run(
    filePath,
    common.title || filePath.split(/[\\/]/).pop()?.replace(/\.[^.]+$/, '') || 'Unknown',
    common.artist?.join(', ') || 'Unknown Artist',
    common.album || 'Unknown Album',
    metadata.format.duration ? Math.round(metadata.format.duration * 1000) : null,
    mtime,
  )
}

// Get all tracks
export function getAllTracks(): any[] {
  return db?.prepare('SELECT * FROM tracks').all() || []
}

// Close database
export function closeDatabase() {
  if (db) {
    db.close()
    db = null
  }
}
