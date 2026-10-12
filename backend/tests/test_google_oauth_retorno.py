"""
Regreso de Google OAuth (parche 14A).

Al volver de Google, el navegador visita /api/v1/integrations/google/callback.
Si el service worker de la PWA respondía esa visita con la app guardada, los
estilos se pedían a /api/v1/.../assets/*.css, el backend respondía JSON
(«MIME type application/json») y la página quedaba en blanco.
"""
import importlib
import os
import re
import unittest
from pathlib import Path
from unittest import mock

ROOT = Path(__file__).resolve().parents[2]


class GoogleOAuthRetornoTests(unittest.TestCase):
    def test_service_worker_no_toma_rutas_del_backend(self):
        cfg = (ROOT / "frontend" / "vite.config.ts").read_text(encoding="utf-8")
        m = re.search(r"navigateFallbackDenylist:\s*\[([^\]]*)\]", cfg)
        self.assertIsNotNone(m, "falta navigateFallbackDenylist en la configuración de la PWA")
        self.assertIn(r"/^\/api\//", m.group(1))

    def test_rescate_en_index_html(self):
        html = (ROOT / "frontend" / "index.html").read_text(encoding="utf-8")
        self.assertIn("serviceWorker.getRegistrations", html)

    def test_redirect_uri_en_vercel(self):
        from app.core import config
        env = {"VERCEL_PROJECT_PRODUCTION_URL": "neurolearn.example.app"}
        with mock.patch.dict(os.environ, env, clear=False):
            os.environ.pop("GOOGLE_REDIRECT_URI", None)
            reloaded = importlib.reload(config)
            self.assertEqual(reloaded.Settings().GOOGLE_REDIRECT_URI,
                             "https://neurolearn.example.app/api/v1/integrations/google/callback")
        importlib.reload(config)


if __name__ == "__main__":
    unittest.main(verbosity=2)
