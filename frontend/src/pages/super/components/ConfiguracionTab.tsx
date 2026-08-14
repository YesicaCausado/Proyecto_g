import { useState, useRef, useEffect } from 'react';
import { Settings, Upload, Globe, Clock, Building2, Phone, Mail, MapPin, Save, RefreshCw, Loader2 } from 'lucide-react';
import api from '../../../services/api';

export default function ConfiguracionTab() {
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [loading, setLoading] = useState(true);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);
  const [form, setForm] = useState({
    name: '',
    dane: '',
    email: '',
    phone: '',
    address: '',
    timezone: 'America/Bogota',
    language: 'es',
    primaryColor: '#6940A5',
    website: '',
  });
  const [origForm, setOrigForm] = useState({
    name: '',
    dane: '',
    email: '',
    phone: '',
    address: '',
    timezone: 'America/Bogota',
    language: 'es',
    primaryColor: '#6940A5',
    website: '',
  });

  useEffect(() => {
    api.get('/super/institution')
      .then(r => {
        const next = {
          name: r.data.name ?? '',
          dane: r.data.dane_code ?? '',
          email: r.data.email ?? '',
          phone: r.data.phone ?? '',
          address: r.data.address ?? '',
          timezone: r.data.timezone ?? 'America/Bogota',
          language: r.data.language ?? 'es',
          primaryColor: r.data.primary_color ?? '#6940A5',
          website: r.data.website ?? '',
        };
        setForm(prev => ({ ...prev, ...next }));
        setOrigForm(next);
        if (r.data.logo_url) {
          setLogoPreview(r.data.logo_url);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleFieldChange = (field: keyof typeof form, value: string) => {
    setForm(prev => ({ ...prev, [field]: value }));
  };

  const handleLogoSelection = (file: File | null | undefined) => {
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      alert('El archivo supera el límite de 2 MB.');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = String(reader.result ?? '');
      setLogoPreview(dataUrl);
      setForm(prev => ({ ...prev, logoUrl: dataUrl }));
    };
    reader.readAsDataURL(file);
  };

  const handleSave = async () => {
    setSaveError('');
    try {
      const payload = {
        name: form.name,
        dane_code: form.dane,
        email: form.email,
        phone: form.phone,
        address: form.address,
        website: form.website,
        timezone: form.timezone,
        language: form.language,
        primary_color: form.primaryColor,
        logo_url: logoPreview || null,
      };
      await api.patch('/super/institution', payload);
      setOrigForm({ ...form });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch {
      setSaveError('No se pudo guardar. Intenta de nuevo.');
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

  return (
    <div className="space-y-8 max-w-3xl">

      {/* Logo institucional */}
      <section className="bg-white border border-[#E9E9E7] rounded-lg p-6">
        <h3 className="font-semibold text-[#191919] mb-4 flex items-center gap-2">
          <Building2 className="w-4 h-4 text-[#787774]" /> Identidad Institucional
        </h3>
        <div className="flex items-start gap-6">
          <div className="flex-shrink-0">
            {/* Input file oculto — se activa al hacer clic en el div */}
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp"
              ref={logoInputRef}
              className="hidden"
              onChange={e => handleLogoSelection(e.target.files?.[0])}
            />
            <div
              onClick={() => logoInputRef.current?.click()}
              className="w-20 h-20 bg-[#F7F6F3] border-2 border-dashed border-[#E9E9E7] rounded-lg flex flex-col items-center justify-center cursor-pointer hover:border-[#6940A5] transition-colors group overflow-hidden"
            >
              {logoPreview
                ? <img src={logoPreview} alt="Logo" className="w-full h-full object-cover" />
                : <>
                    <Upload className="w-5 h-5 text-[#AEADAB] group-hover:text-[#6940A5] transition-colors" />
                    <span className="text-[10px] text-[#AEADAB] mt-1">Logo</span>
                  </>
              }
            </div>
            <p className="text-[10px] text-[#AEADAB] mt-1 text-center">PNG/JPG · Max 2MB</p>
          </div>
          <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-4">
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

      {/* Regional */}
      <section className="bg-white border border-[#E9E9E7] rounded-lg p-6">
        <h3 className="font-semibold text-[#191919] mb-4 flex items-center gap-2">
          <Globe className="w-4 h-4 text-[#787774]" /> Regionalización
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Zona horaria" icon={Clock}>
            <select value={form.timezone} onChange={e => handleFieldChange('timezone', e.target.value)}
              className="w-full px-3 py-2 border border-[#E9E9E7] rounded-md text-sm focus:ring-1 focus:ring-[#37352F] outline-none bg-white">
              <option value="America/Bogota">America/Bogota (UTC-5)</option>
              <option value="America/Lima">America/Lima (UTC-5)</option>
              <option value="America/Mexico_City">America/Mexico_City (UTC-6)</option>
              <option value="America/Santiago">America/Santiago (UTC-4)</option>
              <option value="America/Buenos_Aires">America/Buenos_Aires (UTC-3)</option>
            </select>
          </Field>
          <Field label="Idioma" icon={Globe}>
            <select value={form.language} onChange={e => handleFieldChange('language', e.target.value)}
              className="w-full px-3 py-2 border border-[#E9E9E7] rounded-md text-sm focus:ring-1 focus:ring-[#37352F] outline-none bg-white">
              <option value="es">Español</option>
              <option value="en">English</option>
            </select>
          </Field>
        </div>
      </section>

      {/* Personalización */}
      <section className="bg-white border border-[#E9E9E7] rounded-lg p-6">
        <h3 className="font-semibold text-[#191919] mb-4 flex items-center gap-2">
          <Settings className="w-4 h-4 text-[#787774]" /> Personalización Visual
        </h3>
        <div className="flex items-center gap-4">
          <div>
            <label className="block text-xs font-semibold text-[#787774] mb-1.5 uppercase tracking-wide">
              Color institucional
            </label>
            <div className="flex items-center gap-3">
              <input
                type="color"
                value={form.primaryColor}
                onChange={e => handleFieldChange('primaryColor', e.target.value)}
                className="w-10 h-10 border border-[#E9E9E7] rounded-md cursor-pointer p-0.5"
              />
              <span className="font-mono text-sm text-[#787774]">{form.primaryColor}</span>
            </div>
          </div>
          <div className="flex-1 pl-4 border-l border-[#E9E9E7]">
            <p className="text-xs text-[#787774] mb-2">Vista previa del color seleccionado:</p>
            <div className="flex gap-2">
              <div className="h-8 w-24 rounded-md" style={{ backgroundColor: form.primaryColor }} />
              <div className="h-8 w-24 rounded-md opacity-70" style={{ backgroundColor: form.primaryColor }} />
              <div className="h-8 w-24 rounded-md opacity-40" style={{ backgroundColor: form.primaryColor }} />
            </div>
          </div>
        </div>
      </section>

      {/* Botón guardar */}
      <div className="flex justify-end gap-3">
        <button
          onClick={() => {
            setForm({ ...origForm });
          }}
          className="flex items-center gap-2 px-4 py-2 border border-[#E9E9E7] rounded-md text-sm text-[#787774] hover:bg-[#F7F6F3] transition-colors"
        >
          <RefreshCw className="w-4 h-4" /> Restablecer
        </button>
        <button
          onClick={handleSave}
          className={`flex items-center gap-2 px-5 py-2 rounded-md text-sm font-medium transition-all shadow-sm ${
            saved ? 'bg-[#0F7B6C] text-white' : 'bg-[#37352F] text-white hover:bg-[#2F2D2B]'
          }`}
        >
          <Save className="w-4 h-4" />
          {saved ? '¡Guardado exitosamente!' : 'Guardar cambios'}
        </button>
      </div>
      {saveError && (
        <p className="text-xs text-[#E03E3E] text-right mt-2">{saveError}</p>
      )}
    </div>
  );
}
