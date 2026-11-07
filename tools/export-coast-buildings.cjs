const fs=require('fs'),path=require('path'),vm=require('vm');
const source=fs.readFileSync(path.join(__dirname,'../cs16.js'),'utf8');
const maps=vm.runInNewContext('('+source.match(/const MAP_ROWS = (\{[\s\S]*?\n  \});/)[1]+')');
maps.frontline=require('../cs16-front').district();
const name=process.argv[2]||'dust2',codes={'#':1,'.':0,D:2,C:3,4:4,5:5,6:6,7:7,V:8,B:9,S:10,T:11};
const grid=maps[name].map(row=>Array.from(row,ch=>codes[ch]));
const data=require('../cs16-buildings').layout(grid,name);
process.stdout.write(JSON.stringify({tactical:require('../cs16-tactical-map').definition(name),buildings:data.buildings,boxes:data.boxes.filter(b=>!b.dust)}));
