import { useState, useRef, useEffect } from 'react';
import { Settings, Upload, Globe, Building2, Phone, Mail, MapPin, Save, RefreshCw, Loader2, Trash2 } from 'lucide-react';
import api from '../../../services/api';
import { useAuth } from '../../../context/AuthContext';

// GET/PATCH /super/institution. El logo se muestra en los paneles de todos los
// usuarios de la institución (components/InstitutionLogo.tsx). Se retiraron
// zona horaria, idioma y color: se guardaban pero ninguna pantalla los usaba.

const LOGO_MAX_BYTES = 2 * 1024 * 1024;
const LOGO_TYPES = ['image/png', 'image/jpeg', 'image/webp'];

const normalizeInstitutionData = (data: any) => ({
  name: data?.name ?? '',
  dane: data?.dane_code ?? '',
  email: data?.email ?? '',
  phone: data?.phone ?? '',
  address: data?.address ?? '',
  website: data?.website ?? '',
  logoUrl: data?.logo_url ?? '',
});

type Form = ReturnType<typeof normalizeInstitutionData>;

export default function ConfiguracionTab() {
  const { updateUser } = useAuth();
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [logoError, setLogoError] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const logoInputRef = useRef<HTMLInputElement>(null);
  const [form, setForm] = useState<Form>(normalizeInstitutionData(null));
  const [origForm, setOrigForm] = useState<Form>(normalizeInstitutionData(null));

  const hydrateInstitution = (data: any) => {
    const next = normalizeInstitutionData(data);
    setForm(next);
    setOrigForm(next);
  };

  useEffect(() => {
    api.get('/super/institution')
      .then(r => hydrateInstitution(r.data))
      .catch(() => setLoadError('No fue posible cargar los datos de la institución.'))
      .finally(() => setLoading(false));
  }, []);

  const handleFieldChange = (field: keyof Form, value: string) => {
    setForm(prev => ({ ...prev, [field]: value }));
  };

  const handleLogoSelection = (file: File | null | undefined) => {
    setLogoError('');
    if (!file) return;
    if (!LOGO_TYPES.includes(file.type)) {
      setLogoError('El logo debe ser una imagen PNG, JPG o WebP.');
      return;
    }
    if (file.size > LOGO_MAX_BYTES) {
      setLogoError('El archivo supera el límite de 2 MB.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setForm(prev => ({ ...prev, logoUrl: String(reader.result ?? '') }));
    reader.onerror = () => setLogoError('No se pudo leer el archivo.');
    reader.readAsDataURL(file);
    if (logoInputRef.current) logoInputRef.current.value = '';
  };

  const dirty = JSON.stringify(form) !== JSON.stringify(origForm);

  const handleSave = async () => {
    setSaveError('');
    setSaving(true);
    try {
      const payload = {
        name: form.name,
        dane_code: form.dane,
        email: form.email,
        phone: form.phone,
        address: form.address,
        website: form.website,
        // Cadena vacía = quitar el logo.
        logo_url: form.logoUrl,
      };
      const response = await api.patch('/super/institution', payload);
      const savedData = response.data ?? {};
      hydrateInstitution(savedData);
      window.dispatchEvent(new CustomEvent('institution-config-updated', { detail: savedData }));
      // El nombre de la institución también se muestra en los encabezados.
      if (savedData.name) updateUser({ institution_name: savedData.name });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err: any) {
      const detail = err?.response?.data?.detail;
      setSaveError(typeof detail === 'string' ? detail : 'No se pudo guardar. Intenta de nuevo.');
    } finally {
      setSaving(false);
    }
  };

  const Field = ({ label, icon: Icon, children }: { label: string; icon: any; children: React.ReactNode }) => (
    <div>
      <label className="flex items-center gap-1.5 text-xs font-semibold text-[#787774] mb-1.5 uppercase tracking-wide">
        <Icon className="w-3 h-3" /> {label}
      </label>
      {children}
    </div>
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-[#787774]">
        <Loader2 className="w-5 h-5 animate-spin mr-2" /> Cargando datos institucionales…
      </div>
    );
  }

  if (loadError) {
    return <p className="text-sm text-[#E03E3E] bg-[#FDEEEE] border border-[#F5C7C7] rounded-md px-4 py-3">{loadError}</p>;
  }

  return (
    <div className="space-y-8 max-w-3xl">

      {/* Identidad institucional */}
      <section className="bg-white border border-[#E9E9E7] rounded-lg p-6">
        <h3 className="font-semibold text-[#191919] mb-4 flex items-center gap-2">
          <Building2 className="w-4 h-4 text-[#787774]" /> Identidad Institucional
        </h3>
        <div className="flex flex-col sm:flex-row items-start gap-6">
          <div className="flex-shrink-0">
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp"
              ref={logoInputRef}
              className="hidden"
              onChange={e => handleLogoSelection(e.target.files?.[0])}
            />
            <button
              type="button"
              onClick={() => logoInputRef.current?.click()}
              title="Elegir logo"
              className="w-20 h-20 bg-[#F7F6F3] border-2 border-dashed border-[#E9E9E7] rounded-lg flex flex-col items-center justify-center cursor-pointer hover:border-[#6940A5] transition-colors group overflow-hidden"
            >
              {form.logoUrl
                ? <img src={form.logoUrl} alt="Logo" className="w-full h-full object-contain bg-white" />
                : <>
                    <Upload className="w-5 h-5 text-[#AEADAB] group-hover:text-[#6940A5] transition-colors" />
                    <span className="text-[10px] text-[#AEADAB] mt-1">Logo</span>
                  </>
              }
            </button>
            <p className="text-[10px] text-[#AEADAB] mt-1 text-center">PNG/JPG/WebP · Máx. 2 MB</p>
            {form.logoUrl && (
              <button type="button" onClick={() => setForm(prev => ({ ...prev, logoUrl: '' }))}
                className="mt-1 w-full flex items-center justify-center gap-1 text-[11px] text-[#787774] hover:text-[#E03E3E]">
                <Trash2 className="w-3 h-3" /> Quitar logo
              </button>
            )}
          </div>
          <div className="flex-1 w-full grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Nombre de la institución" icon={Building2}>
              <input
                type="text"
                value={form.name}
                onChange={e => handleFieldChange('name', e.target.value)}
                className="w-full px-3 py-2 border border-[#E9E9E7] rounded-md text-sm focus:ring-1 focus:ring-[#37352F] outline-none"
              />
            </Field>
            <Field label="Código DANE" icon={Settings}>
              <input
                type="text"
                value={form.dane}
                onChange={e => handleFieldChange('dane', e.target.value)}
                className="w-full px-3 py-2 border border-[#E9E9E7] rounded-md text-sm font-mono focus:ring-1 focus:ring-[#37352F] outline-none"
              />
            </Field>
            <p className="sm:col-span-2 text-[11px] text-[#9B9A97]">
              El logo aparece en el menú de los paneles de profesores, estudiantes y del Súper Profesor.
            </p>
            {logoError && <p className="sm:col-span-2 text-xs text-[#E03E3E]">{logoError}</p>}
          </div>
        </div>
      </section>

      {/* Información de contacto */}
      <section className="bg-white border border-[#E9E9E7] rounded-lg p-6">
        <h3 className="font-semibold text-[#191919] mb-4 flex items-center gap-2">
          <Phone className="w-4 h-4 text-[#787774]" /> Información de Contacto
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Correo institucional" icon={Mail}>
            <input type="email" value={form.email} onChange={e => handleFieldChange('email', e.target.value)}
              className="w-full px-3 py-2 border border-[#E9E9E7] rounded-md text-sm focus:ring-1 focus:ring-[#37352F] outline-none" />
          </Field>
          <Field label="Teléfono" icon={Phone}>
            <input type="tel" value={form.phone} onChange={e => handleFieldChange('phone', e.target.value)}
              className="w-full px-3 py-2 border border-[#E9E9E7] rounded-md text-sm focus:ring-1 focus:ring-[#37352F] outline-none" />
          </Field>
          <Field label="Sitio web" icon={Globe}>
            <input type="url" value={form.website} onChange={e => handleFieldChange('website', e.target.value)}
              className="w-full px-3 py-2 border border-[#E9E9E7] rounded-md text-sm focus:ring-1 focus:ring-[#37352F] outline-none" />
          </Field>
          <Field label="Dirección" icon={MapPin}>
            <input type="text" value={form.address} onChange={e => handleFieldChange('address', e.target.value)}
              className="w-full px-3 py-2 border border-[#E9E9E7] rounded-md text-sm focus:ring-1 focus:ring-[#37352F] outline-none" />
          </Field>
        </div>
      </section>

      {/* Botón guardar */}
      <div className="flex justify-end gap-3">
        <button
          onClick={() => { setForm({ ...origForm }); setSaveError(''); setLogoError(''); }}
          disabled={!dirty || saving}
          className="flex items-center gap-2 px-4 py-2 border border-[#E9E9E7] rounded-md text-sm text-[#787774] hover:bg-[#F7F6F3] transition-colors disabled:opacity-50"
        >
          <RefreshCw className="w-4 h-4" /> Restablecer
        </button>
        <button
          onClick={handleSave}
          disabled={saving || (!dirty && !saved)}
          className={`flex items-center gap-2 px-5 py-2 rounded-md text-sm font-medium transition-all shadow-sm disabled:opacity-60 ${
            saved ? 'bg-[#0F7B6C] text-white' : 'bg-[#37352F] text-white hover:bg-[#2F2D2B]'
          }`}
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          {saved ? '¡Guardado exitosamente!' : 'Guardar cambios'}
        </button>
      </div>
      {saveError && (
        <p className="text-xs text-[#E03E3E] text-right mt-2">{saveError}</p>
      )}
    </div>
  );
}
