import { createContext, useState, useEffect, useContext } from 'react';

const AuthContext = createContext();

export function AuthProvider({ children }) {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // Load user from local storage on startup (Mock Auth)
        const storedUser = localStorage.getItem('sxr_user');
        if (storedUser) {
            setUser(JSON.parse(storedUser));
        }
        setLoading(false);
    }, []);

    const apiBase = import.meta.env.VITE_API_URL || '';

    const login = async (email, password) => {
        try {
            const res = await fetch(`${apiBase}/api/auth/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password })
            });
            const data = await res.json();

            if (!res.ok) {
                throw new Error(data.error || 'Login failed');
            }

            setUser(data.user);
            localStorage.setItem('sxr_user', JSON.stringify(data.user));
            localStorage.setItem('sxr_token', data.token);
            return data.user;
        } catch (error) {
            throw error;
        }
    };

    const signup = async (name, email, password) => {
        try {
            const res = await fetch(`${apiBase}/api/auth/signup`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, email, password })
            });
            const data = await res.json();

            if (!res.ok) {
                throw new Error(data.error || 'Signup failed');
            }

            setUser(data.user);
            localStorage.setItem('sxr_user', JSON.stringify(data.user));
            localStorage.setItem('sxr_token', data.token);
            return data.user;
        } catch (error) {
            throw error;
        }
    };

    const updateProfile = async (updates) => {
        try {
            const token = localStorage.getItem('sxr_token');
            const res = await fetch(`${apiBase}/api/auth/profile`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(updates)
            });
            const data = await res.json();

            if (!res.ok) {
                throw new Error(data.error || 'Update failed');
            }

            setUser(data.user);
            localStorage.setItem('sxr_user', JSON.stringify(data.user));
            return data.user;
        } catch (error) {
            throw error;
        }
    };

    const logout = () => {
        setUser(null);
        localStorage.removeItem('sxr_user');
        localStorage.removeItem('sxr_token');
    };

    return (
        <AuthContext.Provider value={{ user, login, signup, logout, updateProfile, loading }}>
            {children}
        </AuthContext.Provider>
    );
}

export const useAuth = () => useContext(AuthContext);
