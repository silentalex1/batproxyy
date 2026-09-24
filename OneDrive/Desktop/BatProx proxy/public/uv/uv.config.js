self.__uv$config = {
  prefix: '/uv/service/',
  encodeUrl: Ultraviolet.codec.xor.encode,
  decodeUrl: Ultraviolet.codec.xor.decode,
  handler: '/uv/uv.handler.js',
  client: '/uv/uv.client.js',
  bundle: '/uv/uv.bundle.js',
  config: '/uv/uv.config.js',
  sw: '/uv/uv.sw.js'
};
if (typeof Document !== 'undefined' && Document.prototype && 'startViewTransition' in Document.prototype) {
  try { delete Document.prototype.startViewTransition; } catch (e) {}
  try { Object.defineProperty(Document.prototype, 'startViewTransition', { value: undefined, configurable: true, writable: true }); } catch (e) {}
}
