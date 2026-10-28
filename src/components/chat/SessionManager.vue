<template>
  <button ref="triggerRef" class="session-trigger" type="button" aria-haspopup="dialog" aria-controls="conversation-atelier" :aria-expanded="opened" :title="`打开会话织匣 · ${activeSession?.title || '新的对话'}`" @click="open">
    <span class="session-trigger-orbit"><SessionIcon /></span>
    <span class="session-trigger-label">会话织匣</span>
    <span class="session-trigger-count">{{ sessions.length.toString().padStart(2, '0') }}</span>
  </button>

  <Teleport to="body">
    <dialog id="conversation-atelier" ref="dialogRef" class="session-dialog" :class="{ 'is-expanded': expanded }" aria-labelledby="atelier-title" aria-describedby="atelier-description" @cancel.prevent="onEscape" @click="onBackdrop">
      <section class="atelier-shell">
        <div class="atelier-orbits" aria-hidden="true"><span /><span /><span /></div>
        <header class="atelier-header">
          <div class="atelier-eyebrow"><span /> CONVERSATION ATELIER</div>
          <button class="atelier-close atelier-icon-btn" type="button" aria-label="关闭会话织匣" @click="close"><SessionIcon name="close" /></button>
          <div class="atelier-heading-row">
            <div>
              <h2 id="atelier-title">会话织匣<span>藏一段话，续一缕思绪。</span></h2>
              <p id="atelier-description">不必从头说起，拾起上次未完的灵感。</p>
            </div>
            <button class="atelier-primary" type="button" @click="create"><SessionIcon name="plus" />开启新对话</button>
          </div>
        </header>

        <div class="atelier-toolbar">
          <label class="atelier-search">
            <SessionIcon name="search" />
            <input ref="searchRef" v-model="query" type="search" placeholder="寻找一段对话…" aria-label="搜索会话标题和内容" />
          </label>
          <div class="atelier-filters" aria-label="筛选会话">
            <button type="button" :aria-pressed="!pinnedOnly" :class="{ selected: !pinnedOnly }" @click="pinnedOnly = false">全部 <span>{{ sessions.length }}</span></button>
            <button type="button" :aria-pressed="pinnedOnly" :class="{ selected: pinnedOnly }" @click="pinnedOnly = true"><SessionIcon name="pin" />置顶 <span>{{ pinnedCount }}</span></button>
          </div>
        </div>

        <div class="atelier-collection">
          <div class="atelier-collection-heading"><span>{{ query ? '寻得的片段' : pinnedOnly ? '心头珍藏' : '与你的对话' }}</span><span>{{ filteredSessions.length }} 段记忆 · 最近更新优先</span></div>
          <div v-if="filteredSessions.length" class="atelier-grid">
            <article v-for="(session, index) in filteredSessions" :key="session.id" class="atelier-card" :class="{ 'is-current': session.id === activeSessionId }" :style="{ '--card-delay': `${Math.min(index, 8) * 38}ms`, '--card-tilt': `${index % 2 ? 2 : -2}deg` }">
              <div :inert="editingId === session.id || deletingId === session.id">
                <button class="atelier-card-main" type="button" :aria-label="`继续会话：${session.title}`" :aria-current="session.id === activeSessionId ? 'true' : undefined" @click="select(session.id)">
                  <span class="atelier-card-top">
                    <span class="atelier-card-seal"><SessionIcon name="chat" /></span>
                    <span v-if="session.id === activeSessionId" class="atelier-current-label"><span />当前对话</span>
                    <span v-else class="atelier-card-number">{{ (index + 1).toString().padStart(2, '0') }}</span>
                  </span>
                  <h3>{{ session.title }}</h3>
                  <p>{{ preview(session) }}</p>
                  <span class="atelier-card-meta"><span>{{ messageCount(session) }} 条消息<span v-if="session.draft" class="atelier-draft"> · 有草稿</span></span><SessionIcon name="arrow" /></span>
                </button>
                <footer class="atelier-card-footer">
                  <time :datetime="new Date(session.updatedAt).toISOString()">{{ formatDate(session.updatedAt) }}</time>
                  <div class="atelier-card-actions">
                    <button class="atelier-icon-btn" :class="{ 'is-pinned': session.pinned }" type="button" :aria-label="`${session.pinned ? '取消置顶' : '置顶'}：${session.title}`" :title="session.pinned ? '取消置顶' : '置顶'" :aria-pressed="session.pinned" @click="togglePinned(session.id)"><SessionIcon name="pin" /></button>
                    <button class="atelier-icon-btn" type="button" :aria-label="`重命名：${session.title}`" title="重命名" @click="startRename(session)"><SessionIcon name="edit" /></button>
                    <button class="atelier-icon-btn atelier-delete" type="button" :aria-label="`删除：${session.title}`" title="删除会话" @click="startDelete(session.id)"><SessionIcon name="trash" /></button>
                  </div>
                </footer>
              </div>
              <form v-if="editingId === session.id" class="atelier-card-edit" @submit.prevent="finishRename(session.id)">
                <label :for="`rename-${session.id}`">为这段对话命名</label>
                <input :id="`rename-${session.id}`" v-model="newTitle" maxlength="40" required autocomplete="off" @keydown.esc.prevent.stop="cancelEdit" />
                <span class="atelier-edit-hint">{{ newTitle.length }} / 40 · 留个容易找到的名字</span>
                <div><button class="atelier-secondary" type="button" @click="cancelEdit">取消</button><button class="atelier-primary" type="submit" :disabled="!newTitle.trim()">保存名字</button></div>
              </form>
              <div v-if="deletingId === session.id" class="atelier-card-edit atelier-delete-confirm" role="group" aria-label="确认删除会话">
                <SessionIcon name="trash" />
                <strong>让这段对话留在过去？</strong>
                <p>「{{ session.title }}」的消息与草稿将被删除，无法恢复。</p>
                <div><button class="atelier-secondary" type="button" @click="cancelEdit">再想想</button><button class="atelier-danger" type="button" @click="remove(session.id)">确认删除</button></div>
              </div>
            </article>
          </div>
          <div v-else class="atelier-empty">
            <span><SessionIcon :name="pinnedOnly && !query ? 'pin' : 'search'" /></span>
            <h3>{{ pinnedOnly && !query ? '把喜欢的对话，留在最前面' : '还没找到这段记忆' }}</h3>
            <p>{{ pinnedOnly && !query ? '点击卡片上的图钉，就能在这里再次相遇。' : '换个关键词，试试标题或聊过的内容。' }}</p>
            <button class="atelier-secondary" type="button" @click="resetFilters">查看全部会话</button>
          </div>
        </div>

        <footer class="atelier-footer">
          <span><SessionIcon name="local" />仅保存在此浏览器 · 每段保留最近 50 条消息</span>
          <span class="atelier-key-hint"><kbd>Esc</kbd> 收起织匣</span>
          <p v-if="inputLocked" class="atelier-busy-note">切换或新建会话会停止当前回复，已显示的内容会保留。</p>
          <p v-if="storageWarning" class="atelier-storage-warning" role="alert">{{ storageWarning }}</p>
        </footer>
      </section>
    </dialog>
  </Teleport>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, ref } from 'vue'
import { chatSessions, createConversation, switchConversation, deleteConversation, inputLocked } from '../../composables/useCultureChat.js'
import SessionIcon from './SessionIcon.vue'

const { sessions, activeSession, activeSessionId, storageWarning, renameSession, togglePinned } = chatSessions
const dialogRef = ref(null)
const triggerRef = ref(null)
const searchRef = ref(null)
const opened = ref(false)
const expanded = ref(false)
const query = ref('')
const pinnedOnly = ref(false)
const editingId = ref('')
const deletingId = ref('')
const newTitle = ref('')
let closeTimer
let frame
let previousOverflow = ''
let editTrigger = null

const pinnedCount = computed(() => sessions.value.filter(s => s.pinned).length)
const filteredSessions = computed(() => {
  const search = query.value.trim().toLocaleLowerCase()
  return sessions.value.filter(s => (!pinnedOnly.value || s.pinned) && (!search ||
    `${s.title} ${s.messages.map(m => m.content).join(' ')}`.toLocaleLowerCase().includes(search)))
    .sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.updatedAt - a.updatedAt)
})
function preview(session) {
  const message = [...session.messages].reverse().find(m => m.role !== 'notice')
  return message?.content || (message?.imageUrl ? '一幅刺绣灵感，等你再来细看。' : '空白的信笺，等你落下第一句。')
}
function messageCount(session) { return session.messages.filter(m => m.role !== 'notice').length }
function formatDate(timestamp) {
  const date = new Date(timestamp)
  const today = new Date()
  const yesterday = new Date(today)
  yesterday.setDate(today.getDate() - 1)
  if (date.toDateString() === today.toDateString()) return `今天 ${date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}`
  if (date.toDateString() === yesterday.toDateString()) return '昨天'
  return date.toLocaleDateString('zh-CN', { ...(date.getFullYear() !== today.getFullYear() ? { year: 'numeric' } : {}), month: 'short', day: 'numeric' })
}
async function open() {
  if (opened.value) return
  opened.value = true
  resetFilters()
  editingId.value = deletingId.value = ''
  previousOverflow = document.body.style.overflow
  document.body.style.overflow = 'hidden'
  dialogRef.value.showModal()
  await nextTick()
  searchRef.value?.focus({ preventScroll: true })
  frame = requestAnimationFrame(() => { expanded.value = true })
}
function close() {
  if (!opened.value || closeTimer) return
  cancelAnimationFrame(frame)
  expanded.value = false
  const delay = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 220
  closeTimer = setTimeout(() => {
    dialogRef.value?.close()
    document.body.style.overflow = previousOverflow
    opened.value = false
    closeTimer = null
    triggerRef.value?.focus({ preventScroll: true })
  }, delay)
}
function onEscape() {
  if (editingId.value || deletingId.value) cancelEdit()
  else close()
}
function onBackdrop(event) { if (event.target === dialogRef.value) close() }
function resetFilters() { query.value = ''; pinnedOnly.value = false }
function create() { if (closeTimer) return; createConversation(); close() }
function select(id) { if (closeTimer) return; switchConversation(id); close() }
async function startRename(session) {
  editTrigger = document.activeElement
  deletingId.value = ''
  editingId.value = session.id
  newTitle.value = session.title
  await nextTick()
  document.getElementById(`rename-${session.id}`)?.select()
}
async function startDelete(id) {
  editTrigger = document.activeElement
  editingId.value = ''
  deletingId.value = id
  await nextTick()
  dialogRef.value.querySelector('.atelier-delete-confirm button')?.focus()
}
function cancelEdit() {
  editingId.value = deletingId.value = ''
  nextTick(() => { if (editTrigger?.isConnected) editTrigger.focus() })
}
function finishRename(id) {
  if (renameSession(id, newTitle.value)) {
    cancelEdit()
    nextTick(() => { if (!editTrigger?.isConnected) searchRef.value?.focus() })
  }
}
function remove(id) {
  deleteConversation(id)
  deletingId.value = ''
  nextTick(() => searchRef.value?.focus())
}
onBeforeUnmount(() => {
  cancelAnimationFrame(frame)
  clearTimeout(closeTimer)
  if (opened.value) {
    dialogRef.value?.close()
    document.body.style.overflow = previousOverflow
  }
})
</script>

<style scoped src="./session-manager.css"></style>
