import { useParams } from "react-router-dom";
import { useEffect, useState } from "react";
import axios from "axios";

export default function UserForm() {
    const { eventId } = useParams();
    const [event, setEvent] = useState(null);
    const [values, setValues] = useState({});
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isSubmitted, setIsSubmitted] = useState(false);
    const [error, setError] = useState(null);
    const [isExpired, setIsExpired] = useState(false);

    const baseURL = "https://dynamicformgenrater.onrender.com";

    useEffect(() => {
        const fetchEvent = async () => {
            try {
                const res = await axios.get(`${baseURL}/api/events/${eventId}`);
                const eventData = res.data;

                // Check if the event has expired
                if (new Date(eventData.expiresAt) < new Date()) {
                    setIsExpired(true);
                }

                setEvent(eventData);
                setError(null);
            } catch (err) {
                setError("Link expired or not found");
            }
        };

        fetchEvent();
    }, [eventId]);

    const handleSubmit = async () => {
        setIsSubmitting(true);
        try {
            await axios.post(`${baseURL}/api/events/${eventId}/submit`, values);
            setIsSubmitted(true);
            setError(null);
        } catch (err) {
            setError(err.response?.data?.message || "Submission failed. Please try again.");
        } finally {
            setIsSubmitting(false);
        }
    };

    if (error) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-red-50 p-4">
                <div className="w-full max-w-md bg-white rounded-2xl shadow-xl p-8 text-center">
                    <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-red-100 mb-4">
                        <svg className="h-10 w-10 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </div>
                    <h2 className="text-2xl font-bold text-gray-800 mb-2">Error</h2>
                    <p className="text-gray-600 mb-6">{error}</p>
                </div>
            </div>
        );
    }

    if (!event) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-blue-50 p-4">
                <div className="w-full max-w-md bg-white rounded-2xl shadow-xl p-8 text-center">
                    <div className="animate-pulse flex justify-center mb-4">
                        <div className="h-12 w-12 bg-blue-200 rounded-full"></div>
                    </div>
                    <h2 className="text-2xl font-bold text-gray-800 mb-2">Loading Form</h2>
                    <p className="text-gray-600">Please wait while we load the form...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-purple-50 to-blue-100 p-4">
            <div className="w-full max-w-lg bg-white rounded-xl shadow-lg overflow-hidden transition-all duration-300 hover:shadow-xl">

                {/* Form Header */}
                <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-5 py-6 text-center">
                    <h1 className="text-2xl font-bold text-white">{event.name}</h1>
                    <p className="text-blue-100 mt-1 text-sm">{event.description}</p>
                </div>

                {/* Form Body */}
                <div className="px-6 py-6 sm:px-8 sm:py-8">
                    {!isSubmitted ? (
                        <form onSubmit={(e) => { e.preventDefault(); handleSubmit(); }} className="space-y-5">

                            {event.fields.map((f, i) => (
                                <div key={i}>
                                    <label className="block text-lg font-medium text-gray-700 mb-1">
                                        {f.label}
                                        {f.type === "number" && <span className="text-gray-500 text-xs ml-1">(number)</span>}
                                        {f.type === "email" && <span className="text-gray-500 text-xs ml-1">(email)</span>}
                                    </label>

                                    {f.type === "dropdown" ? (
                                        <select
                                            value={values[f.label] || ""}
                                            onChange={e => setValues({ ...values, [f.label]: e.target.value })}
                                            required
                                            className="w-full border border-gray-300 rounded-md px-3 py-2 text-gray-800 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                                        >
                                            <option value="">Select an option</option>
                                            {(f.options || []).map((opt, idx) => (
                                                <option key={idx} value={opt}>{opt}</option>
                                            ))}
                                        </select>
                                    ) : f.type === "radio" ? (
                                        <div className="flex flex-col space-y-2 mt-1">
                                            {(f.options || []).map((opt, idx) => (
                                                <label key={idx} className="flex items-center gap-2 text-gray-700">
                                                    <input
                                                        type="radio"
                                                        name={f.label}
                                                        value={opt}
                                                        checked={values[f.label] === opt}
                                                        onChange={(e) => setValues({ ...values, [f.label]: e.target.value })}
                                                        required
                                                        className="text-blue-600 focus:ring-blue-500"
                                                    />
                                                    <span>{opt}</span>
                                                </label>
                                            ))}
                                        </div>
                                    ) : (
                                        <input
                                            type={f.type}
                                            value={values[f.label] || ""}
                                            onChange={e => setValues({ ...values, [f.label]: e.target.value })}
                                            placeholder={`Enter ${f.label.toLowerCase()}`}
                                            required
                                            {...(f.type === "number" ? { step: "any" } : {})}
                                            {...(f.type === "date" ? { min: new Date().toISOString().split("T")[0] } : {})}
                                            className="w-full border border-gray-300 rounded-md px-3 py-2 text-gray-800 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                                        />
                                    )}
                                </div>
                            ))}

                            {error && (
                                <div className="bg-red-100 text-red-700 text-sm px-4 py-2 rounded-md">{error}</div>
                            )}

                            <button
                                type="submit"
                                disabled={isSubmitting || isExpired}
                                className={`w-full py-3 rounded-md font-semibold text-white flex justify-center items-center transition-all duration-200 ${isSubmitting
                                    ? "bg-blue-400 cursor-not-allowed"
                                    : isExpired
                                        ? "bg-gray-400 cursor-not-allowed"
                                        : "bg-blue-600 hover:bg-blue-700"
                                    }`}
                            >
                                {isSubmitting ? (
                                    <>
                                        <svg className="animate-spin h-5 w-5 mr-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.37 0 0 5.37 0 12h4z" />
                                        </svg>
                                        Processing...
                                    </>
                                ) : isExpired ? "Form Closed" : "Submit Form"}
                            </button>
                        </form>
                    ) : (
                        <div className="text-center py-8">
                            <div className="mx-auto mb-4 h-16 w-16 flex items-center justify-center rounded-full bg-green-100">
                                <svg className="h-10 w-10 text-green-600" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                </svg>
                            </div>
                            <h3 className="text-xl font-bold text-gray-800 mb-2">Successfully Submitted!</h3>
                            <p className="text-gray-600 mb-4 text-sm">Thank you! Your response has been recorded.</p>
                            <button
                                onClick={() => {
                                    setValues({});
                                    setIsSubmitted(false);
                                }}
                                className="px-5 py-2 bg-blue-100 text-blue-600 rounded-md font-medium hover:bg-blue-200 transition-colors"
                            >
                                Submit Another
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>


    );
}
