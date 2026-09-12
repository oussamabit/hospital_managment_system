import React, { useState } from 'react';
import { X, Plus, Trash2, Printer, Loader2, ClipboardList } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Medication, CreateOrdonnanceDto } from '../types';

interface PrescriptionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: CreateOrdonnanceDto) => void;
  isSubmitting: boolean;
  patientId: string;
  consultationId: string;
  patientName: string;
  initialMedications?: Medication[];
  initialNotes?: string;
  isEdit?: boolean;
}

const PrescriptionModal: React.FC<PrescriptionModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  isSubmitting,
  patientId,
  consultationId,
  patientName,
  initialMedications = [],
  initialNotes = '',
  isEdit = false
}) => {
  const { t } = useTranslation();
  const [medications, setMedications] = useState<Medication[]>(
    initialMedications.length > 0 ? initialMedications : [{ name: '', dosage: '', duration: '', instructions: '' }]
  );
  const [notes, setNotes] = useState(initialNotes);

  // Update states when initial values change
  React.useEffect(() => {
    if (initialMedications.length > 0) setMedications(initialMedications);
    if (initialNotes) setNotes(initialNotes);
  }, [initialMedications, initialNotes]);

  if (!isOpen) return null;

  const addMedication = () => {
    setMedications([...medications, { name: '', dosage: '', duration: '', instructions: '' }]);
  };

  const removeMedication = (index: number) => {
    if (medications.length === 1) {
      setMedications([{ name: '', dosage: '', duration: '', instructions: '' }]);
      return;
    }
    const newMeds = [...medications];
    newMeds.splice(index, 1);
    setMedications(newMeds);
  };

  const updateMedication = (index: number, field: keyof Medication, value: string) => {
    const newMeds = [...medications];
    newMeds[index] = { ...newMeds[index], [field]: value };
    setMedications(newMeds);
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Filter out empty medications
    const filteredMeds = medications.filter(m => m.name.trim() !== '');
    if (filteredMeds.length === 0) {
      alert(t('ordonnance.at_least_one_medication', { defaultValue: 'Au moins un médicament est requis' }));
      return;
    }

    onSubmit({
      consultation: consultationId,
      patient: patientId,
      medications: filteredMeds,
      notes,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-100 dark:border-slate-700 flex items-center justify-between bg-medical-card dark:bg-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-primary-100 dark:bg-primary-900/30 text-primary-600 rounded-xl flex items-center justify-center">
              <ClipboardList className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                {isEdit 
                  ? t('ordonnance.edit_title', { defaultValue: 'Modifier l\'ordonnance' })
                  : t('ordonnance.new_title', { defaultValue: 'Nouvelle Ordonnance' })
                }
              </h3>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {t('ordonnance.for_patient', { defaultValue: 'Pour' })}: <span className="font-bold">{patientName}</span>
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-full transition-colors">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleFormSubmit} className="flex-1 overflow-y-auto p-6 space-y-6">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                {t('ordonnance.medications', { defaultValue: 'Médicaments' })}
              </h4>
              <button
                type="button"
                onClick={addMedication}
                className="btn-secondary text-xs py-1.5 px-3 flex items-center gap-1.5"
              >
                <Plus className="w-3.5 h-3.5" /> {t('common.add', { defaultValue: 'Ajouter' })}
              </button>
            </div>

            <div className="space-y-4 border-l-2 border-primary-100 dark:border-slate-700 ml-2 pl-4">
              {medications.map((med, index) => (
                <div key={index} className="relative bg-gray-50 dark:bg-slate-900/50 p-4 rounded-2xl border border-gray-100 dark:border-slate-700 group transition-all hover:border-primary-200 dark:hover:border-primary-900/50">
                  <button
                    type="button"
                    onClick={() => removeMedication(index)}
                    className="absolute -top-2 -right-2 p-1.5 bg-white dark:bg-slate-800 border border-gray-100 dark:border-slate-700 rounded-full text-red-500 shadow-sm opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="md:col-span-2">
                      <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-1">
                        {t('ordonnance.medication_name', { defaultValue: 'Nom du médicament' })}
                      </label>
                      <input
                        type="text"
                        className="input-field py-2 text-sm"
                        placeholder="Ex: Paracétamol 500mg"
                        value={med.name}
                        onChange={(e) => updateMedication(index, 'name', e.target.value)}
                        required
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-1">
                        {t('ordonnance.dosage', { defaultValue: 'Posologie / Dosage' })}
                      </label>
                      <input
                        type="text"
                        className="input-field py-2 text-sm"
                        placeholder="Ex: 1 comprimé 3 fois par jour"
                        value={med.dosage}
                        onChange={(e) => updateMedication(index, 'dosage', e.target.value)}
                        required
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-1">
                        {t('ordonnance.duration', { defaultValue: 'Durée' })}
                      </label>
                      <input
                        type="text"
                        className="input-field py-2 text-sm"
                        placeholder="Ex: 5 jours"
                        value={med.duration}
                        onChange={(e) => updateMedication(index, 'duration', e.target.value)}
                        required
                      />
                    </div>
                    <div className="md:col-span-2">
                      <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-1">
                        {t('ordonnance.instructions', { defaultValue: 'Instructions (Optionnel)' })}
                      </label>
                      <input
                        type="text"
                        className="input-field py-2 text-sm"
                        placeholder="Ex: Avant les repas"
                        value={med.instructions}
                        onChange={(e) => updateMedication(index, 'instructions', e.target.value)}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-2 pt-2">
            <h4 className="text-sm font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
              {t('common.notes', { defaultValue: 'Notes additionnelles' })}
            </h4>
            <textarea
              className="input-field min-h-[100px] py-3 text-sm"
              placeholder={t('ordonnance.notes_placeholder', { defaultValue: 'Indications particulières, repos, régime...' })}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
        </form>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-100 dark:border-slate-700 flex items-center justify-end gap-3 bg-gray-50/50 dark:bg-slate-900/30">
          <button
            type="button"
            onClick={onClose}
            className="btn-secondary px-6"
            disabled={isSubmitting}
          >
            {t('common.cancel')}
          </button>
          <button
            onClick={handleFormSubmit}
            className="btn-primary px-8 flex items-center gap-2"
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              isEdit ? <Save className="w-4 h-4" /> : <ClipboardList className="w-4 h-4" />
            )}
            {isEdit 
              ? t('common.save', { defaultValue: 'Enregistrer' })
              : t('ordonnance.create_button', { defaultValue: 'Créer l\'ordonnance' })
            }
          </button>
        </div>
      </div>
    </div>
  );
};

export default PrescriptionModal;
