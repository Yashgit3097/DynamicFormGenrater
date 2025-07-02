import { useState, useEffect } from "react";
import axios from "axios";
import { Link, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
    Copy,
    Check,
    Eye,
    FileText,
    FileDown,
    Trash2,
    Link2,
    LogOut,
    CopyMinus,
    BadgePlus,
    DiamondPlus
} from "lucide-react";


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
    const [noData, setNodata] = useState(true)
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
                    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
                    const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
                    const minutes = Math.floor((diff / 1000 / 60) % 60);
                    const seconds = Math.floor((diff / 1000) % 60);

                    let countdownStr = '';
                    if (days > 0) countdownStr += `${days}d `;
                    if (hours > 0 || days > 0) countdownStr += `${hours}h `;
                    countdownStr += `${minutes}m ${seconds}s`;

                    newCountdowns[event._id] = countdownStr.trim();
                }
            });
            setCountdowns(newCountdowns);
        }, 1000);

        return () => clearInterval(timer);
    }, [events]);

    function formatToIST(dateString) {
        const utcDate = new Date(dateString);
        const istOffset = 5.5 * 60 * 60 * 1000; // 5.5 hours in milliseconds
        const istDate = new Date(utcDate.getTime() + istOffset);

        return istDate.toLocaleString('en-IN', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            hour12: true,
        });
    }

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
            alert("There is no data available so you not download right now let user input that data....");
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
            alert("There is no data available so you not download right now let user input that data....");
        }
    };

    const fetchLiveView = async (eventId) => {
        setIsLoading(true);
        try {
            const res = await axios.get(
                `${baseURL}/api/events/${eventId}/live-view`,
                { headers: { Authorization: `Bearer ${token}` } }
            );
            setNodata(false);
            setLiveViewData(res.data);
            setSelectedEvent(eventId);
        } catch (err) {
            console.error("Error fetching live view:", err);
            alert("There is no date filled up wait.... please wait for let user submit the form")
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
                <div className="flex flex-col md:flex-row md:justify-between md:items-center mb-10 gap-6">
                    {/* Logo with animation */}
                    <motion.div
                        initial={{ y: -20 }}
                        animate={{ y: 0 }}
                        className="flex justify-center md:justify-start"
                    >
                        <img
                            src="/BringYourOwnFormLogo.png"
                            alt="Bring Your Own Form Logo"
                            className="h-24 w-auto object-contain"
                        />
                    </motion.div>

                    {/* Welcome Message */}
                    <div className="text-center md:text-left text-2xl md:text-3xl font-bold text-cyan-800 tracking-tight">
                        🥳 Welcome to <span>Bring Your Own Form</span> 🥳
                    </div>

                    {/* Logout Button */}
                    <button
                        onClick={handleLogout}
                        className="bg-red-500 hover:bg-red-600 text-white px-5 py-2.5 rounded-xl shadow-md transition duration-200 flex items-center gap-2 text-sm font-medium self-center md:self-auto"
                    >
                        <LogOut size={18} /> <span>Logout</span>
                    </button>
                </div>

                {/* Create Event Card */}
                <motion.div
                    initial={{ scale: 0.95, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ delay: 0.1 }}
                    className="bg-white/90 backdrop-blur shadow-2xl rounded-2xl px-6 py-8 mb-10"
                >
                    <h2 className="text-3xl font-bold text-gray-800 mb-6">
                        Create New Event
                    </h2>

                    {/* Error Alert */}
                    {error && (
                        <motion.div
                            initial={{ opacity: 0, y: -10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="bg-red-100 border-l-4 border-red-500 text-red-700 px-4 py-3 rounded mb-6 text-sm"
                        >
                            <p>{error}</p>
                        </motion.div>
                    )}

                    {/* Main Input Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                        <div>
                            <label className="text-sm font-medium text-gray-700 mb-1 block">
                                Event Name
                            </label>
                            <input
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                placeholder="Enter Event Name"
                                className="w-full p-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:outline-none transition"
                            />
                        </div>

                        <div>
                            <label className="text-sm font-medium text-gray-700 mb-1 block">
                                Description
                            </label>
                            <input
                                value={desc}
                                onChange={(e) => setDesc(e.target.value)}
                                placeholder="Enter Description"
                                className="w-full p-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:outline-none transition"
                            />
                        </div>

                        <div>
                            <label className="text-sm font-medium text-gray-700 mb-1 block">
                                Expiry Date
                            </label>
                            <input
                                type="datetime-local"
                                value={expiresAt}
                                onChange={(e) => setExpiresAt(e.target.value)}
                                className="w-full p-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:outline-none transition"
                            />
                        </div>

                        <div className="flex items-end">
                            <button
                                onClick={addField}
                                className="w-full px-4 py-2 rounded-lg bg-gray-200 hover:bg-gray-300 text-gray-700 font-medium flex items-center justify-center gap-2 transition"
                            >
                                <BadgePlus /> <span>Add Field</span>
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
                                className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4"
                            >
                                <div>
                                    <label className="text-sm font-medium text-gray-700 mb-1 block">
                                        Field Label
                                    </label>
                                    <input
                                        value={f.label}
                                        onChange={(e) => handleFieldChange(i, "label", e.target.value)}
                                        placeholder="Label"
                                        className="w-full p-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:outline-none transition"
                                    />
                                </div>

                                <div>
                                    <label className="text-sm font-medium text-gray-700 mb-1 block">
                                        Field Type
                                    </label>
                                    <select
                                        value={f.type}
                                        onChange={(e) => handleFieldChange(i, "type", e.target.value)}
                                        className="w-full p-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:outline-none transition"
                                    >
                                        <option value="text">Text</option>
                                        <option value="number">Number</option>
                                        <option value="email">Email</option>
                                        <option value="date">Date</option>
                                        <option value="dropdown">Dropdown</option>
                                        <option value="radio">Radio</option>
                                    </select>
                                </div>

                                {(f.type === "dropdown" || f.type === "radio") && (
                                    <div>
                                        <label className="text-sm font-medium text-gray-700 mb-1 block">
                                            Options (comma-separated)
                                        </label>
                                        <input
                                            value={f.options?.join(",") || ""}
                                            onChange={(e) =>
                                                handleFieldChange(
                                                    i,
                                                    "options",
                                                    e.target.value.split(",").map((opt) => opt.trim())
                                                )
                                            }
                                            placeholder="e.g. Yes, No"
                                            className="w-full p-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:outline-none transition"
                                        />
                                        <p className="text-xs text-gray-500 mt-1">
                                            Separate values with commas
                                        </p>
                                    </div>
                                )}

                                <div className="flex items-end">
                                    <button
                                        type="button"
                                        onClick={() => removeField(i)}
                                        className="w-full px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg flex items-center justify-center gap-2 transition"
                                    >
                                        <CopyMinus /> <span>Remove Field</span>
                                    </button>
                                </div>
                            </motion.div>
                        ))}
                    </AnimatePresence>

                    {/* Create Event Button */}
                    <div className="mt-6 flex justify-end">
                        <button
                            onClick={createEvent}
                            disabled={isCreating}
                            className={`px-6 py-3 rounded-lg font-medium text-white flex items-center gap-2 shadow-md transition ${isCreating
                                ? "bg-blue-400 cursor-not-allowed"
                                : "bg-blue-600 hover:bg-blue-700"
                                }`}
                        >
                            {isCreating ? (
                                <>
                                    <svg
                                        className="animate-spin h-5 w-5 text-white"
                                        xmlns="http://www.w3.org/2000/svg"
                                        fill="none"
                                        viewBox="0 0 24 24"
                                    >
                                        <circle
                                            className="opacity-25"
                                            cx="12"
                                            cy="12"
                                            r="10"
                                            stroke="currentColor"
                                            strokeWidth="4"
                                        ></circle>
                                        <path
                                            className="opacity-75"
                                            fill="currentColor"
                                            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                                        ></path>
                                    </svg>
                                    Creating...
                                </>
                            ) : (
                                <>
                                    <DiamondPlus /> <span>Create Event</span>
                                </>
                            )}
                        </button>
                    </div>
                </motion.div>


                {/* Events List */}
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.2 }}
                    className="w-full"
                >
                    <h2 className="text-3xl font-bold text-gray-800 mb-6 text-center md:text-left">
                        All Events
                    </h2>

                    {events.length === 0 ? (
                        <div className="bg-white rounded-2xl shadow-md p-8 text-center border border-dashed border-gray-300">
                            <p className="text-gray-500 text-lg">No events created yet. Create your first event above.</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6">
                            {events.map((ev) => (
                                <motion.div
                                    key={ev._id}
                                    initial={{ y: 20, opacity: 0 }}
                                    animate={{ y: 0, opacity: 1 }}
                                    transition={{ type: "spring", stiffness: 120 }}
                                    whileHover={{ scale: 1.02 }}
                                    className="bg-white border border-gray-200 rounded-2xl shadow-sm hover:shadow-lg transition-shadow duration-300 flex flex-col justify-between p-6"
                                >
                                    {/* Top Info */}
                                    <div className="mb-4">
                                        <div className="flex justify-between items-start mb-3">
                                            <h3 className="text-xl font-semibold text-gray-900 leading-tight">
                                                {ev.name}
                                            </h3>
                                            <span
                                                className={`text-xs font-medium px-3 py-1 rounded-full ${new Date(ev.expiresAt) > new Date()
                                                    ? "bg-green-100 text-green-700"
                                                    : "bg-red-100 text-red-700"
                                                    }`}
                                            >
                                                {new Date(ev.expiresAt) > new Date() ? "Active" : "Expired"}
                                            </span>
                                        </div>

                                        <p className="text-gray-600 text-sm mb-2">
                                            {ev.description}
                                        </p>

                                        <div className="flex items-center text-sm mb-4 gap-2">
                                            <span className="text-gray-500">Expires:</span>
                                            <span
                                                className={`font-medium ${new Date(ev.expiresAt) > new Date()
                                                    ? "text-green-600"
                                                    : "text-red-600"
                                                    }`}
                                            >
                                                {new Date(ev.expiresAt) > new Date()
                                                    ? `${countdowns[ev._id] || "Calculating..."}`
                                                    : "Expired"}
                                            </span>
                                        </div>

                                        {/* Fields */}
                                        <div className="mb-4">
                                            <h4 className="text-sm font-semibold text-gray-700 mb-1">
                                                Fields:
                                            </h4>
                                            <div className="flex flex-wrap gap-2">
                                                {ev.fields.map((field, idx) => (
                                                    <span
                                                        key={idx}
                                                        className="bg-blue-100 text-blue-700 text-xs font-medium px-2 py-1 rounded-full"
                                                    >
                                                        {field.label} ({field.type})
                                                    </span>
                                                ))}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Actions */}
                                    <div className="flex flex-wrap gap-2 mt-auto">
                                        <Link
                                            to={`/form/${ev._id}`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="text-blue-600 hover:text-blue-800 underline text-sm font-medium flex items-center gap-1"
                                        >
                                            <Link2 size={16} />
                                            Open Form
                                        </Link>

                                        <motion.button
                                            onClick={() => {
                                                const link = `${window.location.origin}/#/form/${ev._id}`;
                                                navigator.clipboard.writeText(link)
                                                    .then(() => {
                                                        setIsCopied(true);
                                                        setTimeout(() => setIsCopied(false), 2000);
                                                    })
                                                    .catch(() => alert("Failed to copy link."));
                                            }}
                                            className={`flex items-center gap-1 px-3 py-1 rounded-md text-sm font-medium text-white ${isCopied ? "bg-green-500 hover:bg-green-600" : "bg-blue-500 hover:bg-blue-600"
                                                }`}
                                            whileTap={{ scale: 0.95 }}
                                            animate={{ backgroundColor: isCopied ? "#22c55e" : "#3b82f6" }}
                                            transition={{ duration: 0.2 }}
                                        >
                                            {isCopied ? <Check size={16} /> : <Copy size={16} />}
                                            <span>{isCopied ? "Copied!" : "Copy Link"}</span>
                                        </motion.button>

                                        <button
                                            onClick={() => fetchLiveView(ev._id)}
                                            className="bg-yellow-500 hover:bg-yellow-600 text-white text-sm font-medium px-3 py-1 rounded-md flex items-center gap-1"
                                        >
                                            <Eye size={16} />
                                            Live View
                                        </button>

                                        <button
                                            onClick={() => downloadCSV(ev._id)}
                                            className="bg-green-600 hover:bg-green-700 text-white text-sm font-medium px-3 py-1 rounded-md flex items-center gap-1"
                                        >
                                            <FileText size={16} />
                                            Export CSV
                                        </button>

                                        <button
                                            onClick={() => downloadPDF(ev._id)}
                                            className="bg-purple-600 hover:bg-purple-700 text-white text-sm font-medium px-3 py-1 rounded-md flex items-center gap-1"
                                        >
                                            <FileDown size={16} />
                                            Download PDF
                                        </button>

                                        <button
                                            onClick={() => deleteEvent(ev._id)}
                                            className="bg-red-600 hover:bg-red-700 text-white text-sm font-medium px-3 py-1 rounded-md flex items-center gap-1"
                                        >
                                            <Trash2 size={16} />
                                            Delete
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
                                className="bg-white/95 backdrop-blur-lg rounded-2xl p-6 w-full max-w-6xl max-h-[90vh] overflow-auto shadow-2xl border border-gray-200"
                            >
                                {/* Header */}
                                <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4 mb-6">
                                    <h2 className="text-2xl font-bold text-gray-800 tracking-tight leading-snug">
                                        📊 Live View: <span className="text-blue-700">{liveViewData.eventName}</span>
                                    </h2>
                                    <div className="flex gap-2">
                                        <button
                                            onClick={refreshLiveView}
                                            disabled={isLoading}
                                            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition disabled:opacity-50"
                                        >
                                            {isLoading ? (
                                                <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                                </svg>
                                            ) : (
                                                "🔄 Refresh"
                                            )}
                                        </button>
                                        <button
                                            onClick={closeLiveView}
                                            className="bg-red-500 hover:bg-red-600 text-white text-sm font-medium px-4 py-2 rounded-lg transition"
                                        >
                                            ✕ Close
                                        </button>
                                    </div>
                                </div>

                                {/* Table */}
                                <div className="overflow-x-auto border border-gray-200 rounded-xl shadow-sm">
                                    <table className="min-w-full text-sm text-gray-800">
                                        <thead className="bg-gray-100 text-gray-700 font-semibold sticky top-0 z-10">
                                            <tr>
                                                {liveViewData.fields.map((field, i) => (
                                                    <th key={i} className="px-4 py-3 border-b border-gray-200 text-left whitespace-nowrap">
                                                        {field}
                                                        {liveViewData.numberFields.includes(field) && <span className="text-gray-500"> (#)</span>}
                                                    </th>
                                                ))}
                                                <th className="px-4 py-3 border-b border-gray-200 text-left whitespace-nowrap">Submitted At</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {liveViewData.submissions.map((row, rowIndex) => (
                                                <motion.tr
                                                    key={rowIndex}
                                                    initial={{ opacity: 0 }}
                                                    animate={{ opacity: 1 }}
                                                    className={`${rowIndex % 2 === 0 ? "bg-gray-50" : "bg-white"}`}
                                                >
                                                    {liveViewData.fields.map((field, i) => (
                                                        <td key={i} className="px-4 py-3 border-b border-gray-200">
                                                            {row[field] || <span className="text-gray-400 italic">–</span>}
                                                        </td>
                                                    ))}
                                                    <td className="px-4 py-3 border-b border-gray-200">
                                                        {formatToIST(row.createdAt)}
                                                    </td>
                                                </motion.tr>
                                            ))}

                                            {/* Totals Row */}
                                            {liveViewData.totals && (
                                                <tr className="bg-blue-50 font-semibold text-gray-800">
                                                    {liveViewData.fields.map((field, i) => (
                                                        <td key={i} className="px-4 py-3 border-t border-gray-300">
                                                            {liveViewData.numberFields.includes(field)
                                                                ? liveViewData.totals[field]
                                                                : ""}
                                                        </td>
                                                    ))}
                                                    <td className="px-4 py-3 border-t border-gray-300">TOTAL</td>
                                                </tr>
                                            )}
                                        </tbody>
                                    </table>
                                </div>

                                {/* Footer Info */}
                                <div className="mt-6 text-sm text-gray-500 border-t pt-4 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2">
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