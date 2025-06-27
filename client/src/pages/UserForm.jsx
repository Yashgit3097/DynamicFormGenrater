import { useParams } from "react-router-dom";
import { useEffect, useState } from "react";
import axios from "axios";

export default function UserForm() {
    const { eventId } = useParams();
    const [event, setEvent] = useState(null);
    const [values, setValues] = useState({});

    useEffect(() => {
        const fetchEvent = async () => {
            try {
                const res = await axios.get(`http://localhost:4000/api/events/${eventId}`);
                setEvent(res.data);
            } catch (err) {
                alert("Link expired or not found");
            }
        };
        fetchEvent();
    }, [eventId]);

    const handleSubmit = async () => {
        await axios.post(`http://localhost:4000/api/events/${eventId}/submit`, values);
        alert("Submitted!");
    };

    if (!event) return <div className="p-8">Loading...</div>;

    return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-r from-blue-50 to-blue-100 p-4">
            <div className="w-full max-w-md bg-white rounded-xl shadow-lg p-8">
                <h1 className="text-3xl font-bold mb-2 text-gray-800 text-center">{event.name}</h1>
                <p className="text-gray-600 mb-6 text-center">{event.description}</p>

                <form onSubmit={e => { e.preventDefault(); handleSubmit(); }}>
                    {event.fields.map((f, i) => (
                        <div key={i} className="mb-4">
                            <label className="block mb-1 font-semibold text-gray-700">{f.label}</label>
                            <input
                                type={f.type}
                                value={values[f.label] || ""}
                                onChange={e => setValues({ ...values, [f.label]: e.target.value })}
                                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400"
                                placeholder={`Enter ${f.label}`}
                                required
                            />
                        </div>
                    ))}

                    <button
                        type="submit"
                        className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-lg shadow-md transition duration-200"
                    >
                        ✅ Submit
                    </button>
                </form>
            </div>
        </div>

    );
}
