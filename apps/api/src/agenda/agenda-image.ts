import {resolve} from 'path';
import {existsSync,mkdirSync} from 'fs';
export const agendaImageDir=resolve(process.cwd(),'uploads','agenda-images');
mkdirSync(agendaImageDir,{recursive:true});
export const agendaImagePath=(id:string)=>resolve(agendaImageDir,`${id}.image`);
export const hasAgendaImage=(id:string)=>existsSync(agendaImagePath(id));
