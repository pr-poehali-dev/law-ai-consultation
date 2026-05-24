CREATE TABLE IF NOT EXISTS t_p57945357_law_ai_consultation.video_tutorials (
  id SERIAL PRIMARY KEY,
  title VARCHAR(200) NOT NULL,
  description TEXT,
  video_url TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO t_p57945357_law_ai_consultation.video_tutorials (title, description, sort_order, is_active)
VALUES ('Как создать документ?', 'Пошаговая инструкция по созданию юридического документа через AI', 1, true);
