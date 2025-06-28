import { useParams } from "react-router-dom";
import { useEffect, useState } from "react";
import axios from "axios";

export default function UserForm() {
    const { eventId } = useParams();
    const [event, setEvent] = useState(null);
    const [values, setValues] = useState({});
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isSubmitted, setIsSubmitted] = useState(false);
    const [timeLeft, setTimeLeft] = useState({});
    const [error, setError] = useState(null);
    const baseURL = "https://dynamicformgenrater.onrender.com"

    useEffect(() => {
        const fetchEvent = async () => {
            try {
                const res = await axios.get(`${baseURL}/api/events/${eventId}`);
                setEvent(res.data);
                setError(null);
            } catch (err) {
                setError("Link expired or not found");
            }
        };
        fetchEvent();
    }, [eventId]);

    // Countdown timer effect
    useEffect(() => {
        if (!event) return;

        const calculateTimeLeft = () => {
            const difference = new Date(event.expiresAt) - new Date();
            if (difference <= 0) return { expired: true };

            return {
                days: Math.floor(difference / (1000 * 60 * 60 * 24)),
                hours: Math.floor((difference / (1000 * 60 * 60)) % 24),
                minutes: Math.floor((difference / 1000 / 60) % 60),
                seconds: Math.floor((difference / 1000) % 60),
                expired: false
            };
        };

        setTimeLeft(calculateTimeLeft());
        const timer = setInterval(() => {
            setTimeLeft(calculateTimeLeft());
        }, 1000);

        return () => clearInterval(timer);
    }, [event]);

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
            <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-red-50 to-pink-50 p-4">
                <div className="w-full max-w-md bg-white rounded-2xl shadow-xl p-8 text-center">
                    <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-red-100 mb-4">
                        <svg className="h-10 w-10 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </div>
                    <h2 className="text-2xl font-bold text-gray-800 mb-2">Error</h2>
                    <p className="text-gray-600 mb-6">{error}</p>
                    <a
                        href="/"
                        className="px-6 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors"
                    >
                        Return Home
                    </a>
                </div>
            </div>
        );
    }

    if (!event) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-purple-50 to-blue-100 p-4">
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
            <div className="w-full max-w-md bg-white rounded-2xl shadow-xl overflow-hidden transition-all duration-300 hover:shadow-2xl">
                {/* Form Header */}
                <div className="bg-gradient-to-r from-blue-600 to-indigo-600 p-6">
                    <h1 className="text-2xl md:text-3xl font-bold text-white text-center">{event.name}</h1>
                    <p className="text-blue-100 mt-2 text-center">{event.description}</p>
                </div>

                {/* Form Body */}
                <div className="p-6 md:p-8">
                    {!isSubmitted ? (
                        <form onSubmit={e => { e.preventDefault(); handleSubmit(); }}>
                            {event.fields.map((f, i) => (
                                <div key={i} className="mb-5">
                                    <label className="block mb-2 font-medium text-gray-700">
                                        {f.label}
                                        {f.type === 'number' && <span className="text-gray-500 ml-1">(numeric)</span>}
                                        {f.type === 'email' && <span className="text-gray-500 ml-1">(email)</span>}
                                    </label>
                                    <input
                                        type={f.type}
                                        value={values[f.label] || ""}
                                        onChange={e => setValues({ ...values, [f.label]: e.target.value })}
                                        className="w-full border border-gray-200 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent transition-all"
                                        placeholder={`Enter ${f.label.toLowerCase()}`}
                                        required
                                        {...(f.type === 'number' ? { step: "any" } : {})}
                                        {...(f.type === 'date' ? { min: new Date().toISOString().split('T')[0] } : {})}
                                    />
                                </div>
                            ))}

                            {error && (
                                <div className="mb-4 p-3 bg-red-100 text-red-700 rounded-lg text-sm">
                                    {error}
                                </div>
                            )}

                            <button
                                type="submit"
                                disabled={isSubmitting || timeLeft.expired}
                                className={`w-full py-3 px-4 rounded-lg font-semibold text-white shadow-md transition-all duration-300 flex items-center justify-center ${isSubmitting
                                    ? 'bg-blue-400 cursor-not-allowed'
                                    : timeLeft.expired
                                        ? 'bg-gray-400 cursor-not-allowed'
                                        : 'bg-blue-600 hover:bg-blue-700 hover:shadow-lg'
                                    }`}
                            >
                                {isSubmitting ? (
                                    <>
                                        <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                        </svg>
                                        Processing...
                                    </>
                                ) : timeLeft.expired ? (
                                    'Form Closed'
                                ) : (
                                    'Submit Form'
                                )}
                            </button>
                        </form>
                    ) : (
                        <div className="text-center py-8">
                            <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-green-100 mb-4">
                                <svg className="h-10 w-10 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                </svg>
                            </div>
                            <h3 className="text-2xl font-bold text-gray-800 mb-2">Successfully Submitted!</h3>
                            <p className="text-gray-600 mb-6">Thank you for your submission. We've received your information.</p>
                            <div className="flex gap-3 justify-center">
                                <button
                                    onClick={() => {
                                        setValues({});
                                        setIsSubmitted(false);
                                    }}
                                    className="px-6 py-2 bg-blue-100 text-blue-600 rounded-lg font-medium hover:bg-blue-200 transition-colors"
                                >
                                    Submit Another
                                </button>

                            </div>
                        </div>
                    )}
                </div>

                {/* Form Footer */}
                <div className="bg-gray-50 px-6 py-4 border-t border-gray-100 text-center">
                    <p className="text-sm text-gray-500">
                        {timeLeft.expired ? (
                            <span className="text-red-500">This form has closed</span>
                        ) : (
                            <>
                                Form closes in{' '}
                                {timeLeft.days > 0 && `${timeLeft.days}d `}
                                {timeLeft.hours}h {timeLeft.minutes}m {timeLeft.seconds}s
                            </>
                        )}
                    </p>
                </div>
            </div>
        </div>
    );
}