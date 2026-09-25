"""
Conftest de pytest para NeuroLearn AI.

Historia del bug: `pytest tests/` moría durante la colección con
`httpx.ConnectError` (scripts e2e que hacen peticiones HTTP al arrancar) y
con "async def functions are not natively supported" (scripts standalone con
funciones `async def test_*` que pytest intentaba ejecutar sin plugin async).

Estos archivos son scripts manuales de verificación (se ejecutan con
`python -m tests.<nombre>`), no tests pytest reales:

  - test_automated.py, test_chatbot_interactive.py (interactivo, usa input()),
    test_bots_preentrenados.py — simulaciones locales con print, sin asserts.
  - test_e2e_sprint3.py, test_full_flow.py — e2e de sprints anteriores,
    escritos cuando /auth/register era público; ahora el registro está
    protegido (flujo B2B) y además hacen HTTP a un servidor vivo al importar.

Solución: se excluyen de la colección pytest. Siguen siendo ejecutables de
forma independiente. Los tests unitarios reales (motor neuroconductual,
chatbot, bots, seguridad, patrones) no dependen de red y siempre se ejecutan.
"""
# Scripts standalone manuales y e2e de sprints anteriores: nunca como parte
# de la suite pytest.
_STANDALONE_SCRIPTS = [
    "test_automated.py",
    "test_chatbot_interactive.py",
    "test_bots_preentrenados.py",
    "test_e2e_sprint3.py",
    "test_full_flow.py",
]

collect_ignore_glob = _STANDALONE_SCRIPTS
