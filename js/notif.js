export async function basicNotif(title, body, timeout) {
    const notifs = document.getElementById('notifs');
    if (!notifs) {
        console.error('Element with ID "notifs" not found.');
        return;
    }

    const notification = document.createElement('div');
    notification.classList.add('notification');
    notification.innerHTML = `
        <h3 class="notiftitle">${title || ""}</h3>
        <p class="notifbody">${body || ""}</p>
    `;

    notifs.appendChild(notification);

    // Add a class to trigger a CSS transition or animation for the notification
    setTimeout(() => {
        notification.classList.add('death');
    }, timeout);

    // Remove the notification after the specified time plus an additional buffer time
    setTimeout(() => {
        notification.remove();
    }, timeout + 500);
}

export function confirmNotif(title, body) {
    return new Promise((resolve) => {
        const notifs = document.getElementById('notifs');
        if (!notifs) {
            console.error('Element with ID "notifs" not found.');
            resolve(false);
            return;
        }

        const notification = document.createElement('div');
        notification.classList.add('notification');
        notification.innerHTML = `
            <h3 class="notiftitle">${title || ""}</h3>
            <p class="notifbody">${body || ""}</p>
            <div class="buttons">
                <button class="true">Confirm</button>
                <button class="false">Cancel</button>
            </div>
        `;

        notifs.appendChild(notification);

        function handleClick(event) {
            if (event.target.classList.contains('true')) {
                resolve(true);
            } else if (event.target.classList.contains('false')) {
                resolve(false);
            } else {
                return; // Ignore clicks that are not on the buttons
            }

            // Trigger animation and removal only when a button is clicked
            notification.classList.add('death');
            setTimeout(() => {
                notification.remove();
            }, 500);

            notification.removeEventListener('click', handleClick);
        }

        // Attach the event listener only to the button container
        notification.querySelector(".buttons").addEventListener('click', handleClick);
    });
}


export async function sendNotification(body) {
    console.log("Sending")
    if (Notification.permission === 'granted') {
        new Notification("Logbook", {
            body: body,               // The body of the notification
            icon: '/Images/logo.png',       // Notification icon
            badge: '/Images/logo.png',     // Badge icon (small icon in notification)
        });
    }
}