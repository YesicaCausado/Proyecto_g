from passlib.context import CryptContext

pwd_context = CryptContext(
    schemes=["bcrypt"],
    deprecated="auto"
)

print("admin1:", pwd_context.hash("admin123"))
print("admin2:", pwd_context.hash("admin123"))
print("demo:", pwd_context.hash("demo123"))