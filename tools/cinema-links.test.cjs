const {test}=require('node:test'),assert=require('node:assert/strict'),{install}=require('../cinema-links-main');
test('only the main app frame can open a drink website, with no custom protocols',async()=>{
  let handler;const opened=[],frame={},sender={mainFrame:frame};
  install({ipcMain:{handle:(name,fn)=>handler=fn},shell:{openExternal:async url=>opened.push(url)},getWindow:()=>({isDestroyed:()=>false,webContents:sender})});
  for(const value of ['file:///C:/app.exe','javascript:alert(1)','supporthub://do','https://user:pass@example.org',null])
    await assert.rejects(handler({sender,senderFrame:frame},value));
  await assert.rejects(handler({sender:{}},'https://example.org/'));
  await assert.rejects(handler({sender,senderFrame:{}},'https://example.org/'));
  await handler({sender,senderFrame:frame},'https://example.org/drink?kind=cola');
  assert.deepEqual(opened,['https://example.org/drink?kind=cola']);
});
