import ProfileSettings from '../../components/ProfileSettings';

export default function SettingsPage() {
  return (
    <div className="p-4 md:p-6 md:pl-8 max-w-3xl mx-auto">
      <div className="mb-5">
        <h1 className="text-2xl font-bold text-[#37352F]">Configuración</h1>
        <p className="text-[#787774] text-sm mt-1">Tu perfil, seguridad y preferencias</p>
      </div>
      <ProfileSettings role="estudiante" prefsStorageKey="student_notifications" />
    </div>
  );
}