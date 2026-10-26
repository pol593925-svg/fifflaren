const fs=require('fs'),path=require('path'),crypto=require('crypto'),assert=require('assert/strict');
const asar=require('@electron/asar'),yaml=require('js-yaml');
const root=path.resolve(__dirname,'..'),dist=path.join(root,'dist');
const archive=path.join(dist,'win-unpacked/resources/app.asar');
const pkg=JSON.parse(fs.readFileSync(path.join(root,'package.json')));
for(const file of ['support2-world.js','casino-art.js','assets/casino/slot-vault.png','assets/casino/symbol-atlas.png','assets/casino/race-arena.png','assets/support2/forest-floor.png'])assert(asar.extractFile(archive,path.normalize(file)).equals(fs.readFileSync(path.join(root,file))),'Packaged artwork differs: '+file);
assert.equal(JSON.parse(asar.extractFile(archive,'package.json')).version,pkg.version);
for(const file of ['chat-session.js','support-chat.js','main.js','renderer.js','app-ui.js','app-theme.css','hub-features.css','calls-inbox.js','exchange-catalog.js','casino-design.js','support2.js','support2-effects.js','notification.html','image.html','cs16.js','cs16-graphics.js','cs16-graphics.css','index.html',...fs.readdirSync(path.join(root,'models/csgo')).filter(n=>n.endsWith('.glb')).map(n=>'models/csgo/'+n)]){
 assert(asar.extractFile(archive,path.normalize(file)).equals(fs.readFileSync(path.join(root,file))),'Packaged source differs: '+file);
}
const entries=asar.listPackage(archive).map(n=>n.replace(/\\/g,'/'));
assert(!entries.includes('/toolbar.html')&&!entries.includes('/quick.html'),'Pet windows must not be packaged');
const updater=yaml.load(fs.readFileSync(path.join(dist,'win-unpacked/resources/app-update.yml'),'utf8'));
assert.equal(updater.provider,'github');assert.equal(updater.owner,'pol593925-svg');assert.equal(updater.repo,'fifflaren');
const latest=yaml.load(fs.readFileSync(path.join(dist,'latest.yml'),'utf8'));
assert.equal(latest.version,pkg.version);
const exe=fs.readFileSync(path.join(dist,latest.path));
const hash=crypto.createHash('sha512').update(exe).digest('base64');
assert.equal(latest.sha512,hash);assert.equal(latest.files[0].sha512,hash);assert.equal(latest.files[0].size,exe.length);
assert(fs.existsSync(path.join(dist,latest.path+'.blockmap')));
console.log(JSON.stringify({version:pkg.version,installer:latest.path,bytes:exe.length,sha512:hash,packagedAssets:'match source',autoUpdate:updater.provider+'/'+updater.owner+'/'+updater.repo},null,2));
