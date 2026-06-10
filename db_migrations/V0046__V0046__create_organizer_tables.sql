
CREATE TABLE t_p57945357_law_ai_consultation.organizer_cases (
  id          SERIAL PRIMARY KEY,
  user_id     INTEGER NOT NULL REFERENCES t_p57945357_law_ai_consultation.users(id),
  case_number VARCHAR(100) NOT NULL,
  court       VARCHAR(200) NOT NULL,
  judge       VARCHAR(100),
  plaintiff   VARCHAR(200),
  defendant   VARCHAR(200),
  status      VARCHAR(20) NOT NULL DEFAULT 'active',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE t_p57945357_law_ai_consultation.organizer_hearings (
  id         SERIAL PRIMARY KEY,
  case_id    INTEGER NOT NULL REFERENCES t_p57945357_law_ai_consultation.organizer_cases(id),
  user_id    INTEGER NOT NULL,
  hear_date  DATE NOT NULL,
  hear_time  VARCHAR(10),
  room       VARCHAR(50),
  result     VARCHAR(20),
  notes      TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE t_p57945357_law_ai_consultation.organizer_tasks (
  id           SERIAL PRIMARY KEY,
  case_id      INTEGER NOT NULL REFERENCES t_p57945357_law_ai_consultation.organizer_cases(id),
  user_id      INTEGER NOT NULL,
  title        VARCHAR(300) NOT NULL,
  due_date     DATE,
  is_completed BOOLEAN NOT NULL DEFAULT FALSE,
  reminder     BOOLEAN NOT NULL DEFAULT TRUE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE t_p57945357_law_ai_consultation.organizer_documents (
  id          SERIAL PRIMARY KEY,
  case_id     INTEGER NOT NULL REFERENCES t_p57945357_law_ai_consultation.organizer_cases(id),
  user_id     INTEGER NOT NULL,
  name        VARCHAR(300) NOT NULL,
  doc_type    VARCHAR(50) NOT NULL DEFAULT 'Другое',
  is_prepared BOOLEAN NOT NULL DEFAULT FALSE,
  deadline    DATE,
  notes       TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_org_cases_user    ON t_p57945357_law_ai_consultation.organizer_cases(user_id);
CREATE INDEX idx_org_hearings_case ON t_p57945357_law_ai_consultation.organizer_hearings(case_id);
CREATE INDEX idx_org_tasks_case    ON t_p57945357_law_ai_consultation.organizer_tasks(case_id);
CREATE INDEX idx_org_docs_case     ON t_p57945357_law_ai_consultation.organizer_documents(case_id);
