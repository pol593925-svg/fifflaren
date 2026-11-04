const test=require('node:test'),assert=require('node:assert/strict'),os=require('node:os'),path=require('node:path'),fs=require('node:fs');
const {DatabaseSync}=require('node:sqlite'),{domain,erase,install}=require('../browser-cookies');
for(const firefox of [false,true])test('domain cleanup in a synthetic '+(firefox?'Firefox':'Chromium')+' profile',()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'hub-cookies-test-')),file=path.join(dir,'synthetic.sqlite');
  const table=firefox?'moz_cookies':'cookies',key=firefox?'host':'host_key';
  let db=new DatabaseSync(file);
  db.exec('CREATE TABLE '+table+' ('+key+' TEXT);CREATE TABLE unrelated(value TEXT);INSERT INTO unrelated VALUES(\'keep\')');
  for(const site of ['.Example.test','.sub.example.test','notexample.test','example.test.example.org'])db.prepare('INSERT INTO '+table+' VALUES(?)').run(site);
  db.close();
  try{assert.equal(erase(file,firefox,domain('https://example.test/path')),2);db=new DatabaseSync(file);
    assert.deepEqual(db.prepare('SELECT '+key+' AS site FROM '+table).all().map(r=>r.site),['notexample.test','example.test.example.org']);assert.equal(db.prepare('SELECT value FROM unrelated').get().value,'keep');db.close();assert.throws(()=>domain('file://example.test'));
  }finally{fs.unlinkSync(file);fs.rmdirSync(dir);}
});

test('one local yes/no prompt binds a site to the selected profile for each browser',async t=>{
  const base=fs.mkdtempSync(path.join(os.tmpdir(),'hub-consent-')),saved=[process.env.APPDATA,process.env.LOCALAPPDATA];
  process.env.APPDATA=process.env.LOCALAPPDATA=base;
  t.after(()=>{
    for(const [i,k] of ['APPDATA','LOCALAPPDATA'].entries()){if(saved[i]===undefined)delete process.env[k];else process.env[k]=saved[i];}
    fs.rmSync(base,{recursive:true});
  });
  for(const [id,folder] of Object.entries({chrome:'Google/Chrome/User Data',edge:'Microsoft/Edge/User Data',brave:'BraveSoftware/Brave-Browser/User Data',firefox:'Mozilla/Firefox/Profiles'})){
    const root=path.join(base,folder),firefox=id==='firefox',files=[];
    for(const p of ['Default','My Profile']){
      const file=path.join(root,p,firefox?'cookies.sqlite':'Network/Cookies');
      fs.mkdirSync(path.dirname(file),{recursive:true});
      const db=new DatabaseSync(file);
      db.exec('CREATE TABLE '+(firefox?'moz_cookies(host':'cookies(host_key')+" TEXT);INSERT INTO "+(firefox?'moz_cookies':'cookies')+" VALUES('.work.test'),('.sub.work.test'),('.personal.test')");
      db.close();files.push(file);
    }
    if(firefox)fs.writeFileSync(path.join(root,'../profiles.ini'),'[Install0123]\nDefault=Profiles/My Profile\n');
    else fs.writeFileSync(path.join(root,'Local State'),JSON.stringify({profile:{last_used:'My Profile'}}));
    const rows=file=>{const db=new DatabaseSync(file,{readOnly:true});try{return db.prepare('SELECT COUNT(*) AS n FROM '+(firefox?'moz_cookies':'cookies')).get().n;}finally{db.close();}};
    let invoke,answer=1,prompts=0,closed=false,checks=0;
    const frame={},win={webContents:{mainFrame:frame},isVisible:()=>true,isMinimized:()=>false};
    const dialog={showMessageBox:async(parent,opts)=>{
      assert.equal(parent,win);assert.deepEqual(opts.buttons,['Да','Нет']);assert.equal(opts.cancelId,1);assert.equal(opts.defaultId,1);
      assert.match(opts.message,/work\.test/);assert.match(opts.detail,/My Profile/);prompts++;return {response:answer};
    }};
    install({ipcMain:{handle:(name,fn)=>{assert.equal(name,'clear-browser-cookies');invoke=fn;}},getWindow:()=>win,dialog,isClosed:async()=>{checks++;return closed;}});
    const ev={sender:win.webContents,senderFrame:frame},payload={id,site:'work.test'};
    await assert.rejects(invoke({...ev,senderFrame:{}},payload));await assert.rejects(invoke(ev,{id,all:true}));
    assert.equal(prompts,0);assert.equal((await invoke(ev,payload)).cancelled,true);
    assert.equal(checks,0);assert.deepEqual(files.map(rows),[3,3]);
    answer=0;await assert.rejects(invoke(ev,payload),/открыт/);assert.deepEqual(files.map(rows),[3,3]);
    closed=true;assert.deepEqual(await invoke(ev,payload),{count:2});assert.deepEqual(files.map(rows),[3,1]);assert.equal(prompts,3);
  }
});
