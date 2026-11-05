'use strict';
function install({ipcMain,shell,getWindow}){
  ipcMain.handle('cinema-open-drink',async(event,value)=>{
    const win=getWindow();
    if(!win||win.isDestroyed()||event.sender!==win.webContents||(event.senderFrame&&event.senderFrame!==win.webContents.mainFrame))throw Error('Недоступно.');
    if(typeof value!=='string'||value.length>2048)throw Error('Некорректная ссылка.');
    let url;try{url=new URL(value);}catch{throw Error('Некорректная ссылка.');}
    if(!['https:','http:'].includes(url.protocol)||url.username||url.password)throw Error('Можно открывать только сайты http/https.');
    await shell.openExternal(url.href);return {ok:true};
  });
}
module.exports={install};
