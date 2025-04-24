
import './firebase.js';

import { basicNotif, confirmNotif, sendNotification } from './notif.js';

const luxonScript = document.createElement('script');
luxonScript.src = 'https://cdn.jsdelivr.net/npm/luxon@3.2.0/build/global/luxon.min.js';
document.head.appendChild(luxonScript);

let DateTime;

luxonScript.onload = function () {
    DateTime = window.luxon.DateTime;
}

if ('serviceWorker' in navigator) {

} else {

    console.log('Service Workers not supported in this browser.');

};

function calculateDistance(lat1, lon1, lat2, lon2) {

    const R = 6371000; // Radius of the Earth in meters

    const dLat = (lat2 - lat1) * Math.PI / 180;

    const dLon = (lon2 - lon1) * Math.PI / 180;

    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +

        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *

        Math.sin(dLon / 2) * Math.sin(dLon / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c; // Distance in meters

}

function getCurrentLocation() {
    return new Promise((resolve, reject) => {
        if (!navigator.geolocation) {
            return reject(new Error("Geolocation is not supported by this browser."));
        }

        console.log("Getting quick location...");

        // First, get a quick low-accuracy location
        navigator.geolocation.getCurrentPosition(
            (quickPosition) => {
                console.log("Quick location found:", quickPosition.coords);
                
                // Immediately return quick position while requesting an accurate one
                resolve(quickPosition.coords);

                // Now request a more accurate position
                navigator.geolocation.getCurrentPosition(
                    (accuratePosition) => {
                        console.log("More accurate location found:", accuratePosition.coords);
                        resolve(accuratePosition.coords); // Update with accurate data
                    },
                    (error) => console.warn("Accurate location failed:", error.message),
                    {
                        enableHighAccuracy: true, // More accurate but slower
                        timeout: 5000, // Wait max 5 sec for GPS lock
                        maximumAge: 0 // Do not use cached results
                    }
                );
            },
            (error) => reject(new Error("Unable to retrieve location: " + error.message)),
            {
                enableHighAccuracy: false, // Faster but less precise
                timeout: 2000, // Quick timeout for fast retrieval
                maximumAge: 10000 // Allow using a cached location up to 10 sec old
            }
        );
    });
}

if (Notification.permission !== 'granted') {
    Notification.requestPermission().then(permission => {
        if (permission === 'granted') {
            console.log("Permission granted for notifications!");
        }
    });
}

function applyDarkMode(isDarkMode) {

    if (isDarkMode) {

        document.body.classList.add('dark-mode');

    } else {

        document.body.classList.remove('dark-mode');

    }

}

function handleToggleChange(event) {

    const isChecked = event.target.checked;

    localStorage.setItem('darkMode', isChecked); // Save preference to localStorage

    applyDarkMode(isChecked);

}

function loadUserPreference() {

    const darkMode = localStorage.getItem('darkMode') === 'true'; // Get user preference from localStorage

    applyDarkMode(darkMode);

    document.getElementById('darkModeToggle').checked = darkMode; // Set switch position based on user preference

}

document.getElementById('darkModeToggle').addEventListener('change', handleToggleChange);

window.addEventListener('load', loadUserPreference);
