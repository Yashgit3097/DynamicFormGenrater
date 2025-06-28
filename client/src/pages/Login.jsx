import { useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";

export default function Login() {
    const [email, setEmail] = useState("admin@admin.com");
    const [password, setPassword] = useState("admin@1234");
    const navigate = useNavigate()
    const baseURL = "https://dynamicformgenrater.onrender.com"

    const handleLogin = async (e) => {
        e.preventDefault()
        try {
            const res = await axios.post(`${baseURL}/api/login`, {
                email, password
            });
            localStorage.setItem("token", res.data.token);
            navigate('/dashboard')
        } catch (err) {
            alert("Login failed");
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-100">
            <div className="p-8 bg-white shadow-md rounded w-80">
                <h1 className="text-2xl mb-4 font-bold">Admin Login</h1>
                <input
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    className="w-full mb-3 p-2 border"
                    placeholder="Email"
                />
                <input
                    type="password"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    className="w-full mb-3 p-2 border"
                    placeholder="Password"
                />
                <button
                    type="button"
                    onClick={handleLogin}
                    className="w-full bg-blue-600 text-white py-2 rounded"
                >
                    Login
                </button>
            </div>
        </div>
    );
}
