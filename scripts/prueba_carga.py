"""
NeuroLearn IA — Prueba de carga y rendimiento (RNF-12, RNF-13).

Simula N usuarios concurrentes navegando las pantallas principales de cada
rol contra un servidor real (local, preview o producción) y reporta p50, p95,
p99, errores y solicitudes por segundo. Termina con código 1 si algún p95
supera el límite (2,5 s por defecto) o si los errores superan el 1 %.

Solo hace lecturas (GET) más un inicio de sesión por cuenta: no crea ni
modifica datos. Aun así, contra producción coordínelo con el equipo: la carga
es real. Sin dependencias: solo la biblioteca estándar de Python 3.

Cuentas (una por rol que quiera probar), por variable de entorno para que
las contraseñas no queden en el historial de la terminal:

    PRUEBA_CARGA_CUENTAS="estudiante:usuario:clave,profesor:usuario:clave,super:usuario:clave,admin:usuario:clave"

Ejemplos:

    python scripts/prueba_carga.py --url http://localhost:8000 --usuarios 20 --duracion 60
    python scripts/prueba_carga.py --url https://neurolearnym.vercel.app --usuarios 50 --duracion 120 --salida carga.json

Para comparar capacidad, repita con más usuarios (10, 25, 50, 100) y anote
en qué punto el p95 se acerca al límite.
"""
from __future__ import annotations

import argparse
import json
import os
import random
import sys
import threading
import time
import urllib.error
import urllib.request
from collections import defaultdict

ENDPOINTS = {
    "estudiante": [
        "/auth/me", "/classrooms/my-enrolled", "/stats/dashboard", "/stats/performance",
        "/notifications", "/events", "/posts", "/student/evaluations", "/student/materials",
        "/student/diagnostic", "/bots/assigned-to-me", "/chat/quiz-history",
    ],
    "profesor": [
        "/classrooms/my-classes", "/teacher/stats", "/teacher/evaluations", "/teacher/materials",
        "/messages/contacts", "/bots/my-bots", "/notifications",
    ],
    "super": [
        "/super/stats/dashboard", "/super/teachers", "/super/students", "/super/classrooms",
        "/super/reports/overview", "/super/audit", "/super/bots",
    ],
    "admin": ["/admin/stats", "/admin/institutions", "/admin/users", "/admin/config"],
}


def _request(method, url, token=None, body=None, origin=None, timeout=30.0):
    data = json.dumps(body).encode("utf-8") if body is not None else None
    req = urllib.request.Request(url, data=data, method=method)
    req.add_header("Accept", "application/json")
    if data is not None:
        req.add_header("Content-Type", "application/json")
    if token:
        req.add_header("Authorization", f"Bearer {token}")
    if origin:
        req.add_header("Origin", origin)
    t0 = time.perf_counter()
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            payload = resp.read()
            status = resp.status
    except urllib.error.HTTPError as e:
        payload, status = e.read(), e.code
    except Exception:  # noqa: BLE001 (timeout, conexión rechazada…)
        payload, status = b"", 0
    return status, time.perf_counter() - t0, payload


def _percentile(values, pct):
    if not values:
        return 0.0
    ordered = sorted(values)
    return ordered[min(len(ordered) - 1, int(round(pct / 100 * (len(ordered) - 1))))]


def _parse_accounts(raw):
    accounts = []
    for item in filter(None, (x.strip() for x in raw.split(","))):
        role, _, rest = item.partition(":")
        username, _, password = rest.partition(":")
        if role not in ENDPOINTS or not username or not password:
            sys.exit(f"Cuenta inválida «{item}». Formato: rol:usuario:clave con rol en {', '.join(ENDPOINTS)}.")
        accounts.append((role, username, password))
    return accounts


def main():
    # La consola de Windows (cp1252) no imprime tildes ni «≤» sin esto.
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    except Exception:  # noqa: BLE001
        pass
    parser = argparse.ArgumentParser(description="Prueba de carga de NeuroLearn IA (solo lecturas).")
    parser.add_argument("--url", required=True, help="URL base del backend, p. ej. http://localhost:8000")
    parser.add_argument("--usuarios", type=int, default=20, help="usuarios concurrentes (por defecto 20)")
    parser.add_argument("--duracion", type=int, default=60, help="segundos de carga (por defecto 60)")
    parser.add_argument("--pausa", type=float, default=0.5, help="pausa media entre clics de un usuario, s")
    parser.add_argument("--limite", type=float, default=2.5, help="p95 máximo aceptado, s (RNF-12)")
    parser.add_argument("--salida", help="archivo JSON para guardar el reporte")
    args = parser.parse_args()

    accounts = _parse_accounts(os.getenv("PRUEBA_CARGA_CUENTAS", ""))
    if not accounts:
        sys.exit("Defina PRUEBA_CARGA_CUENTAS (ver la ayuda al inicio del archivo).")
    base = args.url.rstrip("/")
    api = base + "/api/v1"

    # Un inicio de sesión por cuenta: los usuarios virtuales comparten el token
    # (así la prueba no dispara el bloqueo de 20 intentos en 5 minutos).
    sessions = []
    for role, username, password in accounts:
        status, elapsed, payload = _request("POST", f"{api}/auth/login", origin=base,
                                            body={"username": username, "password": password})
        if status != 200:
            sys.exit(f"No se pudo iniciar sesión como {role} ({username}): HTTP {status} {payload[:200]!r}")
        sessions.append((role, json.loads(payload)["access_token"]))
        print(f"Sesión iniciada · {role:10} {elapsed * 1000:7.1f} ms")

    samples = defaultdict(list)
    errors = defaultdict(int)
    lock = threading.Lock()
    stop_at = time.monotonic() + args.duracion

    def virtual_user(index):
        role, token = sessions[index % len(sessions)]
        rnd = random.Random(index)
        while time.monotonic() < stop_at:
            path = rnd.choice(ENDPOINTS[role])
            status, elapsed, _ = _request("GET", api + path, token=token)
            key = f"{role} GET {path}"
            with lock:
                samples[key].append(elapsed)
                if status != 200:
                    errors[key] += 1
            time.sleep(rnd.uniform(0, 2 * args.pausa))

    print(f"\nCarga: {args.usuarios} usuarios concurrentes durante {args.duracion} s contra {base}\n")
    started = time.monotonic()
    threads = [threading.Thread(target=virtual_user, args=(i,), daemon=True) for i in range(args.usuarios)]
    for t in threads:
        t.start()
    for t in threads:
        t.join()
    elapsed_total = time.monotonic() - started

    report = {"url": base, "usuarios": args.usuarios, "duracion_s": args.duracion, "limite_s": args.limite,
              "funcionalidades": {}}
    print(f"{'Funcionalidad':45} {'n':>6} {'p50 ms':>8} {'p95 ms':>8} {'p99 ms':>8} {'errores':>8}")
    total = total_errors = 0
    failures = []
    for key in sorted(samples):
        values = samples[key]
        p95 = _percentile(values, 95)
        row = {"n": len(values), "p50_ms": round(_percentile(values, 50) * 1000, 1),
               "p95_ms": round(p95 * 1000, 1), "p99_ms": round(_percentile(values, 99) * 1000, 1),
               "errores": errors[key]}
        report["funcionalidades"][key] = row
        total += len(values)
        total_errors += errors[key]
        if p95 >= args.limite:
            failures.append(f"{key}: p95 {p95:.2f} s")
        print(f"{key:45} {row['n']:6} {row['p50_ms']:8} {row['p95_ms']:8} {row['p99_ms']:8} {row['errores']:8}")

    all_values = [v for vs in samples.values() for v in vs]
    error_rate = total_errors / total if total else 1.0
    report.update({
        "solicitudes": total,
        "solicitudes_por_segundo": round(total / elapsed_total, 2) if elapsed_total else 0,
        "p95_global_ms": round(_percentile(all_values, 95) * 1000, 1),
        "tasa_errores": round(error_rate, 4),
    })
    print(f"\nTotal: {total} solicitudes · {report['solicitudes_por_segundo']} por segundo · "
          f"p95 global {report['p95_global_ms']} ms · errores {error_rate:.2%}")

    if error_rate > 0.01:
        failures.append(f"tasa de errores {error_rate:.2%} (> 1 %)")
    report["cumple"] = not failures
    if args.salida:
        with open(args.salida, "w", encoding="utf-8") as fh:
            json.dump(report, fh, ensure_ascii=False, indent=2)
        print(f"Reporte guardado en {args.salida}")

    if failures:
        print("\nNO CUMPLE:\n  " + "\n  ".join(failures))
        sys.exit(1)
    print(f"\nCUMPLE: todas las funcionalidades con p95 < {args.limite} s y errores ≤ 1 %.")


if __name__ == "__main__":
    main()
