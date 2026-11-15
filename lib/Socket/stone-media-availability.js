/**
 * Diagnostic metadata for messages that the WhatsApp server did not supply to
 * the linked client. Never requests unavailable media or exposes message keys.
 */
export const emitMediaAvailability = (ev, key, reason) => {
    if (!key?.remoteJid || !key?.id || typeof ev?.emit !== 'function') return false;
    if (!['view_once_unavailable', 'view_once_unavailable_fanout', 'missing_message_secret'].includes(reason)) return false;
    ev.emit('stone.message.availability', {
        remoteJid: key.remoteJid,
        messageId: key.id,
        reason,
        available: false,
        receivedAt: Date.now()
    });
    return true;
};
