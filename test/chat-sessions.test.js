import assert from 'node:assert/strict'
import test from 'node:test'
import { createChatSessionStore, SESSION_STORAGE_KEY, LEGACY_CHAT_KEY } from '../src/composables/useChatSessions.js'

function memoryStorage(seed = {}) {
  const data = new Map(Object.entries(seed))
  return { getItem: key => data.get(key) ?? null, setItem: (key, value) => data.set(key, value), removeItem: key => data.delete(key) }
}
function setup(storage = memoryStorage(), extra = {}) {
  let id = 0
  let time = 1000
  return createChatSessionStore({ storage, createId: () => `session-${++id}`, now: () => ++time, ...extra })
}
const conversation = (text = '苏绣有什么特点？') => ({
  messages: [{ role: 'user', content: text }, { role: 'assistant', content: '细腻雅洁。' }],
  context: [{ role: 'system', content: 'private prompt' }, { role: 'user', content: text }, { role: 'assistant', content: '细腻雅洁。' }],
})

test('starts with one usable empty conversation', () => {
  const store = setup()
  assert.equal(store.sessions.value.length, 1)
  assert.equal(store.activeSession.value.title, '新的对话')
  assert.deepEqual(store.activeSession.value.context, [])
})

test('switching preserves independent messages, context and drafts across reload', () => {
  const storage = memoryStorage()
  const store = setup(storage)
  const first = store.activeSessionId.value
  store.updateConversation(conversation())
  store.updateDraft('想继续了解劈丝')
  const second = store.createSession()
  assert.deepEqual(store.activeSession.value.context, [])
  assert.equal(store.activeSession.value.draft, '')
  store.updateConversation(conversation('湘绣的狮虎为什么传神？'))
  store.updateDraft('第二段草稿')
  store.selectSession(first)
  assert.equal(store.activeSession.value.draft, '想继续了解劈丝')
  assert.equal(store.activeSession.value.messages[0].content, '苏绣有什么特点？')
  assert.equal(store.activeSession.value.context.length, 2)
  const restored = setup(storage)
  assert.equal(restored.activeSessionId.value, first)
  assert.equal(restored.activeSession.value.draft, '想继续了解劈丝')
  restored.selectSession(second)
  assert.equal(restored.activeSession.value.draft, '第二段草稿')
  assert.equal(restored.activeSession.value.context[0].content, '湘绣的狮虎为什么传神？')
})

test('automatic names yield to manual names; pin and name persist', () => {
  const storage = memoryStorage()
  const store = setup(storage)
  const id = store.activeSessionId.value
  store.updateConversation(conversation())
  assert.equal(store.activeSession.value.title, '苏绣有什么特点？')
  assert.equal(store.renameSession(id, '   '), false)
  store.renameSession(id, '  一针一线  ')
  store.togglePinned(id)
  store.updateConversation(conversation('不同的新问题'))
  const restored = setup(storage)
  assert.equal(restored.activeSession.value.title, '一针一线')
  assert.equal(restored.activeSession.value.pinned, true)
  assert.equal(restored.activeSession.value.customTitle, true)
})

test('deleting inactive/active/last sessions always leaves a valid selection', () => {
  const store = setup()
  const first = store.activeSessionId.value
  const second = store.createSession()
  store.deleteSession(first)
  assert.equal(store.activeSessionId.value, second)
  const third = store.createSession()
  store.deleteSession(third)
  assert.equal(store.activeSessionId.value, second)
  store.deleteSession(second)
  assert.equal(store.sessions.value.length, 1)
  assert.notEqual(store.activeSessionId.value, second)
  assert.equal(store.activeSession.value.messages.length, 0)
})

test('clearing only resets active conversation and keeps its custom name', () => {
  const store = setup()
  const first = store.activeSessionId.value
  store.updateConversation(conversation())
  store.createSession()
  store.updateConversation(conversation('第二段'))
  store.renameSession(store.activeSessionId.value, '手动名字')
  store.updateDraft('草稿')
  store.clearSession()
  assert.deepEqual(store.activeSession.value.messages, [])
  assert.deepEqual(store.activeSession.value.context, [])
  assert.equal(store.activeSession.value.draft, '')
  assert.equal(store.activeSession.value.title, '手动名字')
  store.selectSession(first)
  assert.equal(store.activeSession.value.messages.length, 2)
})

test('legacy archive migrates only once and strips stored system prompts', () => {
  const storage = memoryStorage({ [LEGACY_CHAT_KEY]: JSON.stringify({ html: 'legacy bubbles', messages: conversation().context }) })
  const store = setup(storage, { parseLegacy: () => conversation().messages })
  assert.equal(store.activeSession.value.title, '苏绣有什么特点？')
  assert.equal(store.activeSession.value.messages.length, 2)
  assert.equal(store.activeSession.value.context.length, 2)
  assert.equal(storage.getItem(LEGACY_CHAT_KEY), null)
  assert.ok(storage.getItem(SESSION_STORAGE_KEY))
  assert.equal(setup(storage).sessions.value.length, 1)
})

test('legacy context is a fallback when no rendered bubbles survive migration', () => {
  const storage = memoryStorage({ [LEGACY_CHAT_KEY]: JSON.stringify({ messages: conversation().context }) })
  const store = setup(storage)
  assert.equal(store.activeSession.value.messages.length, 2)
})

test('failed migration write retains legacy backup and supports in-memory changes', () => {
  const storage = memoryStorage({ [LEGACY_CHAT_KEY]: JSON.stringify({ messages: conversation().context }) })
  storage.setItem = () => { throw new Error('QuotaExceededError') }
  const store = setup(storage)
  assert.ok(storage.getItem(LEGACY_CHAT_KEY))
  assert.ok(store.storageWarning.value)
  store.createSession()
  store.updateDraft('不会崩溃')
  assert.equal(store.activeSession.value.draft, '不会崩溃')
})

test('unavailable storage and malformed archives fail gracefully', () => {
  const unavailable = setup({ getItem() { throw new Error('SecurityError') }, setItem() { throw new Error('SecurityError') } })
  unavailable.updateConversation(conversation())
  assert.equal(unavailable.activeSession.value.messages.length, 2)
  assert.ok(unavailable.storageWarning.value)
  const malformed = setup(memoryStorage({ [SESSION_STORAGE_KEY]: '{broken' }))
  assert.ok(malformed.activeSession.value)
  assert.ok(malformed.storageWarning.value)
})

test('normalizes archive schema, drops duplicate IDs and unsafe image URLs', () => {
  const storage = memoryStorage({ [SESSION_STORAGE_KEY]: JSON.stringify({ version: 1, activeSessionId: 'missing', sessions: [
    { id: 'good', title: 'archive', messages: [{ role: 'assistant', content: '<script>evil()</script>', imageUrl: 'javascript:evil()' }, { role: 'invalid', content: 'bad' }], context: conversation().context },
    { id: 'good', title: 'duplicate' }, null, { title: 'no ID' },
  ] }) })
  const store = setup(storage)
  assert.equal(store.sessions.value.length, 1)
  assert.equal(store.activeSessionId.value, 'good')
  assert.equal(store.activeSession.value.messages[0].imageUrl, '')
  assert.equal(store.activeSession.value.messages[0].content, '<script>evil()</script>')
  assert.equal(store.activeSession.value.context.length, 2)
})

test('caps rendered messages at 50 and API context at 12, retaining valid images', () => {
  const store = setup()
  const messages = Array.from({ length: 80 }, (_, i) => ({ role: i % 2 ? 'assistant' : 'user', content: `message ${i}`, imageUrl: 'https://example.com/embroidery.png' }))
  store.updateConversation({ messages, context: messages })
  assert.equal(store.activeSession.value.messages.length, 50)
  assert.equal(store.activeSession.value.messages[0].content, 'message 30')
  assert.equal(store.activeSession.value.context.length, 12)
  assert.equal(store.activeSession.value.messages[0].imageUrl, 'https://example.com/embroidery.png')
})

test('reading, switching and resaving unchanged messages does not reorder recency', () => {
  const store = setup()
  store.updateConversation(conversation())
  const id = store.activeSessionId.value
  const updated = store.activeSession.value.updatedAt
  store.selectSession(id)
  store.updateConversation(conversation())
  store.updateDraft('just a draft')
  assert.equal(store.activeSession.value.updatedAt, updated)
  assert.equal(store.selectSession('missing'), false)
  assert.equal(store.deleteSession('missing'), false)
  assert.equal(store.activeSessionId.value, id)
})
