const fs=require('fs'),path=require('path'),crypto=require('crypto'),assert=require('assert/strict');
const asar=require('@electron/asar'),yaml=require('js-yaml');
const root=path.resolve(__dirname,'..'),dist=path.join(root,'dist');
const archive=path.join(dist,'win-unpacked/resources/app.asar');
const pkg=JSON.parse(fs.readFileSync(path.join(root,'package.json')));
for(const file of ['casino-art.js','assets/casino/slot-vault.png','assets/casino/symbol-atlas.png','assets/casino/race-arena.png'])assert(asar.extractFile(archive,path.normalize(file)).equals(fs.readFileSync(path.join(root,file))),'Packaged artwork differs: '+file);
assert.equal(JSON.parse(asar.extractFile(archive,'package.json')).version,pkg.version);
for(const file of ['terra.js','terra.css','royale-core.js','cs16-weapon-grip.js','cs16-field-view.js','royale-landscape.js','royale-city.js','royale-view.js','royale-client.js','royale.css',...fs.readdirSync(path.join(root,'models/royale')).map(n=>'models/royale/'+n),...fs.readdirSync(path.join(root,'assets/royale')).map(n=>'assets/royale/'+n),'cs16-passages.js','cs16-passage-view.js','cs16-front.js','cs16-heat-scope.js','cs16-front-view.js','cs16-missile-view.js','cs16-terrain.js','cs16-environment.js','cs16-environment-view.js','cs16-field-effects.js','cs16-adaptive-quality.js','cs16-battle-audio.js','cs16-weapon-animation.js','cs16-footsteps.js','cs16-weapon-finish.js','cs16-landscape.js','assistance-protocol.js','assistance-input.js','assistance-stream.js','cs16-magic.js','cs16-magic-client.js','voxel-life.js','navigation-icons.js','startup-voice.js','assets/audio/welcome.wav','assistance-client.js','assistance-native.js',...fs.readdirSync(path.join(root,'assets/cs16')).map(n=>'assets/cs16/'+n),'cs16-characters.js','assets/cs16/ember.png','assets/cs16/tide.png','assets/cs16/jade.png','assets/cs16/aurora.png','solar-orbit.js','assets/navigation/unique-heroes.png','assets/navigation/hero-pedestals-transparent.png','cs16-classes.js','hero-navigation.js','hero-navigation.css','hub-experience.js','hub-experience.css','cs16-buildings.js','assets/navigation/hero-pedestals.png','assets/comic/page-one.png','assets/comic/page-two.png','voxel-core.js','voxel-game.js','voxel-game.css','cs16-props.js','cs16-conquest-ui.js','models/tank.glb','models/heli.glb','models/bastion.glb','models/storm.glb','cs16-combat.js','chat-session.js','support-chat.js','main.js','renderer.js','app-ui.js','app-theme.css','hub-features.css','calls-inbox.js','exchange-catalog.js','game-loader.js','browser-cookies.js','cookie-dialog.js','team-access.js','radio.js','radio.css','media-volume.js','media-volume.css','cinema.js','cinema-voice.js','cinema-host-main.js','cinema-library-main.js','radio-host-main.js','radio-library-main.js','cinema-snacks.js','cinema-snacks.css','cinema-links-main.js','assets/cinema/cola.svg','assets/cinema/sprite.svg','assets/cinema/fanta.svg','cinema.css','cinema-vip.css','work-tools.js','casino-design.js','notification.html','image.html','cs16.js','cs16-graphics.js','cs16-graphics.css','index.html',...fs.readdirSync(path.join(root,'models/csgo')).filter(n=>n.endsWith('.glb')).map(n=>'models/csgo/'+n)]){
 assert(asar.extractFile(archive,path.normalize(file)).equals(fs.readFileSync(path.join(root,file))),'Packaged source differs: '+file);
}
for (const file of ['brave-shortcuts-main.js','brave-shortcuts.js','team-office.js','team-office.css','voxel-bedrock-data.js','voxel-bedrock.js','voxel-florist.js','voxel-life.js']) assert(asar.extractFile(archive,file).equals(fs.readFileSync(path.join(root,file))));
for (const file of ['manifest.json','content.js','popup.html']) assert(fs.readFileSync(path.join(dist,'win-unpacked/resources/brave-extension',file)).equals(fs.readFileSync(path.join(root,'brave-extension',file))));
const entries=asar.listPackage(archive).map(n=>n.replace(/\\/g,'/'));
assert(!entries.some(n=>/support2|models\/s2\//i.test(n)),'Removed Support2 files must not be packaged');
assert(!entries.includes('/toolbar.html')&&!entries.includes('/quick.html'),'Pet windows must not be packaged');
const updater=yaml.load(fs.readFileSync(path.join(dist,'win-unpacked/resources/app-update.yml'),'utf8'));
assert.equal(updater.provider,'github');assert.equal(updater.owner,'pol593925-svg');assert.equal(updater.repo,'fifflaren');
const channel=pkg.version.split('-')[1]?.split('.')[0]||'latest';
const metadataFile=fs.existsSync(path.join(dist,channel+'.yml'))?channel+'.yml':'latest.yml';
const latest=yaml.load(fs.readFileSync(path.join(dist,metadataFile),'utf8'));
assert.equal(latest.version,pkg.version);
const exe=fs.readFileSync(path.join(dist,latest.path));
const hash=crypto.createHash('sha512').update(exe).digest('base64');
assert.equal(latest.sha512,hash);assert.equal(latest.files[0].sha512,hash);assert.equal(latest.files[0].size,exe.length);
assert(fs.existsSync(path.join(dist,latest.path+'.blockmap')));
console.log(JSON.stringify({version:pkg.version,installer:latest.path,bytes:exe.length,sha512:hash,packagedAssets:'match source',autoUpdate:updater.provider+'/'+updater.owner+'/'+updater.repo},null,2));
