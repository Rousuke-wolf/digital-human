import { computed, ref } from 'vue'

export const SESSION_STORAGE_KEY = 'zhichuan-culture-sessions-v1'
export const LEGACY_CHAT_KEY = 'zhichuan-culture-chat'
export const MAX_SESSION_MESSAGES = 50
const DEFAULT_TITLE = '新的对话'
const newSessionId = () => globalThis.crypto?.randomUUID?.()
  || `session-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`
const validTimestamp = value => Number.isFinite(value) && Math.abs(value) <= 8.64e15

function cleanMessages(messages) {
  if (!Array.isArray(messages)) return []
  return messages.filter(m => m && ['user', 'assistant', 'notice'].includes(m.role))
    .slice(-MAX_SESSION_MESSAGES)
    .map(m => ({
      role: m.role,
      content: typeof m.content === 'string' ? m.content : '',
      // Only restore ordinary web images, never executable URLs or arbitrary HTML.
      imageUrl: typeof m.imageUrl === 'string' && /^https?:\/\//i.test(m.imageUrl) ? m.imageUrl : '',
    }))
}

function cleanContext(messages) {
  if (!Array.isArray(messages)) return []
  return messages.filter(m => m && ['user', 'assistant'].includes(m.role) && typeof m.content === 'string')
    .slice(-12).map(({ role, content }) => ({ role, content }))
}

// Browser-local by design. Inject storage/clock/IDs to exercise persistence without a browser.
export function createChatSessionStore({ storage, parseLegacy = () => [], now = Date.now,
  createId = newSessionId } = {}) {
  const sessions = ref([])
  const activeSessionId = ref('')
  const storageWarning = ref('')
  const activeSession = computed(() => sessions.value.find(s => s.id === activeSessionId.value))

  function blankSession() {
    const time = now()
    return { id: createId(), title: DEFAULT_TITLE, customTitle: false, pinned: false,
      createdAt: time, updatedAt: time, messages: [], context: [], draft: '' }
  }

  function save() {
    try {
      if (!storage) throw new Error('Storage unavailable')
      storage.setItem(SESSION_STORAGE_KEY, JSON.stringify({ version: 1, activeSessionId: activeSessionId.value, sessions: sessions.value }))
      storageWarning.value = ''
      return true
    } catch {
      storageWarning.value = '本机存储不可用或已满，最新改动仅在本次页面中保留。'
      return false
    }
  }

  function load() {
    let legacyImported = false
    try {
      const raw = storage?.getItem(SESSION_STORAGE_KEY)
      if (raw) {
        const data = JSON.parse(raw)
        if (data?.version !== 1 || !Array.isArray(data.sessions)) throw new Error('Invalid archive')
        const seen = new Set()
        sessions.value = data.sessions.filter(s => {
          if (!s || typeof s.id !== 'string' || !s.id || seen.has(s.id)) return false
          seen.add(s.id)
          return true
        }).map(s => ({
          id: s.id, title: typeof s.title === 'string' && s.title.trim() ? s.title.slice(0, 40) : DEFAULT_TITLE,
          customTitle: s.customTitle === true, pinned: s.pinned === true,
          createdAt: validTimestamp(s.createdAt) ? s.createdAt : now(),
          updatedAt: validTimestamp(s.updatedAt) ? s.updatedAt : now(),
          messages: cleanMessages(s.messages), context: cleanContext(s.context),
          draft: typeof s.draft === 'string' ? s.draft : '',
        }))
        activeSessionId.value = data.activeSessionId
      } else {
        const legacy = JSON.parse(storage?.getItem(LEGACY_CHAT_KEY) || 'null')
        if (legacy) {
          const session = blankSession()
          session.context = cleanContext(legacy.messages)
          session.messages = cleanMessages(parseLegacy(legacy.html))
          if (!session.messages.length) session.messages = cleanMessages(session.context)
          session.title = session.messages.find(m => m.role === 'user')?.content.slice(0, 24) || '之前的对话'
          sessions.value = [session]
          legacyImported = true
        }
      }
    } catch {
      storageWarning.value = '未能读取本机会话，原存档未删除；你仍可开始新的对话。'
    }
    if (!sessions.value.length) sessions.value = [blankSession()]
    if (!activeSession.value) activeSessionId.value = sessions.value[0].id
    // Remove the old HTML archive only after the structured archive was written successfully.
    if (legacyImported && save()) {
      try { storage.removeItem(LEGACY_CHAT_KEY) } catch { /* Keep the backup if removal fails. */ }
    }
  }

  function createSession() {
    const session = blankSession()
    sessions.value.unshift(session)
    activeSessionId.value = session.id
    save()
    return session.id
  }

  function selectSession(id) {
    if (!sessions.value.some(s => s.id === id)) return false
    activeSessionId.value = id
    save()
    return true
  }

  function updateConversation({ messages, context }, id = activeSessionId.value) {
    const session = sessions.value.find(s => s.id === id)
    if (!session) return
    const cleaned = cleanMessages(messages)
    const changed = JSON.stringify(session.messages) !== JSON.stringify(cleaned)
    session.messages = cleaned
    session.context = cleanContext(context)
    if (changed) session.updatedAt = now()
    if (!session.customTitle) {
      const firstQuestion = session.messages.find(m => m.role === 'user')?.content.trim()
      if (firstQuestion && session.title === DEFAULT_TITLE) session.title = firstQuestion.slice(0, 24)
    }
    save()
  }

  function updateDraft(draft) {
    if (!activeSession.value || activeSession.value.draft === draft) return
    activeSession.value.draft = draft
    save()
  }

  function renameSession(id, title) {
    const session = sessions.value.find(s => s.id === id)
    const trimmed = title.trim().slice(0, 40)
    if (!session || !trimmed) return false
    session.title = trimmed
    session.customTitle = true
    save()
    return true
  }

  function togglePinned(id) {
    const session = sessions.value.find(s => s.id === id)
    if (!session) return
    session.pinned = !session.pinned
    save()
  }

  function deleteSession(id) {
    if (!sessions.value.some(s => s.id === id)) return false
    sessions.value = sessions.value.filter(s => s.id !== id)
    if (!sessions.value.length) sessions.value = [blankSession()]
    if (activeSessionId.value === id) {
      activeSessionId.value = [...sessions.value].sort((a, b) => b.updatedAt - a.updatedAt)[0].id
    }
    save()
    return true
  }

  function clearSession() {
    const session = activeSession.value
    if (!session) return
    session.messages = []
    session.context = []
    session.draft = ''
    if (!session.customTitle) session.title = DEFAULT_TITLE
    session.updatedAt = now()
    save()
  }

  load()
  return { sessions, activeSessionId, activeSession, storageWarning, createSession, selectSession,
    updateConversation, updateDraft, renameSession, togglePinned, deleteSession, clearSession, save }
}
