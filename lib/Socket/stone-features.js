import { randomUUID } from 'node:crypto'

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
