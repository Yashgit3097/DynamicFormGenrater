import { useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";

export default function Login() {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);
    const [loginSuccess, setLoginSuccess] = useState(false); // Added this line
    const navigate = useNavigate();
    const baseURL = "https://dynamicformgenrater.onrender.com";

    const handleLogin = async (e) => {
        e.preventDefault();
        setError("");
        setLoginSuccess(false); // Reset success state on new login attempt

        // Basic validation
        if (!email || !password) {
            setError("Please fill in all fields");
            return;
        }

        setLoading(true);
        try {
            const res = await axios.post(`${baseURL}/api/login`, {
                email,
                password
            });

            localStorage.setItem("token", res.data.token);

            // Verify the token before redirecting
            const verifyRes = await axios.get(`${baseURL}/api/verify-token`, {
                headers: { Authorization: `Bearer ${res.data.token}` }
            });

            if (verifyRes.data.isValid) {
                setLoginSuccess(true);
                setTimeout(() => {
                    navigate('/dashboard');
                }, 1500); // Show success message for 1.5 seconds before redirecting
            } else {
                setError("Login verification failed");
                localStorage.removeItem("token");
            }
        } catch (err) {
            setError(err.response?.data?.message || "Login failed. Please check your credentials.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
            <div className="w-full max-w-md p-8 bg-white rounded-lg shadow-xl">
                <div className="text-center mb-8">
                    <h1 className="text-3xl font-bold text-gray-800">Admin Portal</h1>
                    <p className="text-gray-600 mt-2">Sign in to your account</p>
                </div>

                {loginSuccess ? (
                    <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded mb-4">
                        <p className="font-bold">Login successful!</p>
                        <p>Redirecting to dashboard...</p>
                    </div>
                ) : (
                    <form onSubmit={handleLogin} className="space-y-6">
                        {error && (
                            <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
                                <p>{error}</p>
                            </div>
                        )}

                        <div>
                            <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                                Email
                            </label>
                            <input
                                id="email"
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                placeholder="admin@example.com"
                                required
                            />
                        </div>

                        <div>
                            <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
                                Password
                            </label>
                            <input
                                id="password"
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                placeholder="••••••••"
                                required
                            />
                        </div>

                        <div>
                            <button
                                type="submit"
                                disabled={loading}
                                className={`w-full flex justify-center py-3 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 ${loading ? 'opacity-70 cursor-not-allowed' : ''}`}
                            >
                                {loading ? (
                                    <>
                                        <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                        </svg>
                                        Signing in...
                                    </>
                                ) : (
                                    'Sign in'
                                )}
                            </button>
                        </div>
                    </form>
                )}

                <div className="mt-6 text-center text-sm text-gray-500">
                    <p>Don't have an account? Contact support</p>
                </div>
            </div>
        </div>
    );
}