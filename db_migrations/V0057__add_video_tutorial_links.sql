UPDATE t_p57945357_law_ai_consultation.video_tutorials
SET video_url = 'https://cdn.poehali.dev/projects/3f0ef70d-a78f-4ee8-b1bc-a70a6b86cef1/bucket/42411d09-9637-4f31-8ae1-91c21fd4e6ca.mp4',
    sort_order = 4,
    updated_at = NOW()
WHERE id = 6;

INSERT INTO t_p57945357_law_ai_consultation.video_tutorials (title, description, video_url, sort_order, is_active, is_welcome)
VALUES ('Как найти судебную практику?', '', 'https://cdn.poehali.dev/projects/3f0ef70d-a78f-4ee8-b1bc-a70a6b86cef1/bucket/5dbed770-3ac8-4b6a-81f7-e13aeff127f6.mp4', 5, TRUE, FALSE);