import { useState, useRef } from "react";

// ─── Types ──────────────────────────────────────────────────────────────────
interface Hospitalization {
  _id: string;
  dateEntree?: string;
  dateSortie?: string;
  diagnostic?: string;
  protocoleOperatoire?: {
    nomOperateur?: string;
    contenuProtocole?: string;
  };
  motifAdmission?: string;
}

interface Patient {
  _id?: string;
  nom?: string;
  prenom?: string;
  lastName?: string;   // fallback field name
  firstName?: string;  // fallback field name
}

interface RapportMedicalProps {
  hospitalization: Hospitalization;
  patient: Patient;
  onClose?: () => void;
}

// ─── Helpers ────────────────────────────────────────────────────────────────
const fmt = (dateStr?: string) => {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString("fr-DZ", { day: "2-digit", month: "2-digit", year: "numeric" });
};

// ─── Print CSS (injected via <style> into print iframe) ─────────────────────
const PRINT_CSS = `
  @page { size: A4; margin: 0; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Segoe UI', Arial, sans-serif; background: white; }

  .page {
    width: 210mm;
    min-height: 297mm;
    padding: 0;
    position: relative;
    background: white;
    display: flex;
  }

  /* ── Left sidebar ── */
  .sidebar {
    width: 52mm;
    min-height: 297mm;
    border-right: 1.5px solid #1a3660;
    padding: 6mm 4mm;
    display: flex;
    flex-direction: column;
    gap: 5mm;
    font-size: 6.5pt;
    color: #1a1a1a;
    line-height: 1.4;
  }
  .sidebar-logo {
    text-align: center;
    font-size: 7pt;
    font-weight: 700;
    color: #1a3660;
    border-bottom: 1px solid #1a3660;
    padding-bottom: 3mm;
    line-height: 1.5;
  }
  .sidebar-section-title {
    font-size: 6.5pt;
    font-weight: 700;
    color: #1a3660;
    text-transform: uppercase;
    letter-spacing: 0.3px;
    border-bottom: 0.5px solid #ccc;
    padding-bottom: 1mm;
    margin-bottom: 1mm;
  }
  .sidebar-person { margin-bottom: 2mm; }
  .sidebar-person .name { font-weight: 600; font-size: 6.5pt; }
  .sidebar-person .role { font-style: italic; color: #444; font-size: 6pt; }
  .sidebar-person .email { color: #1a3660; font-size: 5.5pt; word-break: break-all; }

  /* ── Main content ── */
  .main {
    flex: 1;
    padding: 8mm 10mm 10mm 8mm;
    display: flex;
    flex-direction: column;
  }

  .header-block {
    text-align: center;
    margin-bottom: 6mm;
  }
  .header-block .chu {
    font-size: 10pt;
    font-weight: 700;
    color: #1a3660;
    line-height: 1.5;
  }
  .header-block .clinique {
    font-size: 8pt;
    font-weight: 600;
    color: #1a3660;
  }
  .header-block .chef {
    font-size: 7.5pt;
    color: #333;
    margin-top: 1mm;
  }

  .rapport-title {
    text-align: center;
    font-size: 16pt;
    font-weight: 700;
    color: #1a3660;
    letter-spacing: 2px;
    border-top: 2px solid #1a3660;
    border-bottom: 2px solid #1a3660;
    padding: 3mm 0;
    margin: 4mm 0 8mm 0;
    text-transform: uppercase;
  }

  .field-row {
    display: flex;
    align-items: baseline;
    margin-bottom: 5mm;
    border-bottom: 0.75px solid #aaa;
    padding-bottom: 1mm;
  }
  .field-label {
    font-size: 10pt;
    font-weight: 700;
    color: #1a3660;
    min-width: 38mm;
    white-space: nowrap;
  }
  .field-value {
    font-size: 10pt;
    color: #111;
    flex: 1;
    padding-left: 3mm;
  }

  .diagnostic-block {
    margin-top: 2mm;
  }
  .diagnostic-block .field-label {
    display: block;
    margin-bottom: 2mm;
  }
  .diagnostic-value {
    font-size: 10pt;
    color: #111;
    border: 0.75px solid #aaa;
    min-height: 25mm;
    padding: 2mm;
    width: 100%;
  }

  .city-date {
    margin-top: auto;
    padding-top: 10mm;
    text-align: right;
    font-size: 9pt;
    color: #333;
  }
  .signature-block {
    margin-top: 15mm;
    text-align: center;
    font-size: 9pt;
    font-weight: 700;
    color: #1a3660;
    line-height: 1.6;
  }
`;

// ─── Staff data (from the document) ─────────────────────────────────────────
const STAFF = {
  chef: { name: "Pr. K. BELKHARROUBI", role: "Médecin Chef de Service", grade: "CCA", email: "bourabainekhadidj@yahoo.fr" },
  praticiens: [
    { name: "Pr. A.K. Benetti Houari", role: "Professeur Agrégé, CCA", email: "bensetti.myna@gmail.com" },
    { name: "Dr. H. Remouche", role: "Maître assistant", email: "remouche.hafid@hotmail.com" },
    { name: "Dr. Ait Yahia", role: "Maître assistante", email: "aait3288@gmail.com" },
    { name: "Dr. Nekhoul", role: "Maître assistante", email: "ines.nek92@gmail.com" },
  ],
  specialistes: [
    { name: "Dr. M. Bachir Bouiadjra", role: "Praticien spécialiste", email: "mehdi.r@hotmail.fr" },
    { name: "Dr. Addoun omar", role: "Praticien spécialiste", email: "omaramineaddoun@gmail.com" },
  ],
  secretariat: {
    assistantes: ["Belmiloud Houria"],
    attaches: ["Khouidmi Yamina", "Iftene Amel"],
    secretaire: "Azzouz Aïcha",
    coordinateur: "H. Flitti",
    surveillante: "F. Bensaid",
  },
};

// ─── Component ───────────────────────────────────────────────────────────────
export default function RapportMedical({ hospitalization, patient, onClose }: RapportMedicalProps) {
  const nom = patient.nom ?? patient.lastName ?? "";
  const prenom = patient.prenom ?? patient.firstName ?? "";

  const [fields, setFields] = useState({
    nom: nom,
    prenom: prenom,
    diagnostic: hospitalization.diagnostic ?? hospitalization.motifAdmission ?? "",
    dateEntree: fmt(hospitalization.dateEntree),
    dateOperation: hospitalization.protocoleOperatoire?.nomOperateur
      ? fmt(hospitalization.dateEntree) // fallback — can be edited manually
      : "",
    dateSortie: fmt(hospitalization.dateSortie),
    additionalNotes: "",
  });

  const printRef = useRef<HTMLDivElement>(null);

  const handleChange = (key: keyof typeof fields) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFields((f) => ({ ...f, [key]: e.target.value }));
  };

  const handlePrint = () => {
    const html = `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8"/>
  <style>${PRINT_CSS}</style>
</head>
<body>
<div class="page">

  <!-- ── Sidebar ── -->
  <div class="sidebar">
    <div class="sidebar-logo">
      Centre<br/>hospitalo-universitaire<br/>d'Oran
    </div>

    <div>
      <div class="sidebar-section-title">Service</div>
      <div class="sidebar-person">
        <div class="name">${STAFF.chef.name}</div>
        <div class="role">${STAFF.chef.role}</div>
        <div class="email">${STAFF.chef.email}</div>
      </div>
    </div>

    <div>
      <div class="sidebar-section-title">Hospitalo-universitaire</div>
      ${STAFF.praticiens.map((p) => `
        <div class="sidebar-person">
          <div class="name">${p.name}</div>
          <div class="role">${p.role}</div>
          <div class="email">${p.email}</div>
        </div>
      `).join("")}
    </div>

    <div>
      <div class="sidebar-section-title">Médecin spécialiste</div>
      ${STAFF.specialistes.map((p) => `
        <div class="sidebar-person">
          <div class="name">${p.name}</div>
          <div class="role">${p.role}</div>
          <div class="email">${p.email}</div>
        </div>
      `).join("")}
    </div>

    <div>
      <div class="sidebar-section-title">Secrétariat</div>
      <div class="sidebar-person">
        <div class="role">Assistantes Médicales :</div>
        ${STAFF.secretariat.assistantes.map((a) => `<div class="name">${a}</div>`).join("")}
      </div>
      <div class="sidebar-person">
        <div class="role">Attaché d'administration :</div>
        ${STAFF.secretariat.attaches.map((a) => `<div class="name">${a}</div>`).join("")}
      </div>
      <div class="sidebar-person">
        <div class="role">Secrétaire :</div>
        <div class="name">${STAFF.secretariat.secretaire}</div>
      </div>
      <div class="sidebar-person">
        <div class="role">Coordinateur du service :</div>
        <div class="name">${STAFF.secretariat.coordinateur}</div>
      </div>
      <div class="sidebar-person">
        <div class="role">Surveillante médicale :</div>
        <div class="name">${STAFF.secretariat.surveillante}</div>
      </div>
    </div>
  </div>

  <!-- ── Main ── -->
  <div class="main">
    <div class="header-block">
      <div class="chu">Centre hospitalo-universitaire d'Oran</div>
      <div class="clinique">Clinique chirurgicale et cancérologique « A » ex pav 14</div>
      <div class="chef">Pr. K. Belkharroubi — Médecin-chef de service</div>
    </div>

    <div class="rapport-title">Rapport Médical</div>

    <div class="field-row">
      <span class="field-label">Nom :</span>
      <span class="field-value">${fields.nom}</span>
    </div>
    <div class="field-row">
      <span class="field-label">Prénom :</span>
      <span class="field-value">${fields.prenom}</span>
    </div>
    <div class="field-row">
      <span class="field-label">Date d'entrée :</span>
      <span class="field-value">${fields.dateEntree}</span>
    </div>
    <div class="field-row">
      <span class="field-label">Date d'opération :</span>
      <span class="field-value">${fields.dateOperation}</span>
    </div>
    <div class="field-row">
      <span class="field-label">Date de sortie :</span>
      <span class="field-value">${fields.dateSortie}</span>
    </div>

    <div class="diagnostic-block">
      <span class="field-label">Diagnostic :</span>
      <div class="diagnostic-value">${fields.diagnostic.replace(/\n/g, "<br/>")}</div>
    </div>

    ${fields.additionalNotes ? `
    <div class="diagnostic-block" style="margin-top:5mm;">
      <span class="field-label">Notes :</span>
      <div class="diagnostic-value">${fields.additionalNotes.replace(/\n/g, "<br/>")}</div>
    </div>` : ""}

    <div class="city-date">
      Oran, le ${new Date().toLocaleDateString("fr-DZ", { day: "2-digit", month: "long", year: "numeric" })}
    </div>

    <div class="signature-block">
      Pr. K. BELKHARROUBI<br/>
      Médecin Chef de Service<br/>
      CCA
    </div>
  </div>

</div>
</body>
</html>`;

    const w = window.open("", "_blank", "width=900,height=1100");
    if (!w) { alert("Veuillez autoriser les popups pour imprimer."); return; }
    w.document.write(html);
    w.document.close();
    w.focus();
    setTimeout(() => { w.print(); }, 400);
  };

  // ─── Editor UI ──────────────────────────────────────────────────────────────
  return (
    <div className="border-t-2 border-blue-800 mt-8 pt-6">
      {/* Section header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-1 h-8 bg-blue-800 rounded-full" />
          <div>
            <h2 className="text-lg font-bold text-blue-900 tracking-wide uppercase">
              Rapport Médical
            </h2>
            <p className="text-xs text-gray-500">
              CHU Oran — Clinique chirurgicale et cancérologique « A »
            </p>
          </div>
        </div>
        <button
          onClick={handlePrint}
          className="flex items-center gap-2 bg-blue-800 hover:bg-blue-900 text-white text-sm font-semibold px-5 py-2.5 rounded-lg shadow-md transition-all duration-150 active:scale-95"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
          </svg>
          Imprimer le rapport
        </button>
      </div>

      {/* Form grid */}
      <div className="bg-gray-50 border border-gray-200 rounded-xl p-6 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Nom */}
          <div>
            <label className="block text-xs font-semibold text-blue-900 uppercase tracking-wider mb-1">
              Nom
            </label>
            <input
              type="text"
              value={fields.nom}
              onChange={handleChange("nom")}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600 bg-white"
              placeholder="Nom du patient"
            />
          </div>

          {/* Prénom */}
          <div>
            <label className="block text-xs font-semibold text-blue-900 uppercase tracking-wider mb-1">
              Prénom
            </label>
            <input
              type="text"
              value={fields.prenom}
              onChange={handleChange("prenom")}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600 bg-white"
              placeholder="Prénom du patient"
            />
          </div>

          {/* Date d'entrée */}
          <div>
            <label className="block text-xs font-semibold text-blue-900 uppercase tracking-wider mb-1">
              Date d'entrée
            </label>
            <input
              type="text"
              value={fields.dateEntree}
              onChange={handleChange("dateEntree")}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600 bg-white"
              placeholder="jj/mm/aaaa"
            />
          </div>

          {/* Date d'opération */}
          <div>
            <label className="block text-xs font-semibold text-blue-900 uppercase tracking-wider mb-1">
              Date d'opération
            </label>
            <input
              type="text"
              value={fields.dateOperation}
              onChange={handleChange("dateOperation")}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600 bg-white"
              placeholder="jj/mm/aaaa"
            />
          </div>

          {/* Date de sortie */}
          <div className="md:col-span-2">
            <label className="block text-xs font-semibold text-blue-900 uppercase tracking-wider mb-1">
              Date de sortie
            </label>
            <input
              type="text"
              value={fields.dateSortie}
              onChange={handleChange("dateSortie")}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600 bg-white"
              placeholder="jj/mm/aaaa"
            />
          </div>
        </div>

        {/* Diagnostic */}
        <div>
          <label className="block text-xs font-semibold text-blue-900 uppercase tracking-wider mb-1">
            Diagnostic
          </label>
          <textarea
            value={fields.diagnostic}
            onChange={handleChange("diagnostic")}
            rows={4}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600 bg-white resize-y"
            placeholder="Diagnostic médical..."
          />
        </div>

        {/* Notes supplémentaires */}
        <div>
          <label className="block text-xs font-semibold text-blue-900 uppercase tracking-wider mb-1">
            Notes supplémentaires <span className="text-gray-400 normal-case font-normal">(optionnel)</span>
          </label>
          <textarea
            value={fields.additionalNotes}
            onChange={handleChange("additionalNotes")}
            rows={3}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600 bg-white resize-y"
            placeholder="Informations complémentaires, recommandations..."
          />
        </div>

        {/* Preview hint */}
        <div className="flex items-center gap-2 text-xs text-gray-400 pt-1">
          <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          Les champs sont pré-remplis depuis le dossier médical. Modifiez si nécessaire avant d'imprimer.
        </div>
      </div>
    </div>
  );
}