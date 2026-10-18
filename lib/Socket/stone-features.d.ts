import type { MiscMessageGenerationOptions, WAMessage, WAMessageKey } from '../Types/index.js'
import type { Label } from '../Types/Label.js'

export interface StoneAdditionalMethods {
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
