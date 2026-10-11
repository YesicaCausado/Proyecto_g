/**
 * Descarga autenticada de un material compartido por un profesor
 * (GET /student/materials/{id}/download). Se pide como blob con el cliente
 * de la API para enviar el token; un enlace directo respondería 401.
 */
import api from '../../services/api';

export async function downloadStudentMaterial(id: number, name: string): Promise<void> {
  const res = await api.get(`/student/materials/${id}/download`, { responseType: 'blob' });
  const url = URL.createObjectURL(res.data as Blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name || 'material';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
