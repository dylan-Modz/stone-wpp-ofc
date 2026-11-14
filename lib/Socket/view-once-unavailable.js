/**
 * O WhatsApp pode enviar um aviso view-once sem o conteúdo criptografado.
 * Esse evento permite diagnosticar a recepção sem inventar mediaKey e sem
 * solicitar um reenvio que o protocolo marcou como indisponível.
 */
export const buildUnavailableViewOnceEvent = (unavailableType, message) => {
    if (unavailableType !== 'view_once' && unavailableType !== 'view_once_unavailable_fanout') {
        return null;
    }
    if (message?.message || !message?.key?.remoteJid || !message?.key?.id) {
        return null;
    }
    return {
        kind: 'view_once',
        key: { ...message.key, isViewOnce: true },
        unavailableType,
        messageTimestamp: message.messageTimestamp
    };
};
