import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { differenceInYears, format } from 'date-fns';
import { ChevronLeft, FileText, Loader2, Printer } from 'lucide-react';
import { analyseRequestApi } from '../services/api';
import { AnalyseRequest, Patient, User } from '../types';

const TEST_GROUPS = [
  { title: '1- HEMOBIOLOGIE', tests: ['FNS', 'Frottis Peripherique', 'Ponction de moelle', 'Groupage Sanguin'] },
  { title: '2- HEMOSTASE', tests: ['TP', 'TCK', 'Facteur V', 'Kaliemie', 'Magnesemie'] },
  { title: '3- SEROLOGIE', tests: ['HIV', 'Hydatidose', 'Hepatite'] },
  { title: '4- BIOCHIMIE', tests: ['Uree Sanguine', 'Creatinine Sanguine', 'Glycemie', 'Hg Glyquee', 'Calcemie', 'Phosphoremie', 'Natremie', 'Chloremie'] },
];

const AnalysisRequestPrint: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const { data: analyseRequest, isLoading, error } = useQuery({
    queryKey: ['analyse-request', id],
    queryFn: () => analyseRequestApi.getById(id!).then((r) => r.data.analyseRequest as AnalyseRequest),
    enabled: !!id,
  });

  if (isLoading) {
    return <div className="flex min-h-screen items-center justify-center"><Loader2 className="w-10 h-10 animate-spin text-primary-500" /></div>;
  }

  if (error || !analyseRequest) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 text-center p-6">
        <FileText className="w-10 h-10 text-red-500" />
        <p className="text-lg font-semibold">Demande d'analyse introuvable</p>
        <button onClick={() => navigate(-1)} className="btn-primary">Retour</button>
      </div>
    );
  }

  const patient = analyseRequest.patient as Patient;
  const medecin = analyseRequest.medecin as User;
  const age = patient.birthDate ? differenceInYears(new Date(), new Date(patient.birthDate)) : '';
  const isChecked = (test: string) => analyseRequest.selectedTests.includes(test);

  return (
    <div className="min-h-screen bg-slate-100 p-4 sm:p-8">
      <div className="max-w-4xl mx-auto mb-8 flex items-center justify-between print:hidden">
        <button onClick={() => navigate(-1)} className="btn-ghost flex items-center gap-2">
          <ChevronLeft className="w-4 h-4" /> Retour
        </button>
        <button onClick={() => window.print()} className="btn-primary flex items-center gap-2 shadow-lg">
          <Printer className="w-4 h-4" /> Imprimer
        </button>
      </div>

      <div className="mx-auto w-full max-w-[794px] bg-white shadow-2xl px-10 py-10 print:shadow-none">
        <div className="text-center">
          <p className="text-xl font-semibold">Centre Hospitalo Universitaire d'Oran</p>
          <p className="text-2xl font-bold mt-2">Clinique Chirurgicales "A"</p>
          <p className="text-xl font-semibold">Pavillon "14"</p>
        </div>

        <div className="mt-8 space-y-4 text-[15px]">
          <div className="flex gap-2 items-end">
            <span className="font-semibold">Nom et Prenom :</span>
            <span className="flex-1 border-b border-dotted border-slate-400">{patient.firstName} {patient.lastName}</span>
            <span className="font-semibold">AGE</span>
            <span className="w-24 border-b border-dotted border-slate-400">{age}</span>
          </div>
          <div className="flex gap-2 items-end">
            <span className="font-semibold">Motif de la demande :</span>
            <span className="flex-1 border-b border-dotted border-slate-400">{analyseRequest.motifDemande || ''}</span>
          </div>
        </div>

        <div className="mt-6 flex justify-center">
          <div className="rounded-xl border border-slate-500 px-8 py-2 text-lg font-bold">DEMANDE D'EXAMEN</div>
        </div>

        <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-8 text-[15px]">
          {TEST_GROUPS.map((group) => (
            <div key={group.title}>
              <h3 className="font-bold mb-3">{group.title}</h3>
              <div className="space-y-2">
                {group.tests.map((test) => (
                  <div key={test} className="flex items-center gap-3">
                    <span className={`inline-flex h-5 w-5 items-center justify-center rounded-sm border ${isChecked(test) ? 'bg-slate-800 text-white border-slate-800' : 'border-slate-500'}`}>
                      {isChecked(test) ? 'X' : ''}
                    </span>
                    <span>{test}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-8 text-[15px]">
          <p className="font-semibold">Autre :</p>
          <div className="mt-2 min-h-[70px] rounded-xl border border-dotted border-slate-400 p-3 whitespace-pre-wrap">
            {analyseRequest.otherTests || ''}
          </div>
        </div>

        <div className="mt-12 flex justify-between items-end text-sm">
          <div>
            <p><span className="font-semibold">Service :</span> {analyseRequest.serviceName}</p>
            <p><span className="font-semibold">Medecin :</span> Dr. {medecin.firstName} {medecin.lastName}</p>
          </div>
          <div className="text-center">
            <div className="h-20 w-48 border-b border-dotted border-slate-400" />
            <p className="mt-2 font-semibold">Cachet de Service</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AnalysisRequestPrint;
