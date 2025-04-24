import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";

const luxonScript = document.createElement('script');
luxonScript.src = 'https://cdn.jsdelivr.net/npm/luxon@3.2.0/build/global/luxon.min.js';
document.head.appendChild(luxonScript);

let DateTime;

luxonScript.onload = function () {
    DateTime = window.luxon.DateTime;
}

import {
    getAuth,
    onAuthStateChanged,
    signInWithPopup,
    GoogleAuthProvider,
    signInWithEmailAndPassword,
    createUserWithEmailAndPassword,
    signOut,
    setPersistence,
    browserSessionPersistence,
    inMemoryPersistence,
    browserLocalPersistence
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";

import { getAnalytics } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-analytics.js";

import {
    getFirestore,
    doc,
    setDoc,
    getDoc,
    collection,
    query,
    where,
    getDocs,
    setDoc as setSubDoc,
    deleteDoc,
    onSnapshot,
    orderBy,
    updateDoc,
    deleteField,
    increment,
    addDoc,
    limit,
    arrayUnion,
    arrayRemove,
    initializeFirestore,
    persistentLocalCache,
    persistentSingleTabManager,
    enableIndexedDbPersistence
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

import { basicNotif, confirmNotif } from "./notif.js";

import { getStorage, ref, uploadString, getDownloadURL, deleteObject } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-storage.js";

const firebaseConfig = {
    apiKey: "AIzaSyBlFywXuxIgMMwqHjUEYZ8Opx1BOzG88lE",
    authDomain: "sync-96959.firebaseapp.com",
    projectId: "sync-96959",
    storageBucket: "sync-96959.firebasestorage.app",
    messagingSenderId: "921895030126",
    appId: "1:921895030126:web:51420d99edd8602b46c57f",
    measurementId: "G-JPXBLW1Y71"
  };

const app = initializeApp(firebaseConfig);
const provider = new GoogleAuthProvider();
const auth = getAuth(app);
const db = initializeFirestore(app, {
    localCache: persistentLocalCache({ tabManager: persistentSingleTabManager() }),
});

let currentUser;


export { db }

setPersistence(auth, browserLocalPersistence)
    .then(() => {
        return signInWithEmailAndPassword(auth, email, password), signInWithPopup(auth, provider);
    })
    .catch((error) => {
    });

let alreadyFetched = [];
let isFetchingPosts = false; // Flag to prevent multiple requests

onAuthStateChanged(auth, async (user) => {
    if (user) {
        currentUser = user
        if (typeof on_index != 'undefined') {
        
        }
        if (typeof on_login == 'undefined') {
            console.log(user)

            document.getElementById('signout').addEventListener('click', async function (event) {
                signOutAccount();
            });
        }
        const account = document.getElementById('account');
        if (account) {
            account.innerHTML = `<img id="accountImg" src="${user.photoURL || "Images/gear.png"}"></img>`;
        }

    } else {
        if (typeof on_login == 'undefined') {
            window.location.href = `login.html`;
        }
    }
});

function checkpasswordlength(password) {
    if (password.length >= 8) {
        return true
    }
}

async function updateProfile(displayName, email, uid, photoUrl) {
    const userDocRef = doc(db, 'users', uid);
    await setDoc(userDocRef, {
        displayName: displayName || 'Anonymous',
        email: email,
        uid: uid,
        photoUrl: photoUrl || '../Images/gear.png'
    }, { merge: true })
        .then(() => {
            console.log('Profile updated successfully with RFID UID');
        })
        .catch((error) => {
            console.error('Error updating profile:', error);
        });
}

export async function signUpWithEmail() {
    const displayName = document.getElementById('signUpUsername').value;
    const email = document.getElementById('signUpEmail').value;
    const password = document.getElementById('signUpPassword').value;
    const confirmpassword = document.getElementById('signUpPasswordConfirm').value;

    console.log(displayName, email, password, confirmpassword);

    // Validate password length (for example, minimum 6 characters)
    if (checkpasswordlength(password)) {
        if (confirmpassword === password) {
            try {
                // Create user with email and password
                const userCredential = await createUserWithEmailAndPassword(auth, email, password);
                const user = userCredential.user;
                console.log(user)
                // Update user profile with display name
                await updateProfile(
                    displayName,
                    email,
                    user.uid,
                );
                window.location.href = `index.html`;

                console.log('User created successfully:', user);
                // Handle further logic, like redirecting or showing a success message
            } catch (error) {
                // Handle errors from Firebase Auth
                console.error('Error signing up:', error.message);
                basicNotif('Sign Up Error', error.message, 5000);
            }
        } else {
            basicNotif("Passwords don't match.", "Please try again", 5000);
        }
    } else {
        basicNotif('Password is too short.', 'Your password must be at least 6 characters long.', 5000);
    }
}

export async function loginWithEmail() {
    const email = document.getElementById('loginEmail').value;
    const password = document.getElementById('loginPassword').value;
    signInWithEmailAndPassword(auth, email, password)
        .then((userCredential) => {
            const user = userCredential.user;
            window.location.href = `index.html`;
        })
        .catch((error) => {
            const errorCode = error.code;
            const errorMessage = error.message;
        });
}

export async function loginWithGoogle() {
    signInWithPopup(auth, provider)
        .then(async (result) => {
            const credential = GoogleAuthProvider.credentialFromResult(result);
            const token = credential.accessToken;
            const user = result.user;
            await updateProfile(user.displayName, user.email, user.uid, user.photoURL);
            window.location.href = `index.html`;
        }).catch((error) => {
            const errorCode = error.code;
            const errorMessage = error.message;
            const email = error.customData.email;
            const credential = GoogleAuthProvider.credentialFromError(error);
        });
}

export async function signOutAccount() {
    signOut(auth).then(() => {
    }).catch((error) => {
    });
}

export async function fetchProfile(userid, bruteForce = false) {
    try {
        // Check if the 'profiles' array exists in localStorage
        let profiles = JSON.parse(localStorage.getItem('profilesv1')) || [];

        // Look for the profile in localStorage
        const cachedProfile = profiles.find(profile => profile.userid === userid);

        // If brute force flag is set or no profile found in localStorage, fetch from Firestore
        if (bruteForce || !cachedProfile) {
            console.log(bruteForce ? 'Brute forcing update from Firestore.' : 'Profile not found in localStorage, fetching from Firestore.');

            // Fetch from Firestore
            const userDocRef = doc(db, 'users', userid);
            const docSnap = await getDoc(userDocRef);
            if (docSnap.exists()) {
                const user = docSnap.data();

                // Add the fetched profile to the localStorage array
                if (!cachedProfile) {
                    profiles.push({ userid, ...user });
                } else {
                    // Update existing profile
                    profiles = profiles.map(profile =>
                        profile.userid === userid ? { userid, ...user } : profile
                    );
                }
                localStorage.setItem('profilesv1', JSON.stringify(profiles));

                return user;
            } else {
                console.log('No profile found for user ID:', userid);
                return null;
            }
        }

        // If brute force is not set and profile is found in localStorage
        console.log('Profile found in localStorage:', cachedProfile);
        return cachedProfile;
    } catch (error) {
        console.error('Error fetching profile:', error);
        return null;
    }
}
