// Reproducible migration through the original genmap/update_maps workflow.
const fs=require('fs'),path=require('path'),cp=require('child_process');
const root=path.resolve(__dirname,'..'),base=path.dirname(root),server=path.join(base,'support-hub-server');
function edit(file,old,next){const s=fs.readFileSync(file,'utf8');if(s.includes(next))return;if(!s.includes(old))throw Error('Anchor missing: '+file+' '+old.slice(0,50));fs.writeFileSync(file,s.replace(old,next));}
edit(path.join(root,'cs16-terrain.js'),'  function buildingSites(grid) {',"  function buildingSites(grid) {\n    const tactical=(typeof window==='undefined'?require('./cs16-tactical-map'):window.CS16TacticalMap)?.buildings(grid);if(tactical)return tactical;");
edit(path.join(root,'cs16.js'),"  let curMap = 'dust2';","  for(const name of ['dust2','inferno'])Object.assign(MAP_META[name],CS16TacticalMap.definition(name));\n  let curMap = 'dust2';");
for(const file of ['index.html','tools/graphics-smoke.cjs','tools/electron-load-test.cjs']){
 const p=path.join(root,file),s=fs.readFileSync(p,'utf8');
 if(s.includes('cs16-tactical-map'))continue;
 const prefix=file==='tools/graphics-smoke.cjs'?'/':'';
 const before=file.endsWith('electron-load-test.cjs')?"'cs16-terrain.js'":'<script src="'+prefix+'cs16-terrain.js"></script>';
 const after=file.endsWith('electron-load-test.cjs')?"'cs16-tactical-map.js',"+before:'<script src="'+prefix+'cs16-tactical-map.js"></script>'+before;
 edit(p,before,after);
}
for(const f of ['cs16-tactical-map.js','cs16-terrain.js','cs16-buildings.js'])fs.copyFileSync(path.join(root,f),path.join(server,f));
const gen=path.join(base,'servertest/genmap.js');
edit(gen,'const S = 3,',"if(process.argv.includes('--tactical')){const t=require('../fifflaren-app/cs16-tactical-map');for(const m of ['dust2','inferno'])console.log('=== '+m.toUpperCase()+' ===\\n'+t.generate(m).join('\\n'));process.exit(0);}\nconst S = 3,");
fs.mkdirSync(path.join(base,'deliverables'),{recursive:true});fs.writeFileSync(path.join(base,'deliverables/maprows.txt'),cp.execFileSync(process.execPath,[gen,'--tactical']));
cp.execFileSync(process.execPath,[path.join(base,'servertest/update_maps.js')],{stdio:'inherit'});
edit(path.join(server,'server.js'),'// вейпоинты для ботов (клетки)',"const CS16TacticalMap=require('./cs16-tactical-map');\n// вейпоинты для ботов (клетки)");
edit(path.join(server,'server.js'),'// 3.24.0: статистика и ранги CS',"for(const name of ['dust2','inferno'])CS16_WPS[name]=CS16TacticalMap.waypoints(name);\n// 3.24.0: статистика и ранги CS");
edit(path.join(server,'server.js'),"const safe=require('./cs16-props').safeSpawn(CS16_GRID[cs16.map]||CS16_GRID.dust2,pos);","const safe=require('./cs16-props').safeSpawn(CS16_GRID[cs16.map]||CS16_GRID.dust2,CS16TacticalMap.identify(CS16_GRID[cs16.map])?CS16TacticalMap.spawn(cs16.map,team,index):pos);");
// Reject planting outside an actual A/B footprint, including spoofed remote positions.
edit(path.join(server,'server.js'),"    const site = d && d.site === 'B' ? 'B' : 'A';","    const site=CS16TacticalMap.siteAt(cs16.map,d?.pos);\n    if(!site||site!==d.site||![p.lx,p.ly,p.lz].every(Number.isFinite)||Math.hypot(p.lx-d.pos[0],p.lz-d.pos[2])>3.5||Math.abs(p.ly-d.pos[1])>.75)return;");
console.log('Tactical maps, metadata, spawns and objective validation synchronized.');
