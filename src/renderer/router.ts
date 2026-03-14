import { createRouter, createWebHashHistory } from 'vue-router'
import HomeView from '@/views/HomeView.vue'
import LibraryView from '@/views/LibraryView.vue'
import PlaylistView from '@/views/PlaylistView.vue'
import SettingsView from '@/views/SettingsView.vue'
import SyncView from '@/views/SyncView.vue'

const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    { path: '/', name: 'home', component: HomeView },
    { path: '/library', name: 'library', component: LibraryView },
    { path: '/playlist/:id', name: 'playlist', component: PlaylistView },
    { path: '/settings', name: 'settings', component: SettingsView },
    { path: '/sync', name: 'sync', component: SyncView },
  ],
})

export default router