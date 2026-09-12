import React, { useEffect, useState } from 'react';
import { ClipboardCheck, FlaskConical, Loader2, Save, Trash2, X } from 'lucide-react';
import { CreateAnalyseRequestDto } from '../types';

interface AnalysisRequestModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: CreateAnalyseRequestDto) => void;
  isSubmitting: boolean;
  patientId: string;
  consultationId: string;
  patientName: string;
  initialSelectedTests?: string[];
  initialMotifDemande?: string;
  initialOtherTests?: string;
  isEdit?: boolean;
}

const TEST_GROUPS = [
  {
    title: 'Hemobiologie',
    tests: ['FNS', 'Frottis Peripherique', 'Ponction de moelle', 'Groupage Sanguin'],
  },
  {
    title: 'Hemostase',
    tests: ['TP', 'TCK', 'Facteur V', 'Kaliemie', 'Magnesemie'],
  },
  {
    title: 'Serologie',
    tests: ['HIV', 'Hydatidose', 'Hepatite'],
  },
  {
    title: 'Biochimie',
    tests: ['Uree Sanguine', 'Creatinine Sanguine', 'Glycemie', 'Hg Glyquee', 'Calcemie', 'Phosphoremie', 'Natremie', 'Chloremie'],
  },
];

const AnalysisRequestModal: React.FC<AnalysisRequestModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  isSubmitting,
  patientId,
  consultationId,
  patientName,
  initialSelectedTests = [],
  initialMotifDemande = '',
  initialOtherTests = '',
  isEdit = false,
}) => {
  const [selectedTests, setSelectedTests] = useState<string[]>(initialSelectedTests);
  const [motifDemande, setMotifDemande] = useState(initialMotifDemande);
  const [otherTests, setOtherTests] = useState(initialOtherTests);

  useEffect(() => {
    setSelectedTests(initialSelectedTests);
    setMotifDemande(initialMotifDemande || '');
    setOtherTests(initialOtherTests || '');
  }, [initialSelectedTests, initialMotifDemande, initialOtherTests]);

  if (!isOpen) return null;

  const toggleTest = (test: string) => {
    setSelectedTests((current) => (
      current.includes(test) ? current.filter((item) => item !== test) : [...current, test]
    ));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedTests.length === 0 && !otherTests.trim()) {
      alert('Selectionnez au moins une analyse');
      return;
    }

    onSubmit({
      consultation: consultationId,
      patient: patientId,
      motifDemande,
      selectedTests,
      otherTests,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-2xl w-full max-w-4xl max-h-[92vh] overflow-hidden flex flex-col">
        <div className="px-6 py-4 border-b border-gray-100 dark:border-slate-700 flex items-center justify-between bg-medical-card dark:bg-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-teal-100 dark:bg-teal-900/30 text-teal-600 rounded-xl flex items-center justify-center">
              <FlaskConical className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                {isEdit ? 'Modifier la demande d\'analyse' : 'Nouvelle demande d\'analyse'}
              </h3>
              <p className="text-xs text-gray-500 dark:text-gray-400">Pour: <span className="font-bold">{patientName}</span></p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-full transition-colors">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-6">
          <div className="rounded-2xl border border-teal-100 bg-teal-50/70 px-4 py-3">
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-teal-700">Service</p>
            <p className="mt-1 text-sm font-semibold text-teal-900">Chirurgie Generale et Cancerogene</p>
          </div>

          <div>
            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-1">
              Motif de la demande
            </label>
            <input
              type="text"
              className="input-field py-2 text-sm"
              value={motifDemande}
              onChange={(e) => setMotifDemande(e.target.value)}
              placeholder="Ex: bilan pre-operatoire, controle post-op..."
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {TEST_GROUPS.map((group) => (
              <div key={group.title} className="rounded-2xl border border-gray-100 dark:border-slate-700 p-4 bg-gray-50/60 dark:bg-slate-900/30">
                <h4 className="text-sm font-bold text-gray-800 dark:text-white uppercase tracking-wider mb-3">{group.title}</h4>
                <div className="space-y-2">
                  {group.tests.map((test) => (
                    <label key={test} className="flex items-center gap-3 text-sm text-gray-700 dark:text-slate-200 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={selectedTests.includes(test)}
                        onChange={() => toggleTest(test)}
                      />
                      <span>{test}</span>
                    </label>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <div>
            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-1">
              Autres analyses
            </label>
            <textarea
              className="input-field min-h-[90px] py-3 text-sm"
              value={otherTests}
              onChange={(e) => setOtherTests(e.target.value)}
              placeholder="Ajouter une autre analyse si besoin"
            />
          </div>
        </form>

        <div className="px-6 py-4 border-t border-gray-100 dark:border-slate-700 flex items-center justify-end gap-3 bg-gray-50/50 dark:bg-slate-900/30">
          <button type="button" onClick={onClose} className="btn-secondary px-6" disabled={isSubmitting}>
            Annuler
          </button>
          <button onClick={handleSubmit} className="btn-primary px-8 flex items-center gap-2" disabled={isSubmitting}>
            {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : isEdit ? <Save className="w-4 h-4" /> : <ClipboardCheck className="w-4 h-4" />}
            {isEdit ? 'Enregistrer' : 'Creer la demande'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default AnalysisRequestModal;
