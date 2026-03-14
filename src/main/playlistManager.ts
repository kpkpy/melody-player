import { app } from 'electron'
import { join } from 'path'
import { readFileSync, writeFileSync, existsSync } from 'fs'
import type { Song } from './musicLibrary'

export interface Playlist {
  id: string
  name: string
  songIds: string[]
  createdAt: number
  updatedAt: number
}

export class PlaylistManager {
  private playlists: Map<string, Playlist> = new Map()
  private dataPath: string
  private songs: Map<string, Song> = new Map()

  constructor() {
    this.dataPath = join(app.getPath('userData'), 'playlists.json')
    this.load()
  }

  setSongs(songs: Song[]): void {
    this.songs.clear()
    for (const song of songs) {
      this.songs.set(song.id, song)
    }
  }

  private load(): void {
    if (existsSync(this.dataPath)) {
      try {
        const data = JSON.parse(readFileSync(this.dataPath, 'utf-8'))
        for (const playlist of data) {
          this.playlists.set(playlist.id, playlist)
        }
      } catch (e) {
        console.error('Failed to load playlists:', e)
      }
    }
  }

  private save(): void {
    const data = Array.from(this.playlists.values())
    writeFileSync(this.dataPath, JSON.stringify(data, null, 2))
  }

  create(name: string): Playlist {
    const playlist: Playlist = {
      id: `playlist-${Date.now()}`,
      name,
      songIds: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }
    this.playlists.set(playlist.id, playlist)
    this.save()
    return playlist
  }

  getAll(): Playlist[] {
    return Array.from(this.playlists.values())
  }

  getById(id: string): Playlist | undefined {
    return this.playlists.get(id)
  }

  getPlaylistSongs(playlistId: string): Song[] {
    const playlist = this.playlists.get(playlistId)
    if (!playlist) return []
    
    return playlist.songIds
      .map(id => this.songs.get(id))
      .filter((s): s is Song => s !== undefined)
  }

  addSong(playlistId: string, songId: string): boolean {
    const playlist = this.playlists.get(playlistId)
    if (!playlist) return false
    if (!playlist.songIds.includes(songId)) {
      playlist.songIds.push(songId)
      playlist.updatedAt = Date.now()
      this.save()
    }
    return true
  }

  removeSong(playlistId: string, songId: string): boolean {
    const playlist = this.playlists.get(playlistId)
    if (!playlist) return false
    const index = playlist.songIds.indexOf(songId)
    if (index > -1) {
      playlist.songIds.splice(index, 1)
      playlist.updatedAt = Date.now()
      this.save()
    }
    return true
  }

  delete(playlistId: string): boolean {
    const result = this.playlists.delete(playlistId)
    if (result) {
      this.save()
    }
    return result
  }

  rename(playlistId: string, newName: string): boolean {
    const playlist = this.playlists.get(playlistId)
    if (!playlist) return false
    playlist.name = newName
    playlist.updatedAt = Date.now()
    this.save()
    return true
  }
}