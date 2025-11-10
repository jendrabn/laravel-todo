<?php

namespace Tests\Feature;

use App\Models\Todo;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class TodoApiTest extends TestCase
{
    use RefreshDatabase;

    public function test_user_can_register_and_receive_token(): void
    {
        $response = $this->postJson('/api/auth/register', [
            'name' => 'Jane Doe',
            'email' => 'jane@example.com',
            'password' => 'password123',
            'password_confirmation' => 'password123',
            'device_name' => 'iphone',
        ]);

        $response
            ->assertCreated()
            ->assertJsonStructure([
                'token',
                'user' => ['id', 'name', 'email'],
            ]);

        $this->assertDatabaseHas('users', [
            'email' => 'jane@example.com',
        ]);
    }

    public function test_user_can_login_with_valid_credentials(): void
    {
        $user = User::factory()->create([
            'email' => 'john@example.com',
        ]);

        $response = $this->postJson('/api/auth/login', [
            'email' => $user->email,
            'password' => 'password',
            'device_name' => 'postman',
        ]);

        $response
            ->assertOk()
            ->assertJsonStructure([
                'token',
                'user' => ['id', 'name', 'email'],
            ]);
    }

    public function test_user_cannot_login_with_invalid_credentials(): void
    {
        $user = User::factory()->create();

        $response = $this->postJson('/api/auth/login', [
            'email' => $user->email,
            'password' => 'wrong-password',
        ]);

        $response
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['email']);
    }

    public function test_cannot_access_todos_without_authentication(): void
    {
        $this->getJson('/api/todos')->assertUnauthorized();
    }

    public function test_authenticated_user_can_manage_todos(): void
    {
        $user = User::factory()->create();
        $otherUser = User::factory()->create();
        Todo::factory()->for($otherUser)->create();

        Sanctum::actingAs($user);

        $createResponse = $this->postJson('/api/todos', [
            'title' => 'Write documentation',
            'description' => 'Finish the docs for the API',
            'due_at' => now()->addDay()->toISOString(),
        ]);

        $createResponse
            ->assertCreated()
            ->assertJsonPath('data.title', 'Write documentation');

        $todoId = $createResponse->json('data.id');

        $this->getJson('/api/todos')
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.id', $todoId);

        $this->getJson("/api/todos/{$todoId}")
            ->assertOk()
            ->assertJsonPath('data.id', $todoId);

        $updateResponse = $this->putJson("/api/todos/{$todoId}", [
            'title' => 'Write docs',
            'is_completed' => true,
        ]);

        $updateResponse
            ->assertOk()
            ->assertJsonPath('data.is_completed', true)
            ->assertJsonPath('data.title', 'Write docs');

        $this->deleteJson("/api/todos/{$todoId}")
            ->assertNoContent();

        $this->assertDatabaseMissing('todos', [
            'id' => $todoId,
        ]);
    }
}
