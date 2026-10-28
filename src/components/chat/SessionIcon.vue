<template>
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <path :d="paths[name] || paths.sessions" />
  </svg>
</template>

<script setup>
defineProps({ name: { type: String, default: 'sessions' } })
const paths = {
  sessions: 'M12 3 21 8 12 13 3 8 12 3ZM3 12l9 5 9-5M3 16l9 5 9-5',
  plus: 'M12 5v14M5 12h14',
  close: 'm6 6 12 12M6 18 18 6',
  search: 'M20 20l-5-5M17 10a7 7 0 1 1-14 0 7 7 0 0 1 14 0Z',
  pin: 'm9 3 6 0-1 6 4 4v2H6v-2l4-4-1-6ZM12 15v6',
  edit: 'm15 4 5 5M4 20l5-1L21 7a2 2 0 0 0-4-4L5 15l-1 5Z',
  trash: 'M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 11v5M14 11v5',
  arrow: 'M5 12h14m-5-5 5 5-5 5',
  check: 'm5 12 4 4L19 6',
  local: 'M5 3h14v14H5V3ZM3 21h18M9 17v4m6-4v4',
  chat: 'M21 11a8 8 0 0 1-8 8H5l-3 3V11a9 9 0 0 1 19 0ZM7 10h10M7 14h6',
}
</script>
