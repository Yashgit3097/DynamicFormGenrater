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
                if (diff <= 0) {
                    newCountdowns[event._id] = 'Expired';
                } else {
                    const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
                    const minutes = Math.floor((diff / 1000 / 60) % 60);
                    const seconds = Math.floor((diff / 1000) % 60);
                    newCountdowns[event._id] = `${hours}h ${minutes}m ${seconds}s`;
                }
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
            await axios.post(
                `${baseURL}/api/events`,
                {
                    name,
                    description: desc,
                    fields,
                    expiresAt,
                },
                { headers: { Authorization: `Bearer ${token}` } }
            );
            loadEvents();
            setName("");
            setDesc("");
            setFields([]);
            setExpiresAt("");
        } catch (err) {
            setError(err.response?.data?.message || "Failed to create event");
        } finally {
            setIsCreating(false);
        }
    };

    const addField = () => {
        setFields([...fields, { label: "", type: "text" }]);
    };

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

    const downloadCSV = async (id) => {
        try {
            const res = await axios.get(
                `${baseURL}/api/events/${id}/download`,
                {
                    headers: { Authorization: `Bearer ${token}` },
                    responseType: "blob",
                }
            );
            const url = window.URL.createObjectURL(new Blob([res.data]));
            const link = document.createElement("a");
            link.href = url;
            link.setAttribute("download", `submissions_${id}.csv`);
            document.body.appendChild(link);
            link.click();
            link.remove();
        } catch (err) {
            alert("Failed to download CSV");
        }
    };

    const downloadPDF = async (id) => {
        try {
            const res = await axios.get(
                `${baseURL}/api/events/${id}/download-pdf`,
                {
                    headers: { Authorization: `Bearer ${token}` },
                    responseType: "blob",
                }
            );
            const url = window.URL.createObjectURL(new Blob([res.data]));
            const link = document.createElement("a");
            link.href = url;
            link.setAttribute("download", `submissions_${id}.pdf`);
            document.body.appendChild(link);
            link.click();
            link.remove();
        } catch (err) {
            alert("Failed to download PDF");
        }
    };

    const fetchLiveView = async (eventId) => {
        setIsLoading(true);
        try {
            const res = await axios.get(
                `${baseURL}/api/events/${eventId}/live-view`,
                { headers: { Authorization: `Bearer ${token}` } }
            );
            setLiveViewData(res.data);
            setSelectedEvent(eventId);
        } catch (err) {
            console.error("Error fetching live view:", err);
            alert("Failed to load live view");
        } finally {
            setIsLoading(false);
        }
    };

    const refreshLiveView = async () => {
        if (selectedEvent) {
            await fetchLiveView(selectedEvent);
        }
    };

    const closeLiveView = () => {
        setLiveViewData(null);
        setSelectedEvent(null);
    };

    const deleteEvent = async (id) => {
        if (window.confirm("Are you sure you want to delete this event?")) {
            try {
                await axios.delete(`${baseURL}/api/events/${id}`, {
                    headers: { Authorization: `Bearer ${token}` },
                });
                loadEvents();
            } catch (err) {
                alert("Failed to delete event");
            }
        }
    };

    const handleLogout = () => {
        localStorage.removeItem("token");
        navigate("/");
    };

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50 p-4 md:p-8"
        >
            <div className="max-w-7xl mx-auto">
                {/* Header */}
                <div className="flex flex-col md:flex-row md:justify-between md:items-center mb-8 gap-4">
                    <motion.h1
                        initial={{ y: -20 }}
                        animate={{ y: 0 }}
                        className="text-3xl font-bold text-center md:text-left text-gray-800"
                    >
                        Admin Dashboard
                    </motion.h1>
                    <button
                        onClick={handleLogout}
                        className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-lg shadow-md transition-all duration-200 self-center md:self-auto"
                    >
                        Logout
                    </button>
                </div>

                {/* Create Event Card */}
                <motion.div
                    initial={{ scale: 0.95, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ delay: 0.1 }}
                    className="bg-white shadow-xl rounded-2xl p-6 mb-8 backdrop-blur-sm bg-opacity-90"
                >
                    <h2 className="text-2xl font-semibold mb-4 text-gray-700">
                        Create New Event
                    </h2>

                    {error && (
                        <motion.div
                            initial={{ opacity: 0, y: -10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 mb-4 rounded"
                        >
                            <p>{error}</p>
                        </motion.div>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Event Name</label>
                            <input
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                placeholder="Event Name"
                                className="w-full border border-gray-300 rounded-lg p-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                            <input
                                value={desc}
                                onChange={(e) => setDesc(e.target.value)}
                                placeholder="Description"
                                className="w-full border border-gray-300 rounded-lg p-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Expiry Date</label>
                            <input
                                type="datetime-local"
                                value={expiresAt}
                                onChange={(e) => setExpiresAt(e.target.value)}
                                className="w-full border border-gray-300 rounded-lg p-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                            />
                        </div>
                        <div className="flex items-end">
                            <button
                                onClick={addField}
                                className="bg-gray-200 hover:bg-gray-300 px-4 py-2 rounded-lg mr-2 transition-all duration-200 w-full"
                            >
                                ➕ Add Field
                            </button>
                        </div>
                    </div>

                    {/* Dynamic Fields */}
                    <AnimatePresence>
                        {fields.map((f, i) => (
                            <motion.div
                                key={i}
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: "auto" }}
                                exit={{ opacity: 0, height: 0 }}
                                className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-2"
                            >
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Field Label</label>
                                    <input
                                        value={f.label}
                                        onChange={(e) => handleFieldChange(i, "label", e.target.value)}
                                        placeholder="Field Label"
                                        className="w-full border border-gray-300 rounded-lg p-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Field Type</label>
                                    <select
                                        value={f.type}
                                        onChange={(e) => handleFieldChange(i, "type", e.target.value)}
                                        className="w-full border border-gray-300 rounded-lg p-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                                    >
                                        <option value="text">Text</option>
                                        <option value="number">Number</option>
                                        <option value="email">Email</option>
                                        <option value="date">Date</option>
                                    </select>
                                </div>
                                <div className="flex items-end">
                                    <button
                                        type="button"
                                        onClick={() => removeField(i)}
                                        className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-lg transition-all duration-200 w-full"
                                    >
                                        ❌ Remove Field
                                    </button>
                                </div>
                            </motion.div>
                        ))}
                    </AnimatePresence>

                    <div className="mt-6 flex justify-end">
                        <button
                            onClick={createEvent}
                            disabled={isCreating}
                            className={`bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg shadow-md transition-all duration-200 flex items-center ${isCreating ? 'opacity-75' : ''}`}
                        >
                            {isCreating ? (
                                <>
                                    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                    </svg>
                                    Creating...
                                </>
                            ) : (
                                '✅ Create Event'
                            )}
                        </button>
                    </div>
                </motion.div>

                {/* Events List */}
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.2 }}
                >
                    <h2 className="text-2xl font-semibold mb-4 text-gray-700">All Events</h2>

                    {events.length === 0 ? (
                        <div className="bg-white shadow-lg rounded-xl p-8 text-center">
                            <p className="text-gray-500">No events created yet. Create your first event above.</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            {events.map((ev) => (
                                <motion.div
                                    key={ev._id}
                                    initial={{ y: 20, opacity: 0 }}
                                    animate={{ y: 0, opacity: 1 }}
                                    transition={{ type: "spring", stiffness: 100 }}
                                    whileHover={{ scale: 1.02 }}
                                    className="bg-white shadow-lg rounded-xl p-6 flex flex-col justify-between hover:shadow-xl transition-shadow duration-300"
                                >
                                    <div>
                                        <div className="flex justify-between items-start mb-2">
                                            <h3 className="text-xl font-bold text-gray-800">
                                                {ev.name}
                                            </h3>
                                            <span className={`text-xs px-2 py-1 rounded-full ${new Date(ev.expiresAt) > new Date() ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                                                {new Date(ev.expiresAt) > new Date() ? 'Active' : 'Expired'}
                                            </span>
                                        </div>
                                        <p className="text-gray-600 mb-3">{ev.description}</p>
                                        <div className="flex items-center text-sm mb-4">
                                            <span className="text-gray-500 mr-2">Expires:</span>
                                            <span className={`font-medium ${new Date(ev.expiresAt) > new Date() ? 'text-green-600' : 'text-red-600'}`}>
                                                {new Date(ev.expiresAt) > new Date()
                                                    ? `${countdowns[ev._id] || 'Calculating...'}`
                                                    : 'Expired'}
                                            </span>
                                        </div>

                                        <div className="mb-4">
                                            <h4 className="font-semibold text-gray-700 mb-1">Fields:</h4>
                                            <div className="flex flex-wrap gap-2">
                                                {ev.fields.map((field, idx) => (
                                                    <span
                                                        key={idx}
                                                        className="bg-blue-50 text-blue-800 text-xs px-2 py-1 rounded"
                                                    >
                                                        {field.label} ({field.type})
                                                    </span>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex flex-wrap gap-2 mt-4">
                                        <Link
                                            to={`/form/${ev._id}`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="text-blue-600 hover:text-blue-800 underline flex items-center text-sm"
                                        >
                                            🔗 Open Form
                                        </Link>
                                        <button
                                            onClick={() => fetchLiveView(ev._id)}
                                            className="bg-yellow-500 hover:bg-yellow-600 text-white px-3 py-1 rounded-lg text-sm transition-colors duration-200"
                                        >
                                            👁️ Live View
                                        </button>
                                        <button
                                            onClick={() => downloadCSV(ev._id)}
                                            className="bg-green-600 hover:bg-green-700 text-white px-3 py-1 rounded-lg text-sm transition-colors duration-200"
                                        >
                                            📊 CSV
                                        </button>
                                        <button
                                            onClick={() => downloadPDF(ev._id)}
                                            className="bg-purple-600 hover:bg-purple-700 text-white px-3 py-1 rounded-lg text-sm transition-colors duration-200"
                                        >
                                            📄 PDF
                                        </button>
                                        <button
                                            onClick={() => deleteEvent(ev._id)}
                                            className="bg-red-600 hover:bg-red-700 text-white px-3 py-1 rounded-lg text-sm transition-colors duration-200"
                                        >
                                            🗑️ Delete
                                        </button>
                                    </div>
                                </motion.div>
                            ))}
                        </div>
                    )}
                </motion.div>

                {/* Live View Modal */}
                <AnimatePresence>
                    {liveViewData && (
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center p-4 z-50"
                        >
                            <motion.div
                                initial={{ scale: 0.9, y: 20 }}
                                animate={{ scale: 1, y: 0 }}
                                exit={{ scale: 0.9, y: 20 }}
                                className="bg-white/95 backdrop-blur-lg rounded-xl p-4 md:p-6 w-full max-w-6xl max-h-[90vh] overflow-auto shadow-2xl border border-white/20"
                            >
                                {/* Header */}
                                <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-3 mb-4">
                                    <h2 className="text-xl md:text-2xl font-bold text-gray-800">
                                        Live View: {liveViewData.eventName}
                                    </h2>
                                    <div className="flex gap-2 justify-end">
                                        <button
                                            onClick={refreshLiveView}
                                            disabled={isLoading}
                                            className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 disabled:opacity-50 transition-colors"
                                        >
                                            {isLoading ? (
                                                <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                                </svg>
                                            ) : (
                                                '🔄'
                                            )}
                                            Refresh
                                        </button>
                                        <button
                                            onClick={closeLiveView}
                                            className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-lg transition-colors"
                                        >
                                            ✕ Close
                                        </button>
                                    </div>
                                </div>

                                {/* Table Container */}
                                <div className="overflow-x-auto rounded-lg border border-gray-200/80">
                                    <table className="min-w-full bg-white/95">
                                        <thead className="bg-gray-100">
                                            <tr>
                                                {liveViewData.fields.map((field, i) => (
                                                    <th
                                                        key={i}
                                                        className="py-3 px-4 border-b border-gray-200 text-left text-sm font-semibold text-gray-700"
                                                    >
                                                        {field}
                                                        {liveViewData.numberFields.includes(field) && ' (#'}
                                                    </th>
                                                ))}
                                                <th className="py-3 px-4 border-b border-gray-200 text-left text-sm font-semibold text-gray-700">
                                                    Submitted At
                                                </th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {liveViewData.submissions.map((row, rowIndex) => (
                                                <motion.tr
                                                    key={rowIndex}
                                                    initial={{ opacity: 0 }}
                                                    animate={{ opacity: 1 }}
                                                    className={rowIndex % 2 === 0 ? 'bg-gray-50' : 'bg-white'}
                                                >
                                                    {liveViewData.fields.map((field, i) => (
                                                        <td
                                                            key={i}
                                                            className="py-3 px-4 border-b border-gray-200 text-sm"
                                                        >
                                                            {row[field]}
                                                        </td>
                                                    ))}
                                                    <td className="py-3 px-4 border-b border-gray-200 text-sm">
                                                        {new Date(row.createdAt).toLocaleString()}
                                                    </td>
                                                </motion.tr>
                                            ))}
                                            {liveViewData.totals && (
                                                <tr className="bg-gray-200 font-bold">
                                                    {liveViewData.fields.map((field, i) => (
                                                        <td
                                                            key={i}
                                                            className="py-3 px-4 border-b border-gray-200 text-sm"
                                                        >
                                                            {liveViewData.numberFields.includes(field) ? liveViewData.totals[field] : ''}
                                                        </td>
                                                    ))}
                                                    <td className="py-3 px-4 border-b border-gray-200 text-sm">
                                                        TOTAL
                                                    </td>
                                                </tr>
                                            )}
                                        </tbody>
                                    </table>
                                </div>

                                {/* Footer */}
                                <div className="mt-4 text-sm text-gray-500">
                                    <p>Last updated: {new Date(liveViewData.lastUpdated).toLocaleString()}</p>
                                    <p>Total submissions: {liveViewData.submissions.length}</p>
                                </div>
                            </motion.div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </motion.div>
    );
}