<script setup lang="ts">
const minimize = () => window.electron.window.minimize()
const maximize = () => window.electron.window.maximize()
const close = () => window.electron.window.close()
</script>

<template>
  <div class="title-bar drag-region">
    <div class="title">Melody Player</div>
    <div class="window-controls no-drag">
      <button class="control-btn minimize" @click="minimize">
        <svg width="12" height="12" viewBox="0 0 12 12">
          <rect y="5" width="12" height="2" fill="currentColor" />
        </svg>
      </button>
      <button class="control-btn maximize" @click="maximize">
        <svg width="12" height="12" viewBox="0 0 12 12">
          <rect x="1" y="1" width="10" height="10" stroke="currentColor" stroke-width="2" fill="none" />
        </svg>
      </button>
      <button class="control-btn close" @click="close">
        <svg width="12" height="12" viewBox="0 0 12 12">
          <path d="M1 1L11 11M11 1L1 11" stroke="currentColor" stroke-width="2" />
        </svg>
      </button>
    </div>
  </div>
</template>

<style scoped>
.title-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  height: 32px;
  background: var(--bg-tertiary);
  padding: 0 12px;
  font-size: 13px;
  color: var(--text-secondary);
}

.title {
  font-weight: 500;
}

.window-controls {
  display: flex;
  gap: 8px;
}

.control-btn {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-secondary);
  transition: all 0.15s;
}

.control-btn:hover {
  color: var(--text-primary);
}

.control-btn.close:hover {
  background: #ff5f57;
  color: white;
}

.control-btn.minimize:hover {
  background: #ffbd2e;
  color: white;
}

.control-btn.maximize:hover {
  background: #28c840;
  color: white;
}
</style>