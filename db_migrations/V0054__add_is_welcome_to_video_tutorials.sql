ALTER TABLE t_p57945357_law_ai_consultation.video_tutorials
  ADD COLUMN IF NOT EXISTS is_welcome BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN t_p57945357_law_ai_consultation.video_tutorials.is_welcome
  IS 'Флаг приветственного видео (показывается крупным плеером в модале при первом входе)';