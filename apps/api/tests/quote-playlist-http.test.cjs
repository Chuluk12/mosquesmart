require('dotenv').config({ path: require('node:path').resolve(__dirname, '../.env'), quiet: true });
const { PrismaClient } = require('@prisma/client');
const { JwtService } = require('@nestjs/jwt');
const { randomUUID } = require('node:crypto');
const assert = require('node:assert/strict');
const db = new PrismaClient();
const users = [], playlists = [], audios = [];
const tag = 'quotes-http-' + randomUUID();
const base = 'http://localhost:3000/api';
async function request(path, method='GET', token, body) {
  const r = await fetch(base+path, { method, headers: { 'Content-Type':'application/json', ...(token ? {Authorization:'Bearer '+token} : {}) }, body:body ? JSON.stringify(body):undefined });
  return { status:r.status, body:await r.json() };
}
(async()=>{
  assert.ok(['localhost','127.0.0.1','[::1]'].includes(new URL(process.env.DATABASE_URL).hostname));
  const tokens = {};
  for (const role of ['ADMIN','OPERATOR','VIEWER']) {
    const u = await db.user.create({data:{name:tag,username:tag+role,passwordHash:'unusable-test-hash',role}});
    users.push(u.id); tokens[role] = new JwtService({secret:process.env.JWT_SECRET||'change-me'}).sign({sub:u.id,username:u.username,role},{expiresIn:'2m'});
  }
  assert.equal((await request('/quote-playlists')).status,401);
  assert.equal((await request('/quote-playlists','GET',tokens.VIEWER)).status,200);
  const mosque = await db.mosque.findFirst();
  const a = await db.audio.create({data:{mosqueId:mosque.id,name:tag,category:'GENERAL',filePath:tag}});
  audios.push(a.id);
  const dto={name:tag,audioIds:[a.id],times:['08:00','16:00'],daysOfWeek:[1,2,3,4,5],volume:80,isActive:false};
  assert.equal((await request('/quote-playlists','POST',tokens.VIEWER,dto)).status,403);
  assert.equal((await request('/quote-playlists','POST',tokens.ADMIN,{...dto,times:['99:00']})).status,400);
  const created=await request('/quote-playlists','POST',tokens.OPERATOR,dto);
  assert.equal(created.status,201); playlists.push(created.body.id);
  const p=created.body;
  assert.equal((await request('/quote-playlists/'+p.id+'/approve-repeat','POST',tokens.OPERATOR,{cycle:1})).status,403);
  assert.equal((await request('/quote-playlists/'+p.id+'/approve-repeat','POST',tokens.ADMIN,{cycle:1})).status,400);
  const edited=await request('/quote-playlists/'+p.id,'PATCH',tokens.OPERATOR,{...dto,name:tag+' edited',times:['10:00'],audioIds:['cannot-replace-members'],cycle:99});
  assert.equal(edited.status,200); assert.equal(edited.body.cycle,1); assert.deepEqual(edited.body.audioIds,[a.id]);
  const list=await request('/quote-playlists','GET',tokens.ADMIN);
  const summary=list.body.find(row=>row.id===p.id);
  assert.equal(summary.remaining,1); assert.equal(summary.usedCount,0);
  console.log('PASS HTTP: auth 401, viewer write 403, operator create/edit, admin-only approval, validation 400, immutable membership/cycle, stock response.');
})().catch(e=>{console.error(e);process.exitCode=1}).finally(async()=>{
  await db.quotePlaylist.deleteMany({where:{id:{in:playlists}}});
  await db.audio.deleteMany({where:{id:{in:audios}}});
  await db.user.deleteMany({where:{id:{in:users}}});
  await db.$disconnect();
});