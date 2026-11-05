
// ======================================
// J'S INVENTORY - COMMON JAVASCRIPT
// ======================================

// Backend API URL
const API_URL = "/api";

// ======================================
// COMMON API FUNCTION
// ======================================

async function api(endpoint, options = {}) {

    try {

        const response = await fetch(API_URL + endpoint, {

            headers: {
                "Content-Type": "application/json",
                ...options.headers
            },

            ...options

        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(
                data.message || "Something went wrong"
            );
        }

        return data;

    }

    catch (error) {

        console.error("API Error:", error.message);

        throw error;

    }

}


// ======================================
// FORMAT CURRENCY
// ======================================

function money(value) {

    return "₹" + Number(value || 0).toLocaleString(
        "en-IN",
        {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        }
    );

}


// ======================================
// FORMAT DATE
// ======================================

function formatDate(value) {

    return new Date(value).toLocaleDateString("en-IN");

}


// ======================================
// DISPLAY NOTIFICATION
// ======================================

function showMessage(elementId, message, type = "success") {

    const element = document.getElementById(elementId);

    if (!element) return;

    element.textContent = message;

    element.className = "notice show " + type;

}


// ======================================
// CLEAR NOTIFICATION
// ======================================

function clearMessage(elementId) {

    const element = document.getElementById(elementId);

    if (!element) return;

    element.textContent = "";

    element.className = "notice";

}


// ======================================
// SAFE TEXT FOR HTML
// ======================================

function escapeText(value) {

    return String(value ?? "").replace(/[&<>"']/g, char => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
    })[char]);

}


// ======================================
// CONFIRM DELETE
// ======================================

function confirmDelete(name) {

    return window.confirm(
        `Are you sure you want to delete "${name}"?`
    );

}


// ======================================
// LOG APPLICATION STATUS
// ======================================

console.log("J's Inventory JavaScript Loaded Successfully!");
