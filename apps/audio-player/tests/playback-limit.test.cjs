const {test} = require('node:test');
const assert = require('node:assert/strict');
const {PlaybackLimit} = require('../dist/playback-limit');

function setup(t) {
  t.mock.timers.enable({apis:['setTimeout']});
  let now=0, stops=0;
  const limit=new PlaybackLimit(()=>stops++,()=>now);
  return {limit, tick(ms){now+=ms;t.mock.timers.tick(ms);}, stops:()=>stops};
}
test('20 minute budget starts at PLAYING and expires once',t=>{
  const p=setup(t);p.limit.configure(20);p.limit.update('LOADING');p.tick(60000);
  assert.equal(p.stops(),0);p.limit.update('PLAYING');p.tick(1199999);
  assert.equal(p.stops(),0);p.tick(1);assert.equal(p.stops(),1);
  p.tick(1200000);assert.equal(p.stops(),1);
});
test('pause excludes paused time; repeated PLAYING does not reset budget',t=>{
  const p=setup(t);p.limit.configure(20);p.limit.update('PLAYING');p.tick(600000);
  p.limit.update('PLAYING');p.limit.update('PAUSED');p.tick(1800000);
  assert.equal(p.stops(),0);p.limit.update('PLAYING');p.tick(600000);assert.equal(p.stops(),1);
});
test('natural finish, manual stop, and error cancel automatic stop',t=>{
  const p=setup(t);for(const state of ['FINISHED','STOPPED','ERROR']){
    p.limit.configure(20);p.limit.update('PLAYING');p.tick(1000);p.limit.update(state);p.tick(1200000);
  }assert.equal(p.stops(),0);
});
test('replacement audio does not inherit previous deadline',t=>{
  const p=setup(t);p.limit.configure(20);p.limit.update('PLAYING');p.tick(600000);
  p.limit.configure(30);p.limit.update('PLAYING');p.tick(1200000);assert.equal(p.stops(),0);
  p.tick(600000);assert.equal(p.stops(),1);
});
test('unlimited or invalid limits do not schedule a stop',t=>{
  const p=setup(t);for(const minutes of [null,undefined,0,-1,Infinity,NaN,1441]){
    p.limit.configure(minutes);p.limit.update('PLAYING');p.tick(86400001);
  }assert.equal(p.stops(),0);
});
