// Test environment — never real credentials. Uses the dedicated ggz_test DB.
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL ?? "postgresql://postgres:postgres@localhost:54329/ggz_test";
process.env.APP_URL = "http://localhost:3000";
process.env.APP_SECRET = "test-secret-test-secret-test-secret-0123456789";
process.env.PAYSTACK_SECRET_KEY = "sk_test_unit_tests_only";
delete process.env.RESEND_API_KEY;
delete process.env.EMAIL_FROM;
delete process.env.PAYSTACK_API_BASE_URL;
