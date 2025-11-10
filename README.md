## Deployment (Docker on Ubuntu VPS)

1. **Clone project**
   ```bash
   sudo mkdir -p /var/www
   cd /var/www
   sudo git clone <repo-url> laravel-todo
   cd laravel-todo
   sudo cp .env.example .env
   sudo chown -R $USER:$USER /var/www/laravel-todo
   ```
2. **Configure environment**
   - Set `APP_KEY` later via `php artisan key:generate`.
   - Update `.env` database values:
     ```
     DB_CONNECTION=mysql
     DB_HOST=mysql
     DB_PORT=3306
     DB_DATABASE=laravel_todo
     DB_USERNAME=root
     DB_PASSWORD=
     ```
     (Kosongkan `DB_PASSWORD` karena root tidak memakai password.)
3. **Install dependencies inside containers**
   ```bash
   docker compose run --rm composer install --no-dev --optimize-autoloader
   docker compose run --rm npm install
   docker compose run --rm npm run build
   ```
4. **Generate APP_KEY**
   ```bash
   docker compose run --rm php php artisan key:generate --force
   ```
5. **Bring services up**
   ```bash
   docker compose up -d --build
   ```
6. **Run database migrations (and seed if desired)**
   ```bash
   docker compose exec php php artisan migrate --force
   docker compose exec php php artisan db:seed --force
   ```
7. **Refresh caches manually (inside container)**
   ```bash
   docker compose exec php php artisan optimize:clear
   docker compose exec php php artisan optimize
   ```
8. **Verify**
   - Visit `http://<server-ip>/` for the app and `http://<server-ip>/docs/swagger` for the API docs.
   - Ensure ports 80 (HTTP) and 3306 (if remote DB access required) are allowed through the firewall.

> The stack uses PHP 8.4 FPM, Nginx 1.25, MySQL 8, and dedicated Composer/NPM helper containers. Source code mounts at `/var/www/laravel-todo` inside every container so that host edits are instantly available.

## CI/CD (GitHub Actions)

- Workflow `.github/workflows/deploy.yml` runs automatically on every push to `main` (or manually via **Run workflow**).
- Job order:
  1. Run PHP tests on Ubuntu with PHP 8.4.
  2. If tests pass, SSH into the VPS and execute the same Docker Compose steps described above (`docker compose pull && docker compose up -d --build --remove-orphans`, followed by migrations and cache refresh).
- Required repository secrets:
  - `DEPLOY_HOST`: VPS hostname or IP.
  - `DEPLOY_PORT`: SSH port (use `22` if unsure).
  - `DEPLOY_USER`: SSH user with access to the project directory.
  - `DEPLOY_KEY`: Private SSH key (base64 not needed; paste raw key).
  - `DEPLOY_PATH`: Absolute path to `/var/www/laravel-todo` (or your custom path).
  - `DEPLOY_BRANCH` (optional): Branch to deploy; defaults to `main`.
- The workflow uses `appleboy/ssh-action` to run remote commands non-interactively. Ensure the specified user can run Docker without sudo or configure passwordless sudo for `docker`.

### Menyiapkan Server untuk CI/CD

1. **Buat/konfigurasi user deploy (contoh: `deploy`, boleh pakai `ubuntu` jika sudah ada).**
   ```bash
   sudo adduser deploy
   sudo usermod -aG sudo deploy
   ```
   Jika memakai user `ubuntu`, lewati perintah `adduser` tetapi pastikan ia berada di grup `sudo`.

2. **Izinkan user menjalankan Docker tanpa sudo password.**
   ```bash
    sudo usermod -aG docker deploy   # ganti dengan nama user Anda
   ```
   Setelah itu logout/login lagi (atau jalankan `newgrp docker`) supaya izin barunya aktif. Tes dengan `docker ps`. Jika tetap butuh sudo, buat file `/etc/sudoers.d/deploy` berisi `deploy ALL=(ALL) NOPASSWD:ALL`.

3. **Buat pasangan SSH key khusus GitHub Actions.**
   ```bash
   sudo -u deploy ssh-keygen -t ed25519 -C "deploy@laravel-todo" -f /home/deploy/.ssh/github-actions
   ```
   File private key: `/home/deploy/.ssh/github-actions`  
   File public key: `/home/deploy/.ssh/github-actions.pub`

4. **Daftarkan public key ke user tersebut.**
   ```bash
   sudo -u deploy mkdir -p /home/deploy/.ssh
   sudo -u deploy cat /home/deploy/.ssh/github-actions.pub >> /home/deploy/.ssh/authorized_keys
   sudo chmod 700 /home/deploy/.ssh
   sudo chmod 600 /home/deploy/.ssh/authorized_keys
   sudo chown deploy:deploy /home/deploy/.ssh /home/deploy/.ssh/authorized_keys
   ```

5. **Salin private key ke GitHub.**
   ```bash
   sudo cat /home/deploy/.ssh/github-actions
   ```
   Salin seluruh teks (termasuk `BEGIN/END`) dan tempelkan ke secret `DEPLOY_KEY` di GitHub.

6. **Pastikan direktori proyek dimiliki user deploy.**
   ```bash
   sudo chown -R deploy:deploy /var/www/laravel-todo
   ```
   Perintah ini mencegah error seperti “dubious ownership” atau “permission denied” saat workflow menjalankan git/pull.

7. **Isi semua secret GitHub sesuai daftar di atas.**
   - `DEPLOY_HOST`, `DEPLOY_PORT`, `DEPLOY_USER`, `DEPLOY_KEY`, `DEPLOY_PATH`, dan opsional `DEPLOY_BRANCH`.

8. **Uji koneksi manual.**
   Dari laptop Anda (atau lewat `ssh` di server lain), jalankan:
   ```bash
   ssh -i /path/to/github-actions deploy@<ip-server>
   ```
   Jika berhasil tanpa password, workflow akan bisa login juga.

Dengan langkah di atas, workflow “Deploy” bisa menarik kode, membangun Docker, dan menjalankan Artisan tanpa menghadapi masalah izin atau autentikasi.
