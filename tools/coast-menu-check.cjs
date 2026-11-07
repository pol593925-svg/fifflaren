const assert=require('assert/strict'),path=require('path');
module.exports=async(page,outputs,errors)=>{
 const players=[{nick:'Fifflaren',team:'ct',characterId:'classic'},{nick:'Alex',team:'ct',characterId:'jade'},{nick:'Orix',team:'t',characterId:'tide'},{nick:'knyaz',team:null}];
 await page.evaluate(p=>__qa.lobby('Fifflaren',p,'Fifflaren'),players);
 const nav=key=>page.locator('.coast-nav [data-page='+key+']');
 await nav('plaza').click();await page.screenshot({path:path.join(outputs,'coast-menu-plaza.png')});
 await page.getByRole('button',{name:'ИГРАТЬ  →',exact:true}).click();assert(await page.locator('.coast-squad').isVisible());
 await page.locator('#cs16JoinCT').click();assert.deepEqual(await page.evaluate(()=>__emitted.at(-1)),{n:'cs16_team',d:'ct'});
 await page.locator('#cs16StartBtn').click();assert.deepEqual(await page.evaluate(()=>__emitted.at(-1)),{n:'cs16_start',d:undefined});
 await page.locator('.coast-match-settings summary').click();await page.locator('.cs16MapBtn[data-m=inferno]').click();assert.deepEqual(await page.evaluate(()=>__emitted.at(-1)),{n:'cs16_map',d:'inferno'});
 await page.locator('#cs16Army').check();assert.deepEqual(await page.evaluate(()=>__emitted.at(-1)),{n:'cs16_army',d:true});
 await page.screenshot({path:path.join(outputs,'coast-menu-squad.png')});
 await nav('arsenal').click();await page.waitForFunction(()=>document.querySelector('.coast-preview canvas')?.width>100);
 await page.getByLabel('Оружие для осмотра').selectOption('ak47');await page.waitForTimeout(150);
 assert.equal(await page.locator('.coast-preview canvas').count(),1);const canvas=page.locator('.coast-preview canvas'),box=await canvas.boundingBox();await page.mouse.move(box.x+box.width/2,box.y+box.height/2);await page.mouse.down();await page.mouse.move(box.x+box.width/2+80,box.y+box.height/2+15);await page.mouse.up();
 await page.screenshot({path:path.join(outputs,'coast-menu-arsenal.png')});
 for(let i=0;i<5;i++){await nav('plaza').click();await nav('arsenal').click();assert.equal(await page.locator('.coast-preview canvas').count(),1);}
 await nav('character').click();await page.locator('[data-character=classic]').click();assert.deepEqual(await page.evaluate(()=>__emitted.at(-1)),{n:'cs16_character',d:'classic'});
 await nav('settings').click();await page.getByLabel('Качество графики в меню').selectOption('low');assert.equal(await page.evaluate(()=>localStorage.getItem('cs16-graphics-quality')),'low');
 await page.evaluate(p=>__qa.lobby('Alex',p,'Fifflaren'),players);await nav('squad').click();assert(await page.locator('#cs16StartBtn').isDisabled());assert.equal(await page.locator('.cs16HostBtn,.cs16KickBtn').count(),0);assert(await page.locator('#cs16Army').isDisabled());
 await page.evaluate(p=>__qa.lobby('Fifflaren',p,'knyaz'),players);await page.getByRole('button',{name:'Забрать хост себе',exact:true}).click();assert.deepEqual(await page.evaluate(()=>__emitted.at(-1)),{n:'cs16_sethost',d:'Fifflaren'});
 for(const width of [1000,550]){await page.setViewportSize({width,height:850});for(const key of ['plaza','squad','arsenal','character','settings']){await nav(key).click();assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'overflow '+width+' '+key);}}
 await nav('plaza').click();await page.screenshot({path:path.join(outputs,'coast-menu-narrow.png')});
 assert.deepEqual(errors,[]);console.log('COAST MENU PASS: navigation, team/start/map/army, host permissions, arsenal drag and repeated disposal, characters, quality, narrow layout');
};
