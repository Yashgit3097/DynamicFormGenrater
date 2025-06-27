import { useState, useEffect } from "react";
import axios from "axios";

export default function Dashboard() {
    const [events, setEvents] = useState([]);
    const [name, setName] = useState("");
    const [desc, setDesc] = useState("");
    const [fields, setFields] = useState([]);
    const [expiresAt, setExpiresAt] = useState("");

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

    const download = async (id) => {
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
        link.setAttribute("download", "submissions.csv");
        document.body.appendChild(link);
        link.click();
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
                                <p className="text-sm text-gray-500 mb-4">
                                    Expires: {new Date(ev.expiresAt).toLocaleString()}
                                </p>
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
                                    onClick={() => download(ev._id)}
                                    className="bg-green-600 hover:bg-green-700 text-white px-4 py-1 rounded-lg"
                                >
                                    ⬇️ Download CSV
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
            </div>
        </div>
    );
}
