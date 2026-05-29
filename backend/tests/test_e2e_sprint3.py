"""Test end-to-end Sprint 3"""
import httpx
import asyncio

BASE = 'http://localhost:8001/api/v1'

async def test():
    async with httpx.AsyncClient(timeout=90.0) as c:
        # 1. Registro
        reg = await c.post(f'{BASE}/auth/register', json={
            'username': 'sprint3user', 'email': 'sprint3@neuro.co',
            'password': 'Test1234!', 'full_name': 'Test', 'role': 'estudiante'
        })
        print('REGISTER:', reg.status_code, reg.json().get('detail', 'OK'))

        # 2. Login (JSON body — el endpoint usa UserLogin, no OAuth2Form)
        login = await c.post(f'{BASE}/auth/login', json={
            'username': 'sprint3user', 'password': 'Test1234!'
        })
        token = login.json().get('access_token')
        print('LOGIN:', login.status_code, '| token OK:', bool(token))
        headers = {'Authorization': f'Bearer {token}'}

        # 3. Iniciar sesión
        start = await c.post(f'{BASE}/chat/start', json={
            'topic': 'Matematicas Saber 11', 'difficulty': 'medium'
        }, headers=headers)
        sd = start.json()
        print('START:', start.status_code, '| estado:', sd.get('cognitive_state'))
        print('Bot:', sd.get('message', '')[:200])

        # 4. Mensaje de CONFUSION (señales de duda/doubt)
        msg1 = await c.post(f'{BASE}/chat/message', json={
            'message': 'No entiendo la formula cuadratica, me confundo mucho',
            'response_time_ms': 5200,
            'typing_speed_cpm': 88,
            'corrections': 4,
            'pause_before_ms': 3800,
        }, headers=headers)
        m1 = msg1.json()
        print('\n--- MSG1 (confusion) ---')
        print('Estado:', m1.get('cognitive_state'), '| Confianza:', round(m1.get('confidence', 0), 2))
        print('Engagement:', round(m1.get('engagement_score', 0), 2), '| Riesgo:', round(m1.get('error_risk', 0), 2))
        print('Dificultad:', m1.get('difficulty'), '| Modalidades:', m1.get('active_modalities'))
        print('Bot:', m1.get('message', '')[:350])

        # 5. Mensaje de DOMINIO (respuesta correcta y rapida)
        msg2 = await c.post(f'{BASE}/chat/message', json={
            'message': 'Ya entendi! x = (-b +- sqrt(b^2 - 4ac)) / 2a y se usa cuando el trinomio no factoriza directamente',
            'response_time_ms': 1400,
            'typing_speed_cpm': 215,
            'corrections': 0,
            'pause_before_ms': 450,
        }, headers=headers)
        m2 = msg2.json()
        print('\n--- MSG2 (dominio) ---')
        print('Estado:', m2.get('cognitive_state'), '| Confianza:', round(m2.get('confidence', 0), 2))
        print('Engagement:', round(m2.get('engagement_score', 0), 2))
        print('Bot:', m2.get('message', '')[:350])

asyncio.run(test())
