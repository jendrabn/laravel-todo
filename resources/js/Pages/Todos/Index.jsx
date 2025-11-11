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
    X,
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
    const [isTodoModalOpen, setIsTodoModalOpen] = useState(false);

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

    const openTodoModal = (todo = null) => {
        if (todo) {
            setSelectedTodo(todo);
            setForm({
                title: todo.title,
                description: todo.description ?? '',
                due_at: todo.due_at ? dayjs(todo.due_at).format('YYYY-MM-DDTHH:mm') : '',
            });
        } else {
            resetForm();
        }
        setFormErrors({});
        setIsTodoModalOpen(true);
    };

    const closeTodoModal = () => {
        setIsTodoModalOpen(false);
        resetForm();
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

            closeTodoModal();
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
                setIsTodoModalOpen(false);
            }
            fetchData();
        } catch (error) {
            handleApiErrors(error, 'Gagal menghapus tugas');
        }
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
            showToast(authMode === 'login' ? 'Selamat datang kembali!' : 'Registrasi berhasil!');
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
            setIsTodoModalOpen(false);
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
            <div className="min-h-screen bg-slate-50">
                <div className="mx-auto max-w-6xl px-4 pb-24 pt-16 sm:px-6 lg:px-8">
                    <header className="flex flex-col gap-8 rounded-3xl border border-slate-200 bg-white p-8 shadow-2xl shadow-slate-200/70">
                        <div className="flex flex-wrap items-center gap-4">
                            <div>
                                <p className="text-sm font-semibold uppercase tracking-widest text-indigo-500">
                                    {app?.name ?? 'Laravel Todo'}
                                </p>
                                <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">
                                    {heroTitle}
                                </h1>
                                <p className="mt-3 max-w-2xl text-base text-slate-600">{heroSubtitle}</p>
                            </div>
                            {token && (
                                <div className="ml-auto flex flex-wrap items-center gap-3">
                                    <button
                                        onClick={() => openTodoModal()}
                                        className="inline-flex items-center gap-2 rounded-full bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-500"
                                    >
                                        <Plus className="h-4 w-4" />
                                        Tambah Tugas
                                    </button>
                                    <button
                                        onClick={logout}
                                        className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-50"
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
                                                    ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-200/70'
                                                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200',
                                            )}
                                        >
                                            {item.label}
                                        </button>
                                    ))}
                                </div>
                            )}

                            <div className="space-y-4">
                                {isLoadingTodos && (
                                    <div className="rounded-2xl border border-slate-200 bg-white p-6 text-center text-sm text-slate-600">
                                        Memuat data terbaru...
                                    </div>
                                )}

                                {!isLoadingTodos && filteredTodos.length === 0 && token && (
                                    <div className="rounded-3xl border border-dashed border-slate-300 bg-white px-8 py-12 text-center">
                                        <CalendarCheck2 className="mx-auto h-10 w-10 text-indigo-500" />
                                        <p className="mt-4 text-lg font-semibold text-slate-900">
                                            Belum ada tugas pada filter ini
                                        </p>
                                        <p className="mt-2 text-sm text-slate-600">
                                            Klik tombol "Tambah Tugas" untuk membuat rencana pertamamu.
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
                                            className="group rounded-3xl border border-slate-200 bg-white p-6 shadow-lg shadow-slate-200/70 transition hover:border-indigo-200"
                                        >
                                            <div className="flex flex-wrap items-start gap-4">
                                                <button
                                                    onClick={() => toggleTodo(todo)}
                                                    className={clsx(
                                                        'flex h-11 w-11 items-center justify-center rounded-2xl border transition',
                                                        todo.is_completed
                                                            ? 'border-emerald-200 bg-emerald-50 text-emerald-600'
                                                            : 'border-slate-200 bg-white text-slate-400 hover:border-indigo-200 hover:text-indigo-500',
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
                                                        <h3 className="text-lg font-semibold text-slate-900">{todo.title}</h3>
                                                        {todo.is_completed ? (
                                                            <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-600">
                                                                Selesai
                                                            </span>
                                                        ) : todo.due_at ? (
                                                            <span className="rounded-full bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-600">
                                                                {dayjs(todo.due_at).isBefore(dayjs()) ? 'Terlambat' : 'On track'}
                                                            </span>
                                                        ) : null}
                                                    </div>
                                                    {todo.description && (
                                                        <p className="text-sm text-slate-600">{todo.description}</p>
                                                    )}
                                                    <div className="flex flex-wrap gap-4 text-xs text-slate-500">
                                                        <span className="inline-flex items-center gap-2">
                                                            <Clock3 className="h-4 w-4 text-indigo-500" />
                                                            {formatDate(todo.due_at)}
                                                        </span>
                                                    </div>
                                                </div>

                                                <div className="flex gap-2">
                                                    <button
                                                        onClick={() => openTodoModal(todo)}
                                                        className="rounded-full border border-slate-200 bg-white p-2 text-slate-500 hover:border-indigo-200 hover:text-indigo-500"
                                                    >
                                                        <PencilLine className="h-5 w-5" />
                                                    </button>
                                                    <button
                                                        onClick={() => destroyTodo(todo)}
                                                        className="rounded-full border border-rose-200 bg-rose-50 p-2 text-rose-500 hover:bg-rose-100"
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
                                <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-lg shadow-slate-200/70">
                                    <div className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-indigo-600">
                                        <Plus className="h-4 w-4" />
                                        Kelola tugas
                                    </div>
                                    <p className="mt-3 text-sm text-slate-600">
                                        Gunakan modal untuk membuat rencana baru atau menyunting tugas yang sudah ada. Semua
                                        perubahan akan langsung tersinkron ke daftar sebelah kiri.
                                    </p>
                                    <div className="mt-6 flex flex-col gap-3">
                                        <button
                                            onClick={() => openTodoModal()}
                                            className="inline-flex items-center justify-center gap-2 rounded-2xl bg-indigo-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-indigo-500"
                                        >
                                            <Plus className="h-4 w-4" />
                                            Tugas Baru
                                        </button>
                                        <button
                                            onClick={fetchData}
                                            className="rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-600 transition hover:bg-slate-50"
                                        >
                                            Segarkan Daftar
                                        </button>
                                    </div>
                                </div>
                            )}
                        </aside>
                    </main>
                    <TodoModal
                        isOpen={isTodoModalOpen}
                        onClose={closeTodoModal}
                        onSubmit={persistTodo}
                        form={form}
                        setForm={setForm}
                        formErrors={formErrors}
                        isSaving={isSaving}
                        selectedTodo={selectedTodo}
                    />
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
                gradient="from-indigo-50 to-white"
            />
            <StatCard
                icon={CheckCircle2}
                label="Selesai"
                value={stats.completed}
                chip="streak"
                gradient="from-emerald-50 to-white"
            />
            <StatCard
                icon={Clock3}
                label="Mendesak"
                value={stats.overdue}
                chip="perlu fokus"
                gradient="from-orange-50 to-white"
            />
        </div>
    );
}

function StatCard({ icon: Icon, label, value, chip, gradient }) {
    return (
        <div
            className={clsx(
                'rounded-3xl border border-slate-200 bg-gradient-to-br p-4 text-slate-900 shadow-lg shadow-slate-200/70',
                gradient,
            )}
        >
            <div className="flex items-start justify-between">
                <div>
                    <p className="text-sm uppercase tracking-widest text-slate-500">{label}</p>
                    <p className="mt-2 text-3xl font-semibold text-slate-900">{value}</p>
                </div>
                <div className="rounded-2xl bg-white/80 p-3 text-slate-600">
                    <Icon className="h-5 w-5" />
                </div>
            </div>
            <span className="mt-4 inline-flex rounded-full bg-white/80 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-slate-600">
                {chip}
            </span>
        </div>
    );
}

function Field({ label, error, input }) {
    return (
        <label className="mb-5 block space-y-2 text-sm text-slate-600 last:mb-0">
            <span className="font-semibold text-slate-900">{label}</span>
            {input}
            {error && <p className="text-xs text-rose-600">{Array.isArray(error) ? error[0] : error}</p>}
        </label>
    );
}

function AuthCard({ authMode, setAuthMode, authForm, setAuthForm, authErrors, authLoading, submitAuth }) {
    return (
        <div className="mx-auto w-full max-w-xl rounded-3xl border border-slate-200 bg-white p-6 shadow-lg shadow-slate-200/70">
            <div className="flex flex-col gap-3 sm:flex-row">
                <button
                    onClick={() => setAuthMode('login')}
                    className={clsx(
                        'w-full flex-1 items-center justify-center gap-2 rounded-2xl border px-4 py-3 text-sm font-semibold transition sm:flex sm:px-6',
                        authMode === 'login'
                            ? 'border-transparent bg-indigo-600 text-white shadow-sm'
                            : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50',
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
                        'w-full flex-1 items-center justify-center gap-2 rounded-2xl border px-4 py-3 text-sm font-semibold transition sm:flex sm:px-6',
                        authMode === 'register'
                            ? 'border-transparent bg-emerald-500 text-white shadow-sm'
                            : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50',
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
                                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-900 placeholder:text-slate-400 focus:border-emerald-400 focus:outline-none"
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
                            className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-900 placeholder:text-slate-400 focus:border-indigo-400 focus:outline-none"
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
                            className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-900 placeholder:text-slate-400 focus:border-indigo-400 focus:outline-none"
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
                                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-900 placeholder:text-slate-400 focus:border-emerald-400 focus:outline-none"
                                placeholder="Ulangi password"
                            />
                        }
                    />
                )}

                <button
                    type="submit"
                    disabled={authLoading}
                    className="w-full rounded-2xl bg-indigo-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-indigo-500 disabled:opacity-60"
                >
                    {authMode === 'login' ? 'Masuk & Sinkronkan' : 'Buat Akun Baru'}
                </button>
            </form>
        </div>
    );
}

function TodoModal({ isOpen, onClose, onSubmit, form, setForm, formErrors, isSaving, selectedTodo }) {
    if (!isOpen) {
        return null;
    }

    const handleWrapperClick = (event) => {
        event.stopPropagation();
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 px-4 py-6" onClick={onClose}>
            <div
                className="w-full max-w-2xl rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl shadow-slate-900/20"
                onClick={handleWrapperClick}
            >
                <div className="flex items-start justify-between gap-4">
                    <div>
                        <p className="text-sm font-semibold uppercase tracking-wide text-indigo-600">
                            {selectedTodo ? 'Edit Tugas' : 'Tugas Baru'}
                        </p>
                        <h2 className="text-2xl font-semibold text-slate-900">
                            {selectedTodo ? 'Perbarui rincian tugas' : 'Tambah rencana baru'}
                        </h2>
                        <p className="mt-1 text-sm text-slate-500">
                            Isi judul, detail, dan deadline untuk menjaga ritme produktifmu.
                        </p>
                    </div>
                    <button
                        onClick={onClose}
                        className="rounded-full border border-slate-200 p-2 text-slate-500 transition hover:border-slate-300 hover:text-slate-700"
                        aria-label="Tutup modal"
                    >
                        <X className="h-5 w-5" />
                    </button>
                </div>

                <form onSubmit={onSubmit} className="mt-6 space-y-5">
                    <Field
                        label="Judul"
                        error={formErrors.title}
                        input={
                            <input
                                type="text"
                                value={form.title}
                                onChange={(event) => setForm((prev) => ({ ...prev, title: event.target.value }))}
                                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-900 placeholder:text-slate-400 focus:border-indigo-400 focus:outline-none"
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
                                onChange={(event) => setForm((prev) => ({ ...prev, description: event.target.value }))}
                                rows={3}
                                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-900 placeholder:text-slate-400 focus:border-indigo-400 focus:outline-none"
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
                                onChange={(event) => setForm((prev) => ({ ...prev, due_at: event.target.value }))}
                                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-900 focus:border-indigo-400 focus:outline-none"
                            />
                        }
                    />

                    <div className="flex flex-wrap gap-3 pt-2">
                        <button
                            type="submit"
                            disabled={isSaving}
                            className="inline-flex flex-1 items-center justify-center gap-2 rounded-2xl bg-indigo-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-indigo-500 disabled:opacity-60"
                        >
                            <Plus className="h-4 w-4" />
                            {selectedTodo ? 'Simpan Perubahan' : 'Tambah Tugas'}
                        </button>
                        <button
                            type="button"
                            onClick={onClose}
                            className="rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-600 transition hover:bg-slate-50"
                        >
                            Batalkan
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
