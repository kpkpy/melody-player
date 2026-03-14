import { defineStore } from 'pinia'
import { ref } from 'vue'

export interface Playlist {
  id: string
  name: string
  songIds: string[]
  createdAt: number
  updatedAt: number
}

export const usePlaylistStore = defineStore('playlist', () => {
  const playlists = ref<Playlist[]>([])

  const loadPlaylists = async () => {
    playlists.value = await window.electron.playlist.getAll()
  }

  const createPlaylist = async (name: string) => {
    const playlist = await window.electron.playlist.create(name)
    playlists.value.push(playlist)
    return playlist
  }

  const addSong = async (playlistId: string, songId: string) => {
    await window.electron.playlist.addSong(playlistId, songId)
    const playlist = playlists.value.find(p => p.id === playlistId)
    if (playlist && !playlist.songIds.includes(songId)) {
      playlist.songIds.push(songId)
    }
  }

  const removeSong = async (playlistId: string, songId: string) => {
    await window.electron.playlist.removeSong(playlistId, songId)
    const playlist = playlists.value.find(p => p.id === playlistId)
    if (playlist) {
      playlist.songIds = playlist.songIds.filter(id => id !== songId)
    }
  }

  const deletePlaylist = async (playlistId: string) => {
    await window.electron.playlist.delete(playlistId)
    playlists.value = playlists.value.filter(p => p.id !== playlistId)
  }

  return {
    playlists,
    loadPlaylists,
    createPlaylist,
    addSong,
    removeSong,
    deletePlaylist,
  }
})