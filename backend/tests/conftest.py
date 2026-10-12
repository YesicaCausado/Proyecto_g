"""
Conftest de pytest para NeuroLearn AI.

Scripts manuales que NO forman parte de la suite (se ejecutan a mano con
`python -m tests.<nombre>`):

  - test_chatbot_interactive.py: conversación interactiva por terminal con el
    chatbot adaptativo (usa input()).

`test_8_states.py` también es un script manual (valida los 8 estados
cognitivos e imprime el resultado); pytest no lo ejecuta porque no define
funciones test_*.

Los scripts e2e de sprints anteriores (test_e2e_sprint3.py, test_full_flow.py)
y las simulaciones sin aserciones (test_automated.py,
test_bots_preentrenados.py) se retiraron en el parche 11: dependían del
registro público eliminado o de bots que ya no existen, y sus escenarios útiles
quedaron cubiertos por test_auth_roles.py y test_flujo_institucional.py.
"""
# Scripts manuales: nunca como parte de la suite pytest.
_STANDALONE_SCRIPTS = [
    "test_chatbot_interactive.py",
]

collect_ignore_glob = _STANDALONE_SCRIPTS


# ── Entorno de pruebas aislado ───────────────────────────────────────────────
# Se fija ANTES de que cualquier prueba importe la app: BD SQLite en memoria,
# correo a consola, sin proveedores de IA. Ver tests/entorno_pruebas.py (cada
# archivo de pruebas también lo importa, para quedar aislado con unittest).
import tests.entorno_pruebas  # noqa: E402,F401
