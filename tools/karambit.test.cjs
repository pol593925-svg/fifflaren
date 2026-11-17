const {test}=require('node:test'),assert=require('node:assert/strict'),K=require('../cs16-karambit.js');
test('continuous idle spin is independent of normal frame rates',()=>{
 const angles=[30,60,144].map(fps=>{const s=K.motion();for(let i=0;i<fps*3;i++)K.advance(s,1/fps,i/fps);return s.angle;});
 assert(Math.max(...angles)-Math.min(...angles)<1e-10);assert(angles[0]>.1);
});
test('attacking smoothly catches the handle, then resumes without affecting stats',()=>{
 const s=K.motion();K.advance(s,.05,0);const before=s.angle;
 K.advance(s,.016,1,1);assert.equal(s.angle,before);
 K.advance(s,.016,1.05,1);assert(s.angle>before);
 K.advance(s,.016,1.10,1);const held=s.angle;
 K.advance(s,.016,1.35,1);assert.equal(s.angle,held);
 K.advance(s,.016,1.6,1);assert(s.angle>0&&s.angle<.2);
});
test('suspension cannot cause a runaway spin jump',()=>{const s=K.motion();K.advance(s,30,30);assert(s.angle<.24);});
