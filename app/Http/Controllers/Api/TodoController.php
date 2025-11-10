<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\TodoStoreRequest;
use App\Http\Requests\TodoUpdateRequest;
use App\Http\Resources\TodoResource;
use App\Models\Todo;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

class TodoController extends Controller
{
    public function index(Request $request): AnonymousResourceCollection
    {
        $perPage = (int) $request->integer('per_page', 15);
        $perPage = max(1, min(100, $perPage));

        $todos = $request->user()
            ->todos()
            ->latest()
            ->paginate($perPage);

        return TodoResource::collection($todos);
    }

    public function store(TodoStoreRequest $request): JsonResponse
    {
        $this->authorize('create', Todo::class);

        $todo = $request->user()
            ->todos()
            ->create($request->validated());

        return TodoResource::make($todo)
            ->response()
            ->setStatusCode(201);
    }

    public function show(Todo $todo): TodoResource
    {
        $this->authorize('view', $todo);

        return TodoResource::make($todo);
    }

    public function update(TodoUpdateRequest $request, Todo $todo): TodoResource
    {
        $this->authorize('update', $todo);

        $todo->update($request->validated());

        return TodoResource::make($todo);
    }

    public function destroy(Todo $todo): Response
    {
        $this->authorize('delete', $todo);

        $todo->delete();

        return response()->noContent();
    }
}
