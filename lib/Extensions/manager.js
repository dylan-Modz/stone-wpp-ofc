export function createStonePluginManager(socket) {
    const plugins = new Map();
    let closing = false;
    return {
        async use(plugin, options = {}) {
            if (closing) throw new Error('Stone Plugins foi encerrado');
            const install = typeof plugin === 'function' ? plugin : plugin?.install;
            const name = plugin?.name || options.name;
            if (typeof install !== 'function' || !name || typeof name !== 'string') {
                throw new TypeError('Plugin Stone precisa de name e install()');
            }
            if (plugins.has(name)) throw new Error('Plugin Stone já instalado: ' + name);
            const cleanup = await install({ socket, options });
            if (cleanup !== undefined && typeof cleanup !== 'function') {
                throw new TypeError('install() deve retornar uma função de limpeza ou undefined');
            }
            plugins.set(name, cleanup);
            return name;
        },
        has(name) { return plugins.has(name); },
        list() { return [...plugins.keys()]; },
        async remove(name) {
            if (!plugins.has(name)) return false;
            const cleanup = plugins.get(name);
            plugins.delete(name);
            if (cleanup) await cleanup();
            return true;
        },
        async close() {
            if (closing) return;
            closing = true;
            for (const name of [...plugins.keys()].reverse()) await this.remove(name);
        }
    };
}
