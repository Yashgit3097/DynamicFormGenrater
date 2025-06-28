// components/ProtectedRoute.jsx
import { Navigate } from "react-router-dom";
import { useEffect, useState } from "react";
import axios from "axios";

export default function ProtectedRoute({ children }) {
    const [isAuthenticated, setIsAuthenticated] = useState(null);
    const [loading, setLoading] = useState(true);
    const baseURL = "https://dynamicformgenrater.onrender.com";

    useEffect(() => {
        const verifyToken = async () => {
            const token = localStorage.getItem("token");
            if (!token) {
                setIsAuthenticated(false);
                setLoading(false);
                return;
            }

            try {
                const response = await axios.get(`${baseURL}/api/verify-token`, {
                    headers: { Authorization: `Bearer ${token}` }
                });
                setIsAuthenticated(response.data.isValid);
            } catch (err) {
                localStorage.removeItem("token");
                setIsAuthenticated(false);
            } finally {
                setLoading(false);
            }
        };

        verifyToken();
    }, []);

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-100">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
            </div>
        );
    }

    return isAuthenticated ? children : <Navigate to="/" replace />;
}