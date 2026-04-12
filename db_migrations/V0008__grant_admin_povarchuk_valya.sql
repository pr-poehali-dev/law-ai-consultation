UPDATE t_p57945357_law_ai_consultation.users
SET
  is_admin = TRUE,
  paid_questions = 9999,
  paid_docs = 9999,
  paid_expert = TRUE,
  paid_business = 9999,
  subscription_consult_until = NOW() + INTERVAL '10 years',
  subscription_docs_until = NOW() + INTERVAL '10 years'
WHERE email = 'povarchuk.valya8888@mail.ru';
