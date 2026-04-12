import { app } from 'electron'
import { join } from 'path'
import { existsSync, mkdirSync, writeFileSync, readFileSync } from 'fs'
import { parseFile } from 'music-metadata'

const coverDir = join(app.getPath('userData'), 'covers')

// Initialize cover directory
export function initDatabase(): void {
  if (!existsSync(coverDir)) {
    mkdirSync(coverDir, { recursive: true })
  }
  console.log('Cover cache directory:', coverDir)
}

function getFileHash(filePath: string): string {
  const crypto = require('crypto')
  return crypto.createHash('md5').update(filePath).digest('hex')
}

// Extract and cache cover image to file system
export async function getSongCover(filePath: string): Promise<string | undefined> {
  try {
    const coverPath = join(coverDir, `${getFileHash(filePath)}.jpg`)
    
    // Check cache first
    if (existsSync(coverPath)) {
      const data = readFileSync(coverPath)
      return `data:image/jpeg;base64,${data.toString('base64')}`
    }
    
    // Parse and extract cover
    const metadata = await parseFile(filePath, { skipCovers: false })
    if (metadata.common.picture && metadata.common.picture.length > 0) {
      const pic = metadata.common.picture[0]
      
      // Save to file (JPEG format)
      writeFileSync(coverPath, pic.data)
      
      return `data:image/jpeg;base64,${pic.data.toString('base64')}`
    }
  } catch (e) {
    // Ignore parse errors
  }
  return undefined
}
