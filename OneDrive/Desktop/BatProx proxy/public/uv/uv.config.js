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
  try {
    Object.defineProperty(Document.prototype, 'startViewTransition', {
      configurable: true,
      writable: true,
      value: function (cb) {
        var done = Promise.resolve();
        try {
          var out = typeof cb === 'function' ? cb() : (cb && typeof cb.update === 'function' ? cb.update() : undefined);
          done = out && typeof out.then === 'function' ? out.catch(function () {}) : Promise.resolve();
        } catch (e) {}
        return {
          ready: done,
          finished: done,
          updateCallbackDone: done,
          skipTransition: function () {}
        };
      }
    });
  } catch (e) {}
}
