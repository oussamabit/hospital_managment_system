/**
 * DicomSeriesViewerModal.tsx
 *
 * Full-screen cine-loop viewer for DICOM / imaging series.
 * Works with pre-rendered image files (JPEG/PNG) stored alongside
 * the DICOM source files.
 *
 * Features:
 *  - Filmstrip (left sidebar) with scroll-to-current
 *  - Cine-loop play/pause with configurable FPS
 *  - Slice slider + prev/next arrows
 *  - Mouse-drag pan, ctrl+wheel zoom, scroll-wheel slice navigation
 *  - Brightness / Contrast / Rotation / Invert controls (right panel)
 *  - Keyboard shortcuts: Space=play/pause, ←/→=slice, +/-=zoom, r=rotate, i=invert, Esc=close
 *  - Download series as zip (via backend endpoint)
 *  - Graceful fallback for pure-DICOM series (no pre-rendered images)
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { IDicomSeries, IDicomSeriesFile } from '../types';
import {
  X, ChevronLeft, ChevronRight,
  Play, Pause, RotateCw, RefreshCw, Download, Film,
} from 'lucide-react';

const API_BASE = (import.meta as any).env.VITE_API_URL || 'http://localhost:5005';

interface Props {
  series: IDicomSeries;
  patientName: string;
  onClose: () => void;
}

// ─────────────────────────────────────────────────────────────────────────────
//  Helpers
// ─────────────────────────────────────────────────────────────────────────────
const isDicomFile = (f: IDicomSeriesFile) =>
  /\.(dcm|dicom)$/i.test(f.originalName || '') ||
  f.fileType === 'application/dicom' ||
  (!f.fileType && !f.originalName?.includes('.'));

const isImageFile = (f: IDicomSeriesFile) =>
  !isDicomFile(f) && (
    f.fileType?.startsWith('image/') ||
    /\.(jpe?g|png|gif|webp|bmp)$/i.test(f.originalName || '')
  );

// ─────────────────────────────────────────────────────────────────────────────
//  Component
// ─────────────────────────────────────────────────────────────────────────────
const DicomSeriesViewerModal: React.FC<Props> = ({ series, patientName, onClose }) => {
  const files = (series.files as IDicomSeriesFile[]) ?? [];

  // ── View state ──
  const [idx,     setIdx]     = useState(0);
  const [playing, setPlaying] = useState(false);
  const [fps,     setFps]     = useState(8);
  const [zoom,    setZoom]    = useState(1);
  const [rot,     setRot]     = useState(0);
  const [bri,     setBri]     = useState(100);
  const [con,     setCon]     = useState(100);
  const [inv,     setInv]     = useState(false);
  const [px,      setPx]      = useState(0);
  const [py,      setPy]      = useState(0);
  const [drag,    setDrag]    = useState(false);
  const [ds,      setDs]      = useState({ x: 0, y: 0 });
  const [loadedSet, setLoadedSet] = useState<Set<string>>(new Set());

  // ── Refs ──
  const cvs      = useRef<HTMLCanvasElement>(null);
  const cont     = useRef<HTMLDivElement>(null);
  const filmRef  = useRef<HTMLDivElement>(null);
  const imgCache = useRef<Map<string, HTMLImageElement>>(new Map());
  const playRef  = useRef<ReturnType<typeof setInterval> | null>(null);

  const currentFile = files[idx];
  const hasImages   = files.some(isImageFile);
  const allDicom    = files.every(isDicomFile);

  // ── Image preloading (±15 slices around current) ──
  useEffect(() => {
    const radius = 15;
    const start  = Math.max(0, idx - radius);
    const end    = Math.min(files.length - 1, idx + radius);
    for (let i = start; i <= end; i++) {
      const f = files[i];
      if (!f || !isImageFile(f) || imgCache.current.has(f.filePath)) continue;
      const im = new Image();
      im.crossOrigin = 'anonymous';
      im.onload = () => {
        imgCache.current.set(f.filePath, im);
        setLoadedSet(s => new Set(s).add(f.filePath));
      };
      im.src = `${API_BASE}/${f.filePath}`;
    }
  }, [idx, files]);

  // ── Canvas draw ──
  const draw = useCallback(() => {
    const c = cvs.current; if (!c) return;
    const cx = c.getContext('2d'); if (!cx) return;
    cx.clearRect(0, 0, c.width, c.height);
    const f = files[idx];
    if (!f || !isImageFile(f)) return;
    const im = imgCache.current.get(f.filePath);
    if (!im) return;
    cx.save();
    cx.translate(c.width / 2 + px, c.height / 2 + py);
    cx.rotate((rot * Math.PI) / 180);
    cx.scale(zoom, zoom);
    const filters = [
      `brightness(${bri}%)`,
      `contrast(${con}%)`,
      inv ? 'invert(1)' : '',
    ].filter(Boolean).join(' ');
    cx.filter = filters || 'none';
    cx.drawImage(im, -im.naturalWidth / 2, -im.naturalHeight / 2);
    cx.restore();
  }, [idx, zoom, px, py, rot, bri, con, inv, loadedSet, files]);

  // ── Canvas resize observer ──
  useEffect(() => {
    const el = cont.current; if (!el || !cvs.current) return;
    const resize = () => {
      if (!cvs.current || !el) return;
      cvs.current.width  = el.clientWidth;
      cvs.current.height = el.clientHeight;
      draw();
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(el);
    return () => ro.disconnect();
  }, [draw]);

  useEffect(() => { draw(); }, [draw]);

  // ── Filmstrip: scroll current thumb into view ──
  useEffect(() => {
    const strip = filmRef.current; if (!strip) return;
    const btn = strip.children[idx] as HTMLElement | undefined;
    btn?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [idx]);

  // ── Cine-loop ──
  useEffect(() => {
    if (playing) {
      playRef.current = setInterval(() => {
        setIdx(i => (i + 1) % files.length);
      }, 1000 / fps);
    } else {
      if (playRef.current) clearInterval(playRef.current);
    }
    return () => { if (playRef.current) clearInterval(playRef.current); };
  }, [playing, fps, files.length]);

  // ── Keyboard shortcuts ──
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === 'Escape')                              { onClose(); return; }
      if (e.key === ' ')                                   { e.preventDefault(); setPlaying(p => !p); return; }
      if (e.key === 'ArrowLeft' || e.key === 'ArrowUp')    setIdx(i => Math.max(0, i - 1));
      if (e.key === 'ArrowRight'|| e.key === 'ArrowDown')  setIdx(i => Math.min(files.length - 1, i + 1));
      if (e.key === '+' || e.key === '=')                  setZoom(z => Math.min(10, z + 0.2));
      if (e.key === '-')                                   setZoom(z => Math.max(0.1, z - 0.2));
      if (e.key === 'r' || e.key === 'R')                  setRot(r => (r + 90) % 360);
      if (e.key === 'i' || e.key === 'I')                  setInv(v => !v);
      if (e.key === '0')                                   reset();
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [files.length, onClose]);

  // ── Mouse events ──
  const mDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setDrag(true);
    setDs({ x: e.clientX - px, y: e.clientY - py });
  };
  const mMove = (e: React.MouseEvent) => {
    if (!drag) return;
    setPx(e.clientX - ds.x);
    setPy(e.clientY - ds.y);
  };
  const mUp = () => setDrag(false);

  const onWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    if (e.ctrlKey || e.metaKey) {
      // Ctrl+wheel → zoom
      setZoom(z => Math.max(0.1, Math.min(10, z - e.deltaY * 0.001)));
    } else {
      // Wheel → navigate slices
      setPlaying(false);
      setIdx(i => e.deltaY > 0
        ? Math.min(files.length - 1, i + 1)
        : Math.max(0, i - 1));
    }
  };

  const reset = () => {
    setZoom(1); setPx(0); setPy(0); setRot(0);
    setBri(100); setCon(100); setInv(false);
  };

  // ── Download series zip ──
  const downloadSeries = async () => {
    try {
      // Extract hospitalization ID from folderPath if available
      const parts = series.folderPath?.split(/[\\/]/) ?? [];
      const hospIdIdx = parts.indexOf('hospitalization');
      const hospId = hospIdIdx >= 0 ? parts[hospIdIdx + 1] : null;
      if (!hospId) { alert('ID hospitalisation introuvable'); return; }

      const url = `${API_BASE}/api/hospitalizations/${hospId}/imaging-series/${series.seriesId}/download`;
      const a   = document.createElement('a');
      a.href    = url;
      a.download = `${series.seriesLabel}.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch (err) {
      console.error(err);
    }
  };

  // ─────────────────────────────────────────────────────────────────────────
  //  Render
  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 70,
      display: 'flex', flexDirection: 'column',
      background: '#050505', userSelect: 'none',
    }}>

      {/* ── Top bar ── */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '8px 16px', background: '#0d1117',
        borderBottom: '1px solid #21262d', flexShrink: 0, gap: 8, flexWrap: 'wrap',
      }}>
        {/* Title */}
        <div style={{ minWidth: 0 }}>
          <p style={{ color: 'white', fontSize: 12, fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: 6 }}>
            <Film style={{ width: 14, height: 14, color: '#58a6ff', flexShrink: 0 }} />
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{series.seriesLabel}</span>
          </p>
          <p style={{ color: '#8b949e', fontSize: 10, margin: 0 }}>
            {patientName} · <span style={{ color: '#58a6ff', fontWeight: 700 }}>{series.modality}</span>
            {' · '}{files.length} coupe(s) · Slice {idx + 1}/{files.length}
          </p>
        </div>

        {/* Playback controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          <button onClick={() => { setPlaying(false); setIdx(i => Math.max(0, i - 1)); }} disabled={idx === 0}
            style={btnStyle}>
            <ChevronLeft style={{ width: 14, height: 14 }} />
          </button>

          <button onClick={() => setPlaying(p => !p)}
            style={{ ...btnStyle, background: playing ? '#da3633' : '#238636', minWidth: 80 }}>
            {playing
              ? <><Pause  style={{ width: 12, height: 12 }} /><span style={{ fontSize: 11, fontWeight: 700 }}>Pause</span></>
              : <><Play   style={{ width: 12, height: 12 }} /><span style={{ fontSize: 11, fontWeight: 700 }}>Lecture</span></>
            }
          </button>

          <button onClick={() => { setPlaying(false); setIdx(i => Math.min(files.length - 1, i + 1)); }} disabled={idx === files.length - 1}
            style={btnStyle}>
            <ChevronRight style={{ width: 14, height: 14 }} />
          </button>

          {/* Slice slider */}
          <input type="range" min={0} max={files.length - 1} value={idx}
            onChange={e => { setPlaying(false); setIdx(+e.target.value); }}
            style={{ width: 140, accentColor: '#1f6feb', cursor: 'pointer' }} />

          {/* FPS */}
          <label style={{ color: '#8b949e', fontSize: 10, display: 'flex', alignItems: 'center', gap: 4 }}>
            FPS
            <input type="number" min={1} max={30} value={fps}
              onChange={e => setFps(Math.max(1, Math.min(30, +e.target.value)))}
              style={{ width: 40, background: '#161b22', border: '1px solid #30363d', color: 'white', borderRadius: 4, padding: '2px 4px', fontSize: 10, textAlign: 'center' }} />
          </label>

          {/* Rotate */}
          <button onClick={() => setRot(r => (r + 90) % 360)} style={btnStyle} title="Pivoter (R)">
            <RotateCw style={{ width: 13, height: 13 }} />
          </button>

          {/* Invert */}
          <button onClick={() => setInv(v => !v)}
            style={{ ...btnStyle, background: inv ? '#555' : '#21262d' }} title="Inverser (I)">
            <span style={{ fontSize: 10, fontWeight: 700 }}>INV</span>
          </button>

          {/* Reset */}
          <button onClick={reset} style={btnStyle} title="Réinitialiser (0)">
            <RefreshCw style={{ width: 13, height: 13 }} />
          </button>

          {/* Download zip */}
          <button onClick={downloadSeries} style={{ ...btnStyle, color: '#58a6ff' }} title="Télécharger la série en .zip">
            <Download style={{ width: 13, height: 13 }} />
          </button>
        </div>

        {/* Close */}
        <button onClick={onClose}
          style={{ padding: '6px 8px', border: 'none', background: 'transparent', color: '#8b949e', cursor: 'pointer', borderRadius: 6 }}>
          <X style={{ width: 16, height: 16 }} />
        </button>
      </div>

      {/* ── Main area ── */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>

        {/* ── Filmstrip ── */}
        <div ref={filmRef}
          style={{ width: 72, flexShrink: 0, background: '#0a0a0a', borderRight: '1px solid #1e1e1e', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 4, padding: 4 }}>
          {files.map((f, i) => (
            <button key={f.fileId ?? i} onClick={() => { setPlaying(false); setIdx(i); }}
              title={f.originalName}
              style={{
                border: `2px solid ${i === idx ? '#1f6feb' : 'transparent'}`,
                borderRadius: 4, overflow: 'hidden', background: '#0d0d0d',
                padding: 0, cursor: 'pointer',
                opacity: i === idx ? 1 : 0.45,
                flexShrink: 0, position: 'relative',
              }}>
              {isImageFile(f) ? (
                <img
                  src={`${API_BASE}/${f.filePath}`} alt=""
                  style={{ width: '100%', aspectRatio: '1', objectFit: 'cover', display: 'block', background: '#111' }}
                  loading="lazy"
                />
              ) : (
                <div style={{ width: '100%', aspectRatio: '1', background: '#161b22', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2 }}>
                  <span style={{ fontSize: 8, color: '#58a6ff', fontWeight: 'bold' }}>{series.modality}</span>
                  <span style={{ fontSize: 7, color: '#444' }}>{i + 1}</span>
                </div>
              )}
              {/* Slice number badge */}
              <span style={{ position: 'absolute', bottom: 1, right: 2, fontSize: 7, color: 'rgba(255,255,255,.4)', fontFamily: 'monospace', lineHeight: 1 }}>
                {i + 1}
              </span>
            </button>
          ))}
        </div>

        {/* ── Canvas viewport ── */}
        <div
          ref={cont}
          style={{ flex: 1, position: 'relative', overflow: 'hidden', background: '#080808', cursor: drag ? 'grabbing' : 'grab' }}
          onMouseDown={hasImages ? mDown : undefined}
          onMouseMove={hasImages ? mMove : undefined}
          onMouseUp={hasImages ? mUp : undefined}
          onMouseLeave={hasImages ? mUp : undefined}
          onWheel={onWheel}>

          <canvas ref={cvs} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} />

          {/* Loading spinner */}
          {currentFile && isImageFile(currentFile) && !imgCache.current.has(currentFile.filePath) && (
            <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
              <div style={{ width: 36, height: 36, border: '3px solid #1f6feb', borderTopColor: 'transparent', borderRadius: '50%', animation: 'dicomSpin 0.7s linear infinite' }} />
            </div>
          )}

          {/* Pure-DICOM fallback */}
          {allDicom && (
            <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
              <div style={{ maxWidth: 400, padding: '24px 28px', background: '#0d1117', border: '1px solid #30363d', borderRadius: 14, textAlign: 'center' }}>
                <Film style={{ width: 36, height: 36, color: '#58a6ff', margin: '0 auto 14px' }} />
                <p style={{ color: '#e6edf3', fontSize: 14, fontWeight: 700, margin: '0 0 10px' }}>
                  Série DICOM — {files.length} fichier(s)
                </p>
                <p style={{ color: '#8b949e', fontSize: 12, lineHeight: 1.7, margin: '0 0 18px' }}>
                  Cette série contient des fichiers DICOM binaires.<br />
                  Le rendu in-browser nécessite une bibliothèque WASM (Cornerstone.js).<br />
                  <strong style={{ color: '#58a6ff' }}>Téléchargez le dossier complet</strong> pour l'ouvrir dans
                  OsiriX, RadiAnt DICOM Viewer ou 3D Slicer.
                </p>
                <button onClick={downloadSeries}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '10px 20px', background: '#1a3a5c', color: '#58a6ff', fontSize: 13, fontWeight: 600, borderRadius: 8, border: '1px solid #1e3a5c', cursor: 'pointer' }}>
                  <Download style={{ width: 14, height: 14 }} />
                  Télécharger la série ({files.length} fichiers)
                </button>
                <p style={{ color: '#484f58', fontSize: 10, margin: '14px 0 0' }}>
                  Raccourcis : ← → pour naviguer · Molette pour changer de coupe
                </p>
              </div>
            </div>
          )}

          {/* Overlay info */}
          <div style={{ position: 'absolute', top: 10, left: 10, pointerEvents: 'none' }}>
            <span style={{ fontSize: 10, color: 'rgba(255,255,255,.25)', fontFamily: 'monospace' }}>
              {series.modality} · {idx + 1}/{files.length} · {Math.round(zoom * 100)}%
            </span>
          </div>

          {/* Hint bar */}
          <div style={{ position: 'absolute', bottom: 10, left: '50%', transform: 'translateX(-50%)', pointerEvents: 'none' }}>
            <span style={{ fontSize: 9, color: 'rgba(255,255,255,.18)', background: 'rgba(0,0,0,.5)', padding: '2px 10px', borderRadius: 20, whiteSpace: 'nowrap' }}>
              Molette → coupes · Ctrl+Molette → zoom · Espace → lecture · R → rotation · I → inversion
            </span>
          </div>

          {/* Prev/Next arrows */}
          <button onClick={() => { setPlaying(false); setIdx(i => Math.max(0, i - 1)); }} disabled={idx === 0}
            style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', padding: 8, background: 'rgba(13,17,23,.85)', border: '1px solid #21262d', borderRadius: 6, color: '#8b949e', cursor: 'pointer' }}>
            <ChevronLeft style={{ width: 16, height: 16 }} />
          </button>
          <button onClick={() => { setPlaying(false); setIdx(i => Math.min(files.length - 1, i + 1)); }} disabled={idx === files.length - 1}
            style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', padding: 8, background: 'rgba(13,17,23,.85)', border: '1px solid #21262d', borderRadius: 6, color: '#8b949e', cursor: 'pointer' }}>
            <ChevronRight style={{ width: 16, height: 16 }} />
          </button>
        </div>

        {/* ── Right control panel ── */}
        <div style={{
          width: 158, flexShrink: 0, background: '#0d0d0d',
          borderLeft: '1px solid #1e1e1e', padding: 12,
          overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 14,
        }}>
          {/* Sliders */}
          {([
            ['Zoom',       zoom * 100, 10,  500, (e: React.ChangeEvent<HTMLInputElement>) => setZoom(+e.target.value / 100)],
            ['Luminosité', bri,        10,  400, (e: React.ChangeEvent<HTMLInputElement>) => setBri(+e.target.value)],
            ['Contraste',  con,        10,  400, (e: React.ChangeEvent<HTMLInputElement>) => setCon(+e.target.value)],
            ['Rotation',   rot,        0,   360, (e: React.ChangeEvent<HTMLInputElement>) => setRot(+e.target.value)],
          ] as [string, number, number, number, (e: React.ChangeEvent<HTMLInputElement>) => void][]).map(([lbl, val, min, max, cb]) => (
            <div key={lbl as string}>
              <p style={{ fontSize: 9, color: '#484f58', textTransform: 'uppercase', letterSpacing: '.07em', fontWeight: 700, marginBottom: 4 }}>
                {lbl as string}
              </p>
              <input type="range" min={min as number} max={max as number} value={val as number} onChange={cb}
                style={{ width: '100%', height: 2, cursor: 'pointer', accentColor: '#1f6feb' }} />
              <p style={{ fontSize: 9, color: '#555', textAlign: 'center', marginTop: 2 }}>
                {Math.round(val as number)}{lbl === 'Zoom' ? '%' : lbl === 'Rotation' ? '°' : ''}
              </p>
            </div>
          ))}

          {/* Series metadata */}
          <div style={{ padding: 8, background: '#161b22', borderRadius: 6, border: '1px solid #21262d', marginTop: 6 }}>
            <p style={{ fontSize: 9, color: '#484f58', textTransform: 'uppercase', fontWeight: 700, marginBottom: 4 }}>Série</p>
            <p style={{ fontSize: 10, color: '#8b949e', margin: '0 0 2px', wordBreak: 'break-word' }}>{series.seriesLabel}</p>
            <p style={{ fontSize: 9, color: '#6e7681', margin: 0 }}>
              <span style={{ color: '#58a6ff', fontWeight: 700 }}>{series.modality}</span> · {files.length} coupes
            </p>
            {series.notes && (
              <p style={{ fontSize: 9, color: '#484f58', marginTop: 4, fontStyle: 'italic', wordBreak: 'break-word' }}>{series.notes}</p>
            )}
          </div>

          {/* Shortcut reference */}
          <div style={{ padding: 8, background: '#0a0a0a', borderRadius: 6, border: '1px solid #1e1e1e' }}>
            <p style={{ fontSize: 8, color: '#333', textTransform: 'uppercase', fontWeight: 700, marginBottom: 6 }}>Raccourcis</p>
            {[
              ['Espace', 'Lecture/Pause'],
              ['← →', 'Coupes'],
              ['+ −', 'Zoom'],
              ['R', 'Rotation'],
              ['I', 'Inversion'],
              ['0', 'Réinitialiser'],
              ['Echap', 'Fermer'],
            ].map(([k, v]) => (
              <div key={k} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                <span style={{ fontSize: 8, color: '#3b82f6', fontFamily: 'monospace', background: '#1e3a5c', padding: '1px 4px', borderRadius: 3 }}>{k}</span>
                <span style={{ fontSize: 8, color: '#484f58' }}>{v}</span>
              </div>
            ))}
          </div>

          {/* Reset & Download buttons */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 'auto' }}>
            <button onClick={reset}
              style={{ width: '100%', padding: '5px 0', fontSize: 9, color: '#666', background: '#161b22', border: '1px solid #21262d', borderRadius: 4, cursor: 'pointer' }}>
              Réinitialiser la vue
            </button>
            <button onClick={downloadSeries}
              style={{ width: '100%', padding: '5px 0', fontSize: 9, color: '#58a6ff', background: '#0d1117', border: '1px solid #1e3a5c', borderRadius: 4, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
              <Download style={{ width: 10, height: 10 }} /> Télécharger .zip
            </button>
          </div>
        </div>

      </div>

      {/* CSS keyframes */}
      <style>{`
        @keyframes dicomSpin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
};

// ── Shared button style ──
const btnStyle: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 4,
  padding: '5px 8px', border: 'none',
  background: '#21262d', color: '#8b949e',
  borderRadius: 6, cursor: 'pointer',
};

export default DicomSeriesViewerModal;
