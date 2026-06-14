-- Массовое исправление пользователей, получивших тариф через auto_credit_on_login
-- У них не были установлены: paid_expert, purchased_plan, lawyer_consultations_left

-- id=299 shauvv@gmail.com — paid_expert=false, purchased_plan=null
UPDATE t_p57945357_law_ai_consultation.users
SET paid_expert = TRUE,
    purchased_plan = 'starter',
    lawyer_consultations_left = GREATEST(lawyer_consultations_left, 1)
WHERE id = 299
  AND purchased_plan IS NULL;

-- id=279 konsek5@yandex.ru — purchased_plan=null, lawyer_consultations_left=0
UPDATE t_p57945357_law_ai_consultation.users
SET purchased_plan = 'starter',
    lawyer_consultations_left = GREATEST(lawyer_consultations_left, 1)
WHERE id = 279
  AND purchased_plan IS NULL;

-- id=227 str.russia.64@gmail.com — paid_expert=false (purchased_plan уже starter)
UPDATE t_p57945357_law_ai_consultation.users
SET paid_expert = TRUE
WHERE id = 227
  AND paid_expert = FALSE
  AND purchased_plan = 'starter';

-- id=210 julia.32rus@yandex.ru — paid_expert=false (purchased_plan уже starter)
UPDATE t_p57945357_law_ai_consultation.users
SET paid_expert = TRUE
WHERE id = 210
  AND paid_expert = FALSE
  AND purchased_plan = 'starter';

-- id=171 rustam-son@yandex.ru — paid_expert=false (purchased_plan уже starter)
UPDATE t_p57945357_law_ai_consultation.users
SET paid_expert = TRUE
WHERE id = 171
  AND paid_expert = FALSE
  AND purchased_plan = 'starter';