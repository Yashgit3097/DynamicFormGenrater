import { useState, useEffect } from "react";
import axios from "axios";

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

    const token = localStorage.getItem("token");

    const loadEvents = async () => {
        const res = await axios.get("http://localhost:4000/api/events", {
            headers: { Authorization: `Bearer ${token}` },
        });
        setEvents(res.data);
    };

    useEffect(() => {
        loadEvents();
        const interval = setInterval(loadEvents, 5000);
        return () => clearInterval(interval);
    }, []);

    // Add this effect to update all countdowns every second
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
        await axios.post(
            "http://localhost:4000/api/events",
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
        const res = await axios.get(
            `http://localhost:4000/api/events/${id}/download`,
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
    };

    const downloadPDF = async (id) => {
        const res = await axios.get(
            `http://localhost:4000/api/events/${id}/download-pdf`,
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
    };

    const fetchLiveView = async (eventId) => {
        setIsLoading(true);
        try {
            const res = await axios.get(
                `http://localhost:4000/api/events/${eventId}/live-view`,
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
        await axios.delete(`http://localhost:4000/api/events/${id}`, {
            headers: { Authorization: `Bearer ${token}` },
        });
        loadEvents();
    };

    return (
        <div className="min-h-screen bg-gray-100 p-8">
            <div className="max-w-5xl mx-auto">
                <h1 className="text-3xl font-bold mb-8 text-center text-gray-800">
                    Admin Dashboard
                </h1>

                {/* Create Event Card */}
                <div className="bg-white shadow-lg rounded-xl p-6 mb-12">
                    <h2 className="text-2xl font-semibold mb-4 text-gray-700">
                        Create New Event
                    </h2>

                    {/* Inputs row */}
                    <div className="flex flex-col md:flex-row md:flex-wrap gap-4">
                        <input
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="Event Name"
                            className="border rounded-lg p-2 flex-1 w-full md:w-auto min-w-[200px]"
                        />
                        <input
                            value={desc}
                            onChange={(e) => setDesc(e.target.value)}
                            placeholder="Description"
                            className="border rounded-lg p-2 flex-1 w-full md:w-auto min-w-[200px]"
                        />
                        <input
                            type="datetime-local"
                            value={expiresAt}
                            onChange={(e) => setExpiresAt(e.target.value)}
                            className="border rounded-lg p-2 w-full md:w-auto"
                        />
                    </div>

                    {/* Buttons */}
                    <div className="mt-4">
                        <button
                            onClick={addField}
                            className="bg-gray-200 hover:bg-gray-300 px-4 py-2 rounded-lg mr-2"
                        >
                            ➕ Add Field
                        </button>
                        <button
                            onClick={createEvent}
                            className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg"
                        >
                            ✅ Create Event
                        </button>
                    </div>

                    {/* Dynamic Fields */}
                    {fields.length > 0 && (
                        <div className="mt-6">
                            <h3 className="font-semibold mb-2 text-gray-700">Fields</h3>
                            {fields.map((f, i) => (
                                <div
                                    key={i}
                                    className="flex flex-col md:flex-row items-start md:items-center mb-2 gap-2 w-full"
                                >
                                    <input
                                        value={f.label}
                                        onChange={(e) =>
                                            handleFieldChange(i, "label", e.target.value)
                                        }
                                        placeholder="Field Label"
                                        className="border rounded-lg p-2 flex-1 w-full md:w-auto"
                                    />
                                    <select
                                        value={f.type}
                                        onChange={(e) =>
                                            handleFieldChange(i, "type", e.target.value)
                                        }
                                        className="border rounded-lg p-2 w-full md:w-auto"
                                    >
                                        <option value="text">Text</option>
                                        <option value="number">Number</option>
                                        <option value="email">Email</option>
                                        <option value="date">Date</option>
                                    </select>
                                    <button
                                        type="button"
                                        onClick={() => removeField(i)}
                                        className="bg-red-500 hover:bg-red-600 text-white px-3 py-1 rounded-lg"
                                    >
                                        ❌ Remove
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Events List */}
                <h2 className="text-2xl font-semibold mb-4 text-gray-700">All Events</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {events.map((ev) => (
                        <div
                            key={ev._id}
                            className="bg-white shadow-lg rounded-xl p-6 flex flex-col justify-between"
                        >
                            <div>
                                <h3 className="text-xl font-bold text-gray-800 mb-1">
                                    {ev.name}
                                </h3>
                                <p className="text-gray-600 mb-2">{ev.description}</p>
                                <p className="text-sm mb-4">
                                    Status:
                                    <span className={`ml-1 font-medium ${new Date(ev.expiresAt) > new Date()
                                        ? 'text-green-600'
                                        : 'text-red-600'
                                        }`}>
                                        {new Date(ev.expiresAt) > new Date()
                                            ? `Expires in: ${countdowns[ev._id] || 'Calculating...'}`
                                            : 'Expired'}
                                    </span>
                                </p>

                                {/* Display fields info */}
                                <div className="mb-3">
                                    <h4 className="font-semibold text-gray-700">Fields:</h4>
                                    <ul className="list-disc pl-5 text-sm text-gray-600">
                                        {ev.fields.map((field, idx) => (
                                            <li key={idx}>
                                                {field.label} ({field.type})
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            </div>
                            <div className="flex flex-wrap gap-2">
                                <a
                                    href={`/form/${ev._id}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-blue-600 hover:text-blue-800 underline"
                                >
                                    🔗 Open Form
                                </a>
                                <button
                                    onClick={() => fetchLiveView(ev._id)}
                                    className="bg-yellow-500 hover:bg-yellow-600 text-white px-4 py-1 rounded-lg"
                                >
                                    👁️ Live View
                                </button>
                                <button
                                    onClick={() => downloadCSV(ev._id)}
                                    className="bg-green-600 hover:bg-green-700 text-white px-4 py-1 rounded-lg"
                                >
                                    📊 CSV
                                </button>
                                <button
                                    onClick={() => downloadPDF(ev._id)}
                                    className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-1 rounded-lg"
                                >
                                    📄 PDF
                                </button>
                                <button
                                    onClick={() => deleteEvent(ev._id)}
                                    className="bg-red-600 hover:bg-red-700 text-white px-4 py-1 rounded-lg"
                                >
                                    🗑️ Delete
                                </button>
                            </div>
                        </div>
                    ))}
                </div>

                {/* Live View Modal */}
                {liveViewData && (
                    <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center p-4 z-50">
                        <div className="bg-white/90 backdrop-blur-lg rounded-xl p-4 md:p-6 w-full max-w-4xl max-h-[90vh] overflow-auto shadow-2xl border border-white/20">
                            {/* Header */}
                            <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-3 mb-4">
                                <h2 className="text-xl md:text-2xl font-bold text-gray-800">
                                    Live View: {liveViewData.eventName}
                                </h2>
                                <div className="flex gap-2 justify-end">
                                    <button
                                        onClick={refreshLiveView}
                                        disabled={isLoading}
                                        className="bg-blue-500/90 hover:bg-blue-600 text-white px-3 py-1 md:px-4 md:py-2 rounded-lg text-sm md:text-base disabled:opacity-50 transition-colors"
                                    >
                                        {isLoading ? 'Loading...' : '🔄 Refresh'}
                                    </button>
                                    <button
                                        onClick={closeLiveView}
                                        className="bg-red-500/90 hover:bg-red-600 text-white px-3 py-1 md:px-4 md:py-2 rounded-lg text-sm md:text-base transition-colors"
                                    >
                                        ✕ Close
                                    </button>
                                </div>
                            </div>

                            {/* Table Container */}
                            <div className="overflow-x-auto rounded-lg border border-gray-200/80">
                                <table className="min-w-full bg-white/95">
                                    <thead>
                                        <tr className="bg-gray-100/80">
                                            {liveViewData.fields.map((field, i) => (
                                                <th
                                                    key={i}
                                                    className="py-2 px-3 md:py-3 md:px-4 border-b border-gray-200 text-left text-sm md:text-base"
                                                >
                                                    {field}
                                                    {liveViewData.numberFields.includes(field) && ' (#'}
                                                </th>
                                            ))}
                                            <th className="py-2 px-3 md:py-3 md:px-4 border-b border-gray-200 text-left text-sm md:text-base">
                                                Submitted At
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {liveViewData.submissions.map((row, rowIndex) => (
                                            <tr
                                                key={rowIndex}
                                                className={rowIndex % 2 === 0 ? 'bg-gray-50/50' : ''}
                                            >
                                                {liveViewData.fields.map((field, i) => (
                                                    <td
                                                        key={i}
                                                        className="py-2 px-3 md:py-2 md:px-4 border-b border-gray-200/50 text-sm md:text-base"
                                                    >
                                                        {row[field]}
                                                    </td>
                                                ))}
                                                <td className="py-2 px-3 md:py-2 md:px-4 border-b border-gray-200/50 text-sm md:text-base">
                                                    {row.createdAt}
                                                </td>
                                            </tr>
                                        ))}
                                        {liveViewData.totals && (
                                            <tr className="bg-gray-200/80 font-bold">
                                                {liveViewData.fields.map((field, i) => (
                                                    <td
                                                        key={i}
                                                        className="py-2 px-3 md:py-2 md:px-4 border-b border-gray-200/50 text-sm md:text-base"
                                                    >
                                                        {liveViewData.numberFields.includes(field) ? liveViewData.totals[field] : ''}
                                                    </td>
                                                ))}
                                                <td className="py-2 px-3 md:py-2 md:px-4 border-b border-gray-200/50 text-sm md:text-base">
                                                    TOTAL
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>

                            {/* Footer */}
                            <div className="mt-3 text-xs md:text-sm text-gray-500/80 italic">
                                Last updated: {new Date(liveViewData.lastUpdated).toLocaleString()}
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}