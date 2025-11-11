## Deployment (Docker di VPS Ubuntu 22.04)

1. **Siapkan server**
   ```bash
   sudo apt update && sudo apt upgrade -y
   # Install Docker Engine + Compose plugin sesuai dokumentasi resmi
   sudo usermod -aG docker $USER
   sudo mkdir -p /var/www/laravel-todo
   sudo chown $USER:$USER /var/www/laravel-todo
   cd /var/www/laravel-todo
   git clone <repo-url> .
   ```
   - Pastikan DNS `todo.karirkit.web.id` sudah mengarah ke IP server ini.

2. **Konfigurasi environment produksi**
   ```bash
   cp .env.production.example .env.production
   ```
   - Isi kredensial (mail, storage, dsb).  
   - Buat `APP_KEY` langsung lewat kontainer:
     ```bash
     docker compose -f docker/docker-compose.prod.yml --env-file .env.production run --rm app php artisan key:generate --show
     ```
     Salin nilai yang muncul ke `APP_KEY` di `.env.production`.

3. **Bangun & jalankan stack**
   ```bash
   docker compose -f docker/docker-compose.prod.yml --env-file .env.production up -d --build
   ```
   - Service yang naik: `app` (PHP-FPM), `queue` (Supervisor queue:work), `web` (Nginx), `postgres`, `redis`.
   - Entry point otomatis menjalankan:
     - perbaikan izin (`chown/chmod`) pada `storage` & `bootstrap/cache`
     - `php artisan storage:link`
     - `php artisan migrate --force --seed`
     - `php artisan optimize:clear` dan `php artisan optimize`

4. **Verifikasi**
   ```bash
   docker compose -f docker/docker-compose.prod.yml ps
   docker compose -f docker/docker-compose.prod.yml logs -f app queue web
   ```
   - Buka `http://todo.karirkit.web.id` (aktifkan HTTPS via reverse proxy/Certbot jika perlu).

5. **Operasional harian**
   ```bash
   # Artisan tambahan
   docker compose -f docker/docker-compose.prod.yml --env-file .env.production exec app php artisan migrate --force
   docker compose -f docker/docker-compose.prod.yml --env-file .env.production exec app php artisan optimize

   # Cek worker
   docker compose -f docker/docker-compose.prod.yml --env-file .env.production exec queue supervisorctl status

   # Backup database
   docker compose -f docker/docker-compose.prod.yml --env-file .env.production exec postgres pg_dump -U postgres laravel > backup.sql
   ```
   - Volume persisten: `postgres_data`, `redis_data`, `storage_data`, `bootstrap_cache`. Pastikan dijadwalkan backup.

6. **Deploy pembaruan**
   ```bash
   git pull
   docker compose -f docker/docker-compose.prod.yml --env-file .env.production up -d --build
   ```
   - Setelah deploy, jalankan kembali `migrate --force` jika ada migrasi baru.

> Semua path internal kontainer menunjuk ke `/var/www/laravel-todo`, sehingga repo wajib berada di path yang sama di VPS.
