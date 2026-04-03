import { createRouter, createWebHashHistory } from 'vue-router'
import HomeView from '@/views/HomeView.vue'
import LibraryView from '@/views/LibraryView.vue'
import PlaylistView from '@/views/PlaylistView.vue'
import SettingsView from '@/views/SettingsView.vue'
import SyncView from '@/views/SyncView.vue'
import StatsView from '@/views/StatsView.vue'
import EmotionView from '@/views/EmotionView.vue'

const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    { path: '/', name: 'home', component: HomeView },
    { path: '/library', name: 'library', component: LibraryView },
    { path: '/emotion', name: 'emotion', component: EmotionView },
    { path: '/stats', name: 'stats', component: StatsView },
    { path: '/sync', name: 'sync', component: SyncView },
    { path: '/settings', name: 'settings', component: SettingsView },
  ],
})

export default router