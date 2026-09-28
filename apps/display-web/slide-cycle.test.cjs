const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const path = require('node:path');
const source = fs.readFileSync(path.join(__dirname, 'src/components/AgendaSlides.tsx'), 'utf8');
const compiled = ts.transpileModule(source, {compilerOptions:{esModuleInterop:true,module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.React}}).outputText;
function harness(props) {
 let slots=[],cursor=0,effects=[],timers=new Map(),seq=0;
 const react={createElement:(type,props,...children)=>({type,props,children}),useState(initial){const index=cursor++;if(!(index in slots))slots[index]=initial;return [slots[index],value=>{slots[index]=typeof value==='function'?value(slots[index]):value}];},useEffect(fn,deps){const index=cursor++;const old=slots[index];if(!old||deps.some((d,i)=>!Object.is(d,old.deps[i])))effects.push(()=>{old?.cleanup?.();slots[index]={deps,cleanup:fn()};});}};
 const exports={};vm.runInNewContext(compiled,{exports,require:id=>id==='react'?react:id.includes('runtime-config')?{runtimeConfig:{}}:{},Date,Intl,setInterval:()=>0,clearInterval:()=>{},setTimeout:(fn,ms)=>{timers.set(++seq,{fn,ms});return seq},clearTimeout:id=>timers.delete(id)});
 const render=()=>{cursor=0;effects=[];const output=exports.AgendaSlides(props);effects.forEach(fn=>fn());return output;};
 render();return {render,delay:()=>[...timers.values()][0]?.ms,advance:()=>{const [id,t]=[...timers.entries()][0];timers.delete(id);t.fn();return render();}};
}
const contents=[{id:'b',type:'VIDEO',mediaUrl:'https://example.com/b.mp4',displayOrder:2,durationSeconds:15},{id:'a',type:'IMAGE',mediaUrl:'https://example.com/a.png',displayOrder:1,durationSeconds:10},{id:'off',type:'IMAGE',mediaUrl:'x',isActive:false},{id:'text',type:'RUNNING_TEXT',content:'ticker'}];
let h=harness({agendas:[],contents,enabled:false,timezone:'Asia/Jakarta'});
assert.equal(h.delay(),120000);h.render();assert.equal(h.delay(),120000);
assert.equal(h.advance().props.key,'a');assert.equal(h.delay(),10000);
assert.equal(h.advance().props.key,'b');assert.equal(h.delay(),15000);
assert.equal(h.advance(),null);assert.equal(h.delay(),120000);
h=harness({agendas:[{id:'agenda',startDate:'2099-01-01T00:00:00Z'}],contents,enabled:true,timezone:'Asia/Jakarta'});
assert.equal(h.advance().props.key,'agenda');assert.equal(h.delay(),60000);
assert.equal(h.advance().props.key,'a');
h=harness({agendas:[],contents:[],enabled:true,timezone:'Asia/Jakarta'});assert.equal(h.delay(),undefined);
console.log('Slide cycle passed: prayer, agenda, ordered content, per-item duration, polling rerender, empty playlist, disabled content.');
