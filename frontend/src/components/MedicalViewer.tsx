/**
 * MedicalViewer.tsx
 * Unified medical imaging viewer.
 *
 * - DICOM files (.dcm)  → Cornerstone.js WebGL renderer
 * - Images (jpg/png)    → native <img> with zoom/pan/invert
 * - PDF                 → iframe viewer
 *
 * Usage:
 *   <MedicalViewer study={study} hospitalizationId={hospId} patientName="..." onClose={() => {}} />
 */

import React, {
  useEffect, useRef, useState, useCallback, useLayoutEffect,
} from 'react';
import {
  X, ChevronLeft, ChevronRight, Play, Pause,
  ZoomIn, ZoomOut, RotateCw, FlipHorizontal,
  Sun, Contrast, Download, RefreshCw,
  Loader2, AlertTriangle, Film,
} from 'lucide-react';
// Import IImagingStudy from the main types index (defined there directly)
import { IImagingStudy } from '../types';

// ── API base URL ──────────────────────────────────────────────────────────────
const API = (import.meta as any).env?.VITE_API_URL || 'http://localhost:5005';

// ── Token helper ──────────────────────────────────────────────────────────────
const getToken = () => localStorage.getItem('accessToken') || '';

const authHeaders = () => ({
  Authorization: `Bearer ${getToken()}`,
});

// ── Download helper ───────────────────────────────────────────────────────────
const downloadWithAuth = async (url: string, filename: string) => {
  try {
    const res = await fetch(url, { headers: authHeaders() });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const blob = await res.blob();
    const obj  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = obj; a.download = filename;
    document.body.appendChild(a); a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(obj), 1000);
  } catch (err) {
    alert(`Échec du téléchargement : ${err}`);
  }
};

// ── Props ─────────────────────────────────────────────────────────────────────
interface Props {
  study:              IImagingStudy;
  hospitalizationId:  string;
  patientName:        string;
  onClose:            () => void;
}

// ── Image viewer state ────────────────────────────────────────────────────────
interface ImageState {
  zoom:       number;
  panX:       number;
  panY:       number;
  rotation:   number;
  flipH:      boolean;
  invert:     boolean;
  brightness: number;
  contrast:   number;
}
const defaultImgState = (): ImageState => ({
  zoom: 1, panX: 0, panY: 0, rotation: 0,
  flipH: false, invert: false, brightness: 100, contrast: 100,
});

// ─────────────────────────────────────────────────────────────────────────────
//  DICOM CORNERSTONE VIEWER
// ─────────────────────────────────────────────────────────────────────────────
const DicomViewer: React.FC<{
  study: IImagingStudy;
  hospId: string;
  patientName: string;
}> = ({ study, hospId, patientName }) => {
  const [idx, setIdx]       = useState(0);
  const [playing, setPlaying] = useState(false);
  const [fps, setFps]       = useState(8);
  const [loading, setLoading] = useState(true);
  const [error, setError]   = useState<string | null>(null);
  const [csReady, setCsReady] = useState(false);
  const [wl, setWl]         = useState({ windowWidth: 400, windowCenter: 40 });
  const [zoom, setZoom]     = useState(1);
  const [rotation, setRotation] = useState(0);
  const [invert, setInvert] = useState(false);
  const playRef  = useRef<ReturnType<typeof setInterval> | null>(null);
  const csRef    = useRef<any>(null);
  const elementRef = useRef<HTMLDivElement>(null);

  // Support both new IImagingStudy (studyId) and legacy IDicomSeries (seriesId)
  const studyId = study.studyId || (study as any).seriesId;

  const total = study.files.length;

  const wadoUrl = useCallback((i: number) => {
    const fileUrl = `${API}/api/hospitalizations/${hospId}/studies/${studyId}/files/${i}`;
    const authedUrl = `${fileUrl}?token=${getToken()}`;
    return `wadouri:${authedUrl}`;
  }, [hospId, studyId]);

  // Load Cornerstone dynamically
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        // Import the bundle — v4.x exposes everything on the default export
        const csModule     = await import('cornerstone-core' as any);
        const csWadoModule = await import('cornerstone-wado-image-loader' as any);
        const dpModule     = await import('dicom-parser' as any);

        if (cancelled) return;

        // Handle both ESM default export and UMD global
        const cs         = csModule.default     || csModule;
        const csWado     = csWadoModule.default  || csWadoModule;
        const dicomParser= dpModule.default      || dpModule;

        // Wire up externals (required before any image loading)
        csWado.external.cornerstone  = cs;
        csWado.external.dicomParser  = dicomParser;

        // Configure auth header injection
        if (csWado.configure) {
          csWado.configure({
            beforeSend: (xhr: XMLHttpRequest) => {
              xhr.setRequestHeader('Authorization', `Bearer ${getToken()}`);
            },
          });
        }

        // Register image loaders — v4.x API
        // Try all known export paths for wadouri loader
        const wadouriLoader =
          csWado?.wadouri?.loadImage ||
          csWado?.loadImage ||
          csWado?.default?.wadouri?.loadImage ||
          null;

        if (!wadouriLoader) {
          throw new Error('cornerstoneWADOImageLoader: loadImage function not found');
        }

        try { cs.registerImageLoader('wadouri', wadouriLoader); } catch (_) {}
        try { cs.registerImageLoader('wado',    wadouriLoader); } catch (_) {}

        csRef.current = cs;
        if (!cancelled) {
          console.log('Cornerstone ready, loaders:', Object.keys(cs.imageLoaders || {}));
          setCsReady(true);
        }
      } catch (e: any) {
        if (!cancelled) {
          console.error('Cornerstone load failed:', e);
          setError(`DICOM viewer indisponible: ${e?.message || e}`);
        }
      }
    };
    load();
    return () => { cancelled = true; };
  }, []);

  useLayoutEffect(() => {
    if (!csReady || !elementRef.current || !csRef.current) return;
    const cs = csRef.current;
    const el = elementRef.current;
    try {
      cs.enable(el);
      return () => { try { cs.disable(el); } catch (_) {} };
    } catch (e) {
      setError(`Cornerstone init error: ${e}`);
    }
  }, [csReady]);

  useEffect(() => {
  if (!csReady || !csRef.current || !elementRef.current) return;

  const cs = csRef.current;

  // Verify Cornerstone is initialized correctly
  if (!cs.loadAndCacheImage) {
    setError('Cornerstone non initialisé');
    return;
  }

  const el = elementRef.current;

  setLoading(true);
  setError(null);

  cs.loadAndCacheImage(wadoUrl(idx))
    .then((image: any) => {
      cs.displayImage(el, image);

      const vp = cs.getViewport(el);

      if (vp) {
        vp.windowWidth  = wl.windowWidth;
        vp.windowCenter = wl.windowCenter;
        vp.scale        = zoom;
        vp.rotation     = rotation;
        vp.invert       = invert;

        cs.setViewport(el, vp);
      }

      setLoading(false);
    })
    .catch((e: any) => {
      console.error('DICOM load error:', e);

      setError(
        `Erreur chargement coupe ${idx + 1}: ${e?.message || e}`
      );

      setLoading(false);
    });

}, [idx, csReady, wadoUrl, wl, zoom, rotation, invert]);

  useEffect(() => {
    if (playing) {
      playRef.current = setInterval(() => {
        setIdx(i => (i + 1) % total);
      }, 1000 / fps);
    } else {
      if (playRef.current) clearInterval(playRef.current);
    }
    return () => { if (playRef.current) clearInterval(playRef.current); };
  }, [playing, fps, total]);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') setIdx(i => Math.min(i + 1, total - 1));
      if (e.key === 'ArrowLeft')  setIdx(i => Math.max(i - 1, 0));
      if (e.key === ' ')          setPlaying(p => !p);
      if (e.key === 'i' || e.key === 'I') setInvert(v => !v);
      if (e.key === '+' || e.key === '=') setZoom(z => Math.min(z + 0.1, 5));
      if (e.key === '-')          setZoom(z => Math.max(z - 0.1, 0.1));
      if (e.key === 'r' || e.key === 'R') setRotation(r => (r + 90) % 360);
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [total]);

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    if (e.deltaY > 0) setIdx(i => Math.min(i + 1, total - 1));
    else              setIdx(i => Math.max(i - 1, 0));
  };

  if (!csReady && !error) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4 text-white">
        <Loader2 className="w-8 h-8 animate-spin text-blue-400" />
        <p className="text-sm text-gray-400">Chargement du viewer DICOM...</p>
      </div>
    );
  }

  if (error && !csReady) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-6 text-center px-8">
        <Film className="w-16 h-16 text-blue-400 opacity-60" />
        <div>
          <h3 className="text-white font-bold text-lg mb-2">Série DICOM — {total} fichier(s)</h3>
          <p className="text-gray-400 text-sm mb-1">Le rendu in-browser nécessite Cornerstone.js.</p>
          <p className="text-gray-500 text-xs mb-4">
            Installez avec: <code className="bg-gray-800 px-1 rounded">npm install cornerstone-core cornerstone-wado-image-loader dicom-parser</code>
          </p>
        </div>
        <button
          onClick={() => downloadWithAuth(
            `${API}/api/hospitalizations/${hospId}/imaging-series/${study.studyId}/download`,
            `${study.studyLabel}.zip`
          )}
          className="flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-medium transition"
        >
          <Download className="w-4 h-4" /> Télécharger la série complète
        </button>
        <p className="text-gray-600 text-xs">Ouvrir avec OsiriX, RadiAnt ou 3D Slicer</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full" onWheel={handleWheel}>
      <div
        ref={elementRef}
        className="flex-1 relative bg-black"
        style={{ minHeight: 0 }}
      >
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/70 z-10">
            <Loader2 className="w-8 h-8 animate-spin text-blue-400" />
          </div>
        )}
        {error && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/80 z-10">
            <div className="text-center text-red-400">
              <AlertTriangle className="w-8 h-8 mx-auto mb-2" />
              <p className="text-sm">{error}</p>
            </div>
          </div>
        )}
        <div className="absolute top-2 left-2 text-white text-xs font-mono pointer-events-none z-10 space-y-0.5">
          <div>{patientName}</div>
          <div>{study.modality} · {idx + 1}/{total}</div>
          {study.acquisitionDate && <div>{study.acquisitionDate}</div>}
        </div>
        <div className="absolute top-2 right-2 text-white text-xs font-mono pointer-events-none z-10 space-y-0.5 text-right">
          <div>WW: {wl.windowWidth}</div>
          <div>WC: {wl.windowCenter}</div>
          <div>Zoom: {Math.round(zoom * 100)}%</div>
        </div>
      </div>

      <div className="bg-gray-900 border-t border-gray-700 px-3 py-2 flex items-center gap-3 flex-wrap">
        <button onClick={() => setIdx(i => Math.max(i - 1, 0))} disabled={idx === 0}
          className="p-1.5 rounded text-gray-300 hover:text-white hover:bg-gray-700 disabled:opacity-30 transition">
          <ChevronLeft className="w-4 h-4" />
        </button>
        <span className="text-gray-300 text-xs font-mono min-w-[60px] text-center">{idx + 1} / {total}</span>
        <button onClick={() => setIdx(i => Math.min(i + 1, total - 1))} disabled={idx === total - 1}
          className="p-1.5 rounded text-gray-300 hover:text-white hover:bg-gray-700 disabled:opacity-30 transition">
          <ChevronRight className="w-4 h-4" />
        </button>

        <div className="w-px h-5 bg-gray-700" />

        <button onClick={() => setPlaying(p => !p)}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition ${
            playing ? 'bg-green-600 text-white' : 'bg-gray-700 text-gray-200 hover:bg-gray-600'
          }`}>
          {playing ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
          {playing ? 'Pause' : 'Lecture'}
        </button>
        <div className="flex items-center gap-1.5">
          <span className="text-gray-500 text-xs">FPS</span>
          <input type="range" min={1} max={30} value={fps}
            onChange={e => setFps(Number(e.target.value))}
            className="w-16 h-1 accent-blue-500" />
          <span className="text-gray-400 text-xs w-4">{fps}</span>
        </div>

        <div className="w-px h-5 bg-gray-700" />

        <div className="flex items-center gap-1.5">
          <Sun className="w-3.5 h-3.5 text-gray-500" />
          <input type="range" min={0} max={600} value={wl.windowWidth}
            onChange={e => setWl(v => ({ ...v, windowWidth: Number(e.target.value) }))}
            className="w-20 h-1 accent-yellow-400" title="Window Width" />
        </div>
        <div className="flex items-center gap-1.5">
          <Contrast className="w-3.5 h-3.5 text-gray-500" />
          <input type="range" min={-600} max={600} value={wl.windowCenter}
            onChange={e => setWl(v => ({ ...v, windowCenter: Number(e.target.value) }))}
            className="w-20 h-1 accent-purple-400" title="Window Center" />
        </div>

        <div className="w-px h-5 bg-gray-700" />

        <button onClick={() => setZoom(z => Math.min(z + 0.2, 5))}
          className="p-1.5 rounded text-gray-300 hover:text-white hover:bg-gray-700 transition">
          <ZoomIn className="w-4 h-4" />
        </button>
        <button onClick={() => setZoom(z => Math.max(z - 0.2, 0.2))}
          className="p-1.5 rounded text-gray-300 hover:text-white hover:bg-gray-700 transition">
          <ZoomOut className="w-4 h-4" />
        </button>
        <button onClick={() => setRotation(r => (r + 90) % 360)}
          className="p-1.5 rounded text-gray-300 hover:text-white hover:bg-gray-700 transition">
          <RotateCw className="w-4 h-4" />
        </button>
        <button onClick={() => setInvert(v => !v)}
          className={`px-2 py-1 rounded text-xs transition ${invert ? 'bg-white text-black' : 'text-gray-300 hover:bg-gray-700'}`}>
          INV
        </button>
        <button onClick={() => {
          setZoom(1); setRotation(0); setInvert(false);
          setWl({ windowWidth: 400, windowCenter: 40 });
        }} className="p-1.5 rounded text-gray-400 hover:text-white hover:bg-gray-700 transition" title="Reset">
          <RefreshCw className="w-3.5 h-3.5" />
        </button>

        <div className="ml-auto">
          <button onClick={() => downloadWithAuth(
            `${API}/api/hospitalizations/${hospId}/imaging-series/${study.studyId}/download`,
            `${study.studyLabel}.zip`
          )} className="flex items-center gap-1.5 px-2 py-1.5 text-xs text-gray-400 hover:text-white hover:bg-gray-700 rounded transition">
            <Download className="w-3.5 h-3.5" /> ZIP
          </button>
        </div>
      </div>

      {total > 1 && (
        <div className="bg-gray-900 pb-2 px-3">
          <input
            type="range" min={0} max={total - 1} value={idx}
            onChange={e => setIdx(Number(e.target.value))}
            className="w-full h-1 accent-blue-500"
          />
        </div>
      )}
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
//  IMAGE VIEWER (JPG / PNG)
// ─────────────────────────────────────────────────────────────────────────────
const ImageViewer: React.FC<{
  study: IImagingStudy;
  hospId: string;
  patientName: string;
}> = ({ study, hospId, patientName }) => {
  const studyId = study.studyId || (study as any).seriesId;
  const [idx, setIdx]           = useState(0);
  const [playing, setPlaying]   = useState(false);
  const [fps, setFps]           = useState(4);
  const [state, setState]       = useState<ImageState>(defaultImgState());
  const [dragging, setDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0, panX: 0, panY: 0 });
  const [imageUrls, setImageUrls] = useState<{ [i: number]: string }>({});
  const playRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const total = study.files.length;

  const loadImageUrl = useCallback(async (i: number) => {
    if (imageUrls[i]) return;
    const url = `${API}/api/hospitalizations/${hospId}/studies/${studyId}/files/${i}`;
    const res = await fetch(url, { headers: authHeaders() });
    if (!res.ok) return;
    const blob = await res.blob();
    const obj  = URL.createObjectURL(blob);
    setImageUrls(prev => ({ ...prev, [i]: obj }));
  }, [hospId, study.studyId, imageUrls]);

  useEffect(() => { loadImageUrl(idx); }, [idx]);
  useEffect(() => {
    if (idx + 1 < total) loadImageUrl(idx + 1);
    if (idx - 1 >= 0)    loadImageUrl(idx - 1);
  }, [idx, total]);

  useEffect(() => {
    if (playing) {
      playRef.current = setInterval(() => setIdx(i => (i + 1) % total), 1000 / fps);
    } else {
      if (playRef.current) clearInterval(playRef.current);
    }
    return () => { if (playRef.current) clearInterval(playRef.current); };
  }, [playing, fps, total]);

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    if (e.ctrlKey) {
      setState(s => ({ ...s, zoom: Math.max(0.1, s.zoom + (e.deltaY < 0 ? 0.1 : -0.1)) }));
    } else {
      if (e.deltaY > 0) setIdx(i => Math.min(i + 1, total - 1));
      else              setIdx(i => Math.max(i - 1, 0));
    }
  };

  const imgStyle: React.CSSProperties = {
    transform: `translate(${state.panX}px, ${state.panY}px) scale(${state.zoom}) rotate(${state.rotation}deg) scaleX(${state.flipH ? -1 : 1})`,
    filter: `brightness(${state.brightness}%) contrast(${state.contrast}%) invert(${state.invert ? 1 : 0})`,
    transition: dragging ? 'none' : 'transform 0.1s',
    cursor: dragging ? 'grabbing' : 'grab',
    maxWidth: '100%', maxHeight: '100%',
    userSelect: 'none',
  };

  return (
    <div className="flex flex-col h-full" onWheel={handleWheel}>
      <div className="flex-1 bg-black flex items-center justify-center overflow-hidden relative"
        onMouseDown={e => { setDragging(true); setDragStart({ x: e.clientX, y: e.clientY, panX: state.panX, panY: state.panY }); }}
        onMouseMove={e => { if (dragging) setState(s => ({ ...s, panX: dragStart.panX + (e.clientX - dragStart.x), panY: dragStart.panY + (e.clientY - dragStart.y) })); }}
        onMouseUp={() => setDragging(false)}
        onMouseLeave={() => setDragging(false)}>

        {imageUrls[idx]
          ? <img src={imageUrls[idx]} style={imgStyle} alt={`${study.studyLabel} — ${idx + 1}`} draggable={false} />
          : <div className="flex flex-col items-center gap-2"><Loader2 className="w-8 h-8 animate-spin text-blue-400" /><span className="text-gray-400 text-xs">Chargement...</span></div>
        }

        <div className="absolute top-2 left-2 text-white text-xs font-mono pointer-events-none space-y-0.5">
          <div>{patientName}</div>
          <div>{study.modality} · {idx + 1}/{total}</div>
        </div>
      </div>

      <div className="bg-gray-900 border-t border-gray-700 px-3 py-2 flex items-center gap-2 flex-wrap">
        <button onClick={() => setIdx(i => Math.max(i - 1, 0))} disabled={idx === 0}
          className="p-1.5 rounded text-gray-300 hover:text-white hover:bg-gray-700 disabled:opacity-30"><ChevronLeft className="w-4 h-4" /></button>
        <span className="text-gray-300 text-xs font-mono min-w-[50px] text-center">{idx + 1}/{total}</span>
        <button onClick={() => setIdx(i => Math.min(i + 1, total - 1))} disabled={idx === total - 1}
          className="p-1.5 rounded text-gray-300 hover:text-white hover:bg-gray-700 disabled:opacity-30"><ChevronRight className="w-4 h-4" /></button>

        {total > 1 && <>
          <div className="w-px h-5 bg-gray-700" />
          <button onClick={() => setPlaying(p => !p)}
            className={`flex items-center gap-1.5 px-2 py-1 rounded text-xs transition ${playing ? 'bg-green-600 text-white' : 'bg-gray-700 text-gray-200'}`}>
            {playing ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3" />}
            {playing ? 'Pause' : 'Lecture'}
          </button>
          <input type="range" min={1} max={20} value={fps}
            onChange={e => setFps(Number(e.target.value))} className="w-16 h-1 accent-blue-500" />
          <span className="text-gray-500 text-xs">{fps}fps</span>
        </>}

        <div className="w-px h-5 bg-gray-700" />
        <button onClick={() => setState(s => ({ ...s, zoom: Math.min(s.zoom + 0.2, 5) }))}
          className="p-1.5 rounded text-gray-300 hover:text-white hover:bg-gray-700"><ZoomIn className="w-4 h-4" /></button>
        <button onClick={() => setState(s => ({ ...s, zoom: Math.max(s.zoom - 0.2, 0.1) }))}
          className="p-1.5 rounded text-gray-300 hover:text-white hover:bg-gray-700"><ZoomOut className="w-4 h-4" /></button>
        <button onClick={() => setState(s => ({ ...s, rotation: (s.rotation + 90) % 360 }))}
          className="p-1.5 rounded text-gray-300 hover:text-white hover:bg-gray-700"><RotateCw className="w-4 h-4" /></button>
        <button onClick={() => setState(s => ({ ...s, flipH: !s.flipH }))}
          className="p-1.5 rounded text-gray-300 hover:text-white hover:bg-gray-700"><FlipHorizontal className="w-4 h-4" /></button>
        <button onClick={() => setState(s => ({ ...s, invert: !s.invert }))}
          className={`px-2 py-1 rounded text-xs transition ${state.invert ? 'bg-white text-black' : 'text-gray-400 hover:bg-gray-700'}`}>INV</button>

        <div className="flex items-center gap-1">
          <Sun className="w-3 h-3 text-gray-500" />
          <input type="range" min={0} max={200} value={state.brightness}
            onChange={e => setState(s => ({ ...s, brightness: Number(e.target.value) }))}
            className="w-16 h-1 accent-yellow-400" />
        </div>

        <button onClick={() => setState(defaultImgState())}
          className="p-1.5 rounded text-gray-400 hover:text-white hover:bg-gray-700"><RefreshCw className="w-3.5 h-3.5" /></button>

        {total > 1 && (
          <div className="w-full mt-1">
            <input type="range" min={0} max={total - 1} value={idx}
              onChange={e => setIdx(Number(e.target.value))}
              className="w-full h-1 accent-blue-500" />
          </div>
        )}
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
//  PDF VIEWER
// ─────────────────────────────────────────────────────────────────────────────
const PdfViewer: React.FC<{ study: IImagingStudy; hospId: string }> = ({ study, hospId }) => {
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      const url = `${API}/api/hospitalizations/${hospId}/studies/${study.studyId}/files/0`;
      const res = await fetch(url, { headers: authHeaders() });
      if (!res.ok) return;
      const blob = await res.blob();
      setPdfUrl(URL.createObjectURL(blob));
    };
    load();
  }, [study.studyId, hospId]);

  if (!pdfUrl) return <div className="flex items-center justify-center h-full"><Loader2 className="w-8 h-8 animate-spin text-blue-400" /></div>;

  return <iframe src={pdfUrl} className="w-full h-full border-0" title={study.studyLabel} />;
};

// ─────────────────────────────────────────────────────────────────────────────
//  ERROR BOUNDARY — prevents DICOM viewer crash from blanking the whole page
// ─────────────────────────────────────────────────────────────────────────────
class ViewerErrorBoundary extends React.Component<
  { children: React.ReactNode; onClose: () => void },
  { hasError: boolean; errorMsg: string }
> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false, errorMsg: '' };
  }
  static getDerivedStateFromError(error: Error) {
    return { hasError: true, errorMsg: error.message };
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="fixed inset-0 z-[200] flex flex-col items-center justify-center bg-black gap-6 text-center px-8">
          <AlertTriangle className="w-12 h-12 text-red-400" />
          <div>
            <h3 className="text-white font-bold text-lg mb-2">Erreur du viewer DICOM</h3>
            <p className="text-gray-400 text-sm mb-1">{this.state.errorMsg}</p>
            <p className="text-gray-600 text-xs">Essayez de télécharger la série et l'ouvrir dans OsiriX ou RadiAnt.</p>
          </div>
          <button onClick={this.props.onClose}
            className="px-6 py-3 bg-gray-700 hover:bg-gray-600 text-white rounded-xl text-sm transition">
            Fermer
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
//  MAIN VIEWER MODAL
// ─────────────────────────────────────────────────────────────────────────────
const MedicalViewer: React.FC<Props> = (props) => {
  return (
    <ViewerErrorBoundary onClose={props.onClose}>
      <MedicalViewerInner {...props} />
    </ViewerErrorBoundary>
  );
};

const MedicalViewerInner: React.FC<Props> = ({ study, hospitalizationId, patientName, onClose }) => {

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onClose]);

  // Support both new IImagingStudy and legacy IDicomSeries field names
  const studyId    = study.studyId    || (study as any).seriesId;
  const studyLabel = study.studyLabel || (study as any).seriesLabel || 'Étude';

  const renderViewer = () => {
    switch (study.viewerType || 'dicom') {
      case 'dicom':
        return <DicomViewer study={study} hospId={hospitalizationId} patientName={patientName} />;
      case 'image':
        return <ImageViewer study={study} hospId={hospitalizationId} patientName={patientName} />;
      case 'pdf':
        return <PdfViewer study={study} hospId={hospitalizationId} />;
      default:
        return (
          <div className="flex items-center justify-center h-full text-gray-400">
            <AlertTriangle className="w-6 h-6 mr-2" /> Type de viewer inconnu: {study.viewerType}
          </div>
        );
    }
  };

  return (
    <div className="fixed inset-0 z-[200] flex flex-col bg-black">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-gray-900 border-b border-gray-700 flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-blue-400 bg-blue-900/40 px-2 py-0.5 rounded font-mono">
              {study.modality}
            </span>
            <span className="text-xs text-gray-500 bg-gray-800 px-2 py-0.5 rounded font-mono uppercase">
              {study.viewerType}
            </span>
          </div>
          <div>
            <h2 className="text-white text-sm font-semibold">{studyLabel}</h2>
            <p className="text-gray-400 text-xs">{patientName} · {study.sliceCount || (study as any).frameCount || study.files.length} coupe(s)</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {study.studyUID && (
            <span className="text-gray-600 text-[10px] font-mono hidden lg:block truncate max-w-[200px]" title={study.studyUID}>
              UID: {study.studyUID.slice(-8)}
            </span>
          )}
          <button onClick={onClose}
            className="p-2 rounded-lg text-gray-400 hover:text-white hover:bg-gray-700 transition">
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Viewer area */}
      <div className="flex-1 overflow-hidden">
        {renderViewer()}
      </div>
    </div>
  );
}; // end MedicalViewerInner

export default MedicalViewer;
