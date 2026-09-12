import React, { useState, useRef } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { hospitalizationApi, authApi } from '../services/api';
import MedicalViewer from './MedicalViewer';
import {
  Hospitalization, IFns, IFormuleLeuco, IBilanBiologique,
  IExamenClinique, IProtocoleOperatoire, IDicomSeries, IDicomSeriesFile, User,
} from '../types';
import {
  X, Save, Loader2, ChevronLeft, ChevronRight,
  FileText, Activity, Microscope, Image as ImageIcon,
  Calendar, Plus, Trash2, Upload, FlaskConical, User as UserIcon,
  Heart, Brain, AlertTriangle, Scissors, FolderOpen, Film, Play,
} from 'lucide-react';

const API_BASE = (import.meta as any).env.VITE_API_URL || 'http://localhost:5005';
const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];

interface Props {
  patientId: string;
  patientData: {
    firstName: string; lastName: string; dossierNumber: string;
    bloodGroup?: string; gender?: string; birthDate?: string;
    phone?: string; address?: string;
  };
  hospitalization?: Hospitalization;
  onClose: () => void;
}

const STEPS = [
  { id: 1, label: 'Page 1 — Infos & Diagnostic',   icon: FileText   },
  { id: 2, label: 'Page 2 — Examen clinique',       icon: Heart      },
  { id: 3, label: 'Page 3 — Anamnèse',              icon: Brain      },
  { id: 4, label: 'Page 4 — Bilans',                icon: FlaskConical },
  { id: 5, label: 'Page 5 — Imagerie',              icon: ImageIcon  },
  { id: 6, label: 'Protocole Opératoire',           icon: Scissors   },
  { id: 7, label: 'Suivi journalier',               icon: Calendar   },
];

const HospitalizationForm: React.FC<Props> = ({ patientId, patientData, hospitalization, onClose }) => {
  const qc = useQueryClient();
  const isEdit = !!hospitalization;
  const [step, setStep] = useState(1);
  const [bloodGroupError, setBloodGroupError] = useState('');

  const [page1, setPage1] = useState({
    annee:             hospitalization?.annee             || new Date().getFullYear().toString(),
    dossierN:          hospitalization?.dossierN          || '',
    noBilletSalle:     hospitalization?.noBilletSalle     || '',
    noLit:             hospitalization?.noLit             || '',
    groupage:          hospitalization?.groupage          || patientData.bloodGroup || '',
    rh:                hospitalization?.rh                || '',
    profession:        hospitalization?.profession        || '',
    dateEntree:        hospitalization?.dateEntree        ? hospitalization.dateEntree.substring(0,10) : new Date().toISOString().substring(0,10),
    dateSortie:        hospitalization?.dateSortie        ? hospitalization.dateSortie.substring(0,10) : '',
    transfert:         hospitalization?.transfert         || '',
    deces:             hospitalization?.deces             || '',
    motifAdmission:    hospitalization?.motifAdmission    || '',
    diagnostic:        hospitalization?.diagnostic        || '',
    chirurgienTraitantId: typeof hospitalization?.chirurgienTraitantId === 'object'
      ? (hospitalization?.chirurgienTraitantId as User)?._id || ''
      : hospitalization?.chirurgienTraitantId || '',
    chirurgienTraitantNom: hospitalization?.chirurgienTraitantNom || '',
  });

  const [page2, setPage2] = useState<IExamenClinique>(hospitalization?.examenClinique || {});

  const [page3, setPage3] = useState({
    motifHospitalisation:   hospitalization?.motifHospitalisation   || '',
    histoireMaladie:        hospitalization?.histoireMaladie        || '',
    antecedentsMedicaux:    hospitalization?.antecedentsMedicaux    || '',
    antecedentsChirurgicaux: hospitalization?.antecedentsChirurgicaux || '',
    allergies:              hospitalization?.allergies              || '',
  });

  const [bilanBio,    setBilanBio]    = useState<IBilanBiologique>(hospitalization?.bilanBiologique || {});
  const [fns,         setFns]         = useState<IFns>(hospitalization?.bilanBiologique?.fns || {});
  const [formuleLeuco, setFormuleLeuco] = useState<IFormuleLeuco>(hospitalization?.bilanBiologique?.formuleLeuco || {});
  const [protocole, setProtocole] = useState<IProtocoleOperatoire>(hospitalization?.protocoleOperatoire || {});
  const [newFollowup, setNewFollowup] = useState({ date: new Date().toISOString().substring(0,10), notes: '', evolution: '' });

  // ── Upload mode toggle: 'dicom' | 'single'
  const [uploadMode, setUploadMode] = useState<'dicom' | 'single'>('dicom');

  // Single file state
  const [imagingType, setImagingType] = useState<'radiographie'|'echographie'|'scanner'|'irm'>('radiographie');
  const [imagingFile, setImagingFile] = useState<File | null>(null);
  const [imagingNotes, setImagingNotes] = useState('');
  const [imagingDescription, setImagingDescription] = useState('');

  // DICOM series state
  const [seriesFiles, setSeriesFiles]       = useState<FileList | null>(null);
  const [seriesLabel, setSeriesLabel]       = useState('');
  const [seriesType, setSeriesType]         = useState<'radiographie'|'echographie'|'scanner'|'irm'>('scanner');
  const [seriesNotes, setSeriesNotes]       = useState('');
  const [seriesDescription, setSeriesDescription] = useState('');
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploadingFolder, setIsUploadingFolder] = useState(false);
  const [viewingSeries, setViewingSeries]   = useState<IDicomSeries | null>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);
  const multiInputRef  = useRef<HTMLInputElement>(null);

  const { data: doctorsData } = useQuery({
    queryKey: ['doctors'],
    queryFn: () => authApi.getDoctors().then(r => r.data.doctors as User[]),
  });

  const validateBloodGroup = (value: string) => {
    if (!value) { setBloodGroupError(''); return; }
    if (patientData.bloodGroup && value !== patientData.bloodGroup) {
      setBloodGroupError(`⚠️ Diffère du dossier patient (${patientData.bloodGroup}). Vérifiez.`);
    } else { setBloodGroupError(''); }
  };

  const createMutation = useMutation({
    mutationFn: (data: Record<string,unknown>) => hospitalizationApi.create(patientId, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['hospitalizations', patientId] }); onClose(); },
  });
  const updateMutation = useMutation({
    mutationFn: (data: Record<string,unknown>) => hospitalizationApi.update(hospitalization!._id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['hospitalizations', patientId] }); },
  });
  const addFollowupMutation = useMutation({
    mutationFn: (data: { date:string; notes:string; evolution?:string }) =>
      hospitalizationApi.addFollowup(hospitalization!._id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['hospitalizations', patientId] });
      setNewFollowup({ date: new Date().toISOString().substring(0,10), notes: '', evolution: '' });
    },
  });
  const deleteFollowupMutation = useMutation({
    mutationFn: (fid: string) => hospitalizationApi.deleteFollowup(hospitalization!._id, fid),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['hospitalizations', patientId] }),
  });
  const uploadImagingMutation = useMutation({
    mutationFn: (fd: FormData) => hospitalizationApi.uploadImaging(hospitalization!._id, fd),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['hospitalizations', patientId] });
      setImagingFile(null); setImagingNotes(''); setImagingDescription('');
    },
  });
  const deleteImagingMutation = useMutation({
    mutationFn: ({ type, fileId }:{ type:string; fileId:string }) =>
      hospitalizationApi.deleteImaging(hospitalization!._id, type, fileId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['hospitalizations', patientId] }),
  });
  const uploadSeriesMutation = useMutation({
    mutationFn: (fd: FormData) =>
      hospitalizationApi.uploadDicomSeries(hospitalization!._id, fd, setUploadProgress),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['hospitalizations', patientId] });
      setSeriesFiles(null); setSeriesLabel(''); setSeriesNotes(''); setSeriesDescription('');
      setUploadProgress(0); setIsUploadingFolder(false);
      if (folderInputRef.current) folderInputRef.current.value = '';
      if (multiInputRef.current)  multiInputRef.current.value  = '';
    },
    onError: () => { setUploadProgress(0); setIsUploadingFolder(false); },
  });
  const deleteSeriesMutation = useMutation({
    mutationFn: (seriesId: string) =>
      hospitalizationApi.deleteDicomSeries(hospitalization!._id, seriesId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['hospitalizations', patientId] }),
  });

  const isPending = createMutation.isPending || updateMutation.isPending;

  const buildPayload = () => ({
    ...page1,
    groupage: page1.groupage.toUpperCase(),
    examenClinique: page2,
    ...page3,
    bilanBiologique: { ...bilanBio, fns, formuleLeuco },
    protocoleOperatoire: protocole,
  });

  const handleSave = () => {
    const payload = buildPayload();
    isEdit ? updateMutation.mutate(payload as any) : createMutation.mutate(payload as any);
  };

  const handleImagingUpload = (e: React.FormEvent) => {
    e.preventDefault();
    if (!imagingFile || !hospitalization) return;
    if (!imagingDescription.trim()) { alert('La description est obligatoire.'); return; }
    const fd = new FormData();
    fd.append('file', imagingFile);
    fd.append('imagingType', imagingType);
    fd.append('notes', imagingNotes);
    fd.append('description', imagingDescription);
    uploadImagingMutation.mutate(fd);
  };

  // ── Shared style tokens (light/dark theme aware)
  const cls = 'w-full rounded-xl border border-gray-200 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none transition';
  const lbl = 'block text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1 uppercase tracking-wider';
  const ta  = cls + ' resize-none';

  const Num = ({ label, value, onChange, unit }: { label:string; value?:number; onChange:(v:number|undefined)=>void; unit?:string }) => (
    <div>
      <label className={lbl}>{label}{unit && <span className="text-gray-400 ml-1 normal-case font-normal">({unit})</span>}</label>
      <input type="number" step="any" min={0} className={cls} value={value??''} placeholder="—"
        onChange={e => onChange(e.target.value==='' ? undefined : parseFloat(e.target.value))} />
    </div>
  );

  // ─── PAGE 1 ───────────────────────────────────────────────────────────────
  const renderPage1 = () => (
    <div className="space-y-5">
      <div className="text-center p-4 bg-gray-50 dark:bg-slate-800/60 rounded-2xl border border-gray-200 dark:border-slate-700">
        <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">République Algérienne Démocratique et Populaire</p>
        <p className="text-[10px] text-gray-500">Ministère de la Santé, de la Population et de la Réforme Hospitalière</p>
        <p className="text-sm font-bold text-gray-800 dark:text-gray-100 mt-1">Centre Hospitalo-Universitaire d'Oran</p>
        <p className="text-xs text-gray-500">Service de Chirurgie Générale — Ex Pavillon 14 et Cancérologie</p>
        <p className="text-xs font-semibold text-gray-600 dark:text-gray-300">Pr. K. BELKHARROUBI</p>
        <div className="mt-2 inline-block px-5 py-1 border-2 border-gray-700 dark:border-gray-300 rounded">
          <span className="text-sm font-black tracking-widest text-gray-800 dark:text-gray-100">DOSSIER MÉDICAL</span>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div><label className={lbl}>Année</label><input className={cls} value={page1.annee} onChange={e=>setPage1(p=>({...p,annee:e.target.value}))} /></div>
        <div><label className={lbl}>Dossier N°</label><input className={cls} value={page1.dossierN} onChange={e=>setPage1(p=>({...p,dossierN:e.target.value}))} /></div>
      </div>
      <div className="p-3 bg-gray-50 dark:bg-slate-800/50 rounded-xl border border-gray-200 dark:border-slate-700 space-y-3">
        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Identification</p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div><label className={lbl}>N° Billet de salle</label><input className={cls} value={page1.noBilletSalle} onChange={e=>setPage1(p=>({...p,noBilletSalle:e.target.value}))} /></div>
          <div><label className={lbl}>N° Lit</label><input className={cls} value={page1.noLit} onChange={e=>setPage1(p=>({...p,noLit:e.target.value}))} /></div>
          <div>
            <label className={lbl}>Groupage{patientData.bloodGroup && <span className="ml-1 text-red-500 normal-case">({patientData.bloodGroup})</span>}</label>
            <select className={bloodGroupError ? cls+' border-amber-400' : cls} value={page1.groupage}
              onChange={e=>{ setPage1(p=>({...p,groupage:e.target.value})); validateBloodGroup(e.target.value); }}>
              <option value="">—</option>
              {BLOOD_GROUPS.map(g=><option key={g} value={g}>{g}</option>)}
            </select>
            {bloodGroupError && <p className="text-amber-600 text-[10px] mt-0.5 flex items-center gap-1"><AlertTriangle className="w-3 h-3 flex-shrink-0"/>{bloodGroupError}</p>}
          </div>
          <div>
            <label className={lbl}>Rh</label>
            <select className={cls} value={page1.rh} onChange={e=>setPage1(p=>({...p,rh:e.target.value}))}>
              <option value="">—</option><option value="+">+ (Positif)</option><option value="-">− (Négatif)</option>
            </select>
          </div>
        </div>
      </div>
      <div className="p-3 bg-primary-50/50 dark:bg-primary-900/10 rounded-xl border border-primary-100 dark:border-primary-800/30">
        <p className="text-[10px] font-bold text-primary-600 uppercase tracking-wider mb-2 flex items-center gap-1"><UserIcon className="w-3 h-3"/> Identité patient (auto-rempli)</p>
        <div className="grid grid-cols-3 gap-3 text-sm">
          <div><span className="text-gray-400 text-xs">Nom :</span><p className="font-semibold">{patientData.lastName}</p></div>
          <div><span className="text-gray-400 text-xs">Prénom :</span><p className="font-semibold">{patientData.firstName}</p></div>
          <div><span className="text-gray-400 text-xs">N° Dossier :</span><p className="font-mono font-bold text-teal-700">{patientData.dossierNumber}</p></div>
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div><label className={lbl}>Profession</label><input className={cls} value={page1.profession} onChange={e=>setPage1(p=>({...p,profession:e.target.value}))} /></div>
        <div className="grid grid-cols-2 gap-3">
          <div><label className={lbl}>Date d'entrée</label><input type="date" className={cls} value={page1.dateEntree} onChange={e=>setPage1(p=>({...p,dateEntree:e.target.value}))} /></div>
          <div><label className={lbl}>Date de sortie</label><input type="date" className={cls} value={page1.dateSortie} onChange={e=>setPage1(p=>({...p,dateSortie:e.target.value}))} /></div>
        </div>
        <div><label className={lbl}>Transfert</label><input className={cls} value={page1.transfert} onChange={e=>setPage1(p=>({...p,transfert:e.target.value}))} /></div>
        <div><label className={lbl}>Décès</label><input className={cls} value={page1.deces} onChange={e=>setPage1(p=>({...p,deces:e.target.value}))} /></div>
      </div>
      <div><label className={lbl}>Motif d'admission</label><textarea rows={2} className={ta} value={page1.motifAdmission} onChange={e=>setPage1(p=>({...p,motifAdmission:e.target.value}))} /></div>
      <div className="p-4 bg-red-50/50 dark:bg-red-900/10 rounded-2xl border border-red-100 dark:border-red-800/30">
        <label className={lbl+'  !text-red-600'}>Diagnostic</label>
        <textarea rows={4} className={ta} value={page1.diagnostic} onChange={e=>setPage1(p=>({...p,diagnostic:e.target.value}))} placeholder="Saisir le diagnostic principal..." />
      </div>
      <div className="p-4 bg-gray-50 dark:bg-slate-800/60 rounded-2xl border border-gray-200 dark:border-slate-700 space-y-3">
        <label className={lbl+'  !text-primary-600'}>Chirurgien Traitant</label>
        <select className={cls} value={page1.chirurgienTraitantId}
          onChange={e=>setPage1(p=>({...p,chirurgienTraitantId:e.target.value,chirurgienTraitantNom:''}))}>
          <option value="">— Sélectionner un médecin —</option>
          {(doctorsData||[]).map(d=>(
            <option key={d._id} value={d._id}>Dr. {d.firstName} {d.lastName}{d.specialite?` (${d.specialite})`:''}</option>
          ))}
          <option value="__new__">+ Ajouter un nouveau chirurgien</option>
        </select>
        {page1.chirurgienTraitantId==='__new__' && (
          <input className={cls} placeholder="Nom complet du chirurgien" value={page1.chirurgienTraitantNom}
            onChange={e=>setPage1(p=>({...p,chirurgienTraitantNom:e.target.value}))} />
        )}
      </div>
    </div>
  );

  // ─── PAGE 2 ───────────────────────────────────────────────────────────────
  const renderPage2 = () => (
    <div className="space-y-4">
      <div className="p-3 bg-red-50 dark:bg-red-900/10 rounded-xl border border-red-100 dark:border-red-800/30">
        <p className="text-xs font-bold text-red-600 uppercase tracking-wider">Examen clinique</p>
      </div>
      {[
        { key:'etatGeneral', label:'État général' },
        { key:'appareilCardioRespiratoire', label:'Appareil cardio-respiratoire' },
        { key:'appareilGenitoUrinaire', label:'Appareil génito-urinaire' },
        { key:'systemeNerveux', label:'Système nerveux' },
        { key:'appareilDigestif', label:'Appareil digestif' },
        { key:'autresSystemes', label:'Autres systèmes' },
      ].map(({key,label})=>(
        <div key={key}>
          <label className={lbl}>{label}</label>
          <textarea rows={3} className={ta} value={(page2 as any)[key]||''} onChange={e=>setPage2(p=>({...p,[key]:e.target.value}))} placeholder="..." />
        </div>
      ))}
    </div>
  );

  // ─── PAGE 3 ───────────────────────────────────────────────────────────────
  const renderPage3 = () => (
    <div className="space-y-4">
      <div><label className={lbl}>Motif d'hospitalisation</label><textarea rows={3} className={ta} value={page3.motifHospitalisation} onChange={e=>setPage3(p=>({...p,motifHospitalisation:e.target.value}))} placeholder="..." /></div>
      <div><label className={lbl}>Histoire de la maladie</label><textarea rows={6} className={ta} value={page3.histoireMaladie} onChange={e=>setPage3(p=>({...p,histoireMaladie:e.target.value}))} placeholder="..." /></div>
      <div className="p-4 bg-gray-50 dark:bg-slate-800/50 rounded-2xl border border-gray-200 dark:border-slate-700 space-y-4">
        <p className="text-xs font-bold text-gray-600 dark:text-gray-300 uppercase tracking-wider">Antécédents</p>
        <div><label className={lbl}>• Médicaux</label><textarea rows={3} className={ta} value={page3.antecedentsMedicaux} onChange={e=>setPage3(p=>({...p,antecedentsMedicaux:e.target.value}))} placeholder="..." /></div>
        <div><label className={lbl}>• Chirurgicaux</label><textarea rows={3} className={ta} value={page3.antecedentsChirurgicaux} onChange={e=>setPage3(p=>({...p,antecedentsChirurgicaux:e.target.value}))} placeholder="..." /></div>
        <div><label className={lbl}>• Allergie</label><textarea rows={2} className={ta} value={page3.allergies} onChange={e=>setPage3(p=>({...p,allergies:e.target.value}))} placeholder="..." /></div>
      </div>
    </div>
  );

  // ─── PAGE 4 ───────────────────────────────────────────────────────────────
  const renderPage4 = () => (
    <div className="space-y-6">
      <div className="p-4 bg-blue-50 dark:bg-blue-900/10 rounded-2xl border border-blue-100 dark:border-blue-800/30 space-y-4">
        <p className="text-xs font-bold text-blue-700 dark:text-blue-400 uppercase tracking-widest flex items-center gap-2"><Activity className="w-3.5 h-3.5"/> Bilan Biologique</p>
        <div>
          <p className="text-[10px] font-bold text-blue-500 uppercase tracking-wider mb-2">FNS</p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Num label="GB" unit="/mm³" value={fns.gb} onChange={v=>setFns(f=>({...f,gb:v}))} />
            <Num label="GR" unit="M/mm³" value={fns.gr} onChange={v=>setFns(f=>({...f,gr:v}))} />
            <Num label="HB" unit="g/dL" value={fns.hb} onChange={v=>setFns(f=>({...f,hb:v}))} />
            <Num label="HT" unit="%" value={fns.ht} onChange={v=>setFns(f=>({...f,ht:v}))} />
            <Num label="VGM" unit="fL" value={fns.vgm} onChange={v=>setFns(f=>({...f,vgm:v}))} />
            <Num label="TCMH" unit="pg" value={fns.tcmh} onChange={v=>setFns(f=>({...f,tcmh:v}))} />
            <Num label="CCMH" unit="g/dL" value={fns.ccmh} onChange={v=>setFns(f=>({...f,ccmh:v}))} />
            <Num label="PLQ" unit="/mm³" value={fns.plq} onChange={v=>setFns(f=>({...f,plq:v}))} />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Num label="Urée" unit="g/L" value={bilanBio.uree} onChange={v=>setBilanBio(b=>({...b,uree:v}))} />
          <Num label="Créatinine" unit="mg/L" value={bilanBio.creatinine} onChange={v=>setBilanBio(b=>({...b,creatinine:v}))} />
        </div>
        <div>
          <p className="text-[10px] font-bold text-purple-500 uppercase tracking-wider mb-2 flex items-center gap-1"><Microscope className="w-3 h-3"/> Formule leucocytaire</p>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <Num label="Neutrophiles" unit="%" value={formuleLeuco.neutrophiles} onChange={v=>setFormuleLeuco(f=>({...f,neutrophiles:v}))} />
            <Num label="Lymphocytes" unit="%" value={formuleLeuco.lymphocytes} onChange={v=>setFormuleLeuco(f=>({...f,lymphocytes:v}))} />
            <Num label="Monocytes" unit="%" value={formuleLeuco.monocytes} onChange={v=>setFormuleLeuco(f=>({...f,monocytes:v}))} />
            <Num label="Éosinophiles" unit="%" value={formuleLeuco.eosinophiles} onChange={v=>setFormuleLeuco(f=>({...f,eosinophiles:v}))} />
            <Num label="Basophiles" unit="%" value={formuleLeuco.basophiles} onChange={v=>setFormuleLeuco(f=>({...f,basophiles:v}))} />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div><label className={lbl}>Positif (+)</label><input className={cls} value={bilanBio.positif||''} onChange={e=>setBilanBio(b=>({...b,positif:e.target.value}))} placeholder="ex: Ag HBs +" /></div>
          <div><label className={lbl}>Négatif (−)</label><input className={cls} value={bilanBio.negatif||''} onChange={e=>setBilanBio(b=>({...b,negatif:e.target.value}))} placeholder="ex: VIH −" /></div>
        </div>
        <div><label className={lbl}>Autres examens biologiques</label><textarea rows={2} className={ta} value={bilanBio.autresExamens||''} onChange={e=>setBilanBio(b=>({...b,autresExamens:e.target.value}))} placeholder="TP, TCA, ionogramme, glycémie..." /></div>
      </div>
      <div className="p-4 bg-purple-50 dark:bg-purple-900/10 rounded-2xl border border-purple-100 dark:border-purple-800/30">
        <p className="text-xs font-bold text-purple-700 dark:text-purple-400 uppercase tracking-widest flex items-center gap-2 mb-2"><ImageIcon className="w-3.5 h-3.5"/> Bilan Morphologique (Imagerie)</p>
        <p className="text-xs text-gray-500">Uploadez les images (RX, Échographie, Scanner, IRM) dans l'onglet <b>Page 5 — Imagerie</b>.</p>
        {(() => {
          const bm = hospitalization?.bilanMorphologique;
          if (!bm) return null;
          const total = (bm.radiographie?.length||0)+(bm.echographie?.length||0)+(bm.scanner?.length||0)+(bm.irm?.length||0);
          return total > 0 ? <p className="text-xs text-purple-600 mt-1 font-semibold">{total} fichier(s) déjà uploadé(s) →</p> : null;
        })()}
      </div>
      <div className="p-4 bg-teal-50 dark:bg-teal-900/10 rounded-2xl border border-teal-100 dark:border-teal-800/30">
        <p className="text-xs font-bold text-teal-700 dark:text-teal-400 uppercase tracking-widest flex items-center gap-2 mb-2"><Calendar className="w-3.5 h-3.5"/> Évolution du jour</p>
        <p className="text-xs text-gray-500">Gérez le suivi journalier dans l'onglet <b>Suivi journalier</b>.</p>
      </div>
    </div>
  );

  // ─── PAGE 5 — Imagerie (single unified panel with mode toggle) ─────────────
  const renderPage5 = () => {
    if (!isEdit) return (
      <div className="text-center py-12 bg-amber-50 dark:bg-amber-900/10 rounded-2xl border border-dashed border-amber-200 dark:border-amber-800">
        <ImageIcon className="w-10 h-10 text-amber-400 mx-auto mb-3" />
        <p className="text-sm font-medium text-amber-700">Sauvegardez d'abord l'hospitalisation</p>
        <button onClick={handleSave} disabled={isPending} className="btn-primary mt-4 py-2 px-5 text-sm">
          {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Créer l'hospitalisation
        </button>
      </div>
    );

    const bm   = hospitalization?.bilanMorphologique || {};
    // Support both new 'studies' and legacy 'series' arrays
    const studies: any[] = [
      ...((bm as any).studies || []),
      ...((bm as any).series  || []),
    ];
    const TYPES = [
      { key:'radiographie', label:'Radiographie (RX)' },
      { key:'echographie',  label:'Échographie'       },
      { key:'scanner',      label:'Scanner (TDM/CT)'  },
      { key:'irm',          label:'IRM'               },
    ] as const;

    const handleFolderUpload = (e: React.FormEvent) => {
      e.preventDefault();
      if (!seriesFiles || seriesFiles.length === 0) return;
      if (!seriesDescription.trim()) { alert('La description du contenu est obligatoire.'); return; }
      setIsUploadingFolder(true);
      setUploadProgress(0);
      const fd = new FormData();
      Array.from(seriesFiles).forEach(f => fd.append('files', f));
      fd.append('imagingType', seriesType);
      fd.append('seriesLabel', seriesLabel || `${seriesType} — ${new Date().toLocaleDateString('fr-FR')}`);
      fd.append('notes', seriesNotes);
      fd.append('description', seriesDescription);
      uploadSeriesMutation.mutate(fd);
    };

    return (
      <div className="space-y-6">

        {/* ── Mode toggle ── */}
        <div className="flex rounded-2xl border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800/50 p-1 gap-1">
          <button type="button" onClick={() => setUploadMode('dicom')}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-xs font-semibold transition ${
              uploadMode === 'dicom'
                ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow'
                : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
            }`}>
            <FolderOpen className="w-3.5 h-3.5" />
            Dossier DICOM complet (CT / IRM / …)
          </button>
          <button type="button" onClick={() => setUploadMode('single')}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-xs font-semibold transition ${
              uploadMode === 'single'
                ? 'bg-white dark:bg-slate-700 text-primary-600 shadow'
                : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
            }`}>
            <Upload className="w-3.5 h-3.5" />
            Fichier unique (Radio, PDF, Image)
          </button>
        </div>

        {/* ── DICOM series upload panel ── */}
        {uploadMode === 'dicom' && (
          <div className="p-5 bg-blue-50 dark:bg-blue-900/10 rounded-2xl border border-blue-200 dark:border-blue-800/40 space-y-4">
            <div className="flex items-center gap-2">
              <FolderOpen className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              <h4 className="text-xs font-bold text-blue-600 dark:text-blue-400 uppercase tracking-widest">
                Upload dossier DICOM complet
              </h4>
            </div>
            <p className="text-[10px] text-gray-500 dark:text-gray-400 leading-relaxed">
              Sélectionnez le dossier entier de votre acquisition DICOM (jusqu'à 2000 fichiers .dcm).
              Le viewer les affichera sous forme de séquence ciné-loop image par image.
            </p>

            <form onSubmit={handleFolderUpload} className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className={lbl}>Type d'imagerie</label>
                  <select className={cls} value={seriesType} onChange={e => setSeriesType(e.target.value as any)}>
                    {TYPES.map(t => <option key={t.key} value={t.key}>{t.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className={lbl}>Étiquette de la série</label>
                  <input className={cls}
                    placeholder={`CT Thorax ${new Date().toLocaleDateString('fr-FR')}`}
                    value={seriesLabel} onChange={e => setSeriesLabel(e.target.value)} />
                </div>
              </div>

              {/* Drop zone */}
              <div className="border-2 border-dashed border-blue-200 dark:border-blue-700/50 hover:border-blue-400 dark:hover:border-blue-500 bg-white dark:bg-slate-800 rounded-xl p-6 text-center transition-colors">
                <input ref={folderInputRef} type="file"
                  // @ts-ignore
                  webkitdirectory="true" multiple accept=".dcm,.dicom,.jpg,.jpeg,.png,.pdf"
                  className="hidden" id="folder-upload"
                  onChange={e => { setSeriesFiles(e.target.files); if (multiInputRef.current) multiInputRef.current.value = ''; }}
                />
                <input ref={multiInputRef} type="file"
                  multiple accept=".dcm,.dicom,.jpg,.jpeg,.png,.pdf"
                  className="hidden" id="multi-upload"
                  onChange={e => { setSeriesFiles(e.target.files); if (folderInputRef.current) folderInputRef.current.value = ''; }}
                />

                {seriesFiles && seriesFiles.length > 0 ? (
                  <div>
                    <Film className="w-8 h-8 text-blue-500 mx-auto mb-2" />
                    <p className="text-gray-800 dark:text-gray-100 text-sm font-bold">{seriesFiles.length} fichier(s) sélectionné(s)</p>
                    <p className="text-gray-400 text-[10px] mt-1">
                      {Array.from(seriesFiles).slice(0, 3).map(f => f.name).join(', ')}
                      {seriesFiles.length > 3 ? ` ... +${seriesFiles.length - 3}` : ''}
                    </p>
                    <button type="button"
                      onClick={() => { setSeriesFiles(null); if(folderInputRef.current) folderInputRef.current.value=''; if(multiInputRef.current) multiInputRef.current.value=''; }}
                      className="mt-2 text-[10px] text-red-500 hover:text-red-600">
                      Vider la sélection
                    </button>
                  </div>
                ) : (
                  <div>
                    <FolderOpen className="w-8 h-8 text-gray-300 dark:text-slate-600 mx-auto mb-2" />
                    <p className="text-gray-400 text-xs">Choisissez une méthode d'upload</p>
                  </div>
                )}

                <div className="flex flex-col sm:flex-row gap-2 justify-center mt-4">
                  <label htmlFor="folder-upload"
                    className="cursor-pointer flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-xl transition">
                    <FolderOpen className="w-3.5 h-3.5" />
                    Sélectionner un dossier
                  </label>
                  <label htmlFor="multi-upload"
                    className="cursor-pointer flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-gray-700 dark:text-gray-200 text-xs font-semibold rounded-xl transition border border-gray-200 dark:border-slate-600">
                    <Upload className="w-3.5 h-3.5" />
                    Sélectionner plusieurs fichiers
                  </label>
                </div>
              </div>

              <div>
                <label className={lbl}>Notes (optionnel)</label>
                <input className={cls} placeholder="ex: CT thorax sans injection — 28/04/2026"
                  value={seriesNotes} onChange={e => setSeriesNotes(e.target.value)} />
              </div>

              <div>
                <label className={lbl + ' !text-red-600'}>
                  Description du contenu <span className="text-red-500">*</span>
                </label>
                <textarea rows={3} required
                  className={ta + ' border-red-300 dark:border-red-700 focus:ring-red-500'}
                  placeholder="Décrivez le contenu de cette série : région examinée, findings principaux, contexte clinique..."
                  value={seriesDescription} onChange={e => setSeriesDescription(e.target.value)} />
                <p className="text-[9px] text-gray-400 mt-0.5">Ce texte apparaîtra dans le dossier imprimé à la place des images.</p>
              </div>

              {isUploadingFolder && (
                <div className="space-y-1">
                  <div className="flex justify-between text-[10px] text-gray-500 dark:text-gray-400">
                    <span>Upload en cours...</span>
                    <span>{uploadProgress}%</span>
                  </div>
                  <div className="w-full bg-gray-200 dark:bg-slate-700 rounded-full h-2">
                    <div className="bg-blue-500 h-2 rounded-full transition-all duration-200" style={{ width: `${uploadProgress}%` }} />
                  </div>
                  <p className="text-[9px] text-gray-400">{seriesFiles ? `${seriesFiles.length} fichiers — veuillez patienter...` : ''}</p>
                </div>
              )}

              <button type="submit"
                disabled={!seriesFiles || seriesFiles.length === 0 || uploadSeriesMutation.isPending}
                className="btn-primary py-2 px-5 text-sm disabled:opacity-40 flex items-center gap-2">
                {uploadSeriesMutation.isPending
                  ? <><Loader2 className="w-4 h-4 animate-spin" /> Upload en cours ({uploadProgress}%)...</>
                  : <><Upload className="w-4 h-4" /> Uploader la série ({seriesFiles?.length || 0} fichiers)</>}
              </button>
            </form>
          </div>
        )}

        {/* ── Single file upload panel ── */}
        {uploadMode === 'single' && (
          <div className="p-5 bg-gray-50 dark:bg-slate-800/60 rounded-2xl border border-gray-200 dark:border-slate-700 space-y-4">
            <div className="flex items-center gap-2">
              <Upload className="w-4 h-4 text-primary-500" />
              <h4 className="text-xs font-bold text-primary-600 uppercase tracking-widest">
                Fichier unique (Radio simple, PDF, Image)
              </h4>
            </div>
            <form onSubmit={handleImagingUpload} className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className={lbl}>Type d'imagerie</label>
                  <select className={cls} value={imagingType} onChange={e => setImagingType(e.target.value as any)}>
                    {TYPES.map(t => <option key={t.key} value={t.key}>{t.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className={lbl}>Fichier (JPG, PNG, PDF, DCM)</label>
                  <input type="file" accept=".jpg,.jpeg,.png,.pdf,.dcm,.dicom"
                    onChange={e => setImagingFile(e.target.files?.[0] || null)}
                    className="w-full text-sm text-gray-500 file:mr-2 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:bg-primary-100 file:text-primary-700 file:text-xs hover:file:bg-primary-200 cursor-pointer" />
                </div>
              </div>
              <div>
                <label className={lbl}>Notes (optionnel)</label>
                <input className={cls} placeholder="ex: Radio thorax face" value={imagingNotes} onChange={e => setImagingNotes(e.target.value)} />
              </div>
              <div>
                <label className={lbl + ' !text-red-600'}>Description du contenu <span className="text-red-500">*</span></label>
                <textarea rows={3} required
                  className={ta + ' border-red-300 dark:border-red-700 focus:ring-red-500'}
                  placeholder="Décrivez le contenu : région examinée, résultats observés, contexte clinique..."
                  value={imagingDescription} onChange={e => setImagingDescription(e.target.value)} />
                <p className="text-[9px] text-gray-400 mt-0.5">Ce texte apparaîtra dans le dossier imprimé à la place de l'image.</p>
              </div>
              <button type="submit" disabled={!imagingFile || uploadImagingMutation.isPending}
                className="btn-primary py-2 px-4 text-sm disabled:opacity-50 flex items-center gap-2">
                {uploadImagingMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                Uploader
              </button>
            </form>
          </div>
        )}

        {/* ── Existing studies (new + legacy series) ── */}
        {studies.length > 0 && (
          <div className="space-y-3">
            <h4 className="text-xs font-bold text-gray-600 dark:text-gray-300 uppercase tracking-wider flex items-center gap-2">
              <Film className="w-3.5 h-3.5" /> Études d'imagerie enregistrées ({studies.length})
            </h4>
            {studies.map((s: any) => {
              // Support both new IImagingStudy (studyId, sliceCount, viewerType)
              // and legacy IDicomSeries (seriesId, frameCount)
              const id         = s.studyId || s.seriesId;
              const label      = s.studyLabel || s.seriesLabel;
              const count      = s.sliceCount ?? s.frameCount ?? 0;
              const modality   = s.modality || 'DCM';
              const vtype      = s.viewerType || 'dicom';
              const previewFile = (s.files || []).find((f: any) =>
                f.fileType?.startsWith('image/') || /\.(jpe?g|png)$/i.test(f.originalName || '')
              );
              return (
                <div key={id} className="flex items-center justify-between p-4 bg-gray-50 dark:bg-slate-800/60 rounded-xl border border-gray-200 dark:border-slate-700 group">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-gray-100 dark:bg-slate-700 border border-gray-200 dark:border-slate-600 rounded-lg flex items-center justify-center flex-shrink-0 overflow-hidden">
                      {previewFile
                        ? <img src={`${API_BASE}/${previewFile.filePath}`} alt="" className="w-full h-full object-cover" />
                        : <span className="text-[10px] font-bold text-blue-600 dark:text-blue-400">{modality}</span>
                      }
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-gray-800 dark:text-gray-100">{label}</p>
                      <p className="text-[10px] text-gray-500 dark:text-gray-400">
                        <span className="font-bold text-blue-500">{modality}</span>
                        {' · '}{count} coupe(s)
                        {' · '}<span className="uppercase">{vtype}</span>
                        {s.notes ? ` — ${s.notes}` : ''}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button type="button" onClick={() => setViewingSeries(s)}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg transition">
                      <Play className="w-3 h-3" /> Visualiser
                    </button>
                    <button type="button"
                      onClick={() => { if (window.confirm('Supprimer cette étude et tous ses fichiers ?')) deleteSeriesMutation.mutate(id); }}
                      className="p-2 text-red-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition opacity-0 group-hover:opacity-100">
                      {deleteSeriesMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* ── Existing single files ── */}
        {TYPES.map(({ key, label }) => {
          const files: any[] = (bm as any)[key] || [];
          if (!files.length) return null;
          return (
            <div key={key} className="p-4 rounded-2xl border bg-gray-50 dark:bg-slate-800/40 border-gray-200 dark:border-slate-700">
              <h5 className="text-xs font-bold text-gray-600 dark:text-gray-300 uppercase tracking-widest mb-3">{label} ({files.length})</h5>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                {files.map((f: any) => (
                  <div key={f.fileId} className="relative group rounded-xl overflow-hidden border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-sm">
                    {f.fileType?.includes('image') ? (
                      <a href={`${API_BASE}/${f.filePath}`} target="_blank" rel="noreferrer">
                        <img src={`${API_BASE}/${f.filePath}`} alt={f.originalName} className="w-full h-24 object-cover hover:opacity-90 transition" />
                      </a>
                    ) : (
                      <a href={`${API_BASE}/${f.filePath}`} target="_blank" rel="noreferrer"
                        className="flex flex-col items-center justify-center h-24 bg-gray-100 dark:bg-slate-700 hover:bg-gray-200 transition gap-1">
                        <FileText className="w-7 h-7 text-gray-400" />
                        <span className="text-[9px] text-gray-400 font-bold">{f.originalName?.split('.').pop()?.toUpperCase()}</span>
                      </a>
                    )}
                    <div className="p-2">
                      <p className="text-[10px] font-medium text-gray-600 dark:text-gray-300 truncate">{f.originalName}</p>
                      {f.notes && <p className="text-[9px] text-gray-400 truncate">{f.notes}</p>}
                    </div>
                    <button onClick={() => { if (window.confirm('Supprimer ?')) deleteImagingMutation.mutate({ type: key, fileId: f.fileId }); }}
                      className="absolute top-1 right-1 p-1 bg-red-500 text-white rounded-md opacity-0 group-hover:opacity-100 transition">
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  // ─── PROTOCOLE ────────────────────────────────────────────────────────────
  const renderProtocole = () => (
    <div className="space-y-5">
      <div className="text-center p-4 bg-gray-50 dark:bg-slate-800/60 rounded-2xl border border-gray-200 dark:border-slate-700">
        <p className="text-[10px] text-gray-500">المركز الاستشفائي الجامعي بوهران</p>
        <p className="text-sm font-bold text-gray-800 dark:text-gray-100">CENTRE HOSPITALO-UNIVERSITAIRE D'ORAN</p>
        <p className="text-xs text-gray-500 italic">Clinique Chirurgicale « A »</p>
        <p className="text-xs text-gray-500">Ex. PAVILLON « 14 »</p>
        <p className="text-xs font-semibold text-gray-700 dark:text-gray-200">SERVICE DU Pr. K. BELKHARROUBI</p>
        <div className="mt-2 inline-block px-5 py-1 border-2 border-gray-700 dark:border-gray-300 rounded">
          <span className="text-sm font-black tracking-widest text-gray-800 dark:text-gray-100 italic">Protocole Opératoire</span>
        </div>
      </div>
      <div className="p-4 bg-primary-50/50 dark:bg-primary-900/10 rounded-xl border border-primary-100 dark:border-primary-800/30">
        <div className="grid grid-cols-3 gap-3 text-sm">
          <div><span className="text-gray-400 text-xs block">Nom :</span><p className="font-semibold">{patientData.lastName}</p></div>
          <div><span className="text-gray-400 text-xs block">Prénom :</span><p className="font-semibold">{patientData.firstName}</p></div>
          <div><span className="text-gray-400 text-xs block">Âge :</span><p className="font-semibold text-gray-500">—</p></div>
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div><label className={lbl}>Diagnostic</label><input className={cls} value={protocole.diagnosticOperatoire||''} onChange={e=>setProtocole(p=>({...p,diagnosticOperatoire:e.target.value}))} placeholder="Diagnostic opératoire..." /></div>
        <div><label className={lbl}>Nom de l'opérateur</label><input className={cls} value={protocole.nomOperateur||''} onChange={e=>setProtocole(p=>({...p,nomOperateur:e.target.value}))} placeholder="Dr. ..." /></div>
        <div><label className={lbl}>Aide</label><input className={cls} value={protocole.aide||''} onChange={e=>setProtocole(p=>({...p,aide:e.target.value}))} placeholder="Dr. ..." /></div>
        <div><label className={lbl}>Anesthésistes</label><input className={cls} value={protocole.anesthesistes||''} onChange={e=>setProtocole(p=>({...p,anesthesistes:e.target.value}))} placeholder="Dr. ..." /></div>
      </div>
      <div>
        <label className={lbl}>Compte-rendu opératoire (texte libre)</label>
        <textarea rows={12} className={ta} value={protocole.contenuProtocole||''}
          onChange={e=>setProtocole(p=>({...p,contenuProtocole:e.target.value}))}
          placeholder="Décrivez ici le déroulement de l'opération, les gestes effectués, les constatations peropératoires, les suites immédiates..." />
      </div>
      <button onClick={handleSave} disabled={isPending} className="btn-primary py-2.5 px-6 text-sm w-full sm:w-auto">
        {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
        Enregistrer le protocole
      </button>
    </div>
  );

  // ─── SUIVI ────────────────────────────────────────────────────────────────
  const renderSuivi = () => {
    if (!isEdit) return (
      <div className="text-center py-12 bg-amber-50 dark:bg-amber-900/10 rounded-2xl border border-dashed border-amber-200 dark:border-amber-800">
        <Calendar className="w-10 h-10 text-amber-400 mx-auto mb-3" />
        <p className="text-sm font-medium text-amber-700">Sauvegardez d'abord l'hospitalisation</p>
        <button onClick={handleSave} disabled={isPending} className="btn-primary mt-4 py-2 px-5 text-sm">
          {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Créer l'hospitalisation
        </button>
      </div>
    );
    const followups = hospitalization?.dailyFollowups || [];
    return (
      <div className="space-y-5">
        <div className="p-4 bg-gray-50 dark:bg-slate-800/60 rounded-2xl border border-gray-200 dark:border-slate-700 space-y-3">
          <h4 className="text-xs font-bold text-gray-600 dark:text-gray-300 uppercase tracking-wider flex items-center gap-2">
            <Plus className="w-3.5 h-3.5" /> Ajouter un suivi journalier
          </h4>
          <div className="grid grid-cols-2 gap-3">
            <div><label className={lbl}>Date</label><input type="date" className={cls} value={newFollowup.date} onChange={e=>setNewFollowup(f=>({...f,date:e.target.value}))} /></div>
            <div><label className={lbl}>Évolution</label><input className={cls} placeholder="Stable, Amélioration..." value={newFollowup.evolution} onChange={e=>setNewFollowup(f=>({...f,evolution:e.target.value}))} /></div>
          </div>
          <div><label className={lbl}>Notes / Observations</label><textarea rows={3} className={ta} value={newFollowup.notes} onChange={e=>setNewFollowup(f=>({...f,notes:e.target.value}))} placeholder="Observations médicales du jour..." /></div>
          <button onClick={()=>{ if(!newFollowup.date||!newFollowup.notes) return; addFollowupMutation.mutate(newFollowup); }}
            disabled={!newFollowup.date||!newFollowup.notes||addFollowupMutation.isPending}
            className="btn-primary py-2 px-4 text-sm disabled:opacity-50">
            {addFollowupMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            Ajouter
          </button>
        </div>
        <div className="space-y-3 relative before:absolute before:left-3 before:top-2 before:bottom-2 before:w-0.5 before:bg-gray-200 dark:before:bg-slate-700">
          {followups.length===0 && <p className="text-center text-gray-400 text-sm py-6">Aucun suivi enregistré</p>}
          {[...followups].sort((a,b)=>new Date(b.date).getTime()-new Date(a.date).getTime()).map((f:any,idx)=>(
            <div key={f._id||idx} className="relative pl-8 group">
              <div className="absolute left-1.5 top-3 w-3 h-3 rounded-full bg-primary-500 border-2 border-white dark:border-slate-900" />
              <div className="card shadow-sm border border-gray-100 dark:border-slate-700 p-3">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-bold text-primary-600">
                    {new Date(f.date).toLocaleDateString('fr-FR',{day:'2-digit',month:'long',year:'numeric'})}
                  </span>
                  <div className="flex items-center gap-2">
                    {f.evolution && <span className="px-2 py-0.5 text-[10px] font-semibold bg-teal-100 text-teal-700 rounded-full">{f.evolution}</span>}
                    <button onClick={()=>f._id&&deleteFollowupMutation.mutate(f._id)} className="opacity-0 group-hover:opacity-100 p-1 text-red-400 hover:text-red-600 transition">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
                <p className="text-sm text-gray-700 dark:text-gray-300">{f.notes}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const stepContent = [renderPage1, renderPage2, renderPage3, renderPage4, renderPage5, renderProtocole, renderSuivi];

  return (
    <>
    {viewingSeries && (
      <MedicalViewer
        study={viewingSeries as any}
        hospitalizationId={hospitalization!._id}
        patientName={`${patientData.firstName} ${patientData.lastName}`}
        onClose={() => setViewingSeries(null)}
      />
    )}
    <div className="fixed inset-0 z-50 flex items-start justify-center p-4 sm:p-6 bg-black/60 backdrop-blur-sm overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl w-full max-w-4xl my-4 overflow-hidden flex flex-col" style={{maxHeight:'95vh'}}>

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-slate-800 bg-gradient-to-r from-primary-600 to-teal-600 text-white flex-shrink-0">
          <div>
            <h2 className="text-lg font-bold">{isEdit?'Modifier':'Nouveau'} Dossier d'Hospitalisation</h2>
            <p className="text-xs opacity-80">{patientData.firstName} {patientData.lastName} — {patientData.dossierNumber}</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-white/20 transition"><X className="w-5 h-5" /></button>
        </div>

        {/* Tabs */}
        <div className="flex overflow-x-auto border-b border-gray-100 dark:border-slate-800 bg-gray-50 dark:bg-slate-800/50 flex-shrink-0">
          {STEPS.map(s=>{
            const Icon = s.icon;
            return (
              <button key={s.id} onClick={()=>setStep(s.id)}
                className={`flex items-center gap-1.5 px-3 py-3 text-[11px] font-semibold whitespace-nowrap transition border-b-2 ${
                  step===s.id
                    ? 'border-primary-500 text-primary-600 dark:text-primary-400 bg-white dark:bg-slate-900'
                    : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
                }`}>
                <Icon className="w-3.5 h-3.5 flex-shrink-0" />
                <span className="hidden lg:inline">{s.label}</span>
                <span className="lg:hidden">{s.id}</span>
              </button>
            );
          })}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">{stepContent[step-1]()}</div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-gray-100 dark:border-slate-800 bg-gray-50 dark:bg-slate-800/50 flex-shrink-0">
          <button onClick={()=>setStep(s=>Math.max(1,s-1))} disabled={step===1} className="btn-secondary py-2 px-4 text-sm disabled:opacity-40">
            <ChevronLeft className="w-4 h-4" /> Précédent
          </button>
          <div className="flex items-center gap-2">
            {step <= 4 && (
              <button onClick={handleSave} disabled={isPending} className="btn-primary py-2 px-5 text-sm">
                {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                {isEdit ? 'Enregistrer' : 'Créer'}
              </button>
            )}
            {step < 7 && (
              <button onClick={()=>setStep(s=>Math.min(7,s+1))} className="btn-secondary py-2 px-4 text-sm">
                Suivant <ChevronRight className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
    </>
  );
};

export default HospitalizationForm;
