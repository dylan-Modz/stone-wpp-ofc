export interface StonePlugin {
    name: string;
    install(context: {socket: unknown; options: Record<string, unknown>}): void | (() => void | Promise<void>) | Promise<void | (() => void | Promise<void>)>;
}
export interface StonePluginManager {
    use(plugin: StonePlugin, options?: Record<string, unknown>): Promise<string>;
    has(name: string): boolean;
    list(): string[];
    remove(name: string): Promise<boolean>;
    close(): Promise<void>;
}
export declare function createStonePluginManager(socket: unknown): StonePluginManager;
