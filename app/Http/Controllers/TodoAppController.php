<?php

namespace App\Http\Controllers;

use Inertia\Inertia;
use Inertia\Response;

class TodoAppController extends Controller
{
    public function __invoke(): Response
    {
        return Inertia::render('Todos/Index');
    }
}
