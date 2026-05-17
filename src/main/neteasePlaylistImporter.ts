import { app } from 'electron'
import { join } from 'path'
import { readFileSync, writeFileSync, existsSync } from 'fs'
import type { Song } from './musicLibrary'
import type { Playlist } from './playlistManager'

interface NetEasePlaylistTrack {
  id: number
  name: string
  ar: { name: string }[]
  al: { name: string }
  dt: number
}

interface NetEasePlaylistResponse {
  code: number
  playlist: {
    name: string
    tracks: NetEasePlaylistTrack[]
    trackIds: { id: number }[]
  }
}

export interface PlaylistImportResult {
  success: boolean
  playlistId?: string
  playlistName?: string
  totalTracks: number
  matchedTracks: number
  unmatchedTracks: { title: string; artist: string }[]
  error?: string
}

export class NeteasePlaylistImporter {
  private cachePath: string
  private cookies: string = ''

  constructor() {
    this.cachePath = join(app.getPath('userData'), 'netease-cookies.json')
    this.loadCookies()
  }

  private loadCookies(): void {
    if (existsSync(this.cachePath)) {
      try {
        const data = JSON.parse(readFileSync(this.cachePath, 'utf-8'))
        this.cookies = data.cookies || ''
      } catch (e) {
        console.error('Failed to load NetEase cookies:', e)
      }
    }
  }

  private saveCookies(): void {
    writeFileSync(this.cachePath, JSON.stringify({ cookies: this.cookies }))
  }

  setCookies(cookies: string): void {
    this.cookies = cookies
    this.saveCookies()
  }

  extractPlaylistId(url: string): string | null {
    const patterns = [
      /playlist\?id=(\d+)/,
      /playlist\/(\d+)/,
    ]
    for (const pattern of patterns) {
      const match = url.match(pattern)
      if (match) return match[1]
    }
    return null
  }

  async fetchPlaylist(playlistId: string): Promise<{ name: string; tracks: NetEasePlaylistTrack[] } | null> {
    try {
      const headers: Record<string, string> = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Referer': 'https://music.163.com/',
      }
      if (this.cookies) {
        headers['Cookie'] = this.cookies
      }

      const url = `https://music.163.com/api/playlist/detail?id=${playlistId}`
      const response = await fetch(url, { headers })
      const data: NetEasePlaylistResponse = await response.json()

      if (data.code === 200 && data.playlist) {
        return {
          name: data.playlist.name,
          tracks: data.playlist.tracks,
        }
      }
    } catch (e: any) {
      console.error('Failed to fetch NetEase playlist:', e.message)
    }
    return null
  }

  matchTrack(track: NetEasePlaylistTrack, localSongs: Song[]): Song | null {
    const title = track.name.toLowerCase().trim()
    const artists = track.ar.map(a => a.name.toLowerCase().trim())
    
    for (const song of localSongs) {
      const songTitle = song.title.toLowerCase().trim()
      const songArtist = song.artist.toLowerCase().trim()
      
      if (songTitle === title && artists.some(a => songArtist.includes(a) || a.includes(songArtist))) {
        return song
      }
    }

    for (const song of localSongs) {
      const songTitle = song.title.toLowerCase().trim()
      if (songTitle.includes(title) || title.includes(songTitle)) {
        return song
      }
    }

    return null
  }

  async importPlaylist(
    url: string,
    localSongs: Song[],
    playlistManager: { create: (name: string) => Playlist; addSong: (id: string, songId: string) => boolean }
  ): Promise<PlaylistImportResult> {
    const playlistId = this.extractPlaylistId(url)
    if (!playlistId) {
      return {
        success: false,
        totalTracks: 0,
        matchedTracks: 0,
        unmatchedTracks: [],
        error: 'Invalid NetEase Cloud Music playlist URL',
      }
    }

    const playlist = await this.fetchPlaylist(playlistId)
    if (!playlist) {
      return {
        success: false,
        totalTracks: 0,
        matchedTracks: 0,
        unmatchedTracks: [],
        error: 'Failed to fetch playlist from NetEase Cloud Music',
      }
    }

    const newPlaylist = playlistManager.create(playlist.name)
    let matchedCount = 0
    const unmatched: { title: string; artist: string }[] = []

    for (const track of playlist.tracks) {
      const matched = this.matchTrack(track, localSongs)
      if (matched) {
        playlistManager.addSong(newPlaylist.id, matched.id)
        matchedCount++
      } else {
        unmatched.push({
          title: track.name,
          artist: track.ar.map(a => a.name).join(', '),
        })
      }
    }

    return {
      success: true,
      playlistId: newPlaylist.id,
      playlistName: newPlaylist.name,
      totalTracks: playlist.tracks.length,
      matchedTracks: matchedCount,
      unmatchedTracks: unmatched,
    }
  }
}
