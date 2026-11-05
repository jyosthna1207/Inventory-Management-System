
// ==========================================
// J'S INVENTORY - PURCHASES MANAGEMENT
// ==========================================

let allPurchases = [];
let allProducts = [];
let allSuppliers = [];

// HTML elements
const purchaseForm = document.getElementById("purchaseForm");
const purchaseRows = document.getElementById("purchaseRows");
const purchaseSearch = document.getElementById("purchaseSearch");

const purchaseProduct = document.getElementById("purchaseProduct");
const purchaseSupplier = document.getElementById("purchaseSupplier");
const purchaseQuantity = document.getElementById("purchaseQuantity");
const purchasePrice = document.getElementById("purchasePrice");
const purchaseDate = document.getElementById("purchaseDate");
const purchaseId = document.getElementById("purchaseId");


// Set today's date using local date
function getTodayDate() {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, "0");
    const day = String(today.getDate()).padStart(2, "0");

    return `${year}-${month}-${day}`;
}


// Load all required data
async function loadPurchasePage() {
    try {
        const [products, suppliers, purchases] = await Promise.all([
            api("/products"),
            api("/suppliers"),
            api("/purchases")
        ]);

        allProducts = products;
        allSuppliers = suppliers;
        allPurchases = purchases;

        populateProductDropdown();
        populateSupplierDropdown();
        displayPurchases(allPurchases);
        updatePurchaseSummary();

    } catch (error) {
        console.error("Purchase loading error:", error);
        showMessage(
            "purchaseMessage",
            error.message || "Unable to load purchase information.",
            "error"
        );
    }
}


// Product dropdown
function populateProductDropdown() {
    purchaseProduct.innerHTML =
        '<option value="">Select Product</option>';

    allProducts.forEach(product => {
        const option = document.createElement("option");

        option.value = product.product_id;
        option.textContent =
            `${product.product_name} (Stock: ${product.quantity})`;

        purchaseProduct.appendChild(option);
    });
}


// Supplier dropdown
function populateSupplierDropdown() {
    purchaseSupplier.innerHTML =
        '<option value="">Select Supplier</option>';

    allSuppliers.forEach(supplier => {
        const option = document.createElement("option");

        option.value = supplier.supplier_id;
        option.textContent = supplier.supplier_name;

        purchaseSupplier.appendChild(option);
    });
}


// Display purchase records
function displayPurchases(purchases) {
    purchaseRows.innerHTML = "";

    if (purchases.length === 0) {
        purchaseRows.innerHTML = `
            <tr>
                <td colspan="8" class="empty-state">
                    No purchase records found.
                </td>
            </tr>
        `;
        return;
    }

    purchases.forEach(purchase => {
        const total =
            Number(purchase.quantity) *
            Number(purchase.purchase_price);

        const row = document.createElement("tr");

        row.innerHTML = `
            <td>#${escapeText(purchase.purchase_id)}</td>
            <td>${escapeText(purchase.product_name)}</td>
            <td>${escapeText(purchase.supplier_name)}</td>
            <td>${escapeText(purchase.quantity)}</td>
            <td>${money(purchase.purchase_price)}</td>
            <td>${money(total)}</td>
            <td>${formatDate(purchase.purchase_date)}</td>
            <td>
                <div class="table-actions">
                    <button
                        class="btn-secondary btn-small"
                        data-action="edit"
                        data-id="${Number(purchase.purchase_id)}">
                        Edit
                    </button>

                    <button
                        class="btn-danger btn-small"
                        data-action="delete"
                        data-id="${Number(purchase.purchase_id)}">
                        Delete
                    </button>
                </div>
            </td>
        `;

        purchaseRows.appendChild(row);
    });
}


// Update summary cards
function updatePurchaseSummary() {
    const totalPurchases = allPurchases.length;

    const totalUnits = allPurchases.reduce(
        (sum, purchase) => sum + Number(purchase.quantity),
        0
    );

    const totalValue = allPurchases.reduce(
        (sum, purchase) =>
            sum +
            Number(purchase.quantity) *
            Number(purchase.purchase_price),
        0
    );

    document.getElementById("totalPurchases").textContent =
        totalPurchases;

    document.getElementById("purchaseUnits").textContent =
        totalUnits;

    document.getElementById("purchaseValue").textContent =
        money(totalValue);
}


// Reset form
function resetPurchaseForm() {
    purchaseForm.reset();

    purchaseId.value = "";
    purchaseDate.value = getTodayDate();

    document.getElementById("purchaseFormTitle").textContent =
        "Record New Purchase";

    document.getElementById("savePurchase").textContent =
        "Save Purchase";

    document.getElementById("cancelPurchaseEdit").style.display =
        "none";

    clearMessage("purchaseMessage");
}


// Save or update purchase
purchaseForm.addEventListener("submit", async function (event) {
    event.preventDefault();

    const id = purchaseId.value;

    const purchaseData = {
        product_id: Number(purchaseProduct.value),
        supplier_id: Number(purchaseSupplier.value),
        quantity: Number(purchaseQuantity.value),
        purchase_price: Number(purchasePrice.value),
        purchase_date: purchaseDate.value
    };

    if (
        !purchaseData.product_id ||
        !purchaseData.supplier_id ||
        !purchaseData.quantity ||
        purchaseData.quantity <= 0 ||
        purchaseData.purchase_price < 0 ||
        !purchaseData.purchase_date
    ) {
        showMessage(
            "purchaseMessage",
            "Please enter all valid purchase details.",
            "error"
        );
        return;
    }

    try {
        if (id) {
            await api(`/purchases/${id}`, {
                method: "PUT",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify(purchaseData)
            });

            showMessage(
                "purchaseMessage",
                "Purchase updated successfully!",
                "success"
            );

        } else {
            await api("/purchases", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify(purchaseData)
            });

            showMessage(
                "purchaseMessage",
                "Purchase recorded successfully! Product stock increased.",
                "success"
            );
        }

        resetPurchaseForm();
        await loadPurchasePage();

    } catch (error) {
        console.error("Purchase save error:", error);

        showMessage(
            "purchaseMessage",
            error.message || "Unable to save purchase.",
            "error"
        );
    }
});


// Edit and delete buttons
purchaseRows.addEventListener("click", async function (event) {
    const button = event.target.closest("button[data-action]");

    if (!button) return;

    const id = Number(button.dataset.id);
    const action = button.dataset.action;

    const purchase = allPurchases.find(
        item => Number(item.purchase_id) === id
    );

    if (!purchase) return;

    if (action === "edit") {
        purchaseId.value = purchase.purchase_id;
        purchaseProduct.value = purchase.product_id;
        purchaseSupplier.value = purchase.supplier_id;
        purchaseQuantity.value = purchase.quantity;
        purchasePrice.value = purchase.purchase_price;

        purchaseDate.value =
            String(purchase.purchase_date).slice(0, 10);

        document.getElementById("purchaseFormTitle").textContent =
            "Update Purchase";

        document.getElementById("savePurchase").textContent =
            "Update Purchase";

        document.getElementById("cancelPurchaseEdit").style.display =
            "inline-flex";

        clearMessage("purchaseMessage");

        purchaseForm.scrollIntoView({
            behavior: "smooth",
            block: "center"
        });
    }

    if (action === "delete") {
        const confirmed = confirm(
            `Delete purchase #${id}? This will reverse its stock increase if the stock is still available.`
        );

        if (!confirmed) return;

        try {
            await api(`/purchases/${id}`, {
                method: "DELETE"
            });

            await loadPurchasePage();

            showMessage(
                "purchaseMessage",
                "Purchase deleted successfully.",
                "success"
            );

        } catch (error) {
            showMessage(
                "purchaseMessage",
                error.message || "Unable to delete purchase.",
                "error"
            );
        }
    }
});


// Cancel editing
document
    .getElementById("cancelPurchaseEdit")
    .addEventListener("click", resetPurchaseForm);


// Search purchase history
purchaseSearch.addEventListener("input", function () {
    const searchValue = this.value.toLowerCase().trim();

    const filteredPurchases = allPurchases.filter(purchase => {
        const rowText = [
            purchase.purchase_id,
            purchase.product_name,
            purchase.supplier_name,
            purchase.quantity,
            purchase.purchase_price,
            purchase.purchase_date
        ].join(" ").toLowerCase();

        return rowText.includes(searchValue);
    });

    displayPurchases(filteredPurchases);
});


// Initial setup
purchaseDate.value = getTodayDate();
loadPurchasePage();
