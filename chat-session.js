// Tawk's widget endpoint rejects Electron product tokens. Retain Chromium's UA
// for this provider only, without changing CORS, sandboxing or app requests.
module.exports = function configureChatSession(session) {
  const userAgent = session.getUserAgent()
    .replace(/\sElectron\/\S+/g, '')
    .replace(/\ssupport-hub-desktop\/\S+/gi, '');
  session.webRequest.onBeforeSendHeaders(
    { urls: ['https://tawk.to/*', 'https://*.tawk.to/*'] },
    (details, done) => done({ requestHeaders: { ...details.requestHeaders, 'User-Agent': userAgent } })
  );
};
