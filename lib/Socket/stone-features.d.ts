import type { MiscMessageGenerationOptions, WAMessage, WAMessageKey } from '../Types/index.js'
import type { Label } from '../Types/Label.js'

export interface StoneAdditionalMethods {
  /** Envia link de participação em chamada ao grupo; não inicia mídia/VoIP nem toca os celulares. */
  sendGroupCallInvite(groupJid: string, options?: { type?: 'audio' | 'video'; text?: string }): Promise<{
    groupJid: string;
    type: 'audio' | 'video';
    url: string;
    message: WAMessage;
  }>;
  /** Resolve o vínculo PN/LID conhecido pela sessão. null significa não resolvido. */
  resolveJidMapping(jid: string): Promise<{ input: string; pn: string | null; lid: string | null; resolved: boolean }>;
  /** Consulta se existe uma sessão Signal para o JID sem alterar suas chaves. */
  inspectSignalSession(jid: string): Promise<{ jid: string; exists: boolean }>;
  /** Edita o texto de mensagem enviada pelo próprio bot; não edita mensagens de terceiros. */
  editMessage(jid: string, messageKey: WAMessageKey, text: string): Promise<WAMessage | undefined>;
  /** Pesquisa username pelo USync. Não retorna números de telefone. */
  queryUsernameExists(username: string, pin?: string): Promise<{ username: string; jid: string; wid: string; exists: true } | null>;
  /** Cria ou altera uma nota da conta WhatsApp Business via app-state. */
  setCustomerNote(jid: string, content: string, noteId?: string): Promise<{ id: string; chatId: string; content: string; createdAt: number; type: 'unstructured' }>;
  /** Exclui a nota de uma conversa; exige id conhecido ou sincronizado. */
  deleteCustomerNote(jid: string, noteId?: string): Promise<boolean>;
  /** Nota observada pela sincronização desta conexão; pode ser null mesmo se existir no WhatsApp. */
  getCustomerNote(jid: string): { id: string; chatId: string; content: string; createdAt: number; type: 'unstructured' } | null;
  /** Native Flow Pix. Envia a chave, não processa pagamento; depende da conta WhatsApp. */
  sendPixKeyMessage(
    jid: string,
    data: { keyType: 'CPF' | 'CNPJ' | 'PHONE' | 'EMAIL' | 'EVP'; name: string; key: string; instructions?: string },
    options?: MiscMessageGenerationOptions
  ): Promise<WAMessage | undefined>;
  /** Solicitação KeepInChat; exige permissões e mensagem ainda disponível. */
  keepMessage(jid: string, messageKey: WAMessageKey, keep?: boolean): Promise<string>;
  /** Edita a etiqueta no app-state do WhatsApp. */
  editLabel(id: string, updates: { name?: string; color?: number }): Promise<unknown>;
  /** Exclui uma etiqueta no app-state do WhatsApp. */
  deleteLabel(id: string): Promise<unknown>;
  /** Etiquetas observadas pelos eventos labels.edit desta conexão; lista pode ser parcial. */
  getLabels(): Label[];
  /** Etiqueta observada no app-state nesta conexão, ou undefined. */
  getLabelById(id: string): Label | undefined;
}
export declare function createStoneAdditionalMethods(socket: unknown): StoneAdditionalMethods
