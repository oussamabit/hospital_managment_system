import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Hospitalization, User, IImagingFile, IDicomSeries, IImagingStudy } from '../types';
import {
  X, Printer, Edit2, FileText,
  RotateCw, ChevronLeft, ChevronRight,
  Download, RefreshCw, Play, Film,
} from 'lucide-react';
import MedicalViewer from './MedicalViewer';
import AIAnalysisPanel from './AIAnalysisPanel';
import RapportMedical from "./RapportMedical";

const API_BASE = (import.meta as any).env.VITE_API_URL || 'http://localhost:5005';

const ChuLogo = () => (
  <svg width="70" height="70" viewBox="0 0 140 140" xmlns="http://www.w3.org/2000/svg">
    <circle cx="70" cy="70" r="66" fill="#1a3a6b" stroke="#c8a84b" strokeWidth="4"/>
    <circle cx="70" cy="70" r="58" fill="none" stroke="#c8a84b" strokeWidth="1.5"/>
    <rect x="62" y="32" width="16" height="52" rx="3" fill="white"/>
    <rect x="42" y="52" width="56" height="16" rx="3" fill="white"/>
    <path d="M28 100 Q70 118 112 100" stroke="#c8a84b" strokeWidth="2" fill="none"/>
    <text x="70" y="128" textAnchor="middle" fontFamily="Arial" fontSize="8" fontWeight="bold" fill="#c8a84b">CHU - ORAN</text>
  </svg>
);

interface Props {
  hospitalization: Hospitalization;
  patientData: {
    firstName: string; lastName: string; dossierNumber: string;
    bloodGroup?: string; gender?: string; birthDate?: string;
    phone?: string; address?: string;
  };
  onClose: () => void;
  onEdit?: () => void;
}

const fdate = (d?: string) =>
  d ? new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '';
const ageStr = (b?: string) =>
  b ? String(new Date().getFullYear() - new Date(b).getFullYear()) + ' ans' : '';
const v = (x?: string | number | null) =>
  x !== undefined && x !== null && String(x).trim() !== '' ? String(x) : '';

const SH: React.FC<{ children: React.ReactNode; ul?: boolean; mt?: string }> = ({ children, ul, mt }) => (
  <div className="sh" style={{ marginTop: mt ?? '0', textDecoration: ul ? 'underline' : 'none' }}>{children}</div>
);
const F: React.FC<{ label: string; value?: string; flex?: number }> = ({ label, value, flex }) => (
  <div className="f-field" style={flex ? { flex } : {}}>
    <span className="f-label">{label} :</span>
    <span className="f-value">{v(value)}</span>
  </div>
);
const FL: React.FC<{ label: string; value?: string }> = ({ label, value }) => (
  <div className="f-row"><F label={label} value={value}/></div>
);
const FR: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="f-row">{children}</div>
);
const TextBlock: React.FC<{ text?: string; minLines?: number }> = ({ text, minLines = 4 }) => {
  const lines = text ? text.split('\n').map(l => l.trim()) : [];
  const total = Math.max(lines.length, minLines);
  return (
    <div className="tb-wrap">
      {Array.from({ length: total }).map((_, i) => (
        <div key={i} className="tb-line">{lines[i] || ''}</div>
      ))}
    </div>
  );
};
const Bullet: React.FC<{ label: string; value?: string; minLines?: number }> = ({ label, value, minLines = 3 }) => {
  const lines = value ? value.split('\n').map(l => l.trim()) : [];
  const total = Math.max(lines.length, minLines);
  return (
    <div className="bullet-wrap">
      <div className="bullet-head">- {label} :</div>
      <div>
        {Array.from({ length: total }).map((_, i) => (
          <div key={i} className="tb-line" style={{ paddingLeft: '18pt' }}>{lines[i] || ''}</div>
        ))}
      </div>
    </div>
  );
};
const PB: React.FC<{ n: number }> = ({ n }) => (
  <div className="pb-divider screen-only">
    <span className="pb-label">-- Page {n} --</span>
  </div>
);

type Tool = 'pan' | 'zoom' | 'ww';

interface SingleViewerProps {
  file: IImagingFile; allFiles: IImagingFile[]; currentIndex: number;
  modality: string; patientName: string;
  onClose: () => void; onNavigate: (i: number) => void;
}

const SingleFileViewer: React.FC<SingleViewerProps> = ({ file, allFiles, currentIndex, modality, patientName, onClose, onNavigate }) => {
  const cvs  = useRef<HTMLCanvasElement>(null);
  const cont = useRef<HTMLDivElement>(null);
  const imgR = useRef<HTMLImageElement | null>(null);
  const [zoom, setZoom] = useState(1);
  const [rot,  setRot]  = useState(0);
  const [bri,  setBri]  = useState(100);
  const [con,  setCon]  = useState(100);
  const [fH,   setFH]   = useState(false);
  const [inv,  setInv]  = useState(false);
  const [tool, setTool] = useState<Tool>('pan');
  const [px,   setPx]   = useState(0);
  const [py,   setPy]   = useState(0);
  const [drag, setDrag] = useState(false);
  const [ds,   setDs]   = useState({ x: 0, y: 0 });
  const [ws,   setWs]   = useState({ x: 0, y: 0 });
  const [loaded, setLoaded] = useState(false);
  const [err,    setErr]    = useState('');

  const isDicom = /\.(dcm|dicom)$/i.test(file.originalName || '') || file.fileType === 'application/dicom';
  const isPdf   = file.fileType?.includes('pdf') || /\.pdf$/i.test(file.originalName || '');
  const isImg   = !isDicom && !isPdf;
  const fu      = API_BASE + '/' + file.filePath;

  useEffect(() => { setZoom(1); setPx(0); setPy(0); setRot(0); setBri(100); setCon(100); setFH(false); setInv(false); setLoaded(false); setErr(''); }, [file.fileId]);

  const draw = useCallback(() => {
    const c = cvs.current; const im = imgR.current;
    if (!c || !im || !loaded) return;
    const cx = c.getContext('2d'); if (!cx) return;
    cx.clearRect(0, 0, c.width, c.height);
    cx.save();
    cx.translate(c.width / 2 + px, c.height / 2 + py);
    cx.rotate((rot * Math.PI) / 180);
    cx.scale(zoom * (fH ? -1 : 1), zoom);
    cx.filter = ['brightness(' + bri + '%)', 'contrast(' + con + '%)', inv ? 'invert(1)' : ''].filter(Boolean).join(' ');
    cx.drawImage(im, -im.naturalWidth / 2, -im.naturalHeight / 2);
    cx.restore();
  }, [zoom, px, py, rot, bri, con, fH, inv, loaded]);

  useEffect(() => {
    if (!isImg) return;
    const im = new Image(); im.crossOrigin = 'anonymous';
    im.onload  = () => { imgR.current = im; setLoaded(true); };
    im.onerror = () => setErr("Impossible de charger l'image");
    im.src = fu;
  }, [fu, isImg]);

  useEffect(() => {
    const el = cont.current; if (!el || !cvs.current) return;
    const resize = () => { cvs.current!.width = el.clientWidth; cvs.current!.height = el.clientHeight; draw(); };
    resize();
    const ro = new ResizeObserver(resize); ro.observe(el);
    return () => ro.disconnect();
  }, [draw]);

  useEffect(() => { draw(); }, [draw]);

  const mDown = (e: React.MouseEvent) => { setDrag(true); setDs({ x: e.clientX - px, y: e.clientY - py }); setWs({ x: e.clientX, y: e.clientY }); };
  const mMove = (e: React.MouseEvent) => {
    if (!drag) return;
    if (tool === 'pan')  { setPx(e.clientX - ds.x); setPy(e.clientY - ds.y); }
    else if (tool === 'zoom') { setZoom(z => Math.max(0.1, Math.min(10, z - (e.clientY - ws.y) * 0.005))); setWs({ x: e.clientX, y: e.clientY }); }
    else if (tool === 'ww')   { setBri(b => Math.max(10, Math.min(400, b + (e.clientX - ws.x) * 0.5))); setCon(c => Math.max(10, Math.min(400, c - (e.clientY - ws.y) * 0.5))); setWs({ x: e.clientX, y: e.clientY }); }
  };
  const mUp   = () => setDrag(false);
  const wheel = (e: React.WheelEvent) => { e.preventDefault(); setZoom(z => Math.max(0.1, Math.min(10, z - e.deltaY * 0.001))); };

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowLeft')  onNavigate(Math.max(0, currentIndex - 1));
      if (e.key === 'ArrowRight') onNavigate(Math.min(allFiles.length - 1, currentIndex + 1));
    };
    window.addEventListener('keydown', h); return () => window.removeEventListener('keydown', h);
  }, [currentIndex, allFiles.length, onNavigate, onClose]);

  const reset = () => { setZoom(1); setPx(0); setPy(0); setRot(0); setBri(100); setCon(100); setFH(false); setInv(false); };
  const cursors: Record<Tool, string> = { pan: drag ? 'grabbing' : 'grab', zoom: 'ns-resize', ww: 'crosshair' };

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 60, display: 'flex', flexDirection: 'column', background: 'black', userSelect: 'none' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 16px', background: '#111', borderBottom: '1px solid #222', flexShrink: 0 }}>
        <div>
          <p style={{ color: 'white', fontSize: '11px', fontWeight: 'bold', margin: 0 }}>{patientName}</p>
          <p style={{ color: '#888', fontSize: '9px', margin: 0 }}>{modality} -- {file.notes || file.originalName}</p>
        </div>
        <div style={{ display: 'flex', gap: '4px', background: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: '8px', padding: '4px' }}>
          {(['pan', 'zoom', 'ww'] as Tool[]).map(id => (
            <button key={id} onClick={() => setTool(id)} style={{ padding: '6px 8px', borderRadius: '6px', border: 'none', cursor: 'pointer', background: tool === id ? '#2563eb' : 'transparent', color: tool === id ? 'white' : '#888', fontSize: '10px' }}>{id}</button>
          ))}
          <button onClick={() => setRot(r => (r + 90) % 360)} style={{ padding: '6px 8px', border: 'none', background: 'transparent', color: '#888', cursor: 'pointer', borderRadius: '6px' }}><RotateCw style={{ width: '13px', height: '13px' }} /></button>
          <button onClick={() => setFH(v => !v)} style={{ padding: '6px 8px', border: 'none', background: fH ? '#1e3a5f' : 'transparent', color: fH ? '#7bb3e8' : '#888', cursor: 'pointer', borderRadius: '6px' }}>flip</button>
          <button onClick={() => setInv(v => !v)} style={{ padding: '6px 8px', border: 'none', background: inv ? '#555' : 'transparent', color: inv ? 'white' : '#888', cursor: 'pointer', borderRadius: '6px', fontSize: '10px', fontWeight: 'bold' }}>INV</button>
          <button onClick={reset} style={{ padding: '6px 8px', border: 'none', background: 'transparent', color: '#888', cursor: 'pointer', borderRadius: '6px' }}><RefreshCw style={{ width: '13px', height: '13px' }} /></button>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <a href={fu} download={file.originalName} style={{ padding: '6px 8px', color: '#888', textDecoration: 'none' }}><Download style={{ width: '15px', height: '15px' }} /></a>
          <button onClick={onClose} style={{ padding: '6px 8px', border: 'none', background: 'transparent', color: '#888', cursor: 'pointer' }}><X style={{ width: '15px', height: '15px' }} /></button>
        </div>
      </div>
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {allFiles.length > 1 && (
          <div style={{ width: 68, flexShrink: 0, background: '#0a0a0a', borderRight: '1px solid #1e1e1e', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 6, padding: 6 }}>
            {allFiles.map((f, i) => (
              <button key={f.fileId} onClick={() => onNavigate(i)} style={{ border: '2px solid ' + (i === currentIndex ? '#2563eb' : 'transparent'), borderRadius: 4, overflow: 'hidden', background: 'none', padding: 0, cursor: 'pointer', opacity: i === currentIndex ? 1 : 0.4, flexShrink: 0 }}>
                {f.fileType?.includes('image') ? <img src={API_BASE + '/' + f.filePath} alt="" style={{ width: '100%', aspectRatio: '1', objectFit: 'cover', display: 'block' }} /> : <div style={{ width: '100%', aspectRatio: '1', background: '#1a1a1a', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><span style={{ fontSize: 8, color: '#555', fontWeight: 'bold' }}>{(f.originalName?.split('.').pop() || 'DCM').toUpperCase()}</span></div>}
              </button>
            ))}
          </div>
        )}
        <div ref={cont} style={{ flex: 1, position: 'relative', overflow: 'hidden', background: '#080808', cursor: isImg ? cursors[tool] : 'default' }}
          onMouseDown={isImg ? mDown : undefined} onMouseMove={isImg ? mMove : undefined}
          onMouseUp={isImg ? mUp : undefined} onMouseLeave={isImg ? mUp : undefined} onWheel={isImg ? wheel : undefined}>
          {isImg && <canvas ref={cvs} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} />}
          {isImg && !loaded && !err && <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><div style={{ width: 32, height: 32, border: '2px solid #2563eb', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 1s linear infinite' }} /></div>}
          {err && <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><p style={{ color: 'red', fontSize: 13 }}>{err}</p></div>}
          {isDicom && <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><div style={{ padding: '12px 16px', background: '#161b22', borderRadius: 12, border: '1px solid #30363d', textAlign: 'center' }}><p style={{ color: '#58a6ff', fontSize: 13, fontWeight: 700, margin: '0 0 8px' }}>Fichier DICOM</p><a href={fu} download={file.originalName} style={{ color: '#7bb3e8', fontSize: 12 }}>Telecharger</a></div></div>}
          {isPdf && <iframe src={fu + '#toolbar=1'} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', border: 'none' }} />}
          {allFiles.length > 1 && (
            <>
              <button onClick={() => onNavigate(Math.max(0, currentIndex - 1))} disabled={currentIndex === 0} style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', padding: 8, background: 'rgba(17,17,17,.8)', border: '1px solid #222', borderRadius: 4, color: '#888', cursor: 'pointer' }}><ChevronLeft style={{ width: 15, height: 15 }} /></button>
              <button onClick={() => onNavigate(Math.min(allFiles.length - 1, currentIndex + 1))} disabled={currentIndex === allFiles.length - 1} style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', padding: 8, background: 'rgba(17,17,17,.8)', border: '1px solid #222', borderRadius: 4, color: '#888', cursor: 'pointer' }}><ChevronRight style={{ width: 15, height: 15 }} /></button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

const ImagingThumb: React.FC<{ files: IImagingFile[]; label: string; modality: string; onOpen: (files: IImagingFile[], idx: number, mod: string) => void; }> = ({ files, label, modality, onOpen }) => {
  if (!files?.length) return null;
  return (
    <div className="screen-only" style={{ marginBottom: '10px' }}>
      <p style={{ fontSize: '10px', fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: '6px' }}>{label} -- {files.length} fichier(s)</p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '8px' }}>
        {files.map((f, idx) => (
          <div key={f.fileId} onClick={() => onOpen(files, idx, modality)} style={{ border: '1px solid #e5e7eb', borderRadius: '8px', overflow: 'hidden', cursor: 'pointer' }}>
            <div style={{ height: '64px', background: '#f3f4f6', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {f.fileType?.includes('image') ? <img src={API_BASE + '/' + f.filePath} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <FileText style={{ width: '20px', height: '20px', color: '#9ca3af' }} />}
            </div>
            <div style={{ padding: '4px 6px', background: 'white' }}>
              <p style={{ fontSize: '9px', color: '#6b7280', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', margin: 0 }}>{f.originalName}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

const StudiesThumbs: React.FC<{ studies: IImagingStudy[]; hospitalizationId: string; onOpenStudy: (s: IImagingStudy) => void; }> = ({ studies, onOpenStudy }) => {
  if (!studies?.length) return null;
  const modalityColors: Record<string, string> = { CT: '#1f6feb', MR: '#8b5cf6', RX: '#16a34a', US: '#d97706' };
  return (
    <div className="screen-only" style={{ marginBottom: '12px' }}>
      <p style={{ fontSize: '10px', fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: '8px' }}>Etudes d'imagerie ({studies.length})</p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {studies.map((s) => {
          const color = modalityColors[s.modality] || '#6b7280';
          const previewFile = s.files.find(f => f.fileType?.startsWith('image/') || /\.(jpe?g|png)$/i.test(f.originalName || ''));
          return (
            <div key={s.studyId} onClick={() => onOpenStudy(s)}
              style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 10, cursor: 'pointer', transition: 'border-color .15s' }}
              onMouseEnter={e => (e.currentTarget.style.borderColor = color)} onMouseLeave={e => (e.currentTarget.style.borderColor = '#e2e8f0')}>
              <div style={{ width: 52, height: 52, borderRadius: 6, overflow: 'hidden', flexShrink: 0, background: '#e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {previewFile ? <img src={API_BASE + '/' + previewFile.filePath} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <span style={{ fontSize: 13, fontWeight: 'bold', color }}>{s.modality}</span>}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ color: '#1e293b', fontSize: 13, fontWeight: 600, margin: '0 0 2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.studyLabel}</p>
                <p style={{ color: '#64748b', fontSize: 11, margin: 0 }}><span style={{ color, fontWeight: 700 }}>{s.modality}</span> - {s.sliceCount} coupe(s){s.notes ? ' - ' + s.notes : ''}</p>
              </div>
              <div style={{ width: 32, height: 32, borderRadius: '50%', background: color + '22', border: '1px solid ' + color + '55', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Play style={{ width: 14, height: 14, color, marginLeft: 2 }} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
//  MAIN COMPONENT
// ─────────────────────────────────────────────────────────────────────────────
const HospitalizationDetail: React.FC<Props> = ({ hospitalization: h, patientData: pd, onClose, onEdit }) => {
  const [svOpen,  setSvOpen]  = useState(false);
  const [svFiles, setSvFiles] = useState<IImagingFile[]>([]);
  const [svIdx,   setSvIdx]   = useState(0);
  const [svMod,   setSvMod]   = useState('');
  const [activeTab, setActiveTab] = useState<'dossier' | 'rapport'>('dossier');
  const [studyOpen,   setStudyOpen]   = useState(false);
  const [activeStudy, setActiveStudy] = useState<IImagingStudy | null>(null);

  const openSingleViewer = (files: IImagingFile[], idx: number, mod: string) => { setSvFiles(files); setSvIdx(idx); setSvMod(mod); setSvOpen(true); };
  const openStudyViewer  = (s: IImagingStudy) => { setActiveStudy(s); setStudyOpen(true); };

  const doc = () => {
    if (h.chirurgienTraitantNom) return h.chirurgienTraitantNom;
    if (h.chirurgienTraitantId && typeof h.chirurgienTraitantId === 'object') {
      const d = h.chirurgienTraitantId as User;
      return 'Dr. ' + d.firstName + ' ' + d.lastName;
    }
    return '';
  };

  const ec  = (h.examenClinique       ?? {}) as Record<string, string>;
  const bio = (h.bilanBiologique       ?? {}) as any;
  const fns = (bio.fns                 ?? {}) as any;
  const po  = (h.protocoleOperatoire   ?? {}) as any;
  const bm  = h.bilanMorphologique     ?? {};
  const studies: IImagingStudy[]  = (bm as any).studies || [];
  const morphoLines: string[] = [];
  if (bm.radiographie?.length) morphoLines.push('Radiographie : ' + bm.radiographie.length + ' fichier(s)');
  if (bm.echographie?.length)  morphoLines.push('Echographie : ' + bm.echographie.length + ' fichier(s)');
  if (bm.scanner?.length)      morphoLines.push('Scanner (TDM) : ' + bm.scanner.length + ' fichier(s)');
  if (bm.irm?.length)          morphoLines.push('IRM : ' + bm.irm.length + ' fichier(s)');
  if (studies.length)          morphoLines.push("Etudes d'imagerie : " + studies.length);

  return (
    <>
      {svOpen && svFiles.length > 0 && (
        <SingleFileViewer file={svFiles[svIdx]} allFiles={svFiles} currentIndex={svIdx} modality={svMod} patientName={pd.firstName + ' ' + pd.lastName} onClose={() => setSvOpen(false)} onNavigate={setSvIdx} />
      )}
      {studyOpen && activeStudy && (
        <MedicalViewer study={activeStudy} hospitalizationId={h._id} patientName={pd.firstName + ' ' + pd.lastName} onClose={() => { setStudyOpen(false); setActiveStudy(null); }} />
      )}

      <div className="modal-wrap">
        <div className="modal-box">

          {/* ══ TOOLBAR: title + action buttons only ══ */}
          <div className="toolbar screen-only">
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{ padding: '8px', background: 'rgba(255,255,255,.12)', borderRadius: '10px' }}>
                <FileText style={{ width: '20px', height: '20px', color: 'white' }} />
              </div>
              <div>
                <p style={{ fontWeight: 'bold', fontSize: '15px', color: 'white', margin: 0 }}>Dossier d'Hospitalisation</p>
                <p style={{ fontSize: '11px', opacity: .6, color: 'white', margin: 0 }}>{pd.firstName} {pd.lastName} -- {pd.dossierNumber}</p>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              {onEdit && (
                <button onClick={onEdit} className="btn-edit">
                  <Edit2 style={{ width: '15px', height: '15px' }} /> Modifier
                </button>
              )}
              <button onClick={onClose} className="btn-close">
                <X style={{ width: '18px', height: '18px' }} />
              </button>
            </div>
          </div>

          {/* ══ TABS BAR: separate row below toolbar ══ */}
          <div className="tabs-bar screen-only">
            <button onClick={() => setActiveTab('dossier')} className={activeTab === 'dossier' ? 'tab-btn tab-active' : 'tab-btn'}>
              Dossier Medical
            </button>
            <button onClick={() => setActiveTab('rapport')} className={activeTab === 'rapport' ? 'tab-btn tab-active' : 'tab-btn'}>
              Rapport Medical
            </button>
          </div>

          {/* ══ SCROLLABLE CONTENT ══ */}
          <div className="doc-scroll">
            {activeTab === 'dossier' && (
              <>
                {/* PAGE 1 */}
                <div className="doc-page">
                  <div className="inst-header">
                    <p className="inst-line1">REPUBLIQUE ALGERIENNE DEMOCRATIQUE ET POPULAIRE MINISTERE DE LA SANTE</p>
                    <p className="inst-line1">DE LA POPULATION ET DE LA REFORME HOSPITALIERE</p>
                    <div className="inst-logo-row">
                      <div style={{ flex: 1 }} />
                      <p className="inst-arabic">المركز الاستشفائي الجامعي بوهران</p>
                      <div style={{ flex: 1, display: 'flex', justifyContent: 'flex-end', alignItems: 'center' }}>
                        <ChuLogo />
                      </div>
                    </div>
                    <p className="inst-chu">CENTRE HOSPITALO UNIVERSITAIRE D'ORAN</p>
                    <p className="inst-service">SERVICE DE CHIRURGIE GENERALE ET CANCEROLOGIE EX PAVILLON 14</p>
                    <p className="inst-prof">Pr. K. BELKHARROUBI</p>
                  </div>
                  <div className="title-box-wrap"><div className="title-box">DOSSIER MEDICAL</div></div>
                  <div className="year-row">
                    <div className="year-box">Annee : <strong>{v(h.annee)}</strong></div>
                    <div className="year-box">Dossier n : <strong style={{ fontFamily: 'monospace' }}>{v(h.dossierN ?? pd.dossierNumber)}</strong></div>
                  </div>
                  <div className="fields-block">
                    <FR><F label="N de billet de salle" value={h.noBilletSalle} /><F label="N de lit" value={h.noLit} /><F label="Groupage" value={h.groupage} /><F label="Rh" value={h.rh} /></FR>
                    <FR><F label="Nom" value={pd.lastName} /><F label="Prenom" value={pd.firstName} /><F label="Age" value={ageStr(pd.birthDate)} /></FR>
                    <FR><F label="Adresse" value={pd.address} flex={2} /><F label="N TEL" value={pd.phone} /></FR>
                    <FL label="Profession" value={h.profession} />
                    <FR><F label="Date d'entree" value={fdate(h.dateEntree)} /><F label="Date de sortie" value={fdate(h.dateSortie)} /></FR>
                    <FR><F label="Transfert" value={h.transfert} /><F label="Deces" value={h.deces} /></FR>
                    <FL label="Motif d'admission" value={h.motifAdmission} />
                  </div>
                  <SH ul mt="12pt">DIAGNOSTIC :</SH>
                  <TextBlock text={h.diagnostic} minLines={8} />
                  <SH mt="10pt">Chirurgien Traitant :</SH>
                  <TextBlock text={doc()} minLines={2} />
                  <SH mt="18pt">Examen Clinique :</SH>
                </div>

                <PB n={2} />

                {/* PAGE 2 */}
                <div className="doc-page" style={{ pageBreakBefore: 'always' }}>
                  <Bullet label="Etat general"                 value={ec.etatGeneral}               minLines={3} />
                  <Bullet label="Appareil cardio-respiratoire" value={ec.appareilCardioRespiratoire} minLines={3} />
                  <Bullet label="Appareil genito-urinaire"     value={ec.appareilGenitoUrinaire}     minLines={3} />
                  <Bullet label="Systeme nerveux"              value={ec.systemeNerveux}             minLines={3} />
                  <Bullet label="Appareil digestif"            value={ec.appareilDigestif}           minLines={3} />
                  <SH mt="18pt">Motif d'hospitalisation :</SH>
                </div>

                <PB n={3} />

                {/* PAGE 3 */}
                <div className="doc-page" style={{ pageBreakBefore: 'always' }}>
                  <TextBlock text={h.motifHospitalisation} minLines={3} />
                  <SH mt="14pt">Histoire de la maladie :</SH>
                  <TextBlock text={h.histoireMaladie} minLines={5} />
                  <SH mt="14pt">Antecedents :</SH>
                  <Bullet label="Medicaux"    value={h.antecedentsMedicaux}     minLines={3} />
                  <Bullet label="Chirugicaux" value={h.antecedentsChirurgicaux} minLines={3} />
                  <Bullet label="Allergie"    value={h.allergies}               minLines={2} />
                  <SH mt="14pt">Bilan biologique :</SH>
                </div>

                <PB n={4} />

                {/* PAGE 4 */}
                <div className="doc-page" style={{ pageBreakBefore: 'always' }}>
                  <div className="bio-grid">
                    {([
                      ['GB',         fns.gb  !== undefined ? fns.gb + ' /mm3'   : ''],
                      ['HB',         fns.hb  !== undefined ? fns.hb + ' g/dL'   : ''],
                      ['HT',         fns.ht  !== undefined ? fns.ht + ' %'      : ''],
                      ['PLQ',        fns.plq !== undefined ? fns.plq + ' /mm3'  : ''],
                      ['Uree',       bio.uree       !== undefined ? bio.uree + ' g/L'        : ''],
                      ['Creatinine', bio.creatinine !== undefined ? bio.creatinine + ' mg/L' : ''],
                      ['Positif',    v(bio.positif)],
                      ['Negatif',    v(bio.negatif)],
                    ] as [string, string][]).map(([k, val]) => (
                      <div key={k} className="bio-row">
                        <span className="bio-key">{k} :</span>
                        <span className="bio-val">{val}</span>
                      </div>
                    ))}
                  </div>
                  <SH mt="14pt">Bilan Morphologique :</SH>
                  <div className="screen-only">
                    <StudiesThumbs studies={studies} hospitalizationId={h._id} onOpenStudy={openStudyViewer} />
                    <ImagingThumb files={bm.radiographie || []} label="Radiographie (RX)" modality="RX" onOpen={openSingleViewer} />
                    <ImagingThumb files={bm.echographie  || []} label="Echographie"       modality="US" onOpen={openSingleViewer} />
                    <ImagingThumb files={bm.scanner      || []} label="Scanner (TDM)"     modality="CT" onOpen={openSingleViewer} />
                    <ImagingThumb files={bm.irm          || []} label="IRM"               modality="MR" onOpen={openSingleViewer} />
                    {studies.length === 0 && Object.values(bm).every((a: any) => !a || !a.length) && (
                      <div style={{ padding: '10px', border: '1px dashed #e5e7eb', borderRadius: '8px', textAlign: 'center', marginBottom: '8px' }}>
                        <p style={{ fontSize: '11px', color: '#9ca3af', margin: 0 }}>Aucune image enregistree</p>
                      </div>
                    )}
                  </div>
                  <div className="print-only">
                    {studies.map((s: IImagingStudy) => (
                      <div key={s.studyId} className="tb-line">
                        <strong>{s.modality} -- {s.studyLabel}</strong>
                        {' '}({s.sliceCount} coupe(s){s.notes ? ', ' + s.notes : ''})
                        {s.description ? ' : ' + s.description : ''}
                      </div>
                    ))}
                    {[
                      { key: 'radiographie', label: 'Radiographie (RX)' },
                      { key: 'echographie',  label: 'Echographie' },
                      { key: 'scanner',      label: 'Scanner (TDM/CT)' },
                      { key: 'irm',          label: 'IRM' },
                    ].flatMap(({ key, label }) =>
                      ((bm as any)[key] || []).map((f: any, i: number) => (
                        <div key={key + '-' + i} className="tb-line">
                          <strong>{label}</strong>{f.notes ? ' -- ' + f.notes : ''}{f.description ? ' : ' + f.description : ''}
                        </div>
                      ))
                    )}
                    {!morphoLines.length && <div className="tb-line" style={{ color: '#aaa' }}>--</div>}
                  </div>
                  <SH mt="14pt">Evolution du jour :</SH>
                  <div className="tb-wrap">
                    {(() => {
                      const evs = [...(h.dailyFollowups ?? [])].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
                      const total = Math.max(evs.length, 5);
                      return Array.from({ length: total }).map((_, i) => {
                        const ev = evs[i];
                        return (
                          <div key={i} className="tb-line">
                            {ev && <><strong>{fdate(ev.date)}{ev.evolution ? ' -- ' + ev.evolution : ''} : </strong>{ev.notes}</>}
                          </div>
                        );
                      });
                    })()}
                  </div>
                </div>

                <PB n={5} />

                {/* PAGE 5 - Protocole */}
                <div className="doc-page" style={{ pageBreakBefore: 'always' }}>
                  <div className="arabic-footer">
                    <p style={{ fontSize: '18pt', fontWeight: 'bold' }}>المركز الاستشفائي الجامعي بوهران</p>
                  </div>
                  <div className="po-header">
                    <p className="po-main">CENTRE HOSPITALO-UNIVERSITAIRE D'ORAN</p>
                    <p className="po-sub">Clinique Chirurgicale A</p>
                    <p className="po-sub">Ex. PAVILLON 14</p>
                    <p className="po-sub">SERVICE DU Pr. K. BELKHARROUBI</p>
                  </div>
                  <div className="po-title-wrap"><div className="po-title-box"><em>Protocole Operatoire</em></div></div>
                  <div className="fields-block" style={{ marginTop: '14pt' }}>
                    <FL label="Nom"                value={pd.lastName} />
                    <FL label="Prenom"             value={pd.firstName} />
                    <FL label="Age"                value={ageStr(pd.birthDate)} />
                    <FL label="Diagnostic"         value={v(po.diagnosticOperatoire ?? h.diagnostic)} />
                    <FL label="Nom de l'operateur" value={v(po.nomOperateur ?? doc())} />
                    <FL label="Aide"               value={po.aide} />
                    <FL label="Anesthesistes"      value={po.anesthesistes} />
                  </div>
                  <TextBlock text={po.contenuProtocole} minLines={16} />
                </div>

                {/* AI Panel (screen only) */}
                <div className="screen-only" style={{ maxWidth: '790px', margin: '0 auto 16px' }}>
                  <AIAnalysisPanel patientId={h.patientId} hospitalizationId={h._id} patientName={pd.firstName + ' ' + pd.lastName} />
                </div>

                {/* ══ PRINT BUTTON at the bottom of the document ══ */}
                <div className="print-btn-bar screen-only">
                  <button onClick={() => window.print()} className="btn-print-bottom">
                    <Printer style={{ width: '17px', height: '17px' }} />
                    Imprimer le dossier
                  </button>
                </div>
              </>
            )}

            {activeTab === 'rapport' && (
              <div style={{ background: 'white', borderRadius: '16px', boxShadow: '0 2px 8px rgba(0,0,0,.08)', padding: '32px', marginTop: '20px', maxWidth: '790px', margin: '20px auto' }}>
                <RapportMedical hospitalization={h} patient={pd} />
              </div>
            )}
          </div>

          {/* ═══════════ STYLES ═══════════ */}
          <style>{`
            @keyframes spin { to { transform: rotate(360deg); } }
            .doc-page * { box-sizing: border-box; }

            .modal-wrap {
              position: fixed; inset: 0; z-index: 50;
              display: flex; align-items: flex-start; justify-content: center;
              padding: 16px 24px;
              background: rgba(0,0,0,.55);
              backdrop-filter: blur(4px);
              overflow-y: auto;
            }
            .modal-box {
              background: white; border-radius: 16px;
              box-shadow: 0 24px 64px rgba(0,0,0,.35);
              width: 100%; max-width: 860px;
              margin: 8px 0; overflow: hidden;
              display: flex; flex-direction: column; max-height: 95vh;
            }

            /* Toolbar */
            .toolbar {
              display: flex; align-items: center; justify-content: space-between;
              padding: 14px 20px;
              background: linear-gradient(135deg,#1e293b,#0f172a);
              flex-shrink: 0;
            }
            .btn-edit {
              display: flex; align-items: center; gap: 6px;
              padding: 8px 14px; background: rgba(255,255,255,.1); color: white;
              border: 1px solid rgba(255,255,255,.15); border-radius: 10px;
              font-size: 13px; cursor: pointer; font-family: inherit;
            }
            .btn-edit:hover { background: rgba(255,255,255,.18); }
            .btn-close {
              padding: 8px; background: transparent; color: white;
              border: none; border-radius: 8px; cursor: pointer;
            }
            .btn-close:hover { background: rgba(255,255,255,.1); }

            /* Tabs bar - separate row */
            .tabs-bar {
              display: flex; align-items: flex-end; gap: 2px;
              padding: 0 20px;
              background: #1e293b;
              border-bottom: 3px solid #334155;
              flex-shrink: 0;
            }
            .tab-btn {
              padding: 10px 22px 8px;
              font-size: 13px; font-weight: 600;
              color: #94a3b8;
              background: transparent;
              border: none; border-radius: 8px 8px 0 0;
              cursor: pointer; font-family: inherit;
              transition: color .15s, background .15s;
              border-bottom: 3px solid transparent;
              margin-bottom: -3px;
            }
            .tab-btn:hover { color: #e2e8f0; }
            .tab-active {
              color: #1e293b !important;
              background: white !important;
              border-bottom: 3px solid white !important;
            }

            /* Scrollable doc area */
            .doc-scroll { overflow-y: auto; background: #f1f5f9; flex: 1; padding: 20px; }

            .doc-page {
              background: white; margin: 0 auto 20px; padding: 28px 36px;
              max-width: 790px; box-shadow: 0 2px 8px rgba(0,0,0,.09);
              border-radius: 6px; font-family: Arial, sans-serif;
              font-size: 10pt; color: #111; line-height: 1.5;
              min-height: 26cm; box-sizing: border-box;
            }

            /* Print button bar at the very bottom */
            .print-btn-bar {
              max-width: 790px; margin: 0 auto 28px;
              display: flex; justify-content: center;
            }
            .btn-print-bottom {
              display: flex; align-items: center; gap: 8px;
              padding: 13px 36px;
              background: #2563eb; color: white;
              border: none; border-radius: 14px;
              font-size: 14px; font-weight: 600;
              cursor: pointer; font-family: inherit;
              box-shadow: 0 4px 14px rgba(37,99,235,.35);
              transition: background .15s, box-shadow .15s, transform .1s;
            }
            .btn-print-bottom:hover {
              background: #1d4ed8;
              box-shadow: 0 6px 20px rgba(37,99,235,.45);
              transform: translateY(-1px);
            }
            .btn-print-bottom:active { transform: translateY(0); }

            /* Doc content classes */
            .inst-header    { text-align: center; margin-bottom: 10pt; }
            .inst-line1     { font-size: 7.5pt; font-weight: bold; margin: 0; line-height: 1.4; }
            .inst-logo-row  { display: flex; align-items: center; justify-content: center; gap: 12px; margin: 8pt 0 4pt; }
            .inst-arabic    { font-size: 18pt; font-weight: bold; text-align: center; flex: 0; white-space: nowrap; }
            .inst-chu       { font-size: 11pt; font-weight: bold; margin: 3pt 0 0; }
            .inst-service   { font-size: 10pt; font-weight: bold; margin: 2pt 0 0; }
            .inst-prof      { font-size: 11pt; font-weight: bold; text-decoration: underline; margin: 6pt 0 0; }
            .title-box-wrap { display: flex; justify-content: center; margin: 12pt 0; }
            .title-box      { border: 2px solid #333; padding: 6pt 32pt; font-size: 12pt; font-weight: bold; letter-spacing: 1px; }
            .year-row { display: flex; justify-content: space-between; margin-bottom: 10pt; gap: 8pt; }
            .year-box { border: 1.5px solid #555; padding: 4pt 10pt; font-size: 10pt; }
            .fields-block { margin-bottom: 6pt; }
            .f-row { display: flex; align-items: flex-end; border-bottom: 1px dotted #999; min-height: 19pt; margin-bottom: 3pt; padding-bottom: 1.5pt; }
            .f-field { display: flex; align-items: flex-end; gap: 4pt; flex: 1; padding-right: 6pt; }
            .f-label { font-weight: bold; font-size: 9.5pt; white-space: nowrap; line-height: 1; }
            .f-value { font-size: 9.5pt; flex: 1; line-height: 1; }
            .sh { font-weight: bold; font-size: 10.5pt; margin-bottom: 4pt; }
            .tb-wrap { margin-bottom: 4pt; }
            .tb-line { display: flex; align-items: flex-end; border-bottom: 1px dotted #999; min-height: 19pt; padding-bottom: 1.5pt; font-size: 9.5pt; line-height: 1; }
            .bullet-wrap { margin-bottom: 8pt; }
            .bullet-head { font-weight: bold; font-size: 10pt; margin-bottom: 2pt; }
            .bio-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 0 20pt; margin-bottom: 4pt; }
            .bio-row  { display: flex; align-items: flex-end; border-bottom: 1px dotted #999; min-height: 17pt; padding-bottom: 1.5pt; gap: 4pt; }
            .bio-key  { font-weight: bold; font-size: 9pt; white-space: nowrap; min-width: 55pt; line-height: 1; }
            .bio-val  { font-size: 9pt; line-height: 1; }
            .arabic-footer { text-align: center; margin-top: 24pt; padding-top: 8pt; }
            .po-header  { margin-bottom: 8pt; }
            .po-main    { font-size: 12pt; font-weight: bold; text-align: center; margin-bottom: 8pt; }
            .po-sub     { font-size: 10.5pt; font-weight: bold; margin: 2pt 0; }
            .po-title-wrap { display: flex; justify-content: center; margin: 10pt 0 8pt; }
            .po-title-box  { border: 2px dashed #555; padding: 6pt 40pt; font-size: 13pt; font-weight: bold; font-style: italic; }
            .screen-only { display: block; }
            .print-only  { display: none; }
            .pb-divider  { display: flex; align-items: center; justify-content: center; margin: 6px 0; }
            .pb-label    { font-size: 9px; font-weight: 600; color: #94a3b8; background: #f1f5f9; padding: 2px 12px; border-radius: 20px; text-transform: uppercase; letter-spacing: .06em; }

            @media print {
              .modal-wrap    { position: static !important; background: none !important; backdrop-filter: none !important; padding: 0 !important; overflow: visible !important; display: block !important; inset: auto !important; }
              .modal-box     { max-height: none !important; border-radius: 0 !important; box-shadow: none !important; overflow: visible !important; background: white !important; display: block !important; }
              .doc-scroll    { overflow: visible !important; background: white !important; padding: 0 !important; flex: none !important; }
              .doc-page      { padding: 1.4cm 1.8cm !important; margin: 0 !important; max-width: 100% !important; box-shadow: none !important; border-radius: 0 !important; background: white !important; page-break-after: always; break-after: page; min-height: 0 !important; height: 24.7cm !important; overflow: hidden !important; }
              .doc-page:last-of-type { page-break-after: auto; break-after: auto; }
              .doc-page + .doc-page  { page-break-before: always; break-before: page; }
              .screen-only   { display: none !important; }
              .print-only    { display: block !important; }
              .toolbar       { display: none !important; }
              .tabs-bar      { display: none !important; }
              .pb-divider    { display: none !important; }
              .print-btn-bar { display: none !important; }
              @page { size: A4 portrait; margin: 1.2cm 1.5cm; }
            }
          `}</style>
        </div>
      </div>
    </>
  );
};

export default HospitalizationDetail;
