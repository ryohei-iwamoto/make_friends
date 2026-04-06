-- =============================
-- テーブル定義
-- =============================

-- 事業部マスタ
CREATE TABLE IF NOT EXISTS departments (
  id   SERIAL PRIMARY KEY,
  name TEXT NOT NULL
);

-- グループ
CREATE TABLE IF NOT EXISTS groups (
  id           SERIAL PRIMARY KEY,
  group_number INT  NOT NULL,
  color        TEXT NOT NULL,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

-- ユーザー
CREATE TABLE IF NOT EXISTS users (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id       TEXT UNIQUE NOT NULL,
  department_id     INT  REFERENCES departments(id),
  name              TEXT NOT NULL,
  training_group_id TEXT,
  bio               TEXT,
  photo_url         TEXT,
  group_id          INT  REFERENCES groups(id),
  created_at        TIMESTAMPTZ DEFAULT NOW()
);

-- 集合写真
CREATE TABLE IF NOT EXISTS group_photos (
  id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id  INT REFERENCES groups(id) ON DELETE CASCADE,
  photo_url TEXT NOT NULL,
  taken_at  TIMESTAMPTZ DEFAULT NOW()
);

-- アプリ設定
CREATE TABLE IF NOT EXISTS app_settings (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

-- =============================
-- 初期データ：事業部
-- =============================
INSERT INTO departments (name) VALUES
  ('中途採用事業本部'),
  ('エージェント第一事業本部'),
  ('エージェント第二事業本部'),
  ('IT転職支援事業本部'),
  ('レバウェルプロフェッショナルメディア事業本部'),
  ('デジタルイノベーション事業本部'),
  ('採用本部'),
  ('IT新卒紹介事業本部'),
  ('海外紹介事業本部'),
  ('レバウェル医療テック事業本部'),
  ('キャリアチケット事業本部'),
  ('LT経営推進本部'),
  ('HRテック事業部'),
  ('海外事業本部'),
  ('LTコーポレート本部'),
  ('M&Aアドバイザリー事業部'),
  ('LT管理本部'),
  ('マーケティング部'),
  ('システム本部'),
  ('経営企画管理本部'),
  ('グローバル事業本部'),
  ('LW管理本部'),
  ('スタッフィング事業本部'),
  ('未定'),
  ('その他')
ON CONFLICT DO NOTHING;

-- =============================
-- RLS (Row Level Security)
-- =============================
ALTER TABLE departments  ENABLE ROW LEVEL SECURITY;
ALTER TABLE users        ENABLE ROW LEVEL SECURITY;
ALTER TABLE groups       ENABLE ROW LEVEL SECURITY;
ALTER TABLE group_photos ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;

-- 全員読み取り可
CREATE POLICY "departments_read" ON departments FOR SELECT USING (true);
CREATE POLICY "users_read"       ON users       FOR SELECT USING (true);
CREATE POLICY "groups_read"      ON groups      FOR SELECT USING (true);
CREATE POLICY "group_photos_read" ON group_photos FOR SELECT USING (true);
CREATE POLICY "app_settings_read" ON app_settings FOR SELECT USING (true);

-- ユーザーは自分のレコードのみ更新可
CREATE POLICY "users_insert" ON users FOR INSERT WITH CHECK (true);
CREATE POLICY "users_update" ON users FOR UPDATE USING (true);

-- 写真アップロード
CREATE POLICY "group_photos_insert" ON group_photos FOR INSERT WITH CHECK (true);

-- =============================
-- Storage バケット
-- =============================
-- Supabase管理画面で以下のバケットを作成してください:
-- 1. "profile-photos"  (public)
-- 2. "group-photos"    (public)
