// 🔄 Updated Dashboard.jsx with Delete Submission from Live View

import { useState, useEffect } from "react";
import axios from "axios";
import { Link, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";

export default function Dashboard() {
    const [events, setEvents] = useState([]);
    const [name, setName] = useState("");
    const [desc, setDesc] = useState("");
    const [fields, setFields] = useState([]);
    const [expiresAt, setExpiresAt] = useState("");
    const [countdowns, setCountdowns] = useState({});
    const [liveViewData, setLiveViewData] = useState(null);
    const [selectedEvent, setSelectedEvent] = useState(null);
    const [isLoading, setIsLoading] = useState(false);
    const [isCreating, setIsCreating] = useState(false);
    const [isCopied, setIsCopied] = useState(false);
    const [error, setError] = useState("");
    const baseURL = "https://dynamicformgenrater.onrender.com";
    const navigate = useNavigate();

    const token = localStorage.getItem("token");

    const loadEvents = async () => {
        try {
            const res = await axios.get(`${baseURL}/api/events`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            setEvents(res.data);
        } catch (err) {
            if (err.response?.status === 401) {
                localStorage.removeItem("token");
                navigate("/");
            }
        }
    };

    useEffect(() => {
        loadEvents();
        const interval = setInterval(loadEvents, 5000);
        return () => clearInterval(interval);
    }, []);

    useEffect(() => {
        const timer = setInterval(() => {
            const newCountdowns = {};
            events.forEach(event => {
                const diff = new Date(event.expiresAt) - new Date();
                newCountdowns[event._id] = diff <= 0 ? 'Expired' : `${Math.floor((diff / (1000 * 60 * 60)) % 24)}h ${Math.floor((diff / 1000 / 60) % 60)}m ${Math.floor((diff / 1000) % 60)}s`;
            });
            setCountdowns(newCountdowns);
        }, 1000);
        return () => clearInterval(timer);
    }, [events]);

    const createEvent = async () => {
        if (!name || !expiresAt) {
            setError("Event name and expiry date are required");
            return;
        }
        setIsCreating(true);
        setError("");
        try {
            await axios.post(`${baseURL}/api/events`, { name, description: desc, fields, expiresAt }, { headers: { Authorization: `Bearer ${token}` } });
            loadEvents();
            setName(""); setDesc(""); setFields([]); setExpiresAt("");
        } catch (err) {
            setError(err.response?.data?.message || "Failed to create event");
        } finally {
            setIsCreating(false);
        }
    };

    const addField = () => setFields([...fields, { label: "", type: "text" }]);
    const handleFieldChange = (i, key, value) => {
        const newFields = [...fields];
        newFields[i][key] = value;
        setFields(newFields);
    };
    const removeField = (index) => {
        const newFields = [...fields];
        newFields.splice(index, 1);
        setFields(newFields);
    };

    const fetchLiveView = async (eventId) => {
        setIsLoading(true);
        try {
            const res = await axios.get(`${baseURL}/api/events/${eventId}/live-view`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            setLiveViewData(res.data);
            setSelectedEvent(eventId);
        } catch (err) {
            alert("Failed to load live view");
        } finally {
            setIsLoading(false);
        }
    };

    const refreshLiveView = async () => {
        if (selectedEvent) await fetchLiveView(selectedEvent);
    };

    const deleteSubmission = async (submissionId) => {
        if (!selectedEvent || !submissionId) return;
        if (!window.confirm("Are you sure you want to delete this submission?")) return;
        try {
            await axios.delete(`${baseURL}/api/events/${selectedEvent}/submissions/${submissionId}`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            await fetchLiveView(selectedEvent);
        } catch (err) {
            alert("Failed to delete submission.");
        }
    };

    const closeLiveView = () => {
        setLiveViewData(null);
        setSelectedEvent(null);
    };

    const handleLogout = () => {
        localStorage.removeItem("token");
        navigate("/");
    };

    return (
        <div className="p-4">
            <div className="flex justify-between mb-4">
                <h1 className="text-2xl font-bold">Dashboard</h1>
                <button onClick={handleLogout} className="bg-red-500 text-white px-4 py-2 rounded">Logout</button>
            </div>

            {/* Live View Modal */}
            <AnimatePresence>
                {liveViewData && (
                    <motion.div
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center p-4 z-50"
                    >
                        <motion.div
                            initial={{ scale: 0.9 }} animate={{ scale: 1 }} exit={{ scale: 0.9 }}
                            className="bg-white p-4 rounded-lg shadow-lg w-full max-w-5xl overflow-auto max-h-[90vh]"
                        >
                            <div className="flex justify-between items-center mb-4">
                                <h2 className="text-xl font-semibold">Live View: {liveViewData.eventName}</h2>
                                <div className="flex gap-2">
                                    <button onClick={refreshLiveView} className="bg-blue-500 text-white px-4 py-1 rounded">Refresh</button>
                                    <button onClick={closeLiveView} className="bg-red-500 text-white px-4 py-1 rounded">Close</button>
                                </div>
                            </div>
                            <div className="overflow-auto">
                                <table className="min-w-full border">
                                    <thead className="bg-gray-100">
                                        <tr>
                                            {liveViewData.fields.map((field, i) => (
                                                <th key={i} className="border px-3 py-2 text-left">{field}</th>
                                            ))}
                                            <th className="border px-3 py-2">Submitted At</th>
                                            <th className="border px-3 py-2">Action</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {liveViewData.submissions.map((row, rowIndex) => (
                                            <tr key={rowIndex} className="even:bg-gray-50">
                                                {liveViewData.fields.map((field, i) => (
                                                    <td key={i} className="border px-3 py-2">{row[field]}</td>
                                                ))}
                                                <td className="border px-3 py-2">{row.createdAt}</td>
                                                <td className="border px-3 py-2">
                                                    <button
                                                        onClick={() => deleteSubmission(row._id)}
                                                        className="bg-red-500 text-white px-2 py-1 rounded text-xs"
                                                    >🗑️ Delete</button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                            <p className="text-sm text-gray-500 mt-2">
                                Total Submissions: {liveViewData.submissions.length}
                            </p>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
} 
