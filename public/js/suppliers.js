// =====================================
// J'S INVENTORY - SUPPLIER MANAGEMENT
// =====================================

let allSuppliers = [];

// =====================================
// LOAD ALL SUPPLIERS
// =====================================

async function loadSuppliers() {
    try {
        allSuppliers = await api("/suppliers");

        // Update total supplier count
        const totalElement = document.getElementById("totalSuppliers");

        if (totalElement) {
            totalElement.textContent = allSuppliers.length;
        }

        displaySuppliers(allSuppliers);

    } catch (error) {
        showMessage("supplierMessage", error.message, "error");
    }
}

// =====================================
// DISPLAY SUPPLIERS
// =====================================

function displaySuppliers(suppliers) {
    const table = document.getElementById("supplierRows");

    if (!table) return;

    // Apply search filter
    const searchInput = document.getElementById("supplierSearch");
    const searchValue = searchInput
        ? searchInput.value.toLowerCase().trim()
        : "";

    const filteredSuppliers = suppliers.filter(supplier => {
        const supplierText = [
            supplier.supplier_id,
            supplier.supplier_name,
            supplier.contact_person,
            supplier.phone,
            supplier.email,
            supplier.address
        ].join(" ").toLowerCase();

        return supplierText.includes(searchValue);
    });

    if (filteredSuppliers.length === 0) {
        table.innerHTML = `
            <tr>
                <td colspan="7" style="text-align:center;">
                    No suppliers found.
                </td>
            </tr>
        `;
        return;
    }

    table.innerHTML = filteredSuppliers.map(supplier => `
        <tr>
            <td>${supplier.supplier_id}</td>

            <td>${escapeText(supplier.supplier_name)}</td>

            <td>${escapeText(supplier.contact_person || "-")}</td>

            <td>${escapeText(supplier.phone || "-")}</td>

            <td>${escapeText(supplier.email || "-")}</td>

            <td>${escapeText(supplier.address || "-")}</td>

            <td>
                <button
                    type="button"
                    class="btn btn-light btn-small"
                    data-action="edit"
                    data-id="${supplier.supplier_id}">
                    Edit
                </button>

                <button
                    type="button"
                    class="btn btn-danger btn-small"
                    data-action="delete"
                    data-id="${supplier.supplier_id}">
                    Delete
                </button>
            </td>
        </tr>
    `).join("");
}

// =====================================
// ADD OR UPDATE SUPPLIER
// =====================================

document.getElementById("supplierForm").addEventListener("submit", async function(event) {
    event.preventDefault();

    const id = document.getElementById("supplierId").value;

    const supplierData = {
        supplier_name: document.getElementById("supplierName").value.trim(),
        contact_person: document.getElementById("contactPerson").value.trim(),
        phone: document.getElementById("phone").value.trim(),
        email: document.getElementById("email").value.trim(),
        address: document.getElementById("address").value.trim()
    };

    try {
        if (id) {
            await api(`/suppliers/${id}`, {
                method: "PUT",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify(supplierData)
            });

            showMessage("supplierMessage", "Supplier updated successfully!");

        } else {
            await api("/suppliers", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify(supplierData)
            });

            showMessage("supplierMessage", "Supplier added successfully!");
        }

        resetSupplierForm();
        await loadSuppliers();

    } catch (error) {
        showMessage("supplierMessage", error.message, "error");
    }
});

// =====================================
// HANDLE EDIT AND DELETE BUTTONS
// =====================================

document.getElementById("supplierRows").addEventListener("click", function(event) {
    const button = event.target.closest("button[data-action]");

    if (!button) return;

    const id = Number(button.dataset.id);
    const action = button.dataset.action;

    if (action === "edit") {
        editSupplier(id);
    }

    if (action === "delete") {
        deleteSupplier(id);
    }
});

// =====================================
// EDIT SUPPLIER
// =====================================

function editSupplier(id) {
    const supplier = allSuppliers.find(item =>
        Number(item.supplier_id) === id
    );

    if (!supplier) return;

    document.getElementById("supplierId").value = supplier.supplier_id;
    document.getElementById("supplierName").value = supplier.supplier_name;
    document.getElementById("contactPerson").value = supplier.contact_person || "";
    document.getElementById("phone").value = supplier.phone || "";
    document.getElementById("email").value = supplier.email || "";
    document.getElementById("address").value = supplier.address || "";

    document.getElementById("formTitle").textContent = "Edit Supplier";
    document.getElementById("saveSupplier").textContent = "Update Supplier";
    document.getElementById("cancelEdit").style.display = "inline-block";

    clearMessage("supplierMessage");

    document.getElementById("supplierForm").scrollIntoView({
        behavior: "smooth"
    });
}

// =====================================
// RESET SUPPLIER FORM
// =====================================

function resetSupplierForm() {
    document.getElementById("supplierForm").reset();
    document.getElementById("supplierId").value = "";

    document.getElementById("formTitle").textContent = "Add New Supplier";
    document.getElementById("saveSupplier").textContent = "Add Supplier";
    document.getElementById("cancelEdit").style.display = "none";
}

// =====================================
// CANCEL EDITING
// =====================================

document.getElementById("cancelEdit").addEventListener("click", function() {
    resetSupplierForm();
    clearMessage("supplierMessage");
});

// =====================================
// DELETE SUPPLIER
// =====================================

async function deleteSupplier(id) {
    const supplier = allSuppliers.find(item =>
        Number(item.supplier_id) === id
    );

    if (!supplier) return;

    if (!confirmDelete(supplier.supplier_name)) return;

    try {
        await api(`/suppliers/${id}`, {
            method: "DELETE"
        });

        showMessage("supplierMessage", "Supplier deleted successfully!");

        await loadSuppliers();

    } catch (error) {
        showMessage("supplierMessage", error.message, "error");
    }
}

// =====================================
// SUPPLIER SEARCH
// =====================================

const supplierSearchInput = document.getElementById("supplierSearch");

if (supplierSearchInput) {
    supplierSearchInput.addEventListener("input", function() {
        displaySuppliers(allSuppliers);
    });
}

// =====================================
// EXPORT SUPPLIERS TO CSV
// =====================================

const exportButton = document.getElementById("exportSuppliersBtn");

if (exportButton) {
    exportButton.addEventListener("click", function() {

        if (allSuppliers.length === 0) {
            alert("No supplier records available to export.");
            return;
        }

        const headers = [
            "Supplier ID",
            "Supplier Name",
            "Contact Person",
            "Phone",
            "Email",
            "Address"
        ];

        const csvRows = [headers.join(",")];

        allSuppliers.forEach(function(supplier) {

            const values = [
                supplier.supplier_id,
                supplier.supplier_name,
                supplier.contact_person || "-",
                supplier.phone || "-",
                supplier.email || "-",
                supplier.address || "-"
            ].map(function(value) {

                const safeValue = String(value)
                    .replace(/"/g, '""');

                return `"${safeValue}"`;
            });

            csvRows.push(values.join(","));
        });

        const csvContent = "\uFEFF" + csvRows.join("\n");

        const blob = new Blob([csvContent], {
            type: "text/csv;charset=utf-8;"
        });

        const url = URL.createObjectURL(blob);

        const link = document.createElement("a");

        link.href = url;
        link.download = "J_Inventory_Suppliers.csv";

        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        URL.revokeObjectURL(url);

    });
}

// =====================================
// LOAD SUPPLIERS WHEN PAGE OPENS
// =====================================

loadSuppliers();