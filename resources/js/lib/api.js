import axios from 'axios';

const tokenKey = 'todo_token';

const api = axios.create({
    baseURL: '/api',
    headers: {
        Accept: 'application/json',
    },
});

const applyTokenHeader = (token) => {
    if (token) {
        api.defaults.headers.common.Authorization = `Bearer ${token}`;
    } else {
        delete api.defaults.headers.common.Authorization;
    }
};

const bootstrapToken = () => {
    if (typeof window === 'undefined') {
        return;
    }

    const existing = window.localStorage.getItem(tokenKey);
    if (existing) {
        applyTokenHeader(existing);
    }
};

bootstrapToken();

api.interceptors.request.use((config) => {
    const token = typeof window === 'undefined' ? null : window.localStorage.getItem(tokenKey);
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }

    return config;
});

api.interceptors.response.use(
    (response) => response,
    (error) => {
        if (error?.response?.status === 401 && typeof window !== 'undefined') {
            window.localStorage.removeItem(tokenKey);
            applyTokenHeader(null);
        }

        return Promise.reject(error);
    },
);

export const tokenStore = {
    get: () => (typeof window === 'undefined' ? null : window.localStorage.getItem(tokenKey)),
    set: (value) => {
        if (typeof window === 'undefined') {
            return;
        }

        if (value) {
            window.localStorage.setItem(tokenKey, value);
            applyTokenHeader(value);
        } else {
            window.localStorage.removeItem(tokenKey);
            applyTokenHeader(null);
        }
    },
    key: tokenKey,
};

export default api;
