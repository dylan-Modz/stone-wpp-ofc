import { randomUUID } from 'node:crypto'
import { USyncQuery, USyncUser } from '../WAUSync/index.js'
import { CALL_AUDIO_PREFIX, CALL_VIDEO_PREFIX } from '../Defaults/index.js'

const PIX_KEY_TYPES = new Set(['CPF', 'CNPJ', 'PHONE', 'EMAIL', 'EVP'])

const requireJid = (jid) => {
  if (typeof jid !== 'string' || !jid.includes('@')) {
    throw new TypeError('Informe um JID válido')
  }
  return jid
}

const requireId = (id, label = 'ID') => {
  if (typeof id !== 'string' || !id.trim()) {
    throw new TypeError(`Informe um ${label} válido`)
  }
  return id.trim()
}

/**
 * Stone socket extensions. The underlying connection and auth are unchanged.
 * Methods added here must use the existing WhatsApp transport (never mock success).
 */
export function createStoneAdditionalMethods(socket) {
  const seenLabels = new Map()
  const seenCustomerNotes = new Map()
  const customerNoteByChat = new Map()

  socket.ev.on('notes.edit', (note) => {
    if (!note?.id || !note?.chatId) return
    if (note.deleted) {
      seenCustomerNotes.delete(note.id)
      if (customerNoteByChat.get(note.chatId) === note.id) customerNoteByChat.delete(note.chatId)
    } else {
      const updated = {
        ...(seenCustomerNotes.get(note.id) || {}),
        id: note.id,
        chatId: note.chatId,
        content: note.content ?? '',
        createdAt: note.createdAt,
        type: 'unstructured'
      }
      seenCustomerNotes.set(note.id, updated)
      customerNoteByChat.set(note.chatId, note.id)
    }
  })

  // labels.edit is emitted from WhatsApp's app-state synchronization.
  // This is an observed cache, NOT an authoritative account-wide label fetch.
  socket.ev.on('labels.edit', (label) => {
    if (!label?.id) return
    if (label.deleted) {
      seenLabels.delete(label.id)
    } else {
      seenLabels.set(label.id, { ...seenLabels.get(label.id), ...label })
    }
  })

  return {
    /**
     * Cria um link de chamada no WhatsApp e envia o convite ao grupo.
     * Não inicia uma sessão de voz/vídeo e não faz os participantes tocarem.
     */
    async sendGroupCallInvite(groupJid, options = {}) {
      if (typeof groupJid !== 'string' || !/^[^@\s]+@g\.us$/.test(groupJid)) {
        throw new TypeError('Informe um JID de grupo válido')
      }
      if (!options || typeof options !== 'object' || Array.isArray(options)) {
        throw new TypeError('Informe opções válidas para o convite')
      }
      const { type = 'audio', text } = options
      if (type !== 'audio' && type !== 'video') {
        throw new TypeError('Tipo de chamada deve ser audio ou video')
      }
      if (text !== undefined && (typeof text !== 'string' || !text.trim())) {
        throw new TypeError('O texto do convite deve ser uma mensagem não vazia')
      }
      if (typeof socket.createCallLink !== 'function' || typeof socket.sendMessage !== 'function') {
        throw new Error('Os recursos de convite não estão disponíveis neste socket')
      }
      const token = await socket.createCallLink(type)
      if (typeof token !== 'string' || !/^[A-Za-z0-9_-]{6,256}$/.test(token)) {
        throw new Error('O WhatsApp não retornou um token válido para a chamada')
      }
      const url = (type === 'audio' ? CALL_AUDIO_PREFIX : CALL_VIDEO_PREFIX) + token
      const title = text?.trim() || (type === 'audio' ? 'Convite para chamada de voz em grupo:' : 'Convite para chamada de vídeo em grupo:')
      const message = await socket.sendMessage(groupJid, { text: `${title}\n${url}` })
      if (!message?.key?.id) {
        throw new Error('O socket não confirmou o envio do convite para o grupo')
      }
      return { groupJid, type, url, message }
    },

    /** Consulta o mapeamento PN/LID que a sessão conhece (sem inventar identidades). */
    async resolveJidMapping(jid) {
      requireJid(jid)
      const mapping = socket.signalRepository?.lidMapping
      if (!mapping) throw new Error('Mapeamento de identidades indisponível')
      if (jid.endsWith('@lid') || jid.endsWith('@hosted.lid')) {
        const pn = await mapping.getPNForLID(jid)
        return { input: jid, pn: pn ?? null, lid: jid, resolved: Boolean(pn) }
      }
      if (jid.endsWith('@s.whatsapp.net') || jid.endsWith('@hosted')) {
        const lid = await mapping.getLIDForPN(jid)
        return { input: jid, pn: jid, lid: lid ?? null, resolved: Boolean(lid) }
      }
      throw new TypeError('Informe um JID de usuário PN ou LID')
    },

    /** Diagnóstico somente leitura: não recria nem substitui chaves Signal. */
    async inspectSignalSession(jid) {
      requireJid(jid)
      if (!socket.signalRepository?.validateSession) {
        throw new Error('Repositório de sessões indisponível')
      }
      const status = await socket.signalRepository.validateSession(jid)
      return { jid, exists: Boolean(status?.exists) }
    },

    /**
     * Edita uma mensagem enviada pela própria conta.
     * A Stone já implementa MESSAGE_EDIT no sendMessage: aqui há um atalho
     * com validação para não tentar falsificar mensagens de terceiros.
     */
    async editMessage(jid, messageKey, text) {
      requireJid(jid)
      if (!messageKey || typeof messageKey !== 'object' || !messageKey.id) {
        throw new TypeError('Informe a chave (key) da mensagem enviada pelo bot')
      }
      if (messageKey.fromMe !== true) {
        throw new TypeError('Só é possível editar mensagens enviadas pela própria conta')
      }
      if (messageKey.remoteJid && messageKey.remoteJid !== jid) {
        throw new TypeError('A mensagem original não pertence a esta conversa')
      }
      if (typeof text !== 'string' || !text.trim()) {
        throw new TypeError('Informe o novo texto da mensagem')
      }
      return socket.sendMessage(jid, {
        text,
        edit: { ...messageKey, remoteJid: jid, fromMe: true }
      })
    },
    /**
     * Consulta um @username pelo USync do WhatsApp, com PIN opcional.
     * Não revela nem infere o número de telefone.
     */
    async queryUsernameExists(username, pin) {
      if (typeof username !== 'string') throw new TypeError('Informe o @username')
      const normalized = username.trim().replace(/^@/, '')
      if (!/^[A-Za-z0-9_.]{3,30}$/.test(normalized)) {
        throw new TypeError('Username inválido')
      }
      if (pin !== undefined && !/^\d{4}$/.test(pin)) {
        throw new TypeError('O PIN deve conter exatamente 4 dígitos')
      }
      const user = new USyncUser().withUsername(normalized)
      if (pin !== undefined) user.withUsernameKey(pin)
      const query = new USyncQuery().withContactProtocol().withUser(user)
      const response = await socket.executeUSyncQuery(query)
      const contact = response?.list?.find(entry => entry?.contact === true && typeof entry.id === 'string')
      return contact ? { username: normalized, jid: contact.id, wid: contact.id, exists: true } : null
    },

    /**
     * Cria ou altera uma nota comercial via app-state do WhatsApp.
     * Receber uma nota depende de a conta oferecer o recurso comercial.
     */
    async setCustomerNote(jid, content, noteId) {
      requireJid(jid)
      if (jid.endsWith('@g.us') || jid.endsWith('@newsletter')) {
        throw new TypeError('Notas são permitidas apenas em conversas individuais')
      }
      if (typeof content !== 'string' || !content.trim()) {
        throw new TypeError('Informe o conteúdo da nota')
      }
      const id = noteId == null ? customerNoteByChat.get(jid) || randomUUID() : requireId(noteId, 'ID da nota')
      const existing = seenCustomerNotes.get(id)
      const createdAt = existing?.createdAt || Math.floor(Date.now() / 1000)
      const note = { id, chatId: jid, content: content.trim(), createdAt, type: 'unstructured' }
      await socket.chatModify({ noteEdit: { ...note, deleted: false } }, jid)
      seenCustomerNotes.set(id, note)
      customerNoteByChat.set(jid, id)
      return { ...note }
    },

    /** Remove uma nota comercial, identificada pelo JID e/ou ID previamente sincronizado. */
    async deleteCustomerNote(jid, noteId) {
      requireJid(jid)
      const id = noteId == null ? customerNoteByChat.get(jid) : requireId(noteId, 'ID da nota')
      if (!id) throw new Error('Nota não encontrada nesta conexão: informe o ID para excluir')
      const existing = seenCustomerNotes.get(id)
      await socket.chatModify({
        noteEdit: {
          id, chatId: jid, createdAt: existing?.createdAt || Math.floor(Date.now() / 1000),
          content: '', deleted: true
        }
      }, jid)
      seenCustomerNotes.delete(id)
      if (customerNoteByChat.get(jid) === id) customerNoteByChat.delete(jid)
      return true
    },

    /**
     * Nota observada pela sincronização desta conexão ou criada agora.
     * Retorna null se a nota ainda não tiver sido sincronizada.
     */
    getCustomerNote(jid) {
      requireJid(jid)
      const id = customerNoteByChat.get(jid)
      const note = id && seenCustomerNotes.get(id)
      return note ? { ...note } : null
    },

    /**
     * Envia o Native Flow de pagamento Pix para contas WhatsApp compatíveis.
     * Não efetua nem verifica pagamentos.
     */
    async sendPixKeyMessage(jid, data, options = {}) {
      requireJid(jid)
      if (!data || typeof data !== 'object') {
        throw new TypeError('Informe os dados do Pix')
      }
      const { keyType, name, key, instructions = '' } = data
      if (!PIX_KEY_TYPES.has(keyType)) {
        throw new TypeError('keyType deve ser CPF, CNPJ, PHONE, EMAIL ou EVP')
      }
      if (typeof name !== 'string' || !name.trim()) {
        throw new TypeError('Informe o nome do recebedor')
      }
      if (typeof key !== 'string' || !key.trim()) {
        throw new TypeError('Informe a chave Pix')
      }
      if (typeof instructions !== 'string') {
        throw new TypeError('instructions deve ser texto')
      }
      const ref = randomUUID().replace(/-/g, '')
      const zero = { value: 0, offset: 1 }
      const payment = {
        order: {
          items: [{ name: '', retailer_id: `stone-${ref}`, amount: { ...zero }, quantity: 0 }],
          order_type: 'ORDER_WITHOUT_AMOUNT',
          status: 'payment_requested',
          subtotal: { ...zero }
        },
        total_amount: { ...zero },
        reference_id: ref,
        payment_settings: [
          { type: 'pix_static_code', pix_static_code: { key_type: keyType, merchant_name: name.trim(), key: key.trim() } },
          { type: 'cards', cards: { enabled: false } }
        ],
        external_payment_configurations: [
          { type: 'payment_instruction', payment_instruction: instructions }
        ],
        additional_note: '',
        currency: 'BRL',
        type: 'physical-goods'
      }
      return socket.sendMessage(jid, {
        interactive: {
          text: '',
          buttons: [{ name: 'payment_info', buttonParamsJson: JSON.stringify(payment) }],
          messageVersion: 1
        }
      }, options)
    },

    /**
     * Solicita manter/desfazer uma mensagem temporária via KeepInChatMessage.
     * A confirmação depende do servidor e das permissões da conversa.
     */
    async keepMessage(jid, messageKey, keep = true) {
      requireJid(jid)
      if (!messageKey || typeof messageKey !== 'object' || !messageKey.id) {
        throw new TypeError('Informe a chave da mensagem original (messageKey)')
      }
      if (messageKey.remoteJid && messageKey.remoteJid !== jid) {
        throw new TypeError('A mensagem não pertence ao JID informado')
      }
      if (typeof keep !== 'boolean') {
        throw new TypeError('keep deve ser true ou false')
      }
      return socket.relayMessage(jid, {
        keepInChatMessage: {
          key: messageKey,
          keepType: keep ? 1 : 2,
          timestampMs: Date.now()
        }
      }, {})
    },

    /**
     * Atualiza uma etiqueta usando a app-state API já existente na Stone.
     */
    async editLabel(id, updates) {
      requireId(id, 'ID da etiqueta')
      if (!updates || typeof updates !== 'object' || Array.isArray(updates)) {
        throw new TypeError('Informe as alterações da etiqueta')
      }
      const { name, color } = updates
      if (name === undefined && color === undefined) {
        throw new TypeError('Informe name e/ou color')
      }
      if (name !== undefined && (typeof name !== 'string' || !name.trim())) {
        throw new TypeError('name deve ser texto não vazio')
      }
      if (color !== undefined && (!Number.isInteger(color) || color < 0 || color > 19)) {
        throw new TypeError('color deve ser um inteiro de 0 a 19')
      }
      return socket.addLabel('', {
        id: id.trim(),
        ...(name === undefined ? {} : { name: name.trim() }),
        ...(color === undefined ? {} : { color }),
        deleted: false
      })
    },

    /** Exclui uma etiqueta real via app-state. */
    async deleteLabel(id) {
      requireId(id, 'ID da etiqueta')
      return socket.addLabel('', { id: id.trim(), deleted: true })
    },

    /**
     * Apenas etiquetas recebidas em eventos labels.edit desde que o socket iniciou.
     * Não garante listagem completa da conta. Consulte a documentação.
     */
    getLabels() {
      return [...seenLabels.values()].map(label => ({ ...label }))
    },

    /** Consulta a etiqueta que passou pelo sync desta conexão. */
    getLabelById(id) {
      requireId(id, 'ID da etiqueta')
      const label = seenLabels.get(id.trim())
      return label ? { ...label } : undefined
    }
  }
}
