import { useInstitutionLogo } from '../hooks/useInstitutionLogo';

// Logo de la institución en los menús; sin logo, el ícono de NeuroLearn.
const FALLBACK = `${import.meta.env.BASE_URL}2d.png`;

export default function InstitutionLogo({ className = '' }: { className?: string }) {
  const logo = useInstitutionLogo();
  return (
    <img
      src={logo || FALLBACK}
      alt={logo ? 'Logo de la institución' : 'NeuroLearn'}
      className={`object-contain bg-white ${className}`}
    />
  );
}
