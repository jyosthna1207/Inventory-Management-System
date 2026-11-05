
// ==========================================
// J'S INVENTORY - SALES MANAGEMENT
// ==========================================

let allSales = [];
let allProducts = [];

// HTML elements
const salesForm = document.getElementById("salesForm");
const salesRows = document.getElementById("salesRows");
const salesSearch = document.getElementById("salesSearch");

const saleProduct = document.getElementById("saleProduct");
const customerName = document.getElementById("customerName");
const saleQuantity = document.getElementById("saleQuantity");
const sellingPrice = document.getElementById("sellingPrice");
const saleDate = document.getElementById("saleDate");
const saleId = document.getElementById("saleId");


// Today's date
function getSalesTodayDate() {
    const today = new Date();

    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, "0");
    const day = String(today.getDate()).padStart(2, "0");

    return `${year}-${month}-${day}`;
}


// Load products and sales
async function loadSalesPage() {
    try {
        const [products, sales] = await Promise.all([
            api("/products"),
            api("/sales")
        ]);

        allProducts = products;
        allSales = sales;

        populateSalesProducts();
        displaySales(allSales);
        updateSalesSummary();

    } catch (error) {
        console.error("Sales loading error:", error);

        showMessage(
            "salesMessage",
            error.message || "Unable to load sales information.",
            "error"
        );
    }
}


// Populate product dropdown
function populateSalesProducts() {
    saleProduct.innerHTML =
        '<option value="">Select Product</option>';

    allProducts.forEach(product => {
        const option = document.createElement("option");

        option.value = product.product_id;
        option.textContent =
            `${product.product_name} (Available: ${product.quantity})`;

        saleProduct.appendChild(option);
    });
}


// Display sales records
function displaySales(sales) {
    salesRows.innerHTML = "";

    if (sales.length === 0) {
        salesRows.innerHTML = `
            <tr>
                <td colspan="7" class="empty-state">
                    No sales records found.
                </td>
            </tr>
        `;
        return;
    }

    sales.forEach(sale => {
        const total =
            Number(sale.quantity) *
            Number(sale.selling_price);

        const row = document.createElement("tr");

        row.innerHTML = `
            <td>#${escapeText(sale.sale_id)}</td>
            <td>${escapeText(sale.product_name)}</td>
            <td>${escapeText(sale.customer_name)}</td>
            <td>${escapeText(sale.quantity)}</td>
            <td>${money(sale.selling_price)}</td>
            <td>${money(total)}</td>
            <td>${formatDate(sale.sale_date)}</td>
            <td>
                <div class="table-actions">
                    <button
                        class="btn-secondary btn-small"
                        data-action="edit"
                        data-id="${Number(sale.sale_id)}">
                        Edit
                    </button>

                    <button
                        class="btn-danger btn-small"
                        data-action="delete"
                        data-id="${Number(sale.sale_id)}">
                        Delete
                    </button>
                </div>
            </td>
        `;

        salesRows.appendChild(row);
    });
}


// Update summary cards
function updateSalesSummary() {
    const totalSales = allSales.length;

    const totalUnits = allSales.reduce(
        (sum, sale) => sum + Number(sale.quantity),
        0
    );

    const totalRevenue = allSales.reduce(
        (sum, sale) =>
            sum +
            Number(sale.quantity) *
            Number(sale.selling_price),
        0
    );

    document.getElementById("totalSales").textContent =
        totalSales;

    document.getElementById("salesUnits").textContent =
        totalUnits;

    document.getElementById("salesRevenue").textContent =
        money(totalRevenue);
}


// Reset sales form
function resetSalesForm() {
    salesForm.reset();

    saleId.value = "";
    saleDate.value = getSalesTodayDate();

    document.getElementById("salesFormTitle").textContent =
        "Record New Sale";

    document.getElementById("saveSale").textContent =
        "Save Sale";

    document.getElementById("cancelSaleEdit").style.display =
        "none";

    clearMessage("salesMessage");
}


// Save or update sale
salesForm.addEventListener("submit", async function (event) {
    event.preventDefault();

    const id = saleId.value;

    const salesData = {
        product_id: Number(saleProduct.value),
        customer_name: customerName.value.trim(),
        quantity: Number(saleQuantity.value),
        selling_price: Number(sellingPrice.value),
        sale_date: saleDate.value
    };

    if (
        !salesData.product_id ||
        !salesData.customer_name ||
        !salesData.quantity ||
        salesData.quantity <= 0 ||
        salesData.selling_price < 0 ||
        !salesData.sale_date
    ) {
        showMessage(
            "salesMessage",
            "Please enter all valid sales details.",
            "error"
        );
        return;
    }

    try {
        if (id) {
            await api(`/sales/${id}`, {
                method: "PUT",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify(salesData)
            });

            showMessage(
                "salesMessage",
                "Sale updated successfully!",
                "success"
            );

        } else {
            await api("/sales", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify(salesData)
            });

            showMessage(
                "salesMessage",
                "Sale recorded successfully! Product stock decreased.",
                "success"
            );
        }

        resetSalesForm();
        await loadSalesPage();

    } catch (error) {
        console.error("Sales save error:", error);

        showMessage(
            "salesMessage",
            error.message || "Unable to save sale.",
            "error"
        );
    }
});


// Edit and delete buttons
salesRows.addEventListener("click", async function (event) {
    const button = event.target.closest("button[data-action]");

    if (!button) return;

    const id = Number(button.dataset.id);
    const action = button.dataset.action;

    const sale = allSales.find(
        item => Number(item.sale_id) === id
    );

    if (!sale) return;

    if (action === "edit") {
        saleId.value = sale.sale_id;
        saleProduct.value = sale.product_id;
        customerName.value = sale.customer_name;
        saleQuantity.value = sale.quantity;
        sellingPrice.value = sale.selling_price;

        saleDate.value =
            String(sale.sale_date).slice(0, 10);

        document.getElementById("salesFormTitle").textContent =
            "Update Sale";

        document.getElementById("saveSale").textContent =
            "Update Sale";

        document.getElementById("cancelSaleEdit").style.display =
            "inline-flex";

        clearMessage("salesMessage");

        salesForm.scrollIntoView({
            behavior: "smooth",
            block: "center"
        });
    }

    if (action === "delete") {
        const confirmed = confirm(
            `Delete sale #${id}? This will restore the sold quantity to stock.`
        );

        if (!confirmed) return;

        try {
            await api(`/sales/${id}`, {
                method: "DELETE"
            });

            await loadSalesPage();

            showMessage(
                "salesMessage",
                "Sale deleted successfully. Stock quantity restored.",
                "success"
            );

        } catch (error) {
            showMessage(
                "salesMessage",
                error.message || "Unable to delete sale.",
                "error"
            );
        }
    }
});


// Cancel editing
document
    .getElementById("cancelSaleEdit")
    .addEventListener("click", resetSalesForm);


// Search sales history
salesSearch.addEventListener("input", function () {
    const searchValue = this.value.toLowerCase().trim();

    const filteredSales = allSales.filter(sale => {
        const rowText = [
            sale.sale_id,
            sale.product_name,
            sale.customer_name,
            sale.quantity,
            sale.selling_price,
            sale.sale_date
        ].join(" ").toLowerCase();

        return rowText.includes(searchValue);
    });

    displaySales(filteredSales);
});


// Initial setup
saleDate.value = getSalesTodayDate();
loadSalesPage();
