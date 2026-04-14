# Melody Player Changelog

## [1.0.0] - 2026-04-14

### ✨ Added
- Local music player supporting MP3, FLAC, M4A, WAV, OGG, WMA, APE, AAC
- Smart album art extraction and display
- Random song recommendations on home page
- Music library with sort, filter and search
- Playlist management
- Play queue management
- Desktop lyrics support
- Playback statistics tracking

### 🐛 Fixed
- Fixed FLAC album cover not loading (ERR_INVALID_URL error)
  - Properly convert Uint8Array to Buffer before base64 encoding
  - Normalize MIME types (JPEG -> image/jpeg, PNG -> image/png)
- Fixed missing cover art in mini player and full-screen player
  - Added dynamic cover loading when playing songs
- Fixed song play flow in home view
  - Added better song ID matching
  - Added debug logging for troubleshooting

### 🔧 Changed
- Improved cover loading performance
  - Skip covers during library scan (skipCovers: true)
  - Load covers on-demand when displaying
  - Cache covers to filesystem to avoid re-parsing
- Enhanced error handling and logging

### 📦 Build
- NSIS installer for Windows
- Portable/green version (win-unpacked)
- Auto-update support via electron-builder

### 🏠 Homepage
- Random shuffle algorithm for song recommendations
- Beautiful card-based UI with animations
- Cover art lazy loading

### 🎵 Music Library
- Multiple view modes: Songs, Albums, Artists
- Sort by title, artist, album, duration
- Search functionality
- Pagination for large libraries

### ▶️ Player Controls
- Play/Pause, Next, Previous
- Volume control (0-100%)
- Play modes: Sequence, Random, Single
- Progress bar with seek
- Time display (current/total)

### 📋 Queue Management
- Add to queue
- Add next (play after current)
- Remove from queue
- Clear queue
- Queue panel display

### 🖥️ Desktop Integration
- Global hotkeys (media keys)
- Desktop lyrics window
- Playback statistics tracking

## Technical Details

### Architecture
- Electron 28.x
- Vue 3.4 with Composition API
- Vite 5 for build
- Pinia for state management
- music-metadata for file parsing

### Supported Formats
| Format | Extension | Cover Support |
|--------|-----------|---------------|
| MP3 | .mp3 | ✅ JPEG, PNG |
| FLAC | .flac | ✅ JPEG, PNG |
| M4A | .m4a | ✅ JPEG, PNG |
| WAV | .wav | ⚠️ Limited |
| OGG | .ogg | ✅ PNG |
| WMA | .wma | ✅ JPEG |
| APE | .ape | ✅ JPEG, PNG |
| AAC | .aac | ✅ JPEG |

### Known Issues
- Symbolic link creation during build requires admin privileges on Windows
- Some WAV files may not display cover art

### Future Plans
- Gapless playback
- Equalizer support
- Playlist import/export (M3U, PLS)
- Theme customization
- macOS and Linux builds
