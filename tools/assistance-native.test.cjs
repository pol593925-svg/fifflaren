const {test}=require('node:test'),assert=require('node:assert/strict'),{EventEmitter}=require('node:events'),{install}=require('../assistance-native');
const pause=ms=>new Promise(r=>setTimeout(r,ms));
test('native input: scaled coordinates, coalescing, drag, text, clipboard, fullscreen, primary capture and cleanup',async()=>{
 const handlers={},writes=[],opened=[],children=[],clip=[],shortcuts=new Map();let fullscreen=false,captures=0;
 const wc=new EventEmitter();wc.send=()=>{};wc.getBackgroundThrottling=()=>true;wc.setBackgroundThrottling=()=>{};const main={isDestroyed:()=>false,webContents:wc,isFullScreen:()=>fullscreen,setFullScreen:v=>fullscreen=v};
 class Window extends EventEmitter{constructor(){super();this.webContents=new EventEmitter();}setAlwaysOnTop(){}setMenu(){}async loadURL(){}showInactive(){}isDestroyed(){return !!this.dead;}destroy(){this.dead=true;this.emit('closed');}}
 const service=install({ipcMain:{handle:(n,f)=>handlers[n]=f},BrowserWindow:Window,
 screen:{getPrimaryDisplay:()=>({id:2,bounds:{x:0,y:0,width:1001,height:501}}),dipToScreenPoint:p=>({x:p.x*2,y:p.y*2})},
 shell:{openExternal:async u=>opened.push(u)},clipboard:{writeText:s=>clip.push(s),readText:()=> 'Из буфера'},
 desktopCapturer:{getSources:async o=>{captures++;assert.equal(o.thumbnailSize.width,0);return [{display_id:'1',id:'wrong'},{display_id:'2',id:'screen:2'}];}},
 globalShortcut:{register:(k,f)=>{shortcuts.set(k,f);return true;},unregister:k=>shortcuts.delete(k)},app:new EventEmitter(),getMain:()=>main,
 spawn:(cmd,args,opts)=>{assert(opts.windowsHide);const p=new EventEmitter();p.stdin={on(){},writable:true,write:s=>writes.push(JSON.parse(s)),end(){setImmediate(()=>p.emit('exit'));}};p.stderr=new EventEmitter();p.stdout=new EventEmitter();setImmediate(()=>p.stdout.emit('data',Buffer.from('READY')));p.kill=()=>p.killed=true;children.push(p);return p;}});
 const e={sender:wc};await assert.rejects(handlers['assistance-begin']({sender:{}},{id:'x',admin:'a'}));
 await handlers['assistance-begin'](e,{id:'one',admin:'admin'});assert(service.canCapture(wc));assert(!service.canCapture({}));
 assert.deepEqual(await handlers['assistance-source'](e,{id:'one'}),{id:'screen:2'});assert.equal(captures,1);
 for(let i=0;i<30;i++)await handlers['assistance-command'](e,{id:'one',kind:'move',x:i/29,y:.5});
 await pause(30);assert.equal(writes.length,1);assert.deepEqual(writes[0],{kind:'move',x:2000,y:500});
 for(const kind of ['down','up'])await handlers['assistance-command'](e,{id:'one',kind,button:0,x:.5,y:.5});
 assert.equal(writes[1].x,1000);assert.equal(writes[2].kind,'up');
 await handlers['assistance-command'](e,{id:'one',kind:'text',text:'Привет'});
 assert.equal(writes.at(-1).text,'Привет');
 await handlers['assistance-command'](e,{id:'one',kind:'paste',text:'Текст\nбуфера'});
 assert.equal(clip[0],'Текст\nбуфера');assert.equal(writes.at(-1).vk,86);assert(writes.at(-1).ctrl);
 await assert.rejects(handlers['assistance-command'](e,{id:'wrong',kind:'text',text:'bad'}));
 await assert.rejects(handlers['assistance-command'](e,{id:'one',kind:'url',url:'javascript:alert(1)'}));
 await handlers['assistance-command'](e,{id:'one',kind:'url',url:'https://example.com'});
 assert.equal(opened[0],'https://example.com/');
 await handlers['assistance-begin'](e,{id:'two',admin:'admin'});children[0].emit('exit');
 await handlers['assistance-command'](e,{id:'two',kind:'key',code:'ArrowLeft',shift:true});
 shortcuts.get('Control+Alt+F12')();assert.equal(writes.at(-1).kind,'release');assert(!service.canCapture(wc));
 await assert.rejects(handlers['assistance-command'](e,{id:'two',kind:'key',code:'KeyA'}));
 handlers['assistance-view'](e,true);assert(fullscreen);assert.equal(handlers['assistance-clipboard'](e),'Из буфера');
 handlers['assistance-stop'](e);assert(!fullscreen);
 fullscreen=true;handlers['assistance-view'](e,true);handlers['assistance-stop'](e);assert(fullscreen,'restore preexisting fullscreen');service.stop();
});
