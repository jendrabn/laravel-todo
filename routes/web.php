<?php

use App\Http\Controllers\TodoAppController;
use Illuminate\Support\Facades\Route;

Route::get('/', TodoAppController::class)->name('app.dashboard');

Route::get('/docs/openapi.yaml', function () {
    $path = resource_path('openapi/todo-api.yaml');

    abort_unless(file_exists($path), 404);

    return response()->file($path, [
        'Content-Type' => 'application/yaml',
    ]);
})->name('docs.openapi');

Route::view('/docs/swagger', 'swagger')->name('docs.swagger');
