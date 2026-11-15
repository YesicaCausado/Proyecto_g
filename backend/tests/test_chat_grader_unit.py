import asyncio
import unittest

from app.ai.cognitive.chat_grader import (
    GRADING_ERROR,
    grade_user_answer,
    parse_verdict,
    tutor_is_asking,
)


class FakeAIManager:
    def __init__(self, response, provider="groq"):
        self.response = response
        self.provider = provider
        self.calls = 0

    async def generate(self, **_kwargs):
        self.calls += 1
        return {"response": self.response, "provider": self.provider}


class ChatGraderUnitTests(unittest.TestCase):
    def test_identifies_knowledge_questions(self):
        self.assertTrue(tutor_is_asking("¿Cuál es la capital de Colombia?"))
        self.assertTrue(tutor_is_asking("Explica el ciclo del agua"))

    def test_conversational_questions_are_not_sent_to_grader(self):
        ai = FakeAIManager("CORRECTO")
        result = asyncio.run(
            grade_user_answer(ai, "Sí, por favor", "¿Te gustaría practicar otro ejercicio?", "Geografía")
        )
        self.assertEqual(result, (None, 0.0))
        self.assertEqual(ai.calls, 0)

    def test_accepts_unambiguous_verdict_prefix(self):
        self.assertEqual(parse_verdict("Veredicto: INCORRECTO — revisa el concepto")[0], "incorrect")
        self.assertEqual(parse_verdict("RESPUESTA= CORRECTO")[0], "correct")

    def test_local_fallback_cannot_be_counted_as_a_grade(self):
        ai = FakeAIManager("CORRECTO", provider="local")
        result = asyncio.run(
            grade_user_answer(ai, "Bogotá", "¿Cuál es la capital de Colombia?", "Geografía")
        )
        self.assertEqual(result, (GRADING_ERROR, 0.0))


if __name__ == "__main__":
    unittest.main()
