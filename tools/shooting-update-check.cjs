'use strict';
const assert=require('node:assert/strict'),path=require('node:path'),fs=require('node:fs');
module.exports=async(page,outputs,errors)=>{
 const players=[{nick:'Preview',team:'ct',characterId:'ember'},{nick:'Guest',team:'t',characterId:'tide'},{nick:'Bot',team:'t',bot:true}];
 await page.evaluate(p=>__qa.lobby('Preview',p,'Preview'),players);await page.locator('.coast-nav [data-page=squad]').click();
 assert(await page.locator('#cs16BotClear').isVisible(),'bot clearing is outside collapsed map settings');
 await page.locator('#cs16BotClear').click();assert.equal(await page.evaluate(()=>__emitted.at(-1).n),'cs16_botclear');
 await page.locator('#cs16BotFill').uncheck();assert.deepEqual(await page.evaluate(()=>__emitted.at(-1)),{n:'cs16_botfill',d:false});
 await page.screenshot({path:path.join(outputs,'bots-541.png')});
 await page.evaluate(p=>__qa.lobby('Guest',p,'Preview'),players);assert(await page.locator('#cs16BotClear').isDisabled());assert(await page.locator('#cs16BotFill').isDisabled());
 await page.evaluate(p=>__qa.lobby('Preview',p,'Preview'),players);
 const reports=await page.evaluate(()=>{
  __socket.receive('cs16_you',{team:'ct',alive:true,hp:100,armor:100,money:16000,weapon:'m4a1'});
  return __qa.snapshot().weapons.filter(id=>CS16Combat.weapons[id]&&id!=='knife').map(id=>({id,...__qa.shotCheck(id)}));
 });
 assert.equal(reports.length,18);
 for(const row of reports){assert.equal(row.yawDelta,0,row.id);assert.equal(row.pitchDelta,0,row.id);assert.equal(row.kick,0,row.id);assert(row.flash?.every(Number.isFinite),row.id);assert.equal(row.rest.boltZ,0);assert.equal(row.rest.slideZ,0);if(row.id!=='awp'&&row.id!=='scout')assert(row.animation.boltZ>0,row.id);}
 // Exercise actual confirmed-hit packets and verify bounded resources, cleanup and screenshots.
 await require('./hit-feedback-check.cjs')(page,outputs,errors);
 fs.writeFileSync(path.join(outputs,'shooting-541.json'),JSON.stringify(reports,null,2));assert.deepEqual(errors,[]);
 console.log('SHOOTING_UPDATE_PASS: host bot controls, 18 weapons x20 shots, fixed aim, mechanical cycles, bounded hit effects');
};
