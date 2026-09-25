import React from 'react';
export function RunningText({text}:{text:string}){return <footer className="running-text"><div className="running-text-track"><span>🔊 {text}</span><span>—</span><span>{text}</span><span>—</span><span>{text}</span></div></footer>}
