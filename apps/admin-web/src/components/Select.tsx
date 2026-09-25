import React,{useEffect,useId,useRef,useState} from 'react';
import {createPortal} from 'react-dom';
import './select.css';
type Props=Omit<React.SelectHTMLAttributes<HTMLSelectElement>,'multiple'|'size'>;
export function Select({children,value,onChange,disabled,required,id,name,className,style,'aria-label':label,...rest}:Props){
 const uid=useId(),button=useRef<HTMLButtonElement>(null),panel=useRef<HTMLDivElement>(null),validation=useRef<HTMLInputElement>(null);
 const [open,setOpen]=useState(false),[query,setQuery]=useState(''),[cursor,setCursor]=useState(0),[position,setPosition]=useState({top:0,left:0,width:200,maxHeight:280});
 const options: {value:string;text:string;disabled:boolean}[]=[];
 const collect=(nodes:React.ReactNode)=>React.Children.forEach(nodes,n=>{if(!React.isValidElement(n))return;const p=n.props as any;if(n.type==='option')options.push({value:String(p.value??p.children),text:React.Children.toArray(p.children).join(''),disabled:!!p.disabled});else if(p.children)collect(p.children);});collect(children);
 const selected=options.find(o=>o.value===String(value??''));
 const filtered=options.filter(o=>o.text.toLocaleLowerCase().includes(query.toLocaleLowerCase()));
 const close=()=>{setOpen(false);setQuery('');};
 const choose=(v:string)=>{onChange?.({target:{value:v,name},currentTarget:{value:v,name}} as React.ChangeEvent<HTMLSelectElement>);close();button.current?.focus();};
 useEffect(()=>{validation.current?.setCustomValidity(required&&!value?'Pilih salah satu pilihan.':'');},[required,value]);
 useEffect(()=>{if(!open)return;const place=()=>{const r=button.current!.getBoundingClientRect();const below=innerHeight-r.bottom-12;const height=Math.min(320,Math.max(below,r.top-12));setPosition({top:below>=Math.min(320,r.top-12)?r.bottom+5:Math.max(8,r.top-height-5),left:Math.min(r.left,innerWidth-Math.min(r.width,innerWidth-16)-8),width:Math.min(r.width,innerWidth-16),maxHeight:height});};place();const outside=(e:PointerEvent)=>{if(!button.current?.contains(e.target as Node)&&!panel.current?.contains(e.target as Node))close();};document.addEventListener('pointerdown',outside);window.addEventListener('resize',place);window.addEventListener('scroll',place,true);return()=>{document.removeEventListener('pointerdown',outside);window.removeEventListener('resize',place);window.removeEventListener('scroll',place,true);};},[open]);
 useEffect(()=>{panel.current?.querySelector(`[data-index="${cursor}"]`)?.scrollIntoView({block:'nearest'});},[cursor]);
 const key=(e:React.KeyboardEvent)=>{if(e.key==='Escape'){e.preventDefault();close();button.current?.focus();}else if(e.key==='Tab')close();else if(['ArrowDown','ArrowUp','Home','End'].includes(e.key)){e.preventDefault();setOpen(true);setCursor(c=>e.key==='Home'?0:e.key==='End'?filtered.length-1:Math.max(0,Math.min(filtered.length-1,c+(e.key==='ArrowDown'?1:-1))));}else if(e.key==='Enter'||(e.key===' '&&e.target===button.current)){e.preventDefault();if(open&&filtered[cursor]&&!filtered[cursor].disabled)choose(filtered[cursor].value);else setOpen(true);}};
 return <span className={`custom-select ${className||''}`} style={style}>
 <button ref={button} id={id} type="button" className="custom-select-trigger" disabled={disabled} aria-label={label} aria-haspopup="listbox" aria-expanded={open} aria-controls={open?uid:undefined} onKeyDown={key} onClick={()=>{if(open)close();else{setCursor(Math.max(0,options.findIndex(o=>o.value===String(value))));setOpen(true);}}}><span>{selected?.text||'Pilih...'}</span><span aria-hidden="true">⌄</span></button>
 <input ref={validation} className="custom-select-validation" tabIndex={-1} aria-hidden="true" value={String(value??'')} readOnly required={required} disabled={disabled} name={name} onInvalid={()=>{button.current?.focus();setOpen(true);}}/>
 {open&&!disabled&&createPortal(<div ref={panel} className="custom-select-popup" style={position} onKeyDown={key}>
 {options.length>7&&<input autoFocus aria-label="Cari pilihan" placeholder="Cari pilihan..." value={query} onChange={e=>{setQuery(e.target.value);setCursor(0);}}/>}
 <div id={uid} role="listbox" aria-label={label||'Pilihan'}>{filtered.map((o,i)=><button type="button" role="option" aria-selected={selected?.value===o.value} disabled={o.disabled} data-index={i} className={cursor===i?'highlighted':''} key={o.value} onMouseEnter={()=>setCursor(i)} onClick={()=>choose(o.value)}>{o.text}<span>{selected?.value===o.value?'✓':''}</span></button>)}{!filtered.length&&<p>Tidak ada pilihan yang cocok.</p>}</div></div>,document.body)}
 </span>;
}
