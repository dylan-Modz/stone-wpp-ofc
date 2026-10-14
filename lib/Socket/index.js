import { DEFAULT_CONNECTION_CONFIG } from '../Defaults/index.js';
import { makeCommunitiesSocket } from './communities.js';
import { attachStoneFeatures } from '../Recursos/index.js';
// export the last socket layer
const makeWASocket = (config) => {
    const newConfig = {
        ...DEFAULT_CONNECTION_CONFIG,
        ...config
    };
    return attachStoneFeatures(makeCommunitiesSocket(newConfig), config?.stone);
};
export default makeWASocket;
//# sourceMappingURL=index.js.map