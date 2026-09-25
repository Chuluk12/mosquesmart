import type {CSSProperties} from 'react';
const backgrounds:Record<string,string>={default:'/mosque-dashboard-bg.png',kaaba:'/backgrounds/kaaba.png',madinah:'/backgrounds/madinah.png',ottoman:'/backgrounds/ottoman.png'};
export function displayBackground(id?:string, originalClassic = false):CSSProperties|undefined {
  if (originalClassic && (!id || id === 'default')) return undefined;
  const image=backgrounds[id||'default']||backgrounds.default;
  return image?{backgroundImage:`linear-gradient(90deg,rgba(3,20,37,.32),rgba(3,20,37,.72)),url("${image}")`,backgroundSize:'cover',backgroundPosition:'center',backgroundRepeat:'no-repeat'}:undefined;
}
