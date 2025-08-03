// InstallPWA.jsx
import { useEffect, useState } from 'react';

const InstallPWA = () => {
    const [deferredPrompt, setDeferredPrompt] = useState(null);
    const [showInstall, setShowInstall] = useState(false);

    useEffect(() => {
        window.addEventListener('beforeinstallprompt', (e) => {
            e.preventDefault();
            setDeferredPrompt(e);
            setShowInstall(true);
        });
    }, []);

    const handleInstall = async () => {
        if (deferredPrompt) {
            deferredPrompt.prompt();
            const { outcome } = await deferredPrompt.userChoice;
            if (outcome === 'accepted') {
                console.log('User accepted the PWA install');
            }
            setDeferredPrompt(null);
            setShowInstall(false);
        }
    };

    return (
        <>
            {showInstall && (
                <button
                    onClick={handleInstall}
                    className="fixed bottom-4 right-4 bg-gradient-to-r from-purple-500 to-pink-500 text-white font-bold py-3 px-6 rounded-full shadow-lg hover:scale-105 hover:shadow-xl transition duration-300"
                >
                    📲 Install App
                </button>
            )}
        </>
    );
};

export default InstallPWA;
