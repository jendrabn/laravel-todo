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

## Otomasi Deploy via GitHub Actions

Workflow `.github/workflows/ci-cd.yml` menangani build & deploy otomatis. Berikut cara memakainya:

### 1. Persiapan pertama kali
1. Pastikan server sudah mengikuti langkah "Deployment" di atas (repo berada di `DEPLOY_PATH`, `.env.production` terisi, Docker Compose dapat dijalankan manual).
2. Tambahkan secrets di GitHub Repository Settings > Secrets and variables > Actions:
   - `GHCR_USERNAME` dan `GHCR_TOKEN` (Personal Access Token dengan scope `write:packages` untuk push image ke GHCR).
   - `SSH_HOST`, `SSH_USER`, `SSH_KEY` (private key format PEM), opsional `SSH_PORT` jika tidak 22.
   - `DEPLOY_PATH` (mis. `/var/www/laravel-todo`).
3. Opsional: jalankan workflow secara manual di tab Actions (pilih "CI/CD" lalu "Run workflow") setelah secrets terisi untuk memastikan koneksi SSH dan Docker Compose di server siap.

### 2. Deploy saat ada update kode
1. Buat branch atau pull request seperti biasa. Workflow otomatis menjalankan job **Validasi & Test** pada setiap push/PR untuk memastikan lint, build aset, dan test lulus.
2. Setelah PR digabung ke `main`, push tersebut akan memicu urutan:
   - **tests**: install dependensi, build aset, migrasi database testing, jalankan Pint, lalu `php artisan test`.
   - **build-images**: membangun image `app` dan `nginx` dari `docker/Dockerfile.prod`, men-tag `ghcr.io/<org>/<repo>-{app,nginx}:<sha>` (plus `latest` untuk branch `main`), lalu push ke GHCR.
   - **deploy**: SSH ke server, `git reset --hard origin/main`, membuat `.env.production.ci` yang meng-override `APP_SERVICE_IMAGE` dan `NGINX_SERVICE_IMAGE` sesuai tag terbaru, kemudian menjalankan `docker compose -f docker/docker-compose.prod.yml --env-file .env.production.ci up -d --remove-orphans`.
3. Pantau hasil di tab Actions. Jika deploy gagal, periksa log job lalu gunakan tombol "Re-run jobs" setelah memperbaiki penyebabnya.

### 3. Deploy manual (jika butuh hotfix tanpa commit baru)
1. Buka tab Actions, pilih workflow "CI/CD", klik **Run workflow**, dan pilih branch `main`.
2. Workflow akan menjalankan semua job (tests, build, deploy) walaupun tidak ada commit baru. Ini berguna untuk redeploy cepat jika server bermasalah.
