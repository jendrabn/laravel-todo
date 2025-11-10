import { Head } from '@inertiajs/react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import api, { tokenStore } from '@/lib/api';
import clsx from 'clsx';
import dayjs from 'dayjs';
import {
    CalendarCheck2,
    CheckCircle2,
    Circle,
    Clock3,
    LogIn,
    LogOut,
    PencilLine,
    Plus,
    Trash2,
    UserPlus,
} from 'lucide-react';

const statusFilters = [
    { key: 'all', label: 'Semua' },
    { key: 'active', label: 'Belum Selesai' },
    { key: 'completed', label: 'Selesai' },
];

const emptyTodoForm = {
    title: '',
    description: '',
    due_at: '',
};

const emptyAuthForm = {
    name: '',
    email: '',
    password: '',
    password_confirmation: '',
};

const formatDate = (value) => (value ? dayjs(value).format('DD MMM YYYY HH:mm') : 'Tanpa deadline');

export default function TodosIndex({ app }) {
    const [token, setToken] = useState(tokenStore.get());
    const [user, setUser] = useState(null);
    const [todos, setTodos] = useState([]);
    const [isLoadingTodos, setIsLoadingTodos] = useState(false);
    const [filter, setFilter] = useState('all');
    const [form, setForm] = useState(emptyTodoForm);
    const [formErrors, setFormErrors] = useState({});
    const [isSaving, setIsSaving] = useState(false);
    const [selectedTodo, setSelectedTodo] = useState(null);
    const [toast, setToast] = useState(null);
    const [authMode, setAuthMode] = useState('login');
    const [authForm, setAuthForm] = useState(emptyAuthForm);
    const [authErrors, setAuthErrors] = useState({});
    const [authLoading, setAuthLoading] = useState(false);

    const filteredTodos = useMemo(() => {
        if (filter === 'completed') {
            return todos.filter((todo) => todo.is_completed);
        }

        if (filter === 'active') {
            return todos.filter((todo) => !todo.is_completed);
        }

        return todos;
    }, [filter, todos]);

    const stats = useMemo(() => {
        const total = todos.length;
        const completed = todos.filter((todo) => todo.is_completed).length;
        const overdue = todos.filter(
            (todo) => !todo.is_completed && todo.due_at && dayjs(todo.due_at).isBefore(dayjs()),
        ).length;

        return { total, completed, overdue };
    }, [todos]);

    const showToast = useCallback((message, variant = 'success') => {
        setToast({ message, variant });
        setTimeout(() => setToast(null), 3500);
    }, []);

    const handleApiErrors = useCallback(
        (error, fallback) => {
            if (error?.response?.data?.errors) {
                return error.response.data.errors;
            }

            if (fallback) {
                showToast(fallback, 'error');
            }

            return null;
        },
        [showToast],
    );

    const fetchData = useCallback(async () => {
        if (!token) {
            return;
        }

        setIsLoadingTodos(true);
        try {
            const [userResponse, todoResponse] = await Promise.all([
                api.get('/user'),
                api.get('/todos', { params: { per_page: 50 } }),
            ]);

            setUser(userResponse.data);
            setTodos(todoResponse.data.data);
        } catch (error) {
            handleApiErrors(error, 'Gagal memuat data');
        } finally {
            setIsLoadingTodos(false);
        }
    }, [handleApiErrors, token]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const resetForm = () => {
        setSelectedTodo(null);
        setForm(emptyTodoForm);
        setFormErrors({});
    };

    const persistTodo = async (event) => {
        event.preventDefault();
        setIsSaving(true);
        setFormErrors({});

        const payload = {
            title: form.title,
            description: form.description || null,
            due_at: form.due_at || null,
        };

        try {
            if (selectedTodo) {
                await api.patch(`/todos/${selectedTodo.id}`, payload);
                showToast('Tugas berhasil diperbarui');
            } else {
                await api.post('/todos', payload);
                showToast('Tugas baru berhasil dibuat');
            }

            resetForm();
            fetchData();
        } catch (error) {
            const errors = handleApiErrors(error, 'Tidak dapat menyimpan tugas');
            if (errors) {
                setFormErrors(errors);
            }
        } finally {
            setIsSaving(false);
        }
    };

    const toggleTodo = async (todo) => {
        try {
            await api.patch(`/todos/${todo.id}`, { is_completed: !todo.is_completed });
            fetchData();
        } catch (error) {
            handleApiErrors(error, 'Gagal memperbarui status');
        }
    };

    const destroyTodo = async (todo) => {
        if (!window.confirm(`Hapus "${todo.title}"?`)) {
            return;
        }

        try {
            await api.delete(`/todos/${todo.id}`);
            showToast('Tugas dihapus');
            if (selectedTodo?.id === todo.id) {
                resetForm();
            }
            fetchData();
        } catch (error) {
            handleApiErrors(error, 'Gagal menghapus tugas');
        }
    };

    const selectAsDraft = (todo) => {
        setSelectedTodo(todo);
        setForm({
            title: todo.title,
            description: todo.description ?? '',
            due_at: todo.due_at ? dayjs(todo.due_at).format('YYYY-MM-DDTHH:mm') : '',
        });
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const submitAuth = async (event) => {
        event.preventDefault();
        setAuthLoading(true);
        setAuthErrors({});

        const endpoint = authMode === 'login' ? '/auth/login' : '/auth/register';
        const payload = {
            email: authForm.email,
            password: authForm.password,
            device_name: 'inertia-app',
        };

        if (authMode === 'register') {
            payload.name = authForm.name;
            payload.password_confirmation = authForm.password_confirmation;
        }

        try {
            const { data } = await api.post(endpoint, payload);
            tokenStore.set(data.token);
            setToken(data.token);
            setUser(data.user);
            setAuthForm(emptyAuthForm);
            showToast(authMode === 'login' ? 'Selamat datang kembali!' : 'Registrasi berhasil 🎉');
            fetchData();
        } catch (error) {
            const errors = handleApiErrors(error, 'Gagal memproses akun');
            if (errors) {
                setAuthErrors(errors);
            }
        } finally {
            setAuthLoading(false);
        }
    };

    const logout = async () => {
        try {
            await api.post('/auth/logout');
        } catch (error) {
            //
        } finally {
            tokenStore.set(null);
            setToken(null);
            setTodos([]);
            setUser(null);
            resetForm();
            showToast('Berhasil keluar');
        }
    };

    const heroTitle = user ? `Halo, ${user.name.split(' ')[0]}!` : 'Kelola agenda harianmu dengan santai';
    const heroSubtitle = user
        ? 'Tetap fokus pada prioritas utama, rayakan progres kecil, dan tuntaskan tugas paling penting hari ini.'
        : 'Catat ide, susun prioritas, lalu tandai progressmu dalam satu papan yang modern dan mudah dipakai.';

    return (
        <>
            <Head title="Todo Board" />
            <div className="min-h-screen bg-slate-950">
                <div className="relative isolate">
                    <div className="absolute inset-0 -z-10 bg-gradient-to-br from-slate-900 via-indigo-900/60 to-slate-900 opacity-90" />
                    <div className="absolute inset-x-0 top-0 -z-10 h-72 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-indigo-600/60 via-slate-900 to-slate-950 blur-3xl" />
                    <div className="mx-auto max-w-6xl px-4 pb-24 pt-16 sm:px-6 lg:px-8">
                        <header className="flex flex-col gap-8 rounded-3xl border border-white/10 bg-white/5 p-8 shadow-2xl shadow-indigo-950/20 backdrop-blur">
                            <div className="flex flex-wrap items-center gap-4">
                                <div>
                                    <p className="text-sm font-semibold uppercase tracking-widest text-indigo-300">
                                        {app?.name ?? 'Laravel Todo'}
                                    </p>
                                    <h1 className="mt-2 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
                                        {heroTitle}
                                    </h1>
                                    <p className="mt-3 max-w-2xl text-base text-slate-200">{heroSubtitle}</p>
                                </div>
                                {token && (
                                    <div className="ml-auto">
                                        <button
                                            onClick={logout}
                                            className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/20"
                                        >
                                            <LogOut className="h-4 w-4" />
                                            Keluar
                                        </button>
                                    </div>
                                )}
                            </div>

                            {token && <StatsRow stats={stats} />}
                        </header>

                        <main className="mt-12 grid gap-10 lg:grid-cols-[2fr,1fr]">
                            <section className="space-y-6">
                                {token && (
                                    <div className="flex flex-wrap items-center gap-3">
                                        {statusFilters.map((item) => (
                                            <button
                                                key={item.key}
                                                onClick={() => setFilter(item.key)}
                                                className={clsx(
                                                    'rounded-full px-4 py-2 text-sm font-semibold transition',
                                                    filter === item.key
                                                        ? 'bg-indigo-500/80 text-white shadow-lg shadow-indigo-500/40'
                                                        : 'bg-white/10 text-white hover:bg-white/20',
                                                )}
                                            >
                                                {item.label}
                                            </button>
                                        ))}
                                    </div>
                                )}

                                <div className="space-y-4">
                                    {isLoadingTodos && (
                                        <div className="rounded-2xl border border-white/10 bg-white/5 p-6 text-center text-sm text-slate-200">
                                            Memuat data terbaru...
                                        </div>
                                    )}

                                    {!isLoadingTodos && filteredTodos.length === 0 && token && (
                                        <div className="rounded-3xl border border-dashed border-white/20 bg-white/5 px-8 py-12 text-center">
                                            <CalendarCheck2 className="mx-auto h-10 w-10 text-indigo-400" />
                                            <p className="mt-4 text-lg font-semibold text-white">
                                                Belum ada tugas pada filter ini
                                            </p>
                                            <p className="mt-2 text-sm text-slate-200">
                                                Tambahkan rencana pertama Anda di panel sebelah kanan.
                                            </p>
                                        </div>
                                    )}

                                    {!token && (
                                        <AuthCard
                                            authMode={authMode}
                                            setAuthMode={setAuthMode}
                                            authForm={authForm}
                                            setAuthForm={setAuthForm}
                                            authErrors={authErrors}
                                            authLoading={authLoading}
                                            submitAuth={submitAuth}
                                        />
                                    )}

                                    {token &&
                                        filteredTodos.map((todo) => (
                                            <article
                                                key={todo.id}
                                                className="group rounded-3xl border border-white/10 bg-gradient-to-br from-white/10 via-slate-900/60 to-slate-950 p-6 shadow-lg shadow-slate-950/40 transition hover:border-indigo-400/60"
                                            >
                                                <div className="flex flex-wrap items-start gap-4">
                                                    <button
                                                        onClick={() => toggleTodo(todo)}
                                                        className={clsx(
                                                            'flex h-11 w-11 items-center justify-center rounded-2xl border transition',
                                                            todo.is_completed
                                                                ? 'border-emerald-400/40 bg-emerald-400/10 text-emerald-300'
                                                                : 'border-white/20 bg-white/5 text-white hover:border-indigo-400/40 hover:text-indigo-200',
                                                        )}
                                                    >
                                                        {todo.is_completed ? (
                                                            <CheckCircle2 className="h-5 w-5" />
                                                        ) : (
                                                            <Circle className="h-5 w-5" />
                                                        )}
                                                    </button>

                                                    <div className="flex-1 space-y-2">
                                                        <div className="flex items-center gap-3">
                                                            <h3 className="text-lg font-semibold text-white">{todo.title}</h3>
                                                            {todo.is_completed ? (
                                                                <span className="rounded-full bg-emerald-500/15 px-3 py-1 text-xs font-semibold text-emerald-300">
                                                                    Selesai
                                                                </span>
                                                            ) : todo.due_at ? (
                                                                <span className="rounded-full bg-indigo-500/15 px-3 py-1 text-xs font-semibold text-indigo-200">
                                                                    {dayjs(todo.due_at).isBefore(dayjs()) ? 'Terlambat' : 'On track'}
                                                                </span>
                                                            ) : null}
                                                        </div>
                                                        {todo.description && (
                                                            <p className="text-sm text-slate-200">{todo.description}</p>
                                                        )}
                                                        <div className="flex flex-wrap gap-4 text-xs text-slate-300">
                                                            <span className="inline-flex items-center gap-2">
                                                                <Clock3 className="h-4 w-4 text-indigo-300" />
                                                                {formatDate(todo.due_at)}
                                                            </span>
                                                        </div>
                                                    </div>

                                                    <div className="flex gap-2">
                                                        <button
                                                            onClick={() => selectAsDraft(todo)}
                                                            className="rounded-full border border-white/15 bg-white/5 p-2 text-white hover:border-indigo-300/60 hover:text-indigo-200"
                                                        >
                                                            <PencilLine className="h-5 w-5" />
                                                        </button>
                                                        <button
                                                            onClick={() => destroyTodo(todo)}
                                                            className="rounded-full border border-rose-400/30 bg-rose-500/10 p-2 text-rose-100 hover:bg-rose-500/20"
                                                        >
                                                            <Trash2 className="h-5 w-5" />
                                                        </button>
                                                    </div>
                                                </div>
                                            </article>
                                        ))}
                                </div>
                            </section>

                            <aside className="space-y-6">
                                {token && (
                                    <form
                                        onSubmit={persistTodo}
                                        className="rounded-3xl border border-white/10 bg-white/5 p-6 shadow-xl shadow-indigo-950/30 backdrop-blur"
                                    >
                                        <div className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-indigo-200">
                                            <Plus className="h-4 w-4" />
                                            {selectedTodo ? 'Perbarui Tugas' : 'Rencana Baru'}
                                        </div>

                                        <div className="mt-6 space-y-5">
                                            <Field
                                                label="Judul"
                                                error={formErrors.title}
                                                input={
                                                    <input
                                                        type="text"
                                                        value={form.title}
                                                        onChange={(event) =>
                                                            setForm((prev) => ({ ...prev, title: event.target.value }))
                                                        }
                                                        className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white placeholder:text-slate-400 focus:border-indigo-400/70 focus:outline-none"
                                                        placeholder="Contoh: Review sprint backlog"
                                                    />
                                                }
                                            />

                                            <Field
                                                label="Deskripsi"
                                                error={formErrors.description}
                                                input={
                                                    <textarea
                                                        value={form.description}
                                                        onChange={(event) =>
                                                            setForm((prev) => ({ ...prev, description: event.target.value }))
                                                        }
                                                        rows={3}
                                                        className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white placeholder:text-slate-400 focus:border-indigo-400/70 focus:outline-none"
                                                        placeholder="Detail tambahan atau langkah kecil..."
                                                    />
                                                }
                                            />

                                            <Field
                                                label="Deadline"
                                                error={formErrors.due_at}
                                                input={
                                                    <input
                                                        type="datetime-local"
                                                        value={form.due_at}
                                                        onChange={(event) =>
                                                            setForm((prev) => ({ ...prev, due_at: event.target.value }))
                                                        }
                                                        className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white focus:border-indigo-400/70 focus:outline-none"
                                                    />
                                                }
                                            />
                                        </div>

                                        <div className="mt-8 flex flex-wrap gap-3">
                                            <button
                                                type="submit"
                                                disabled={isSaving}
                                                className="inline-flex flex-1 items-center justify-center gap-2 rounded-2xl bg-indigo-500 px-4 py-3 text-sm font-semibold text-white transition hover:bg-indigo-400 disabled:opacity-60"
                                            >
                                                <Plus className="h-4 w-4" />
                                                {selectedTodo ? 'Simpan Perubahan' : 'Tambahkan'}
                                            </button>
                                            {selectedTodo && (
                                                <button
                                                    type="button"
                                                    onClick={resetForm}
                                                    className="inline-flex items-center justify-center rounded-2xl border border-white/20 px-4 py-3 text-sm font-semibold text-white hover:border-white/40"
                                                >
                                                    Batalkan
                                                </button>
                                            )}
                                        </div>
                                    </form>
                                )}
                            </aside>
                        </main>
                    </div>
                </div>
            </div>

            {toast && (
                <div className="fixed inset-x-0 bottom-6 z-50 flex justify-center">
                    <div
                        className={clsx(
                            'flex items-center gap-3 rounded-full px-6 py-3 text-sm font-semibold shadow-2xl shadow-black/30',
                            toast.variant === 'error' ? 'bg-rose-500/90 text-white' : 'bg-emerald-500/90 text-emerald-50',
                        )}
                    >
                        {toast.message}
                    </div>
                </div>
            )}
        </>
    );
}

function StatsRow({ stats }) {
    return (
        <div className="grid gap-4 sm:grid-cols-3">
            <StatCard
                icon={Plus}
                label="Total Tugas"
                value={stats.total}
                chip="+ produktif"
                gradient="from-indigo-500/40 to-indigo-400/10"
            />
            <StatCard
                icon={CheckCircle2}
                label="Selesai"
                value={stats.completed}
                chip="streak"
                gradient="from-emerald-500/40 to-emerald-400/10"
            />
            <StatCard
                icon={Clock3}
                label="Tertunda"
                value={stats.overdue}
                chip="perlu fokus"
                gradient="from-orange-500/40 to-amber-400/10"
            />
        </div>
    );
}

function StatCard({ icon: Icon, label, value, chip, gradient }) {
    return (
        <div
            className={clsx(
                'rounded-3xl border border-white/10 bg-gradient-to-br p-4 text-white shadow-lg shadow-black/20',
                gradient,
            )}
        >
            <div className="flex items-start justify-between">
                <div>
                    <p className="text-sm uppercase tracking-widest text-white/70">{label}</p>
                    <p className="mt-2 text-3xl font-semibold">{value}</p>
                </div>
                <div className="rounded-2xl bg-white/10 p-3">
                    <Icon className="h-5 w-5" />
                </div>
            </div>
            <span className="mt-4 inline-flex rounded-full bg-black/20 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-white/80">
                {chip}
            </span>
        </div>
    );
}

function Field({ label, error, input }) {
    return (
        <label className="mb-5 block space-y-2 text-sm text-slate-200 last:mb-0">
            <span className="font-semibold text-white">{label}</span>
            {input}
            {error && <p className="text-xs text-rose-300">{Array.isArray(error) ? error[0] : error}</p>}
        </label>
    );
}

function AuthCard({ authMode, setAuthMode, authForm, setAuthForm, authErrors, authLoading, submitAuth }) {
    return (
        <div className="mx-auto w-full max-w-xl rounded-3xl border border-white/10 bg-white/5 p-6 shadow-lg shadow-black/30 backdrop-blur">
            <div className="flex flex-col gap-3 sm:flex-row">
                <button
                    onClick={() => setAuthMode('login')}
                    className={clsx(
                        'w-full flex-1 items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-semibold transition sm:flex sm:px-6',
                        authMode === 'login'
                            ? 'bg-indigo-500 text-white'
                            : 'bg-white/5 text-white hover:bg-white/10',
                    )}
                >
                    <span className="inline-flex items-center justify-center gap-2">
                        <LogIn className="h-4 w-4" />
                        Masuk
                    </span>
                </button>
                <button
                    onClick={() => setAuthMode('register')}
                    className={clsx(
                        'w-full flex-1 items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-semibold transition sm:flex sm:px-6',
                        authMode === 'register'
                            ? 'bg-emerald-500 text-white'
                            : 'bg-white/5 text-white hover:bg-white/10',
                    )}
                >
                    <span className="inline-flex items-center justify-center gap-2">
                        <UserPlus className="h-4 w-4" />
                        Daftar
                    </span>
                </button>
            </div>

            <form onSubmit={submitAuth} className="mt-6 space-y-5">
                {authMode === 'register' && (
                    <Field
                        label="Nama Lengkap"
                        error={authErrors.name}
                        input={
                            <input
                                type="text"
                                value={authForm.name}
                                onChange={(event) => setAuthForm((prev) => ({ ...prev, name: event.target.value }))}
                                className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white placeholder:text-slate-400 focus:border-emerald-400/70 focus:outline-none"
                                placeholder="Nama Anda"
                            />
                        }
                    />
                )}

                <Field
                    label="Email"
                    error={authErrors.email}
                    input={
                        <input
                            type="email"
                            value={authForm.email}
                            onChange={(event) => setAuthForm((prev) => ({ ...prev, email: event.target.value }))}
                            className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white placeholder:text-slate-400 focus:border-indigo-400/70 focus:outline-none"
                            placeholder="you@example.com"
                        />
                    }
                />

                <Field
                    label="Password"
                    error={authErrors.password}
                    input={
                        <input
                            type="password"
                            value={authForm.password}
                            onChange={(event) => setAuthForm((prev) => ({ ...prev, password: event.target.value }))}
                            className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white placeholder:text-slate-400 focus:border-indigo-400/70 focus:outline-none"
                            placeholder="Minimal 8 karakter"
                        />
                    }
                />

                {authMode === 'register' && (
                    <Field
                        label="Konfirmasi Password"
                        error={authErrors.password_confirmation}
                        input={
                            <input
                                type="password"
                                value={authForm.password_confirmation}
                                onChange={(event) =>
                                    setAuthForm((prev) => ({ ...prev, password_confirmation: event.target.value }))
                                }
                                className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white placeholder:text-slate-400 focus:border-emerald-400/70 focus:outline-none"
                                placeholder="Ulangi password"
                            />
                        }
                    />
                )}

                <button
                    type="submit"
                    disabled={authLoading}
                    className="w-full rounded-2xl bg-indigo-500 px-4 py-3 text-sm font-semibold text-white transition hover:bg-indigo-400 disabled:opacity-60"
                >
                    {authMode === 'login' ? 'Masuk & Sinkronkan' : 'Buat Akun Baru'}
                </button>
            </form>
        </div>
    );
}
