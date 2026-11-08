const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),crypto=require('node:crypto');
const {create,install}=require('../login-vault');
function fixture(){
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'hub-login-test-')),file=path.join(dir,'session.bin'),key=crypto.randomBytes(32);let enabled=true;
 const safeStorage={isEncryptionAvailable:()=>enabled,encryptString(s){const iv=crypto.randomBytes(12),cipher=crypto.createCipheriv('aes-256-gcm',key,iv);return Buffer.concat([iv,cipher.update(s,'utf8'),cipher.final(),cipher.getAuthTag()]);},decryptString(b){const cipher=crypto.createDecipheriv('aes-256-gcm',key,b.subarray(0,12));cipher.setAuthTag(b.subarray(-16));return Buffer.concat([cipher.update(b.subarray(12,-16)),cipher.final()]).toString();}};
 const vault=create({file,safeStorage,now:()=>1000});
 return {vault,file,disable(){enabled=false;},close(){for(const name of ['session.bin','session.bin.tmp'])try{fs.unlinkSync(path.join(dir,name));}catch{}fs.rmdirSync(dir);}};
}
test('badge exposes no bearer or password; persistence is encrypted and strips extra fields',()=>{
 const f=fixture();try{const token='a'.repeat(43);f.vault.save({username:'Alex',callsToken:token,password:'never-store',sessionExpiresAt:5000});
 assert.deepEqual(f.vault.profile(),{username:'Alex',expiresAt:5000});assert(!fs.readFileSync(f.file).includes(Buffer.from(token)));assert.equal(f.vault.read().password,undefined);
 f.vault.clear();assert.equal(f.vault.read(),null);}finally{f.close();}
});
test('corrupt or expired session is removed, no plaintext fallback when OS encryption unavailable',()=>{
 const f=fixture();try{fs.writeFileSync(f.file,'corrupt');assert.equal(f.vault.read(),null);assert(!fs.existsSync(f.file));assert.throws(()=>f.vault.save({username:'Alex',callsToken:'a'.repeat(43),sessionExpiresAt:999}));
 f.disable();assert.deepEqual(f.vault.save({username:'Alex',callsToken:'a'.repeat(43)}),{saved:false});assert(!fs.existsSync(f.file));}finally{f.close();}
});
test('IPC vault rejects other windows and subframes',async()=>{
 const handlers={},mainFrame={},webContents={mainFrame};install({app:{},ipcMain:{handle:(n,f)=>handlers[n]=f},safeStorage:{},getWindow:()=>({webContents})});
 assert.throws(()=>handlers['auth-profile']({sender:{},senderFrame:mainFrame}),/Unauthorized/);
 assert.throws(()=>handlers['auth-session-read']({sender:webContents,senderFrame:{}}),/Unauthorized/);
});
