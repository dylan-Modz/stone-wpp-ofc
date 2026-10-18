import { DEFAULT_CONNECTION_CONFIG } from '../Defaults/index.js';
import { makeCommunitiesSocket } from './communities.js';
import { createStoneAdditionalMethods } from './stone-features.js';
// export the last socket layer
const makeWASocket = (config) => {
    const newConfig = {
        ...DEFAULT_CONNECTION_CONFIG,
        ...config
    };
    const socket = makeCommunitiesSocket(newConfig);
    return Object.assign(socket, createStoneAdditionalMethods(socket));
};
export default makeWASocket;
