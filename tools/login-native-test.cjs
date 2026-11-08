const {app,BrowserWindow,ipcMain,safeStorage}=require('electron'),fs=require('node:fs'),path=require('node:path'),os=require('node:os'),assert=require('node:assert/strict');
const temp=fs.mkdtempSync(path.join(os.tmpdir(),'hub-login-native-'));
app.setPath('userData',temp);let win;
require('../login-vault').install({app,ipcMain,safeStorage,getWindow:()=>win});
app.whenReady().then(async()=>{
 try{
  assert(safeStorage.isEncryptionAvailable(),'OS credential encryption must be available');
  win=new BrowserWindow({show:false,webPreferences:{nodeIntegration:true,contextIsolation:false}});
  await win.loadURL('about:blank');
  const result=await win.webContents.executeJavaScript(`(async()=>{
   const ipc=require('electron').ipcRenderer;
   const first=await ipc.invoke('auth-profile');
   const saved=await ipc.invoke('auth-save',{username:'QA',callsToken:'q'.repeat(43),sessionExpiresAt:Date.now()+60000});
   const profile=await ipc.invoke('auth-profile'),session=await ipc.invoke('auth-session-read');
   return {first:first.profile,saved,profile:profile.profile,hasToken:!!session?.token};
  })()`);
  assert.equal(result.first,null);assert(result.saved.saved);assert.equal(result.profile.username,'QA');assert(!result.profile.token);assert(result.hasToken);
  const encrypted=fs.readFileSync(path.join(temp,'login-session.bin'));assert(!encrypted.includes(Buffer.from('q'.repeat(43))));
  await win.webContents.executeJavaScript("require('electron').ipcRenderer.invoke('auth-forget')");
  assert(!fs.existsSync(path.join(temp,'login-session.bin')));
  console.log('NATIVE LOGIN PASS: Windows encryption, trusted main-frame IPC, saved profile and explicit removal.');
  win.destroy();app.exit(0);
 }catch(e){console.error(e.message);win?.destroy();app.exit(1);}
});
