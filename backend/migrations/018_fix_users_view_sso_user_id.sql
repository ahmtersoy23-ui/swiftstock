-- 018: users VIEW'ına sso_user_id eklendi
-- wms_users tablosunda sso_user_id zaten var ama eski VIEW definition'da yoktu.
CREATE OR REPLACE VIEW users AS
  SELECT user_id, username, password_hash, full_name, email, role,
         warehouse_id, is_active, last_login, created_at, updated_at,
         must_change_password, sso_user_id
  FROM wms_users;
