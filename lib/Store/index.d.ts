export interface StoneStore {
    get<T = unknown>(key: string): Promise<T | undefined>;
    set(key: string, value: unknown): Promise<boolean>;
    delete(key: string): Promise<boolean>;
    list(prefix?: string): Promise<Array<{key: string; value: unknown}>>;
    clear(): Promise<void>;
    close(): Promise<void>;
}
export declare function createMemoryStore(initial?: Record<string, unknown>): StoneStore;
export declare function createJsonStore(filename: string): Promise<StoneStore>;
export declare function createSqliteStore(filename: string): Promise<StoneStore>;
export declare function createStoneStore(options?: 'memory' | 'json' | 'sqlite' | {type?: 'memory' | 'json' | 'sqlite'; path?: string; initial?: Record<string, unknown>}): Promise<StoneStore>;
