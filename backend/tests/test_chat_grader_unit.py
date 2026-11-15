import asyncio
import unittest
from datetime import datetime, timedelta

from app.ai.cognitive.chat_grader import (
    GRADING_ERROR,
    grade_user_answer,
    parse_verdict,
    tutor_is_asking,
)
from app.ai.cognitive.pattern_status import performance_status


class FakeAIManager:
    def __init__(self, response, provider="groq"):
        self.response = response
        self.provider = provider
        self.calls = 0
        self.kwargs = None

    async def generate(self, **kwargs):
        self.calls += 1
        self.kwargs = kwargs
        return {"response": self.response, "provider": self.provider}


class ChatGraderUnitTests(unittest.TestCase):
    def test_identifies_knowledge_questions(self):
        self.assertTrue(tutor_is_asking("¿Cuál es la capital de Colombia?"))
        self.assertTrue(tutor_is_asking("Explica el ciclo del agua"))
        self.assertTrue(tutor_is_asking("Indica si la afirmación es verdadero o falso."))
        self.assertTrue(tutor_is_asking("Selecciona la respuesta:\nA) 2\nB) 4\nC) 6"))
        self.assertFalse(tutor_is_asking("La respuesta es correcta. ¿Quieres practicar otro ejercicio?"))

    def test_conversational_questions_are_not_sent_to_grader(self):
        ai = FakeAIManager("CORRECTO")
        result = asyncio.run(
            grade_user_answer(ai, "Sí, por favor", "¿Te gustaría practicar otro ejercicio?", "Geografía")
        )
        self.assertEqual(result, (None, 0.0))
        self.assertEqual(ai.calls, 0)

    def test_accepts_unambiguous_verdict_prefix(self):
        self.assertEqual(parse_verdict('{"verdict":"incorrect","confidence":0.91}'), ("incorrect", 0.91))
        self.assertEqual(parse_verdict('{"verdict":"correct","confidence":0.82}'), ("correct", 0.82))
        self.assertEqual(parse_verdict('{"verdict":"neutral","confidence":0.6}'), (None, 0.6))

    def test_rejects_malformed_or_out_of_range_json(self):
        for response in (
            "INCORRECTO",
            '{"verdict":"incorrect"}',
            '{"verdict":"unknown","confidence":0.8}',
            '{"verdict":"correct","confidence":1.1}',
            '{"verdict":"correct","confidence":true}',
            '```json\n{"verdict":"correct","confidence":0.9}\n```',
        ):
            with self.subTest(response=response):
                self.assertEqual(parse_verdict(response), (GRADING_ERROR, 0.0))

    def test_local_fallback_cannot_be_counted_as_a_grade(self):
        ai = FakeAIManager('{"verdict":"correct","confidence":0.9}', provider="local")
        result = asyncio.run(
            grade_user_answer(ai, "Bogotá", "¿Cuál es la capital de Colombia?", "Geografía")
        )
        self.assertEqual(result, (GRADING_ERROR, 0.0))

    def test_grading_receives_prior_context_and_uses_structured_output(self):
        ai = FakeAIManager('{"verdict":"correct","confidence":0.87}')
        result = asyncio.run(
            grade_user_answer(
                ai,
                "La fotosíntesis transforma energía luminosa.",
                "¿Qué transforma la fotosíntesis?",
                "Biología",
                context_messages=[
                    {"role": "user", "content": "Estamos estudiando plantas."},
                    {"role": "assistant", "content": "¿Qué transforma la fotosíntesis?"},
                ],
            )
        )
        self.assertEqual(result, ("correct", 0.87))
        self.assertIn("Estamos estudiando plantas.", ai.kwargs["prompt"])
        self.assertNotIn("temperature", ai.kwargs["prompt"])
        self.assertEqual(ai.kwargs["temperature"], 0.0)
        self.assertGreater(ai.kwargs["max_tokens"], 8)

    def test_failed_current_grade_preserves_quiz_history(self):
        now = datetime.utcnow()
        result = performance_status(
            verdict=None,
            grading_failed=True,
            was_question=True,
            session_stats={"chat_eval_count": 0},
            quiz_count=2,
            quiz_error_rate=0.25,
            last_quiz_at=now - timedelta(days=1),
            analysis=None,
            now=now,
        )
        self.assertEqual(result["status"], "available")
        self.assertEqual(result["values"]["quiz_count"], 2)
        self.assertIn("respuesta actual", result["reason"])

    def test_failed_grade_without_history_remains_an_error(self):
        now = datetime.utcnow()
        result = performance_status(
            verdict=None,
            grading_failed=True,
            was_question=True,
            session_stats={"chat_eval_count": 0},
            quiz_count=0,
            quiz_error_rate=None,
            last_quiz_at=None,
            analysis=None,
            now=now,
        )
        self.assertEqual(result["status"], "error")
        self.assertEqual(result["values"], {})


if __name__ == "__main__":
    unittest.main()
