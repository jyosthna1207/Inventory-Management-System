
// =====================================
// J'S INVENTORY - PRODUCT MANAGEMENT
// =====================================

let allProducts = [];

// =====================================
// LOAD ALL PRODUCTS
// =====================================

async function loadProducts() {
    try {
        allProducts = await api("/products");

        updateProductSummary();
        displayProducts(allProducts);

    } catch (error) {
        console.error("Error loading products:", error);

        const table = document.getElementById("productRows");

        if (table) {
            table.innerHTML = `
                <tr>
                    <td colspan="8" style="text-align:center;">
                        Unable to load products. Please check the server.
                    </td>
                </tr>
            `;
        }
    }
}

// =====================================
// UPDATE PRODUCT SUMMARY
// =====================================

function updateProductSummary() {
    const totalProducts = allProducts.length;

    const totalStock = allProducts.reduce(
        (sum, product) => sum + Number(product.quantity || 0),
        0
    );

    const lowStockProducts = allProducts.filter(
        product => Number(product.quantity) <= Number(product.reorder_level)
    );

    const productCount = document.getElementById("productCount");
    const stockCount = document.getElementById("stockCount");
    const lowStockCount = document.getElementById("lowStockCount");

    if (productCount) productCount.textContent = totalProducts;
    if (stockCount) stockCount.textContent = totalStock;
    if (lowStockCount) lowStockCount.textContent = lowStockProducts.length;
}

// =====================================
// DISPLAY PRODUCTS
// =====================================

function displayProducts(products) {
    const table = document.getElementById("productRows");

    if (!table) return;

    if (!products || products.length === 0) {
        table.innerHTML = `
            <tr>
                <td colspan="8" style="text-align:center;">
                    No products found.
                </td>
            </tr>
        `;
        return;
    }

    table.innerHTML = products.map(product => {
        const quantity = Number(product.quantity);
        const reorderLevel = Number(product.reorder_level);
        const isLowStock = quantity <= reorderLevel;

        return `
            <tr>
                <td>${product.product_id}</td>
                <td>${escapeText(product.product_name)}</td>
                <td>${escapeText(product.category)}</td>
                <td>${money(product.price)}</td>
                <td>${quantity}</td>
                <td>${reorderLevel}</td>

                <td>
                    <span class="${isLowStock ? "stock-low" : "stock-good"}">
                        ${isLowStock ? "Low Stock" : "In Stock"}
                    </span>
                </td>

                <td>
                    <button
                        type="button"
                        class="btn btn-light btn-small"
                        data-action="edit"
                        data-id="${product.product_id}">
                        Edit
                    </button>

                    <button
                        type="button"
                        class="btn btn-small"
                        data-action="stock"
                        data-id="${product.product_id}">
                        Stock
                    </button>

                    <button
                        type="button"
                        class="btn btn-danger btn-small"
                        data-action="delete"
                        data-id="${product.product_id}">
                        Delete
                    </button>
                </td>
            </tr>
        `;
    }).join("");
}

// =====================================
// SEARCH PRODUCTS
// =====================================

const searchInput = document.getElementById("searchInput");

if (searchInput) {
    searchInput.addEventListener("input", function () {
        const searchValue = this.value.toLowerCase().trim();

        const filteredProducts = allProducts.filter(product => {
            return (
                String(product.product_id).toLowerCase().includes(searchValue) ||
                String(product.product_name).toLowerCase().includes(searchValue) ||
                String(product.category).toLowerCase().includes(searchValue)
            );
        });

        displayProducts(filteredProducts);
    });
}

// =====================================
// HANDLE PRODUCT ACTION BUTTONS
// =====================================

const productRows = document.getElementById("productRows");

if (productRows) {
    productRows.addEventListener("click", function (event) {
        const button = event.target.closest("button[data-action]");

        if (!button) return;

        const id = Number(button.dataset.id);
        const action = button.dataset.action;

        if (action === "edit") editProduct(id);
        if (action === "stock") openStockModal(id);
        if (action === "delete") deleteProduct(id);
    });
}

// =====================================
// EDIT PRODUCT
// =====================================

function editProduct(id) {
    const product = allProducts.find(
        item => Number(item.product_id) === id
    );

    if (!product) return;

    document.getElementById("editId").value = product.product_id;
    document.getElementById("editName").value = product.product_name;
    document.getElementById("editCategory").value = product.category;
    document.getElementById("editPrice").value = product.price;
    document.getElementById("editQuantity").value = product.quantity;
    document.getElementById("editReorder").value = product.reorder_level;

    clearMessage("editMessage");

    document.getElementById("editModal").classList.add("active");
}

// =====================================
// CLOSE EDIT MODAL
// =====================================

function closeEditModal() {
    document.getElementById("editModal").classList.remove("active");
    document.getElementById("editForm").reset();

    clearMessage("editMessage");
}

// =====================================
// UPDATE PRODUCT DETAILS
// =====================================

const editForm = document.getElementById("editForm");

if (editForm) {
    editForm.addEventListener("submit", async function (event) {
        event.preventDefault();

        const id = document.getElementById("editId").value;

        const productData = {
            product_name: document.getElementById("editName").value.trim(),
            category: document.getElementById("editCategory").value.trim(),
            price: Number(document.getElementById("editPrice").value),
            quantity: Number(document.getElementById("editQuantity").value),
            reorder_level: Number(document.getElementById("editReorder").value)
        };

        try {
            await api(`/products/${id}`, {
                method: "PUT",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify(productData)
            });

            closeEditModal();
            await loadProducts();

        } catch (error) {
            showMessage("editMessage", error.message, "error");
        }
    });
}

// =====================================
// OPEN STOCK MODAL
// =====================================

function openStockModal(id) {
    const product = allProducts.find(
        item => Number(item.product_id) === id
    );

    if (!product) return;

    document.getElementById("stockId").value = product.product_id;
    document.getElementById("stockType").value = "purchase";
    document.getElementById("stockAmount").value = "";

    clearMessage("stockMessage");

    document.getElementById("stockModal").classList.add("active");
}

// =====================================
// CLOSE STOCK MODAL
// =====================================

function closeStockModal() {
    document.getElementById("stockModal").classList.remove("active");
    document.getElementById("stockForm").reset();

    clearMessage("stockMessage");
}

// =====================================
// STOCK IN / STOCK OUT
// =====================================

const stockForm = document.getElementById("stockForm");

if (stockForm) {
    stockForm.addEventListener("submit", async function (event) {
        event.preventDefault();

        const id = document.getElementById("stockId").value;
        const transactionType = document.getElementById("stockType").value;

        const quantityInput = document.getElementById("stockAmount");
        const quantityValue = quantityInput.value.trim();
        const quantity = Number(quantityValue);

        // Validate quantity
        if (
            quantityValue === "" ||
            !Number.isSafeInteger(quantity) ||
            quantity <= 0
        ) {
            showMessage(
                "stockMessage",
                "Please enter a valid positive whole quantity.",
                "error"
            );
            return;
        }

        try {
            await api(`/products/${id}/stock`, {
                method: "PATCH",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    type: transactionType,
                    quantity: quantity
                })
            });

            closeStockModal();
            await loadProducts();

        } catch (error) {
            showMessage("stockMessage", error.message, "error");
        }
    });
}

// =====================================
// DELETE PRODUCT
// =====================================

async function deleteProduct(id) {
    const product = allProducts.find(
        item => Number(item.product_id) === id
    );

    if (!product) return;

    if (!confirmDelete(product.product_name)) return;

    try {
        await api(`/products/${id}`, {
            method: "DELETE"
        });

        await loadProducts();

    } catch (error) {
        alert(error.message);
    }
}

// =====================================
// CLOSE MODALS WHEN CLICKING OUTSIDE
// =====================================

["editModal", "stockModal"].forEach(modalId => {
    const modal = document.getElementById(modalId);

    if (modal) {
        modal.addEventListener("click", function (event) {
            if (event.target === modal) {
                modal.classList.remove("active");
            }
        });
    }
});

// =====================================
// LOAD PRODUCTS WHEN PAGE OPENS
// =====================================

loadProducts();
