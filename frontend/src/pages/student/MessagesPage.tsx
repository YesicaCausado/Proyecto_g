import Messaging from '../../components/Messaging';

export default function MessagesPage() {
  return (
    <div className="p-4 md:p-6 md:pl-8 max-w-5xl mx-auto">
      <div className="mb-5">
        <h1 className="text-2xl font-bold text-[#37352F]">Mensajes</h1>
        <p className="text-[#787774] text-sm mt-1">Conversaciones con tus profesores</p>
      </div>
      <Messaging accent="#0066FF" height="h-[calc(100vh-200px)] min-h-[480px]" emptyHint="Habla con tus profesores de clase" />
    </div>
  );
}