import ProfileSettings from '../../../components/ProfileSettings';

interface Props {
  user: any;
}

export default function ConfiguracionTab(_props: Props) {
  return (
    <ProfileSettings
      role="profesor"
      prefsStorageKey="teacher_notifications"
    />
  );
}