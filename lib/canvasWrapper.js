/**
 * canvasWrapper.js — safe lazy loader for the canvas native module.
 *
 * On platforms where the native binary isn't compiled (Pterodactyl, Heroku, etc.),
 * canvas commands will throw a descriptive error caught by their own try/catch,
 * instead of flooding logs with unhandled rejections at startup.
 */

let _canvas = null;

try {
    _canvas = await import('canvas');
} catch {
    // Native binary not compiled on this platform — canvas features unavailable
}

const _unavailable = (name) => (..._args) => {
    throw new Error(`❌ Canvas is not available on this server (missing native build for '${name}'). Feature unsupported.`);
};

export const createCanvas  = _canvas?.createCanvas  ?? _unavailable('createCanvas');
export const registerFont  = _canvas?.registerFont  ?? ((..._args) => {}); // no-op if missing — safe to ignore
export const loadImage     = _canvas?.loadImage     ?? _unavailable('loadImage');
export const Image         = _canvas?.Image         ?? class Image { constructor() { throw new Error(`❌ Canvas is not available on this server (missing native build for 'Image'). Feature unsupported.`); } };
