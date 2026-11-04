const test=require('node:test'),assert=require('node:assert/strict'),os=require('node:os'),path=require('node:path'),fs=require('node:fs');
const {DatabaseSync}=require('node:sqlite'),{domain,erase}=require('../browser-cookies');
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
