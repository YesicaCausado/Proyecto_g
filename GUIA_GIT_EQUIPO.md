# 📝 Guía para trabajar en equipo con Git

## 1. Configuración inicial

Ambos deben clonar el repositorio:

```bash
git clone <url-del-repo>
```

Asegúrense de tener la rama main actualizada:

```bash
git checkout main
git pull origin main
```

---

## 2. Crear una rama para cada tarea

Antes de empezar cualquier cambio:

```bash
git checkout main
git pull origin main
git checkout -b nombre-de-tu-rama
```

**Ejemplo:** `feature-login`, `fix-bug-123`, `feat-azure-tts`, `fix-quiz-layout`

---

## 3. Trabajar en tu rama

Haz tus cambios y confirma:

```bash
git add .
git commit -m "Descripción clara del cambio"
```

Sube tu rama al remoto:

```bash
git push origin nombre-de-tu-rama
```

---

## 4. Integrar cambios con Pull Request

En GitHub/GitLab:

1. **Abre un Pull Request** desde tu rama hacia `main`
2. **Tu compañero revisa y aprueba**
3. **Solo después se hace el merge a main**

---

## 5. Mantener ramas actualizadas

Si tu compañero ya fusionó algo en main, actualiza tu rama:

```bash
git checkout main
git pull origin main
git checkout nombre-de-tu-rama
git merge main
```

O usa `git rebase main` si prefieren un historial más limpio:

```bash
git rebase main
```

---

## 6. Reglas de oro ⭐

- ✅ **Nunca trabajen directamente en main**
- ✅ **Cada cambio debe pasar por una rama y un Pull Request**
- ✅ **Usen commits claros y descriptivos**
- ✅ **Revisen y aprueben los PR del otro antes de fusionar**
- ✅ **Pullen antes de empezar trabajo nuevo**
- ✅ **Si hay conflictos, resuelvanlos juntos**

---

## 7. Flujo típico de una sesión de trabajo

```bash
# Paso 1: Actualizar main localmente
git checkout main
git pull origin main

# Paso 2: Crear rama nueva para tu tarea
git checkout -b feature-nueva-funcionalidad

# Paso 3: Hacer cambios... editar archivos, etc.

# Paso 4: Confirmar cambios
git add .
git commit -m "feat: agregar nueva funcionalidad"

# Paso 5: Subir rama
git push origin feature-nueva-funcionalidad

# Paso 6: En GitHub - crear Pull Request
# Tu compañero revisa y aprueba

# Paso 7: Mergear en GitHub (o desde terminal)
git checkout main
git pull origin main
git merge feature-nueva-funcionalidad
git push origin main
```

---

## 8. Comandos útiles

| Comando | Qué hace |
|---------|----------|
| `git branch` | Ver ramas locales |
| `git branch -a` | Ver todas las ramas (locales + remotas) |
| `git status` | Ver cambios sin confirmar |
| `git log --oneline` | Ver historial de commits |
| `git diff` | Ver diferencias sin confirmar |
| `git stash` | Guardar cambios temporalmente |
| `git stash pop` | Recuperar cambios guardados |
| `git reset --soft HEAD~1` | Deshacer último commit (mantiene cambios) |
| `git reset --hard HEAD~1` | Deshacer último commit (elimina cambios) |

---

## 9. En caso de conflictos

Si hay conflictos al mergear:

1. Git te indicará qué archivos tienen conflictos
2. Abre el archivo y busca los marcadores de conflicto:
   ```
   <<<<<<< HEAD
   Tu código aquí
   =======
   Código del otro
   >>>>>>> nombre-rama
   ```
3. Resuelve manualmente: elige qué código mantener
4. Confirma la resolución:
   ```bash
   git add .
   git commit -m "Resolver conflictos"
   git push origin main
   ```

---

## 10. Ejemplo: Proyecto NeuroLearn

**Escenario:** Yesica y Compañero trabajan juntos

### Yesica está implementando Azure TTS:
```bash
git checkout main
git pull origin main
git checkout -b feat-azure-neural-tts
# ... edita useVoiceTutor.ts, QuizPanel.tsx ...
git add -A
git commit -m "feat: Azure Neural TTS con Irene ES y Jenny EN"
git push origin feat-azure-neural-tts
```

### Compañero está mejorando autenticación:
```bash
git checkout main
git pull origin main
git checkout -b feat-login-improvements
# ... edita auth.py, AuthContext.tsx ...
git add -A
git commit -m "feat: mejorar validación de login"
git push origin feat-login-improvements
```

### Luego mergean en GitHub con Pull Requests ✅

---

**¡Listo para colaborar en equipo! 🚀**
