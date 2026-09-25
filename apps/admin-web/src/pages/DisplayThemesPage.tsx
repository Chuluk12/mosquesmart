import {SlideSettings} from './SlideSettings';
import React from 'react';
import {DisplayBackgroundPicker} from './DisplayBackgroundPicker';
import {DisplayLayoutPicker} from './DisplayLayoutPicker';
import './display-themes.css';
export function DisplayThemesPage(){return <div className="display-themes"><header><div><small>TAMPILAN MUSHOLA</small><h1>Tema Display</h1><p>Pilih gambar latar dan susunan tampilan layar mushola.</p></div></header><SlideSettings/><DisplayBackgroundPicker/><DisplayLayoutPicker/><p className="hint">Warna mengikuti desain layout secara otomatis. Jadwal sholat, agenda, dan teks berjalan tetap menggunakan data mushola.</p></div>}
