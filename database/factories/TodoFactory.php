<?php

namespace Database\Factories;

use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends \Illuminate\Database\Eloquent\Factories\Factory<\App\Models\Todo>
 */
class TodoFactory extends Factory
{
    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'user_id' => User::factory(),
            'title' => \fake()->sentence(4),
            'description' => \fake()->optional()->paragraph(),
            'is_completed' => \fake()->boolean(20),
            'due_at' => \fake()->optional()->dateTimeBetween('now', '+2 months'),
        ];
    }
}
