import {
    fetchClass, fetchMembers,
    changeMemberRole, fetchProfile,
    getCurrentUser, fetchMember,
    kickfromClass, db,
    checkAttendance, getAttendance,
    postPost, fetchClassPosts,
    deletePost, generateUniquePostSyntax,
    addToLikedPosts,
    removeFromLikedPosts,
    displayComments,
    sendCommentToPost,
    emailTagged,
    leaveClass,
    updateClass
} from './firebase.js';

const luxonScript = document.createElement('script');
luxonScript.src = 'https://cdn.jsdelivr.net/npm/luxon@3.2.0/build/global/luxon.min.js';
document.head.appendChild(luxonScript);

let DateTime;

luxonScript.onload = function () {
    DateTime = window.luxon.DateTime;
}

import { collection, query, where, getDocs, doc, getDoc } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";
import { basicNotif, confirmNotif } from './notif.js';
import 'https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.js';
import "https://cdn.jsdelivr.net/npm/chart.js";
import { faceDetect, matchFacesFromVideo, verifyCurrentUser } from './facerecog.js';
import * as faceapi from 'https://cdn.jsdelivr.net/npm/@vladmandic/face-api@latest/dist/face-api.esm.js';
// Debounce function
function debounce(func, wait) {
    let timeout;
    return function (...args) {
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(this, args), wait);
    };
}
const qrreader = document.getElementById('qrscanner-container');
const video = document.getElementById('camera');
const canvas = document.createElement('canvas');
const canvasContext = canvas.getContext('2d', { willReadFrequently: true });

let currentStream = null; // Variable to hold the current video stream

let isCameraStarted = false;

let scanInterval; // Variable to hold the interval ID

export function startCamera() {
    console.log(currentStream);
    qrreader.style.display = "block";
    
    if (isCameraStarted) {
        console.log('Camera already started, skipping initialization.');
        video.srcObject = currentStream;
        video.setAttribute('playsinline', true);
        video.play();

        // If the camera is already started, ensure scanning continues every 1 second
        clearInterval(scanInterval); // Clear any previous intervals
        scanInterval = setInterval(scanQRCode, 1000); // Scan every 1 second
        return;
    }

    // Request access to the front-facing camera
    navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } })
        .then(stream => {
            // Assign the video stream to the video element and to the currentStream variable
            currentStream = stream;
            video.srcObject = stream;
            video.setAttribute('playsinline', true);
            video.play();

            isCameraStarted = true; // Prevent restarting the camera multiple times

            // Start scanning for QR codes every 1 second
            scanInterval = setInterval(scanQRCode, 1000); // Scan every 1 second
        })
        .catch(err => {
            qrreader.style.display = "none";
            handleCameraError(err); // Handle camera errors
        });
}


export async function startCamera2() {
    console.log(currentStream);
    //qrreader.style.display = "block";

    if (currentStream) {
        console.log('Using existing camera stream.');
        video.srcObject = currentStream; // Use the current stream
        video.setAttribute('playsinline', true);
        video.play();
        setTimeout(async () => {
            const matches = await matchFacesFromVideo(video, memberProfiles);
            console.log('Matches found:', matches); // Log all matched UIDs
        }, 1000); // Detect faces after a delay
        return; // Exit the function
    }

    // Request access to the front-facing camera
    navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" } })
        .then(stream => {
            // Assign the video stream to the video element and to the currentStream variable
            currentStream = stream;
            video.srcObject = stream;
            video.setAttribute('playsinline', true);
            video.play();

            // Start face detection after a short delay
            setTimeout(async () => {
                const matches = await matchFacesFromVideo(video, memberProfiles);
                console.log('Matches found:', matches); // Log all matched UIDs
            }, 1000);
        })
        .catch(err => {
            qrreader.style.display = "none";
            handleCameraError(err); // Handle camera errors
        });
}
export function stopCamera() {
    qrreader.style.display = "none"
    if (scanInterval) {
        clearInterval(scanInterval); // Clear the scanning interval
    }   
    if (currentStream) {
        const tracks = currentStream.getTracks();
        tracks.forEach(track => track.stop()); // Stop all tracks (video and/or audio)
        currentStream = null; // Clear the current stream
        video.srcObject = null; // Clear the video element's source
        isCameraStarted = false;
    } else {
        console.warn('No stream to stop. Video source is null.');
    }
}

// Event listener for starting the camera when the QR code reader button is clicked
document.getElementById('qr-code-reader').addEventListener('click', function (event) {
    if (currentStream) {
        stopCamera();
    } else {
        startCamera();
    };
});

const facescanButton = document.getElementById('facescan-button');

facescanButton.addEventListener('click', async () => {
    try {
        // Check if NDEFReader is supported
        if ('NDEFReader' in window) {
            const ndef = new NDEFReader();
            await ndef.scan(); // Start NFC scan
            console.log('NFC scan started.');
            basicNotif("NFC scanning started...", "Please place RFID to scan", 5500);
            // Set up the NFC reading event
            ndef.onreading = async (event) => {
                try {
                    const { serialNumber } = event; // This is the UID of the RFID
                    console.log('RFID UID:', serialNumber); // Log UID for debugging
                    // Now check Firestore for a matching RFID in 'memberProfiles'
                    const memberRef = collection(db, 'users');
                    const q = query(memberRef, where('rfidUid', '==', serialNumber));
                    const querySnapshot = await getDocs(q);

                    if (!querySnapshot.empty) {
                        // If we find a matching user, proceed with attendance check
                        querySnapshot.forEach(async (doc) => {
                            const userData = doc.data();
                            const mememberData = await fetchMember(syntax, userData.uid)
                            if (mememberData) {
                                basicNotif("Member found", userData.displayName, 5000);
                                console.log('User data found:', userData);
                                //ndef.onreading = null;
                                //ndef.onerror = null;
                                // Call checkAttendance for the matched user
                                await checkAttendance(syntax, classroom.timezone, userData.uid);
                                basicNotif("Member attendance checked succesfully", `User ${userData.displayName}'s attedance has been checked.`, 5000);
                                updateattendanceList();
                            } else {
                                basicNotif("Not a member of class", `User ${userData.displayName} is not a member for this class.`, 5000);
                            }
                        });
                    } else {
                        // If no user is found with the scanned RFID
                        basicNotif("No user found", "", 5000);
                        console.log("No matching user found.");
                    }
                } catch (error) {
                    console.error('Error reading NFC data:', error);
                }
            };

            // Set up NFC error handling
            ndef.onerror = (error) => {
                console.error('NFC reading error:', error);
                basicNotif("Error reading RFID", "", 5000);
            };
        } else {
            console.error('NFC is not supported in this browser.');
            basicNotif("NFC not supported", "", 5000);
        }
    } catch (error) {
        console.error('Error initiating NFC scan:', error);
        basicNotif("Failed to start NFC scan", "", 5000);
    }
});

function handleCameraError(err) {
    switch (err.name) {
        case 'NotReadableError':
            console.error('Camera is already in use:', err);
            basicNotif('Camera is already in use. Please close other applications using the camera.', "", 5000);
            break;
        case 'NotAllowedError':
            console.error('Permission to access the camera was denied:', err);
            basicNotif('Permission to access the camera was denied. Please allow camera access in your settings.', "", 5000);
            break;
        case 'NotFoundError':
            console.error('No camera was found on this device:', err);
            basicNotif('No camera found. Please ensure your device has a camera.', "", 5000);
            break;
        default:
            console.error('Error accessing camera:', err);
            basicNotif('Error accessing camera: ' + err.message, "", 5000);
            break;
    }
}

async function getCurrentLocation() {
    return new Promise((resolve, reject) => {
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                position => resolve(position.coords),
                error => reject(console.log('Unable to retrieve location: ' + error.message)),
                {
                    enableHighAccuracy: true, // Set to false for quicker, less accurate location
                    maximumAge: 150000 // Don't use cached location data
                }
            );
        } else {
            reject("Geolocation is not supported by this browser.");
        }
    });
}

async function scanQRCode() {
    if (video.videoWidth > 0 && video.videoHeight > 0) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        canvasContext.drawImage(video, 0, 0, canvas.width, canvas.height);
        const imageData = canvasContext.getImageData(0, 0, canvas.width, canvas.height);
        const code = jsQR(imageData.data, canvas.width, canvas.height);

        if (code) {
            stopCamera();
            //basicNotif('QR code detected', "", 5000)
            qrreader.style.display = "none"
            const mememberData = await fetchMember(syntax, code.data)
            const mememberProfile = await fetchProfile(code.data)
            if (await confirmNotif('Is this the correct account?', mememberProfile.displayName, 5000) == false) {
                basicNotif('Canceled', "", 5000)
                return;
            } else {
                basicNotif('Checking attandance...', "Please wait...", 5000)
                if (mememberData) {
                    basicNotif('Member fetched', "", 5000)
                    //video.style.border = "1px solid green"; // Optional: change border color to indicate success

                    const location = await getCurrentLocation();
                    const distance = calculateDistance(
                        location.latitude,
                        location.longitude,
                        classroom.lat,
                        classroom.long
                    );
                    console.log(distance)
                    if (distance <= classroom.rad) {
                        const attendance = await checkAttendance(syntax, classroom.timezone, code.data);
                        updateattendanceList();
                        console.log(attendance)
                        basicNotif(`Attandance checked`, code.data, 5000);
                    };
                } else {
                    basicNotif('Not a member', code.data, 5000);
                };
            }

        } else {
            //video.style.border = "1px solid red"; // Optional: change border color to indicate failure
            //console.log('No QR code detected.');
        }
    }
    requestAnimationFrame(scanQRCode);
}

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

const debouncedUpdateList = debounce(updatememberList, 300);
const debouncedUpdateattList = debounce(updateattendanceList, 300);

let classroom;
let members;
const memberProfiles = [];
const className = document.getElementById('className');

const classCode = document.getElementById('code');
let syntax;

function convertTo12Hour(militaryTime) {
    const regex = /^([01]\d|2[0-3]):([0-5]\d)$/;
    if (!regex.test(militaryTime)) {
        return 'Invalid military time format';
    }

    let [hours, minutes] = militaryTime.split(':').map(Number);
    let period = hours >= 12 ? 'PM' : 'AM';
    if (hours === 0) hours = 12;
    else if (hours > 12) hours -= 12;

    return `${hours}:${minutes.toString().padStart(2, '0')} ${period}`;
}

function capitalizeFirstLetter(str) {
    if (!str) return str; // Handle empty strings
    return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
}
let currentmember
async function updateattendanceList() {
    const currentUserLogged = await getCurrentUser();
    const currentMember = await fetchMember(syntax, currentUserLogged.uid);
    currentmember = currentMember;
    members = await fetchMembers(syntax);
    const attendanceList = document.getElementById('attendance-List');

    if (!currentMember) {
        window.location.href = `classes.html`;
        return;
    }
    if (!attendanceList) {
        console.error('Element with ID "attendanceList" not found');
        return;
    }
    attendanceList.innerHTML = '';

    const now = DateTime.now();
    const currentHour = now.hour;

    for (const member of members) {
        try {
            const memberData = await fetchProfile(member.id);
            if (memberData) {
                memberProfiles.push(memberData); // Add profile to the array
            } else {
                console.log(`Profile not found for member ID: ${member.id}`);
            }

            var { status, time } = await getAttendance(syntax, classroom.timezone, member.id);
            console.log(status, time)
            if (!time) {
                time = "Not Available";
            } else {
                time = convertTo12Hour(time);
            }

            // Determine the color class based on status
            let statusClass = '';
            switch (status.toLowerCase()) {
                case 'present':
                    statusClass = 'status-present'; // Green
                    break;
                case 'late':
                    statusClass = 'status-late'; // Purple
                    break;
                case 'absent':
                    statusClass = 'status-absent'; // Red
                    break;
                default:
                    statusClass = ''; // Default class or leave it empty
            }

            // Determine the color class based on status
            const listItem = document.createElement('li');
            listItem.classList.add('list-item');
            listItem.innerHTML = `
                <div class="${statusClass}">
                <img src=${memberData.photoUrl}></img>
                    <h3>${memberData.displayName}</h3>
                    <p>${capitalizeFirstLetter(status || 'Absent')}<br>${time}</p>
                    
                </div>
                <div>
                
                ${(currentmember.role === 'admin' || currentmember.role === 'owner')
                    && member.role !== 'owner'
                    && member.id !== currentUserLogged.uid ? `<label for="memberoptions${memberData.uid}"><i class="fa-solid fa-ellipsis"></i></label>` : ""}
                </div>
                <input class="option" type="checkbox" style="display: none;" id="memberoptions${memberData.uid}">
                <div id="memberoptions">
                ${(currentmember.role === 'admin' || currentmember.role === 'owner')
                    && member.role !== 'owner'
                    && member.id !== currentUserLogged.uid ? `<button data-typeId="${memberData.uid}" data-syntax="${syntax}"  class="remove-btn"><i id="i" class="fa-solid fa-user-minus"></i> Kick</button>` : ''}
${(currentmember.role === 'admin' || currentmember.role === 'owner')
                    && member.role !== 'owner'
                    && member.role !== 'admin'
                    && member.id !== currentUserLogged.uid ? `<button data-typeId="${memberData.uid}" data-syntax="${syntax}"  class="set-admin">Give Admin</button>` : ''}
${(currentmember.role === 'admin' || currentmember.role === 'owner')
                    && member.role !== 'owner'
                    && member.role === 'admin'
                    && member.id !== currentUserLogged.uid ? `<button data-typeId="${memberData.uid}" data-syntax="${syntax}"  class="remove-admin">Revoke Admin</button>` : ''}
        ${(currentmember.role === 'owner' && member.id !== currentUserLogged.uid) ? `<button data-typeId="${memberData.uid}" data-syntax="${syntax}"  class="give-owner"><i id="i" class="fa-solid fa-arrow-right-arrow-left"></i> Transfer Ownership</button>` : ''}
                </div>
                `;
            attendanceList.appendChild(listItem);
        } catch (error) {
            console.error(`Failed to fetch profile for member with ID ${member.id}:`, error);
        }
    }
    console.log("Profile", memberProfiles);
    async function updateAttendanceList(date) {
        const attendanceList = document.getElementById('attendance-List'); // Adjust based on your HTML structure
        if (!attendanceList) {
            console.error("Attendance list element not found.");
            return; // Exit if the attendance list element is not found
        }

        attendanceList.innerHTML = ''; // Clear existing list items before updating

        // Loop through members to update the attendance list
        for (const member of members) {
            try {
                const memberId = member.id; // Get member ID
                const attendanceRecord = member.attendance?.[date];
                console.log(`Checking attendance for date: ${date}`);
                console.log(`Attendance for member ${memberId}:`, member.attendance);

                // Extract status and time from attendance data
                const attendanceStatus = attendanceRecord ? attendanceRecord.status : 'Absent';
                const time = attendanceRecord && attendanceRecord.timeChecked ? convertTo12Hour(attendanceRecord.timeChecked) : "Not Available";

                // Find the member profile using memberId
                const memberData = memberProfiles.find(profile => profile.uid === memberId);

                // Get the display name or set a default value if not found
                const displayName = memberData ? memberData.displayName : 'Unknown Member';

                // Determine the color class based on status
                let statusClass = '';
                switch (attendanceStatus.toLowerCase()) {
                    case 'present':
                        statusClass = 'status-present'; // Green
                        break;
                    case 'late':
                        statusClass = 'status-late'; // Purple
                        break;
                    case 'absent':
                        statusClass = 'status-absent'; // Red
                        break;
                    default:
                        statusClass = ''; // Default class or leave it empty
                }

                // Create list item for the member
                const listItem = document.createElement('li');
                listItem.classList.add('list-item');
                listItem.innerHTML = `
                <div class="${statusClass}">
                    <img src=${memberData.photoUrl}></img>
                    <h3>${memberData.displayName}</h3>
                    <p>${capitalizeFirstLetter(attendanceStatus || 'Absent')}<br>${time}</p>
                </div>
                <div>
                    ${(currentmember.role === 'admin' || currentmember.role === 'owner')
                        && member.role !== 'owner'
                        && member.id !== currentUserLogged.uid ? `<label for="memberoptions${memberData.uid}"><i class="fa-solid fa-ellipsis"></i></label>` : ""}
                </div>
                <input class="option" type="checkbox" style="display: none;" id="memberoptions${memberData.uid}">
                <div id="memberoptions">
                    ${(currentmember.role === 'admin' || currentmember.role === 'owner')
                        && member.role !== 'owner'
                        && member.id !== currentUserLogged.uid ? `<button data-typeId="${memberData.uid}" data-syntax="${syntax}"  class="remove-btn"><i id="i" class="fa-solid fa-user-minus"></i> Kick</button>` : ''}
                    ${(currentmember.role === 'admin' || currentmember.role === 'owner')
                        && member.role !== 'owner'
                        && member.role !== 'admin'
                        && member.id !== currentUserLogged.uid ? `<button data-typeId="${memberData.uid}" data-syntax="${syntax}"  class="set-admin">Give Admin</button>` : ''}
                    ${(currentmember.role === 'admin' || currentmember.role === 'owner')
                        && member.role !== 'owner'
                        && member.role === 'admin'
                        && member.id !== currentUserLogged.uid ? `<button data-typeId="${memberData.uid}" data-syntax="${syntax}"  class="remove-admin">Revoke Admin</button>` : ''}
                    ${(currentmember.role === 'owner' && member.id !== currentUserLogged.uid) ? `<button data-typeId="${memberData.uid}" data-syntax="${syntax}"  class="give-owner"><i id="i" class="fa-solid fa-arrow-right-arrow-left"></i> Transfer Ownership</button>` : ''}
                </div>
                `;
                attendanceList.appendChild(listItem);
            } catch (error) {
                console.error(`Failed to fetch profile for member:`, error);
            }
        }
    }


    function getFilteredData(range, customRange = null) {
        const today = new Date();
        const filteredData = {};

        members.forEach(member => {
            const attendance = member.attendance;

            console.log(memberProfiles.find(profile => profile.uid === member.id), member.id)
            for (const date in attendance) {
                const attendanceDate = new Date(date);
                let withinRange = false;

                // Check if the attendance date is within the specified range
                switch (range) {
                    case 'week':
                        withinRange = (today - attendanceDate <= 7 * 24 * 60 * 60 * 1000);
                        break;
                    case 'month':
                        withinRange = (today - attendanceDate <= 30 * 24 * 60 * 60 * 1000);
                        break;
                    case 'year':
                        withinRange = (today - attendanceDate <= 365 * 24 * 60 * 60 * 1000);
                        break;
                    case 'custom':
                        if (customRange && customRange.startDate && customRange.endDate) {
                            const startDate = new Date(customRange.startDate);
                            const endDate = new Date(customRange.endDate);
                            withinRange = (attendanceDate >= startDate && attendanceDate <= endDate);
                        }
                        break;
                    default:
                        withinRange = false;
                }

                // If the date is within the selected range, process the attendance data
                if (withinRange) {
                    // Initialize the date entry if it doesn't exist
                    if (!filteredData[date]) {
                        filteredData[date] = {
                            present: { count: 0, names: [] },
                            late: { count: 0, names: [] },
                            absent: { count: 0, names: [] }
                        };
                    }

                    // Process attendance for the date
                    if (attendance[date]) {
                        const status = attendance[date].status; // Get the overall attendance status
                        filteredData[date][status].count++;
                        filteredData[date][status].names.push(
                            memberProfiles.find(profile => profile.uid === member.id).displayName
                        ); // Store the member's name
                    }
                }
            }
        });

        return filteredData;
    }


    // Function to update the chart with filtered data
    let attendanceChart;

    function updateCalendarHeatmap(range, customRange = null) {
        const filteredData = getFilteredData(range, customRange);
        const dates = Object.keys(filteredData).sort((a, b) => new Date(a) - new Date(b));
        const calendarContainer = document.getElementById('heatmap-calendar');

        // Clear the calendar
        calendarContainer.innerHTML = '';

        let lastMonth = '';

        // Generate the heatmap
        dates.forEach((date, index) => {
            const currentDate = new Date(date);
            const dayOfMonth = currentDate.getDate();
            const currentMonth = currentDate.toLocaleString('default', { month: 'short' });

            // Check if the month has changed
            if (currentMonth !== lastMonth) {
                lastMonth = currentMonth;
                const monthLabel = document.createElement('div');
                monthLabel.className = 'heatmap-month-label';
                monthLabel.textContent = currentMonth;
                calendarContainer.appendChild(monthLabel);
            }

            const data = filteredData[date];

            // Assuming you can calculate the number of members somehow (e.g., from `data`)
            const numberOfMembers = memberProfiles.length || 0; // Adjust to your data structure

            // Calculate the total expected attendance counts (each member is counted once)
            const total = numberOfMembers;

            // Calculate the combined "present + late" for the day (no distinction between morning/afternoon)
            const presentAndLate = (data?.present?.count || 0) + (data?.late?.count || 0);

            // Calculate the percentage for color intensity (scaled down slightly for clearer distinction)
            const percentage = total > 0 ? (presentAndLate / total) * 0.8 : 0;

            // Create the day element
            const dayDiv = document.createElement('div');
            dayDiv.className = 'heatmap-day';

            // Set the animation delay for each element based on its position in the loop
            const delay = index * 0.1; // Delay each element by 0.1s incrementally
            dayDiv.style.animationDelay = `${delay}s`;
            dayDiv.style.backgroundColor = `rgba(0, 255, 0, ${percentage})`;

            // Add the day number to the cube
            const dayLabel = document.createElement('span');
            dayLabel.className = 'day-label';
            dayLabel.textContent = dayOfMonth;

            // Add click event to the day div
            dayDiv.addEventListener('click', async () => {
                await updateAttendanceList(date); // Call your function to update the attendance list

                // Add a thick dotted border to the clicked day
                const allDays = document.querySelectorAll('.heatmap-day');
                allDays.forEach(day => {
                    day.classList.remove('clicked'); // Remove previous selection
                });
                dayDiv.classList.add('clicked'); // Add the clicked class to the current day
            });

            dayDiv.appendChild(dayLabel);
            calendarContainer.appendChild(dayDiv);
        });
    }


    document.getElementById('dateRange').addEventListener('change', function () {
        const selectedRange = this.value;
        const customRangeSelector = document.getElementById('customRangeSelector');

        if (selectedRange === 'custom') {
            customRangeSelector.style.display = 'block';
        } else {
            customRangeSelector.style.display = 'none';
        }
    });

    document.getElementById('applyDateRange').addEventListener('click', function () {
        const range = document.getElementById('dateRange').value;

        if (range === 'custom') {
            const startDate = document.getElementById('startDate').value;
            const endDate = document.getElementById('endDate').value;

            if (!startDate || !endDate) {
                alert('Please select both a start and an end date.');
                return;
            }

            //updateChart(range, { startDate, endDate });
            updateCalendarHeatmap(range, { startDate, endDate });
        } else {
            updateCalendarHeatmap(range);
            //updateChart(range);
        }
    });
    updateCalendarHeatmap("week");
    //updateChart("week");
}


async function updatememberList() {
    const currentUserlogged = await getCurrentUser();
    const currentmember = await fetchMember(syntax, currentUserlogged.uid)
    const members = await fetchMembers(syntax);

    const memberList = document.getElementById('memberList');
    if (!currentmember) {
        window.location.href = `classes.html`;
    }
    if (!memberList) {
        console.error('Element with ID "memberList" not found');
        return;
    }
    memberList.innerHTML = '';

    for (const member of members) {
        try {
            const memberData = await fetchProfile(member.id);
            console.log(memberData);

            const listItem = document.createElement('li');
            listItem.classList.add('list-item');
            listItem.innerHTML = `
<div>
<h3>${memberData.displayName}</h3>
<p><b>Role: ${capitalizeFirstLetter(member.role)}</b></p>
</div>
${(currentmember.role === 'admin' || currentmember.role === 'owner')
                    && member.role !== 'owner'
                    && member.id !== currentUserlogged.uid ? `<input style="display:none;" type="checkbox" id="userOptionsToggle${member.id}">` : ''}
    ${(currentmember.role === 'admin' || currentmember.role === 'owner')
                    && member.role !== 'owner'
                    && member.id !== currentUserlogged.uid ? `<label for="userOptionsToggle${member.id}" class="userOptionsToggle"><i id="i" class="fa-solid fa-gear"></i> Options</label>` : ''}
<div class="userOptions">
${(currentmember.role === 'admin' || currentmember.role === 'owner')
                    && member.role !== 'owner'
                    && member.id !== currentUserlogged.uid ? `<button data-typeId="${memberData.uid}" data-syntax="${syntax}"  class="remove-btn"><i id="i" class="fa-solid fa-user-minus"></i> Kick</button>` : ''}
${(currentmember.role === 'admin' || currentmember.role === 'owner')
                    && member.role !== 'owner'
                    && member.role !== 'admin'
                    && member.id !== currentUserlogged.uid ? `<button data-typeId="${memberData.uid}" data-syntax="${syntax}"  class="set-admin">Give Admin</button>` : ''}
${(currentmember.role === 'admin' || currentmember.role === 'owner')
                    && member.role !== 'owner'
                    && member.role === 'admin'
                    && member.id !== currentUserlogged.uid ? `<button data-typeId="${memberData.uid}" data-syntax="${syntax}"  class="remove-admin">Revoke Admin</button>` : ''}
        ${(currentmember.role === 'owner' && member.id !== currentUserlogged.uid) ? `<button data-typeId="${memberData.uid}" data-syntax="${syntax}"  class="give-owner"><i id="i" class="fa-solid fa-arrow-right-arrow-left"></i> Transfer Ownership</button>` : ''}
            </div>`;
            memberList.appendChild(listItem);
        } catch (error) {
            console.error(`Failed to fetch profile for member with ID ${member.id}:`, error);
        }
    }
}

document.addEventListener('DOMContentLoaded', async () => {
    const urlParams = new URLSearchParams(window.location.search);
    syntax = urlParams.get('syntax');
    console.log(syntax);
    let isInitialLoad = true;

    const classPosts = await fetchClassPosts(syntax);
    const currentUser = await getCurrentUser(); // Fetch the current user's email

    classPosts.forEach(post => {
        // Destructure the post object
        const { email, image, dateTime, description } = post;

        // Call the createPostItem function for each post
        createPostItem(email, image, dateTime, description, currentUser.email, post.id, post.userid, post.likes);
    })
    debouncedUpdateattList();
    debouncedUpdateList();

    if (syntax) {
        const form = document.getElementById('classEditform');
        const currentUserlogged = await getCurrentUser();
        const currentmember = await fetchMember(syntax, currentUserlogged.uid)

        if (currentmember.role === 'admin' || currentmember.role === 'owner') {
            form.style.display = 'block'; // Show the form
        } else {
            form.style.display = 'none'; // Hide the form
        }
        document.getElementById('leaveButton').addEventListener('click', async function (event) {
            event.preventDefault();
            if (await confirmNotif("Leave Class?", "Your attendance data will be removed from this class.") === true) {
                leaveClass(syntax);
            }
        });
        classroom = await fetchClass(syntax);
        if (classroom) {
            className.innerHTML = classroom.name;
            classCode.innerHTML = `<i>${classroom.code}</i> <i role="button" id="clipboard" class="fa-regular fa-clipboard"></i>`;
            document.getElementById('clipboard').addEventListener('click', async () => {
                console.log("Copying plain text...");
                const textToCopy = `Join *${classroom.name}* today to get your attendance checked.\n${window.location.origin}/dtr/classes.html?classCode=${classroom.code}`;
                try {
                    await navigator.clipboard.writeText(textToCopy);
                } catch (err) {
                }
            });
            document.title = `Class - ${classroom.name}`;
            function populateForm(classData) {
                // Set class name
                document.getElementById('class-Name').value = classData.name;

                // Set latitude and longitude
                document.getElementById('lat').value = classData.lat;
                document.getElementById('long').value = classData.long;

                // Set radius
                document.getElementById('radius').value = classData.rad;

                // Set time values for each day
                document.getElementById('timeInMondayfirst').value = classData.timeInMondayfirst;
                document.getElementById('timeInMondaylast').value = classData.timeInMondaylast;

                document.getElementById('timeInTuesdayfirst').value = classData.timeInTuesdayfirst;
                document.getElementById('timeInTuesdaylast').value = classData.timeInTuesdaylast;

                document.getElementById('timeInWednesdayfirst').value = classData.timeInWednesdayfirst;
                document.getElementById('timeInWednesdaylast').value = classData.timeInWednesdaylast;

                document.getElementById('timeInThursdayfirst').value = classData.timeInThursdayfirst;
                document.getElementById('timeInThursdaylast').value = classData.timeInThursdaylast;

                document.getElementById('timeInFridayfirst').value = classData.timeInFridayfirst;
                document.getElementById('timeInFridaylast').value = classData.timeInFridaylast;
            }

            // Call the function to populate the form
            populateForm(classroom);
        } else {
            window.location.href = `classes.html`;
        }
    } else {
        console.error('No syntax provided in URL');
    }
});

document.getElementById('attendance-List').addEventListener('click', async function (event) {
    if (event.target.classList.contains('remove-btn')) {
        var listItem = event.target.closest('li');
        var btn = event.target;
        let id = btn.getAttribute('data-typeId');

        try {
            await kickfromClass(syntax, id);
            updateattendanceList();
            console.log("Class removed successfully:", syntax);
        } catch (error) {
            console.error("Error removing class:", syntax, id, error);
        }
        listItem.remove();
    } else if (event.target.classList.contains('set-admin')) {
        var btn = event.target;
        let id = btn.getAttribute('data-typeId');
        changeMemberRole(syntax, id, "admin");
        updateattendanceList();
    } else if (event.target.classList.contains('remove-admin')) {
        var btn = event.target;
        let id = btn.getAttribute('data-typeId');
        changeMemberRole(syntax, id, "student");
        updateattendanceList();
    } else if (event.target.classList.contains('give-owner')) {
        var btn = event.target;
        let id = btn.getAttribute('data-typeId');
        const currentUserlogged = await getCurrentUser();
        changeMemberRole(syntax, currentUserlogged.uid, "admin");
        changeMemberRole(syntax, id, "owner");
        updateattendanceList();
    }
});

const attendanceSearchInput = document.getElementById('attendanceSearch');
const attendanceList = document.getElementById('attendance-List');

// Get initial list of items
let items2 = Array.from(attendanceList.getElementsByClassName('list-item'));

const filterClasses2 = () => {
    const searchTerm = attendanceSearchInput.value.toLowerCase();
    console.log('Search term:', searchTerm);
    items2.forEach(item => {
        const h3Text = item.querySelector('h3').textContent.toLowerCase();
        if (h3Text.includes(searchTerm)) {
            item.classList.remove('hidden');
        } else {
            item.classList.add('hidden');
        }
    });
};

// Event listener for search input
attendanceSearchInput.addEventListener('keyup', filterClasses2);

// Mutation Observer to watch for changes in the attendanceList
const observer2 = new MutationObserver(mutations => {
    mutations.forEach(mutation => {
        if (mutation.addedNodes.length || mutation.removedNodes.length) {
            // Update items array and reapply filter
            items2 = Array.from(attendanceList.getElementsByClassName('list-item'));
            filterClasses2();
        }
    });
});

// Start observing the attendanceList for changes
observer2.observe(attendanceList, { childList: true });

// Initial filter
filterClasses2();

let labeledDescriptors = [];

async function handleImageUpload(event) {
    const loadingBar = document.getElementById('loading-bar');
    loadingBar.style.transform = 'translateX(-100%)';
    const file = event.target.files[0];
    if (!file) {
        console.error('No file provided.');
        return;
    }

    const img = new Image();
    const reader = new FileReader();

    return new Promise((resolve, reject) => {
        reader.onload = function (e) {
            img.src = e.target.result;
        };

        reader.onerror = function (error) {
            console.error('Error reading file:', error);
            reject('Error reading file.');
        };

        img.onload = async function () {
            loadingBar.style.transform = 'translateX(-98%)';
            const canvass = document.getElementById('canvass');
            //canvass.style.display = 'flex';
            const faces = await faceDetect(file);

            const matchResults = [];
            let index = 0;
            for (let memberProfile of memberProfiles) {
                index = index + 1;
                const totalMember = members.length;
                console.log(`translateX(${-98 + (50 / (totalMember / index))}%)`);
                console.log(90 / (totalMember / index));

                // Update the loading bar position
                loadingBar.style.transform = `translateX(${-98 + (50 / (totalMember / index))}%)`;

                // Ensure the profile has face descriptors and handle brute-force update if necessary
                if (memberProfile) {
                    console.log(memberProfile)
                    memberProfile = await fetchProfile(memberProfile.userid, true);
                    // Brute-force logic: Check if faceDescriptors are missing or invalid
                    if (!Array.isArray(memberProfile.faceDescriptors)) {
                        console.log(`Invalid or missing face descriptors for member: ${memberProfile.displayName}. Attempting brute-force update...`);
                    }

                    // Re-check after the brute-force update
                    if (Array.isArray(memberProfile.faceDescriptors)) {
                        console.log(`Descriptors for ${memberProfile.displayName}:`, memberProfile.faceDescriptors);

                        // Push the valid descriptors into the labeledDescriptors
                        labeledDescriptors.push(
                            new faceapi.LabeledFaceDescriptors(
                                String(memberProfile.uid), // Member's name as label
                                [new Float32Array(memberProfile.faceDescriptors)] // Wrap it in an array
                            )
                        );
                    } else {
                        console.log(`Invalid face descriptor length for member: ${memberProfile.displayName}. Expected 128.`);
                    }
                } else {
                    console.log(`No profile found for member: ${memberProfile.displayName}`);
                }
            }

            const canvas = document.getElementById('canvas');
            if (!canvas) {
                console.error('Canvas element not found.');
                return reject('Canvas element not found.');
            }

            const ctx = canvas.getContext('2d', { willReadFrequently: true });
            if (!ctx) {
                console.error('2D context not available.');
                return reject('2D context not available.');
            }

            // Only create the FaceMatcher if there are labeled descriptors
            if (labeledDescriptors.length > 0) {

                const faceMatcher = new faceapi.FaceMatcher(labeledDescriptors, 0.5);
                const facesCanvas = document.getElementById('faces'); // Ensure this canvas exists in your HTML
                const facesCtx = facesCanvas.getContext('2d');

                const croppedFaces = []; // Array to hold cropped face images
                const faceWidth = 50; // Set a width for the cropped face
                const faceHeight = 50; // Set a height for the cropped face

                let xOffset = 0; // Position to start drawing faces on the new canvas
                facesCtx.clearRect(0, 0, facesCanvas.width, facesCanvas.height);
                for (const [index, face] of faces.entries()) {
                    const bestMatch = faceMatcher.findBestMatch(face.descriptor);
                    const label = bestMatch.label !== 'unknown' ? bestMatch.label : 'Unknown';
                    const box = face.detection.box;
                    const totalfaces = faces.length;
                    console.log(`translateX(${-48 + (42 / (totalfaces / index))}%)`)
                    console.log(90 / (totalfaces / index))
                    loadingBar.style.transform = `translateX(${-48 + (42 / (totalfaces / index))}%)`;
                    // Create a temporary canvas for the cropped face
                    const temp = document.getElementById('temp');
                    temp.width = canvas.width;
                    temp.height = canvas.height;
                    const tempCtx = temp.getContext('2d');
                    const croppedFaceCanvas = document.createElement('canvas');
                    croppedFaceCanvas.width = faceWidth;
                    croppedFaceCanvas.height = faceHeight;
                    const croppedFaceCtx = croppedFaceCanvas.getContext('2d');
                    tempCtx.drawImage(img, 0, 0, canvas.width, canvas.height);
                    // Draw the cropped face onto the temporary canvas
                    croppedFaceCtx.drawImage(
                        temp, // Main canvas
                        box.x, box.y, box.width, box.height, // Source rectangle from the main canvas
                        0, 0, faceWidth, faceHeight // Destination rectangle on the temporary canvas
                    );


                    // Store the cropped face image
                    croppedFaces.push(croppedFaceCanvas);

                    // Draw the cropped face on the facesCanvas
                    facesCtx.drawImage(croppedFaceCanvas, xOffset, 0, faceWidth, faceHeight);
                    xOffset += faceWidth; // Move the xOffset for the next face

                    // Draw label on original canvas
                    if (bestMatch.label !== 'unknown') {
                        console.log(`Face ${index + 1} matches with ${bestMatch.label}`);
                        matchResults.push(bestMatch.label); // Store the UID of the best match

                        // Fetch display name

                        ctx.fillStyle = 'white'; // Text color
                        ctx.fillText(label, box.x, box.y - 20); // Draw label
                    } else {
                        console.log(`Face ${index + 1} did not match any member.`);
                        ctx.fillStyle = 'white'; // Text color
                        ctx.fillText(label, box.x, box.y - 20); // Draw label
                    }
                    canvass.style.display = 'none'
                    document.getElementById('camera-input').value = '';
                }
            } else {
                console.log("No valid labeled descriptors found; FaceMatcher cannot be created.");
            }


            addPostTemplate(img.src, matchResults);
            resolve();
        };

        reader.readAsDataURL(file);
    });
}


async function addPostTemplate(img, matches) {
    const loadingBar = document.getElementById('loading-bar');
    loadingBar.style.transform = 'translateX(100%)'
    const posts = document.getElementById('posts');
    const options = { month: 'short', day: 'numeric', year: 'numeric' };
    const currentDate = new Date().toLocaleDateString('en-US', options);
    const currentTime = new Date().toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true, // Ensures AM/PM format
    });
    // Check if a template with the class 'template' already exists
    const existingTemplate = document.querySelector('.template');

    let pretags = [];
    let preemails = [];

    // Loop through matches to create tags
    for (const match of matches) {
        const memberProfile = await fetchProfile(match);
        if (memberProfile && memberProfile.displayName) {
            // Replace spaces with underscores and prepend @

            const tag = '@' + memberProfile.displayName.replace(/\s+/g, '_'); // Display only the username
            pretags.push(tag);
            preemails.push(memberProfile.email);
        }
    }

    // Join the tags into a string
    const tagsString = pretags.join(' ');


    if (!existingTemplate) {
        // Create the template
        const user = await getCurrentUser();
        const userdata = await fetchProfile(user.uid);
        const template = document.createElement('li');
        template.className = 'template';
        template.id = 'post';
        template.innerHTML = `
        <div id="postHeader">
        <img class="img" src="${userdata.photoUrl}">
            <p>${user.displayName}</p>
        </div>
            <img id="postImg" src="${img}" alt="Post Image">
            <div id="suggestion-box"></div>
            <textarea maxlength="1500" id="desc" placeholder="Enter description here...">${tagsString}</textarea>
            <p>${currentDate} ${currentTime}</p>
            <div id="post-buttons">
            <button class="post-button" id="postPost">Post</button>
            <button class="post-button" id="cancelPost">Cancel</button>
            </div>
        `;
        posts.insertBefore(template, posts.firstChild);
        const targetElement = template.querySelector('#postHeader');
        targetElement.scrollIntoView({ behavior: 'smooth', block: 'start' });

        let tags = [];
        let emails = [];

        tags = pretags;
        emails = preemails;

        template.querySelector('#desc').addEventListener('input', function (e) {
            const textarea = this;
            let previousScrollHeight = textarea.scrollHeight;
            // Automatically adjust height based on content
            this.style.height = 'auto';
            this.style.height = (this.scrollHeight) + 'px';

            const value = textarea.value;
            if (textarea.scrollHeight > previousScrollHeight) {
                //addNewLineToTextarea(textarea);
            }
            // Measure the current width of the text and apply a line break if neede

            // Check for @mentions
            const caretPosition = textarea.selectionStart; // Get caret position
            const beforeCaretText = value.slice(0, caretPosition); // Get text before the caret

            // Find the word before the caret by splitting at spaces
            const wordsBeforeCaret = beforeCaretText.split(/\s+/);
            const currentWord = wordsBeforeCaret[wordsBeforeCaret.length - 1];

            // Regular expression to find all strings starting with '@'
            const atMentions = value.match(/@(\w[\w_]*)/g) || [];

            let newtags = [...pretags]; // Start with pre-loaded tags
            let newemails = [...preemails]; // Start with pre-loaded emails

            // Check for each mention
            for (const mention of atMentions) {
                const searchTerm = mention.slice(1); // Remove '@' to get the search term
                const closestMatch = findClosestMember(searchTerm);

                if (closestMatch) {
                    showSuggestion(closestMatch.displayName);
                    // Check if the mention is already in newtags
                    if (!newtags.includes(mention)) {
                        newtags.push(mention); // Add the mention to tags
                        newemails.push(closestMatch.email); // Add the member's email to emails
                    }
                } else {
                    hideSuggestion();
                }
            }

            // Hide suggestion if no mentions
            if (atMentions.length === 0) {
                hideSuggestion();
            }

            const updatedTags = newtags.filter(tag => atMentions.includes(tag));

            const uniqueEmailsSet = new Set();

            // Filter emails based on the updated tags and also keep preemails that still have a tag
            updatedTags.forEach(tag => {
                const index = newtags.indexOf(tag);
                if (index !== -1) {
                    uniqueEmailsSet.add(newemails[index]); // Keep the email for this tag
                }
            });

            // Now add emails for any remaining preloaded tags that still exist
            pretags.forEach((tag, index) => {
                if (updatedTags.includes(tag)) {
                    uniqueEmailsSet.add(preemails[index]); // Keep corresponding email if tag still exists
                }
            });

            // Convert the Set back to an array for unique emails
            newemails = Array.from(uniqueEmailsSet);

            // Update the global tags and emails
            tags = updatedTags;
            emails = newemails;

            console.log(tags, emails)
            // Check if the current word contains '@' and show/hide suggestions
            if (currentWord.startsWith('@')) {
                const searchTerm = currentWord.slice(1); // Remove '@' to get the search term
                if (searchTerm.length > 0) {
                    const closestMatch = findClosestMember(searchTerm);
                    if (closestMatch) {
                        showSuggestion(closestMatch.displayName); // Show suggestion if match found
                    }
                }
            } else {
                hideSuggestion(); // Hide suggestions if no '@' in the current word
            }

            // Helper function to find the closest member
            function findClosestMember(searchTerm) {
                const matches = memberProfiles.filter(member =>
                    member.displayName.replace(/\s+/g, '_').toLowerCase().includes(searchTerm.toLowerCase())
                );

                return matches.length > 0 ? matches[0] : null;
            }

            // Function to display the suggestion box
            function showSuggestion(text) {
                const suggestionBox = template.querySelector('#suggestion-box');
                const caretPos = getCaretCoordinates(textarea);

                suggestionBox.textContent = text;
                suggestionBox.style.top = caretPos.top + 'px';
                suggestionBox.style.left = caretPos.left + 'px';
                suggestionBox.style.display = 'block'; // Show the suggestion box

                // Check for overflow after displaying the suggestion box
                checkOverflow(suggestionBox);
            }

            // Function to check if the suggestion box is overflowing the viewport
            function checkOverflow(suggestionBox) {
                const boxRect = suggestionBox.getBoundingClientRect();

                // Check if suggestion box overflows the right or bottom of the viewport
                const isOverflowingRight = boxRect.right > window.innerWidth;
                const isOverflowingBottom = boxRect.bottom > window.innerHeight;

                // Adjust position if it's overflowing the right
                if (isOverflowingRight) {
                    suggestionBox.style.left = (window.innerWidth - boxRect.width) + 'px'; // Adjust to stay within the right boundary
                }

                // Adjust position if it's overflowing the bottom
                if (isOverflowingBottom) {
                    suggestionBox.style.top = (window.innerHeight - boxRect.height) + 'px'; // Adjust to stay within the bottom boundary
                }
            }

            // Function to hide the suggestion box
            function hideSuggestion() {
                const suggestionBox = document.querySelector('#suggestion-box');
                suggestionBox.style.display = 'none'; // Hide the suggestion box
            }

            // Function to calculate the caret's coordinates within the textarea
            function getCaretCoordinates(textarea) {
                const text = textarea.value.substr(0, textarea.selectionStart);
                const textLines = text.split("\n");

                const currentLine = textLines[textLines.length - 1]; // Text in the current line
                const fontSize = parseInt(window.getComputedStyle(textarea).fontSize);
                const lineHeight = fontSize * 1.2; // Adjust based on font size

                const { top, left } = textarea.getBoundingClientRect(); // Get the textarea position

                const lineNumber = textLines.length; // Current line number
                const columnNumber = currentLine.length; // Caret position in the current line

                // Calculate the caret's position relative to the textarea
                const caretTop = top + lineHeight * (lineNumber - 1); // Adjust for the line number
                const caretLeft = left + columnNumber * fontSize * 0.6; // Approximate caret position horizontally

                return {
                    top: caretTop + window.scrollY,
                    left: caretLeft + window.scrollX
                };
            }
        });


        template.querySelector('#postPost').addEventListener('click', async () => {
            try {
                const description = template.querySelector('#desc').value;
                const postSyntax = await generateUniquePostSyntax(syntax);
                const buttons = template.querySelector('#post-buttons');
                buttons.innerHTML = "<p>Posting...<p>";

                loadingBar.style.transform = 'translateX(-100%)';
                await postPost(user.email, img, currentDate, currentTime, description, syntax, postSyntax, user.uid);

                // Attempt to get location
                const location = await getCurrentLocation();
                const distance = calculateDistance(
                    location.latitude,
                    location.longitude,
                    classroom.lat,
                    classroom.long
                );
                console.log(distance)
                if (distance <= classroom.rad) {
                    const attendance = await checkAttendance(syntax, classroom.timezone, user.uid);
                    updateattendanceList();
                    console.log(attendance)
                    basicNotif(`Attandance checked`, user.displayName, 5000);
                };

                if (emails) {
                    const href = `https://shoyunsine.github.io/dtr/post.html?postId=${postSyntax}&syntax=${syntax}`;
                    const emailPromises = emails.map(email => emailTagged(email, classroom.name, user.displayName, description, href));
                    await Promise.all(emailPromises);
                }

                if (distance <= classroom.rad && matches) {
                    const attendancePromises = matches.map(async match => {
                        console.log(match);
                        await checkAttendance(syntax, classroom.timezone, match);
                        updateattendanceList();
                    });
                    await Promise.all(attendancePromises);
                }

                await createPostItem(user.email, img, `${currentDate} ${currentTime}`, description, user.email, postSyntax, user.uid, 0, matches);
                loadingBar.style.transform = 'translateX(100%)';
                cancelFunction(template);

            } catch (error) {
                console.error("Error getting location or posting:", error);
                buttons.innerHTML = "<p>Error: Could not complete the post. Please check location permissions.</p>";
                loadingBar.style.transform = 'translateX(0%)'; // Reset loading bar if there's an error
            }
        });


        template.querySelector('#cancelPost').addEventListener('click', () => {// Hide loading bar when done
            cancelFunction(template);
        });
    } else {
        console.log('Post template already exists.');
    }
}

function cancelFunction(template) {
    // Remove the template from the DOM
    template.remove();
}



document.getElementById('camera-button').addEventListener('click', () => {
    document.getElementById('camera-input').click();
});

document.getElementById('attendButton').addEventListener('click', async () => {
    const user = await getCurrentUser();
    const location = await getCurrentLocation();
    
    const distance = calculateDistance(
        location.latitude,
        location.longitude,
        classroom.lat,
        classroom.long
    );

    console.log(distance);

    if (distance > classroom.rad) {
        basicNotif(
            `You are ${Math.floor(distance)}m away from the classroom location`,
            `You must be within ${classroom.rad}m of the pinned location`,
            5000
        );
        return; // Stop execution if the user is too far
    }

    basicNotif("Verifying face...", "Please look at the camera.", 5000);

    const verification = await verifyCurrentUser(video,user.uid);
    if (!verification) {
        return;
    }
    // Proceed with attendance check
    const attendance = await checkAttendance(syntax, classroom.timezone, user.uid);
    updateattendanceList();
    console.log(attendance);
    basicNotif("Attendance checked", user.displayName, 5000);
});

// Event listener to handle the file input change
document.getElementById('camera-input').addEventListener('change', handleImageUpload);
async function createPostItem(email, img, dateTime, description, currentUserEmail, postId, userid, likes) {
    const user = await getCurrentUser();
    const currentMemberData = await fetchMember(syntax, user.uid);
    const userdata = await fetchProfile(userid);
    const posts = document.getElementById('posts');
    const template = document.createElement('li');
    template.id = 'post';

    description = description.replace(/(@[\w_\.]+)/g, function (match) {
        return `<span class="tag">${match.replace(/_/g, ' ')}</span>`;
    });

    // Wrap #hashtags with <span> tags
    description = description.replace(/(#[\w_\.]+)/g, function (match) {
        return `<span class="tag">${match.replace(/_/g, ' ')}</span>`;
    });

    // Make text between * bold
    description = description.replace(/\*(.*?)\*/g, function (match, content) {
        return `<strong>${content}</strong>`;
    });

    // Make text between *^ very bold
    description = description.replace(/\+\+(.*?)\+\+/g, function (match, content) {
        return `<b style="font-weight: bold; font-size: 1.1em;">${content}</b>`; // Using <b> for very bold
    });
    // Italicize text between //
    description = description.replace(/\/\/(.*?)\/\//g, function (match, content) {
        return `<i>${content}</i>`;
    });

    // Change font size using ^n (e.g., ^2(text))
    description = description.replace(/\^(\d+)\((.*?)\)/g, function (match, size, content) {
        return `<span style="font-size: ${size}em;">${content}</span>`;
    });

    const timeDisplay = formatTimeDifference(dateTime);

    template.innerHTML = `
        <div id="postHeader">
            <div>
                <img class="img" src="${userdata.photoUrl}">
                <div>
                <p>${userdata.displayName}</p>
                </div>
            </div>
            <label for="postOptionstoggle${postId}"><i class="fa-solid fa-ellipsis-vertical"></i></label>
        </div>
        <input style="display:none;" class="like" type="checkbox" id="like${postId}">
        <div class="loader">
            <div class="circle top"></div>
            <div class="circle top"></div>
            <div class="circle bottom"></div>
            <div class="circle bottom"></div>
        </div>
        <img id="postImg" src="${img}" alt="Post Image">
        <div id="postButtons">
            <label id="heartUncheck" for="like${postId}"><i class="fa-regular fa-heart"></i></label>
            <label id="heartCheck" for="like${postId}"><i class="fa-solid fa-heart"></i></label>
            <label for="comments${postId}"><i class="fa-regular fa-message"></i></label>
        </div>
        <a id="likes">${likes} likes</a>
        <input type="checkbox" id="toggle">
                        <p id="desc">${description}</p>
                        <label for="toggle" id="toggleText">... Read More</label>
                        <label for="toggle" id="toggleTextShow">... Show Less</label>
        <label for="commentSectionToggle${postId}" style="display:none;" id="commentsToggleLabel${postId}">
        Show Comments</label>
        <p>${timeDisplay}</p>
        <input class="option" type="checkbox" id="postOptionstoggle${postId}">
        <input style="display:none;" class="comment" type="checkbox" id="comments${postId}">
        <input style="display:none;" class="commentToggle" type="checkbox" id="commentSectionToggle${postId}">
        <div id="postOptions">
            ${email === currentUserEmail || currentMemberData.role === 'owner' || currentMemberData.role === 'admin' ?
            `<button class="postOptionButton" id="deletePost" data-post-id="${postId}">Delete Post <i class="fa-solid fa-trash"></i></button>` :
            ''}
        </div>
        <div id="commentSection">
        <div id="commentArea">
            <img class="img" src="${user.photoURL}"><textarea maxlength="150" id="commentInput${postId}" placeholder="Comment here"></textarea><i id="postComment${postId}" class="fa-solid fa-paper-plane"></i><a>Send</a>
        </div>
        </div>
        <div class="comments" id="commentSection${postId}">
        <label for="commentSectionToggle${postId}" id="commentsToggleLabel${postId}">
        Comments</label>
            <div id="commentsContainer${postId}">
            </div>
        </div>
    `;

    posts.insertBefore(template, posts.firstChild);
    const imgElement = template.querySelector('#postImg');
    const loader = template.querySelector('.loader');

    // Load the image
    imgElement.src = img;
    imgElement.style.display = 'none';
    // Show loader until the image loads
    imgElement.onload = () => {
        loader.style.display = 'none'; // Hide loader
        imgElement.style.display = 'block'; // Show image
    };

    imgElement.addEventListener('click', () => {
        window.location.href = `post.html?postId=${encodeURIComponent(postId)}&syntax=${encodeURIComponent(syntax)}`;
    });

    const likeCheckbox = template.querySelector(`#like${postId}`);
    const desc = template.querySelector('#desc');
    const toggleText = template.querySelector('#toggleText');
    const toggleTextShow = template.querySelector('#toggleTextShow');
    console.log(desc.scrollHeight > 110);
    if (desc.scrollHeight > 110) {
        desc.style.height = '110px';
        toggleText.style.display = 'inline';
        toggleTextShow.style.display = 'none'; // Hide "Show Less" by default
    } else {
        // Hide the toggle buttons if content doesn't overflow
        toggleText.style.display = 'none';
        toggleTextShow.style.display = 'none';
    }
    template.querySelector('#toggle').addEventListener('change', function () {
        if (this.checked) {
            desc.style.height = `${desc.scrollHeight}px`;
            toggleText.style.display = 'none';
            toggleTextShow.style.display = 'inline';
        } else {
            desc.style.height = '110px';
            toggleText.style.display = 'inline';
            toggleTextShow.style.display = 'none';
        }
    });

    // Check if the post is liked by the current user on page load
    const postRef = doc(db, 'posts', postId);
    const postSnapshot = await getDoc(postRef);

    if (postSnapshot.exists()) {
        const postData = postSnapshot.data();
        const postLikes = postData.userlikes || []; // Get the 'likes' array or an empty array if it doesn't exist

        if (postLikes.includes(user.uid)) {
            likeCheckbox.checked = true; // Check the checkbox if user has liked the post
        }
    }

    // Toggle like status on checkbox change
    likeCheckbox.addEventListener('change', async () => {
        const likestxt = template.querySelector('#likes');

        if (likeCheckbox.checked) {
            likestxt.innerHTML = `${likes + 1} likes`;
            likes = likes + 1;
            await addToLikedPosts(user.uid, postId); // Add user ID to the post's likes array
        } else {
            likestxt.innerHTML = `${likes - 1} likes`;
            likes = likes - 1;
            await removeFromLikedPosts(user.uid, postId); // Remove user ID from the post's likes array
        }
    });

    function makeCommentSectionDraggable(postId) {
        const commentSection = document.getElementById(`commentSection${postId}`);
        const commentToggle = document.getElementById(`commentSectionToggle${postId}`);

        let startY = 0;
        let currentY = 0;
        let isDragging = false;

        const dragThreshold = 50;
        const initialBottomPercent = -1; // Adjust as needed
        const dragScaleFactor = 0.3;

        // Create the "Refresh Comments" message
        const refreshMessage = document.createElement('div');
        refreshMessage.textContent = 'Refresh Comments';
        refreshMessage.style.position = 'absolute';
        refreshMessage.style.bottom = '100%'; // Position above the comment section
        refreshMessage.style.left = '50%';
        refreshMessage.style.transform = 'translateX(-50%)';
        refreshMessage.style.fontSize = '12px';
        refreshMessage.style.padding = '5px 10px';
        refreshMessage.style.backgroundColor = 'rgba(0, 0, 0, 0.8)';
        refreshMessage.style.color = 'white';
        refreshMessage.style.borderRadius = '15px';
        refreshMessage.style.display = 'none'; // Hidden by default
        commentSection.appendChild(refreshMessage);

        // Function to handle the start of the drag
        function startDrag(event) {
            if (event.target === commentSection) {
                isDragging = true;
                startY = event.touches ? event.touches[0].clientY : event.clientY;
                commentSection.style.transition = 'none'; // Disable smooth transition during drag
            }
        }

        // Function to handle dragging
        function drag(event) {
            if (!isDragging) return;

            currentY = event.touches ? event.touches[0].clientY : event.clientY;
            let dragDistance = currentY - startY;

            // Show refresh message when dragging upwards
            if (dragDistance < -10) {
                refreshMessage.style.display = 'block';
            } else {
                refreshMessage.style.display = 'none';
            }

            // Adjust the bottom property based on the drag distance
            if (dragDistance > 0) {
                commentSection.style.bottom = `calc(${initialBottomPercent}% - ${dragDistance}px)`;
            }
            if (dragDistance < 0) {
                dragDistance *= dragScaleFactor;
                refreshMessage.style.bottom = `calc(${100}% - ${dragDistance / 12}px)`; // Position above the comment section
                commentSection.style.height = `calc(${50}% - ${dragDistance * 2}px)`;
                commentSection.style.bottom = `calc(${initialBottomPercent}% - ${dragDistance / 12}px)`;
            }
        }

        // Function to handle the end of the drag
        async function endDrag() {
            if (!isDragging) return;
            isDragging = false;
            commentSection.style.transition = 'bottom 0.3s ease'; // Re-enable smooth transition

            const dragDistance = currentY - startY;

            // Hide the refresh message after dragging ends
            refreshMessage.style.display = 'none';
            commentSection.style.height = ''
            if (dragDistance > dragThreshold) {

                commentSection.style.bottom = ''; // Close the comment section
                commentToggle.checked = false;
            } else if (dragDistance < -10) {
                await displayComments(postId); // Call your refresh function
                commentSection.style.bottom = `${initialBottomPercent}%`;
            } else {
                commentSection.style.bottom = `${initialBottomPercent}%`; // Reset to the original position
            }
        }

        // Attach event listeners for mouse and touch events
        commentSection.addEventListener('mousedown', startDrag);
        commentSection.addEventListener('mousemove', drag);
        commentSection.addEventListener('mouseup', endDrag);
        commentSection.addEventListener('mouseleave', endDrag);

        commentSection.addEventListener('touchstart', startDrag);
        commentSection.addEventListener('touchmove', drag);
        commentSection.addEventListener('touchend', endDrag);

        // Prevent child elements from triggering drag
        commentSection.addEventListener('mousedown', (event) => {
            if (event.target !== commentSection) {
                event.stopPropagation();
            }
        });
        commentSection.addEventListener('touchstart', (event) => {
            if (event.target !== commentSection) {
                event.stopPropagation();
            }
        });
    }

    makeCommentSectionDraggable(postId);

    template.querySelector(`#postComment${postId}`).addEventListener('click', async () => {
        const commentInput = template.querySelector(`#commentInput${postId}`);
        const commentText = commentInput.value.trim();

        if (commentText) {
            await sendCommentToPost(postId, user.uid, commentText);
            commentInput.value = ''; // Clear the input after sending
        } else {
            alert('Please enter a comment before sending.');
        }
    });

    function observeComments(postId) {
        const commentsContainer = template.querySelector(`#commentsContainer${postId}`);
        const commentsToggleLabel = template.querySelector(`#commentsToggleLabel${postId}`);

        // Function to update the visibility of the checkbox label
        function updateCommentsToggle() {
            if (commentsContainer.children.length > 0) {
                commentsToggleLabel.textContent = `View ${commentsContainer.children.length} ${commentsContainer.children.length > 1 ? 'comments' : 'comment'}`;
                commentsToggleLabel.style.display = 'block';
            } else {
                // Hide the checkbox if no comments exist
                commentsToggleLabel.style.display = 'none';
            }
        }

        updateCommentsToggle();

        const observer = new MutationObserver(() => {
            updateCommentsToggle();
        });

        observer.observe(commentsContainer, { childList: true });
    }

    observeComments(postId);
    if (email === currentUserEmail || currentMemberData.role === 'owner' || currentMemberData.role === 'admin') {
        template.querySelector('#deletePost').addEventListener('click', async (event) => {
            const postId = event.target.getAttribute('data-post-id');
            await deletePost(postId, syntax); // Add deletePost function to remove the post
            cancelFunction(template);
        });
    };

    await displayComments(postId);
}
function formatTimeDifference(dateTime) {
    const postDate = new Date(dateTime); // Parse the date string
    const currentDate = new Date(); // Get the current date/time
    const timeDiff = Math.abs(currentDate - postDate); // Difference in milliseconds

    const seconds = Math.floor(timeDiff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    const weeks = Math.floor(days / 7);

    if (seconds < 60) {
        return 'Just now';
    } else if (minutes < 60) {
        return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
    } else if (hours < 24) {
        return `${hours} hour${hours > 1 ? 's' : ''} ago`;
    } else if (days === 1) {
        return 'Yesterday';
    } else if (days < 7) {
        return `${days} day${days > 1 ? 's' : ''} ago`;
    } else if (weeks < 4) {
        return `${weeks} week${weeks > 1 ? 's' : ''} ago`;
    } else {
        const options = { month: 'long', day: 'numeric' }; // Format as "Month Day"
        return postDate.toLocaleDateString(undefined, options);
    }
}

document.getElementById('classEditform').addEventListener('submit', async (event) => {
    event.preventDefault(); // Prevent the default form submission

    // Create a FormData object
    const formData = new FormData(event.target);

    // Filter form values to exclude empty ones
    const formValues = Object.fromEntries(
        [...formData.entries()].filter(([key, value]) => value.trim() !== "")
    );

    // Log the filtered values
    console.log('Filtered Form Values:', formValues);
    await updateClass(syntax, formValues);
    basicNotif("Class Updated", "Succesfully updated data", 5000)
    // Handle the filtered data (e.g., send it to a server or update UI)
});

function getDistance(lat1, lon1, lat2, lon2) {
    const R = 6371; // Earth radius in km
    const toRad = (x) => (x * Math.PI) / 180;

    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);

    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c; // distance in km
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

function getLocation() {
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

function updateDistance(userLat, userLon, classLat, classLon) {
    const distanceElement = document.getElementById('currentDis');
    if (!distanceElement) return;

    if (classLat != null && classLon != null) {
        const distance = getDistance(userLat, userLon, classLat, classLon);
        distanceElement.textContent = `${distance.toFixed(2)} km`;
    } else {
        distanceElement.textContent = "Class location not set";
    }
}


function watchLocation() {
    if (!navigator.geolocation) {
        console.error("Geolocation is not supported by this browser.");
        document.getElementById('currentDis').textContent = "Location unavailable";
        return;
    }

    navigator.geolocation.watchPosition(
        (position) => {
            const { latitude, longitude } = position.coords;
            console.log("Updated position:", latitude, longitude);
            updateDistance(latitude, longitude, classroom.lat, classroom.long);
        },
        (error) => {
            console.error("Error watching position:", error.message);
            document.getElementById('currentDis').textContent = "Unable to get location";
        },
        {
            enableHighAccuracy: true, // Get best location data
            timeout: 5000, // 5 seconds
            maximumAge: 0 // No caching
        }
    );
}

// Call it when your page loads
watchLocation();
