/**
 * A phone JID is written into credentials while a pairing code is REQUESTED,
 * so creds.me alone cannot identify a linked session. Only pair-success,
 * validated against the WhatsApp account signature, supplies the account.
 */
export const hasCompletedStonePairing = (creds) =>
    !!(creds?.me?.id && creds?.account);
