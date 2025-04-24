
import { fetchProfile, generateUniqueSyntax, addClass, removeClass, generateClassCode, joinClassByCode, leaveClass, getCurrentUser } from './firebase.js';
import { basicNotif } from './notif.js';

function getLocation() {
    return new Promise((resolve, reject) => {
        if (navigator.geolocation) {
            console.log("Getting Location");
            navigator.geolocation.getCurrentPosition(
                position => resolve(position.coords),
                error => reject(alert('Unable to retrieve location: ' + error.message)),
                {
                    enableHighAccuracy: true, // Set to false for quicker, less accurate location
                    timeout: 15000, // Set a timeout (e.g., 5000 ms) for the location request
                    maximumAge: 1500000000000000 // Don't use cached location data
                }
            );
        } else {
            reject(new Error('Geolocation is not supported by this browser.'));
        }
    });
}



document.getElementById('getLocation').addEventListener('click', async function (event) {
    event.preventDefault();
    let location = await getLocation();
    const lat = document.getElementById('lat');
    const long = document.getElementById('long');
    console.log(location)
    lat.value = location.latitude
    long.value = location.longitude
});

document.getElementById('classjoinForm').addEventListener('submit', async function (event) {
    event.preventDefault();
    var classCode = document.getElementById('classCode').value;
    const user = await getCurrentUser();
    await joinClassByCode(classCode, user);
});

document.getElementById('classaddForm').addEventListener('submit', async function (event) {
    event.preventDefault(); // Prevent the form from submitting the traditional way

    var className = document.getElementById('className').value;
    var lat = parseFloat(document.getElementById('lat').value);
    var long = parseFloat(document.getElementById('long').value);
    var rad = document.getElementById('radius').value;
    const timezoneInput = document.getElementById('timezone');
    const timezone = timezoneInput.value;
    const timezoneList = document.getElementById('timezone-list');
    const timezoneOptions = Array.from(timezoneList.options).map(option => option.value);


    // Check if the input value matches any of the options
    if (!timezoneOptions.includes(timezone)) {
        basicNotif("Invalid timezone",`${timezone} is not valid timezone.`,5000);
        return; // Prevent further execution if the time zone is invalid
    }

    try {
        // Generate a unique syntax
        const uid = await generateUniqueSyntax();
        const classcode = await generateClassCode();

        // Add the class to Firestore (or your database)
        await addClass(className, uid, classcode, lat, long, rad, timezone);

        // Add the new class to the DOM
        document.getElementById('classaddForm').reset();
    } catch (error) {
        console.error('Error generating unique syntax or adding class:', error);
    }
});

document.addEventListener('DOMContentLoaded', async (event) => {
    event.preventDefault();
    const urlParams = new URLSearchParams(window.location.search);
    const classCode = urlParams.get('classCode');
    const user = await getCurrentUser();
    if (classCode) {
        const classCodeElement = document.getElementById('classCode');
        const joinTab = document.getElementById('joinTab');
        joinTab.click();
        if (classCodeElement) {
            classCodeElement.value = classCode;
            console.log('Class Code set to:', classCode);
            await joinClassByCode(classCode, user);
        } else {
            console.error('Element with ID "classCode" not found');
        }
    }
});


