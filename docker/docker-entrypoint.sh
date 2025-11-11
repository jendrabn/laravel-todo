#!/usr/bin/env bash
# Skrip entrypoint produksi untuk menyiapkan environment Laravel sebelum PHP-FPM berjalan
set -euo pipefail

umask 002

ARTISAN="php artisan"

# Menjalankan perintah sebagai user www-data bila kontainer berjalan sebagai root
run_as_www() {
    if [ "$(id -u)" -eq 0 ]; then
        su -s /bin/bash www-data -c "$*"
    else
        bash -lc "$*"
    fi
}

# Eksekusi artisan dengan retry agar tidak gagal ketika database belum siap
retry_artisan() {
    local cmd="$1"
    local attempt=0
    local max_attempts="${ARTISAN_RETRY_ATTEMPTS:-10}"
    local sleep_seconds="${ARTISAN_RETRY_SLEEP:-5}"

    until run_as_www "$ARTISAN $cmd"; do
        attempt=$((attempt + 1))
        if [ "$attempt" -ge "$max_attempts" ]; then
            echo "Failed to run '$ARTISAN $cmd' after ${max_attempts} attempts" >&2
            return 1
        fi
        echo "Retrying '$ARTISAN $cmd' in ${sleep_seconds}s (attempt ${attempt}/${max_attempts})..."
        sleep "$sleep_seconds"
    done
}

# Membuat folder storage/cache dan memastikan hak akses sesuai kebutuhan Laravel
prepare_storage() {
    mkdir -p storage/app/public storage/framework/cache storage/framework/sessions storage/framework/views storage/logs bootstrap/cache
    chown -R www-data:www-data storage bootstrap/cache
    chmod -R ug+rwx storage bootstrap/cache
}

# Perbaiki izin hanya jika tidak diminta untuk dilewati
if [ "${SKIP_PERMISSION_FIXES:-false}" != "true" ]; then
    prepare_storage
fi

# Pastikan symbolic link storage/public tersedia sehingga asset dapat diakses
if [ "${RUN_STORAGE_LINK:-true}" = "true" ]; then
    if [ ! -L public/storage ]; then
        run_as_www "$ARTISAN storage:link" || true
    fi
fi

# Jalankan migrasi dan seeder secara paksa agar database up-to-date
if [ "${RUN_MIGRATIONS:-true}" = "true" ]; then
    retry_artisan "migrate --force --seed"
fi

# Bersihkan cache konfigurasi lama sebelum membuat cache baru
if [ "${RUN_OPTIMIZE_CLEAR:-true}" = "true" ]; then
    run_as_www "$ARTISAN optimize:clear"
fi

# Buat cache konfigurasi/route/view agar performa lebih maksimal
if [ "${RUN_OPTIMIZE:-true}" = "true" ]; then
    run_as_www "$ARTISAN optimize"
fi

# Teruskan ke proses utama kontainer (mis. php-fpm)
exec "$@"
