-- gizma31@mail.ru (id=170): добавляем 70 вопросов чтобы итого стало 100 (как plan_pro)
-- Это даёт доступ к анализу PDF (canUploadFiles = paidQuestions >= 100)
UPDATE t_p57945357_law_ai_consultation.users
SET paid_questions = paid_questions + 70
WHERE id = 170 AND email = 'gizma31@mail.ru';

INSERT INTO t_p57945357_law_ai_consultation.billing_log
  (user_id, user_email, service_type, amount, description, source)
VALUES
  (170, 'gizma31@mail.ru', 'plan_pro', 0, 'Компенсация: +70 вопросов (доступ к анализу PDF, обещано в воронке Пакет Старт)', 'manual_fix');
