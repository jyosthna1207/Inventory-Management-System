
const express = require("express");
const mysql = require("mysql2/promise");
const cors = require("cors");
const path = require("path");

const app = express();
const PORT = 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

// MySQL Database Configuration
const dbConfig = {
    host: "localhost",
    user: "root",
    password: "jsystem",
    database: "js_inventory"
};

let db;

// Connect to MySQL
async function connectDatabase() {
    try {
        db = await mysql.createPool({
            ...dbConfig,
            waitForConnections: true,
            connectionLimit: 10
        });

        await db.query("SELECT 1");
        console.log("MySQL Database Connected Successfully!");
    } catch (error) {
        console.log("Database Connection Failed:", error.message);
        process.exit(1);
    }
}

// ===============================
// DASHBOARD API
// ===============================

app.get("/api/dashboard", async (req, res) => {
    try {
        const [rows] = await db.query(`
            SELECT
                COUNT(*) AS totalProducts,
                COALESCE(SUM(quantity), 0) AS totalStock,
                COALESCE(SUM(price * quantity), 0) AS inventoryValue,
                COALESCE(SUM(quantity <= reorder_level), 0) AS lowStock
            FROM products
        `);

        res.json(rows[0]);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// ===============================
// PRODUCT CRUD OPERATIONS
// ===============================

// READ ALL PRODUCTS
app.get("/api/products", async (req, res) => {
    try {
        const [rows] = await db.query(
            "SELECT * FROM products ORDER BY product_id DESC"
        );

        res.json(rows);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// READ ONE PRODUCT
app.get("/api/products/:id", async (req, res) => {
    try {
        const [rows] = await db.query(
            "SELECT * FROM products WHERE product_id = ?",
            [req.params.id]
        );

        if (rows.length === 0) {
            return res.status(404).json({
                message: "Product not found"
            });
        }

        res.json(rows[0]);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// CREATE PRODUCT
app.post("/api/products", async (req, res) => {
    try {
        const {
            product_name,
            category,
            price,
            quantity,
            reorder_level
        } = req.body;

        if (
            !product_name?.trim() ||
            !category?.trim() ||
            price === "" || price == null ||
            quantity === "" || quantity == null ||
            reorder_level === "" || reorder_level == null
        ) {
            return res.status(400).json({
                message: "Please fill all product fields"
            });
        }

        if (
            !Number.isFinite(Number(price)) ||
            !Number.isInteger(Number(quantity)) ||
            !Number.isInteger(Number(reorder_level)) ||
            Number(price) < 0 ||
            Number(quantity) < 0 ||
            Number(reorder_level) < 0
        ) {
            return res.status(400).json({
                message: "Enter valid non-negative price and whole-number quantities"
            });
        }

        const [result] = await db.query(
            `INSERT INTO products
            (product_name, category, price, quantity, reorder_level)
            VALUES (?, ?, ?, ?, ?)`,
            [
                product_name.trim(),
                category.trim(),
                Number(price),
                Number(quantity),
                Number(reorder_level)
            ]
        );

        res.status(201).json({
            message: "Product added successfully!",
            product_id: result.insertId
        });

    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// UPDATE PRODUCT
app.put("/api/products/:id", async (req, res) => {
    try {
        const {
            product_name,
            category,
            price,
            quantity,
            reorder_level
        } = req.body;

        if (
            !product_name?.trim() ||
            !category?.trim() ||
            price === "" || price == null ||
            quantity === "" || quantity == null ||
            reorder_level === "" || reorder_level == null
        ) {
            return res.status(400).json({
                message: "Please fill all product fields"
            });
        }

        if (
            !Number.isFinite(Number(price)) ||
            !Number.isInteger(Number(quantity)) ||
            !Number.isInteger(Number(reorder_level)) ||
            Number(price) < 0 ||
            Number(quantity) < 0 ||
            Number(reorder_level) < 0
        ) {
            return res.status(400).json({
                message: "Enter valid non-negative values"
            });
        }

        const [result] = await db.query(
            `UPDATE products
             SET product_name = ?,
                 category = ?,
                 price = ?,
                 quantity = ?,
                 reorder_level = ?
             WHERE product_id = ?`,
            [
                product_name.trim(),
                category.trim(),
                Number(price),
                Number(quantity),
                Number(reorder_level),
                req.params.id
            ]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({
                message: "Product not found"
            });
        }

        res.json({ message: "Product updated successfully!" });

    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// DELETE PRODUCT
app.delete("/api/products/:id", async (req, res) => {
    try {
        const [result] = await db.query(
            "DELETE FROM products WHERE product_id = ?",
            [req.params.id]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({
                message: "Product not found"
            });
        }

        res.json({ message: "Product deleted successfully!" });

    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// ===============================
// STOCK MANAGEMENT
// ===============================



// ===============================
// SUPPLIER CRUD OPERATIONS
// ===============================
 app.patch("/api/products/:id/stock", async (req, res) => {

    // FIX: Frontend sends "quantity", not "amount"
    const { type, quantity } = req.body;

    const qty = Number(quantity);

    // Validate stock transaction
    if (
        !["purchase", "sale"].includes(type) ||
        quantity === undefined ||
        quantity === null ||
        quantity === "" ||
        !Number.isSafeInteger(qty) ||
        qty <= 0
    ) {
        return res.status(400).json({
            message: "Enter a valid stock quantity"
        });
    }

    let connection;

    try {

        connection = await db.getConnection();

        await connection.beginTransaction();

        // Get current product stock
        const [rows] = await connection.query(
            "SELECT quantity FROM products WHERE product_id = ? FOR UPDATE",
            [req.params.id]
        );

        if (rows.length === 0) {

            await connection.rollback();

            return res.status(404).json({
                message: "Product not found"
            });
        }

        const currentQuantity = Number(rows[0].quantity);

        // Check available stock before sale
        if (type === "sale" && currentQuantity < qty) {

            await connection.rollback();

            return res.status(400).json({
                message: "Insufficient stock for this sale"
            });
        }

        // Calculate updated quantity
        const newQuantity = type === "purchase"
            ? currentQuantity + qty
            : currentQuantity - qty;

        // Update database
        await connection.query(
            "UPDATE products SET quantity = ? WHERE product_id = ?",
            [newQuantity, req.params.id]
        );

        await connection.commit();

        res.json({
            message: "Stock updated successfully!",
            quantity: newQuantity
        });

    } catch (error) {

        if (connection) {
            await connection.rollback();
        }

        res.status(500).json({
            message: error.message
        });

    } finally {

        if (connection) {
            connection.release();
        }
    }

});
// READ SUPPLIERS
app.get("/api/suppliers", async (req, res) => {
    try {
        const [rows] = await db.query(
            "SELECT * FROM suppliers ORDER BY supplier_id DESC"
        );

        res.json(rows);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// CREATE SUPPLIER
app.post("/api/suppliers", async (req, res) => {
    try {
        const {
            supplier_name,
            contact_person,
            phone,
            email,
            address
        } = req.body;

        if (!supplier_name?.trim()) {
            return res.status(400).json({
                message: "Supplier name is required"
            });
        }

        const [result] = await db.query(
            `INSERT INTO suppliers
            (supplier_name, contact_person, phone, email, address)
            VALUES (?, ?, ?, ?, ?)`,
            [
                supplier_name.trim(),
                contact_person || "",
                phone || "",
                email || "",
                address || ""
            ]
        );

        res.status(201).json({
            message: "Supplier added successfully!",
            supplier_id: result.insertId
        });

    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// UPDATE SUPPLIER
app.put("/api/suppliers/:id", async (req, res) => {
    try {
        const {
            supplier_name,
            contact_person,
            phone,
            email,
            address
        } = req.body;

        if (!supplier_name?.trim()) {
            return res.status(400).json({
                message: "Supplier name is required"
            });
        }

        const [result] = await db.query(
            `UPDATE suppliers
             SET supplier_name = ?,
                 contact_person = ?,
                 phone = ?,
                 email = ?,
                 address = ?
             WHERE supplier_id = ?`,
            [
                supplier_name.trim(),
                contact_person || "",
                phone || "",
                email || "",
                address || "",
                req.params.id
            ]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({
                message: "Supplier not found"
            });
        }

        res.json({ message: "Supplier updated successfully!" });

    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// DELETE SUPPLIER
app.delete("/api/suppliers/:id", async (req, res) => {
    try {
        const [result] = await db.query(
            "DELETE FROM suppliers WHERE supplier_id = ?",
            [req.params.id]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({
                message: "Supplier not found"
            });
        }

        res.json({ message: "Supplier deleted successfully!" });

    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// =============================================
// PURCHASES AND SALES MANAGEMENT
// =============================================

// COMMON VALIDATION FUNCTIONS

function validPositiveInteger(value) {
    return value !== "" &&
        value !== null &&
        value !== undefined &&
        Number.isSafeInteger(Number(value)) &&
        Number(value) > 0;
}

function validNonNegativePrice(value) {
    return value !== "" &&
        value !== null &&
        value !== undefined &&
        Number.isFinite(Number(value)) &&
        Number(value) >= 0;
}

function validDate(value) {
    return typeof value === "string" &&
        /^\d{4}-\d{2}-\d{2}$/.test(value) &&
        !Number.isNaN(Date.parse(value));
}

async function getTransactionConnection() {
    const connection = await db.getConnection();
    await connection.beginTransaction();
    return connection;
}


// =============================================
// PURCHASES API
// =============================================

// READ ALL PURCHASES

app.get("/api/purchases", async (req, res) => {
    try {
        const [rows] = await db.query(`
            SELECT
                p.*,
                pr.product_name,
                s.supplier_name
            FROM purchases p
            JOIN products pr ON p.product_id = pr.product_id
            JOIN suppliers s ON p.supplier_id = s.supplier_id
            ORDER BY p.purchase_id DESC
        `);

        res.json(rows);

    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});


// ADD PURCHASE

app.post("/api/purchases", async (req, res) => {
    const {
        product_id,
        supplier_id,
        quantity,
        purchase_price,
        purchase_date
    } = req.body;

    if (
        !validPositiveInteger(product_id) ||
        !validPositiveInteger(supplier_id) ||
        !validPositiveInteger(quantity) ||
        !validNonNegativePrice(purchase_price) ||
        !validDate(purchase_date)
    ) {
        return res.status(400).json({
            message: "Please enter valid purchase details"
        });
    }

    let connection;

    try {
        connection = await getTransactionConnection();

        const [products] = await connection.query(
            "SELECT product_id FROM products WHERE product_id = ? FOR UPDATE",
            [product_id]
        );

        if (products.length === 0) {
            await connection.rollback();
            return res.status(404).json({
                message: "Product not found"
            });
        }

        const [result] = await connection.query(`
            INSERT INTO purchases
            (product_id, supplier_id, quantity, purchase_price, purchase_date)
            VALUES (?, ?, ?, ?, ?)
        `, [
            Number(product_id),
            Number(supplier_id),
            Number(quantity),
            Number(purchase_price),
            purchase_date
        ]);

        await connection.query(
            "UPDATE products SET quantity = quantity + ? WHERE product_id = ?",
            [Number(quantity), Number(product_id)]
        );

        await connection.commit();

        res.status(201).json({
            message: "Purchase recorded and stock updated successfully!",
            purchase_id: result.insertId
        });

    } catch (error) {
        if (connection) await connection.rollback();
        res.status(500).json({ message: error.message });

    } finally {
        if (connection) connection.release();
    }
});


// UPDATE PURCHASE

app.put("/api/purchases/:id", async (req, res) => {
    const {
        product_id,
        supplier_id,
        quantity,
        purchase_price,
        purchase_date
    } = req.body;

    if (
        !validPositiveInteger(product_id) ||
        !validPositiveInteger(supplier_id) ||
        !validPositiveInteger(quantity) ||
        !validNonNegativePrice(purchase_price) ||
        !validDate(purchase_date)
    ) {
        return res.status(400).json({
            message: "Please enter valid purchase details"
        });
    }

    let connection;

    try {
        connection = await getTransactionConnection();

        const [oldRows] = await connection.query(
            "SELECT * FROM purchases WHERE purchase_id = ? FOR UPDATE",
            [req.params.id]
        );

        if (oldRows.length === 0) {
            await connection.rollback();
            return res.status(404).json({
                message: "Purchase not found"
            });
        }

        const oldPurchase = oldRows[0];
        const oldProductId = Number(oldPurchase.product_id);
        const newProductId = Number(product_id);
        const oldQuantity = Number(oldPurchase.quantity);
        const newQuantity = Number(quantity);

        const productIds = [...new Set([
            oldProductId,
            newProductId
        ])].sort((a, b) => a - b);

        const [lockedProducts] = await connection.query(
            "SELECT product_id, quantity FROM products WHERE product_id IN (?) ORDER BY product_id FOR UPDATE",
            [productIds]
        );

        const productMap = new Map(
            lockedProducts.map(p => [
                Number(p.product_id),
                Number(p.quantity)
            ])
        );

        if (!productMap.has(newProductId)) {
            await connection.rollback();
            return res.status(404).json({
                message: "Selected product not found"
            });
        }

        if (!productMap.has(oldProductId)) {
            await connection.rollback();
            return res.status(404).json({
                message: "Original product not found"
            });
        }

        if (oldProductId === newProductId) {
            const newStock =
                productMap.get(oldProductId) - oldQuantity + newQuantity;

            if (newStock < 0) {
                await connection.rollback();
                return res.status(409).json({
                    message: "Cannot reduce this purchase because some stock has already been sold"
                });
            }

            await connection.query(
                "UPDATE products SET quantity = ? WHERE product_id = ?",
                [newStock, oldProductId]
            );

        } else {
            const oldStock = productMap.get(oldProductId) - oldQuantity;

            if (oldStock < 0) {
                await connection.rollback();
                return res.status(409).json({
                    message: "Cannot change this purchase because some original stock has already been sold"
                });
            }

            await connection.query(
                "UPDATE products SET quantity = ? WHERE product_id = ?",
                [oldStock, oldProductId]
            );

            await connection.query(
                "UPDATE products SET quantity = quantity + ? WHERE product_id = ?",
                [newQuantity, newProductId]
            );
        }

        await connection.query(`
            UPDATE purchases
            SET product_id = ?,
                supplier_id = ?,
                quantity = ?,
                purchase_price = ?,
                purchase_date = ?
            WHERE purchase_id = ?
        `, [
            newProductId,
            Number(supplier_id),
            newQuantity,
            Number(purchase_price),
            purchase_date,
            req.params.id
        ]);

        await connection.commit();

        res.json({
            message: "Purchase updated and stock adjusted successfully!"
        });

    } catch (error) {
        if (connection) await connection.rollback();
        res.status(500).json({ message: error.message });

    } finally {
        if (connection) connection.release();
    }
});


// DELETE PURCHASE

app.delete("/api/purchases/:id", async (req, res) => {
    let connection;

    try {
        connection = await getTransactionConnection();

        const [rows] = await connection.query(
            "SELECT * FROM purchases WHERE purchase_id = ? FOR UPDATE",
            [req.params.id]
        );

        if (rows.length === 0) {
            await connection.rollback();
            return res.status(404).json({
                message: "Purchase not found"
            });
        }

        const purchase = rows[0];

        const [products] = await connection.query(
            "SELECT quantity FROM products WHERE product_id = ? FOR UPDATE",
            [purchase.product_id]
        );

        if (
            products.length === 0 ||
            Number(products[0].quantity) < Number(purchase.quantity)
        ) {
            await connection.rollback();
            return res.status(409).json({
                message: "Cannot delete this purchase because its stock has already been used"
            });
        }

        await connection.query(
            "UPDATE products SET quantity = quantity - ? WHERE product_id = ?",
            [purchase.quantity, purchase.product_id]
        );

        await connection.query(
            "DELETE FROM purchases WHERE purchase_id = ?",
            [req.params.id]
        );

        await connection.commit();

        res.json({
            message: "Purchase deleted and stock adjusted successfully!"
        });

    } catch (error) {
        if (connection) await connection.rollback();
        res.status(500).json({ message: error.message });

    } finally {
        if (connection) connection.release();
    }
});


// =============================================
// SALES API
// =============================================

// READ ALL SALES

app.get("/api/sales", async (req, res) => {
    try {
        const [rows] = await db.query(`
            SELECT
                s.*,
                p.product_name
            FROM sales s
            JOIN products p ON s.product_id = p.product_id
            ORDER BY s.sale_id DESC
        `);

        res.json(rows);

    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});


// ADD SALE

app.post("/api/sales", async (req, res) => {
    const {
        product_id,
        customer_name,
        quantity,
        selling_price,
        sale_date
    } = req.body;

    if (
        !validPositiveInteger(product_id) ||
        !customer_name?.trim() ||
        !validPositiveInteger(quantity) ||
        !validNonNegativePrice(selling_price) ||
        !validDate(sale_date)
    ) {
        return res.status(400).json({
            message: "Please enter valid sales details"
        });
    }

    let connection;

    try {
        connection = await getTransactionConnection();

        const [products] = await connection.query(
            "SELECT quantity FROM products WHERE product_id = ? FOR UPDATE",
            [product_id]
        );

        if (products.length === 0) {
            await connection.rollback();
            return res.status(404).json({
                message: "Product not found"
            });
        }

        if (Number(products[0].quantity) < Number(quantity)) {
            await connection.rollback();
            return res.status(400).json({
                message: "Insufficient stock for this sale"
            });
        }

        const [result] = await connection.query(`
            INSERT INTO sales
            (product_id, customer_name, quantity, selling_price, sale_date)
            VALUES (?, ?, ?, ?, ?)
        `, [
            Number(product_id),
            customer_name.trim(),
            Number(quantity),
            Number(selling_price),
            sale_date
        ]);

        await connection.query(
            "UPDATE products SET quantity = quantity - ? WHERE product_id = ?",
            [Number(quantity), Number(product_id)]
        );

        await connection.commit();

        res.status(201).json({
            message: "Sale recorded and stock updated successfully!",
            sale_id: result.insertId
        });

    } catch (error) {
        if (connection) await connection.rollback();
        res.status(500).json({ message: error.message });

    } finally {
        if (connection) connection.release();
    }
});


// UPDATE SALE

app.put("/api/sales/:id", async (req, res) => {
    const {
        product_id,
        customer_name,
        quantity,
        selling_price,
        sale_date
    } = req.body;

    if (
        !validPositiveInteger(product_id) ||
        !customer_name?.trim() ||
        !validPositiveInteger(quantity) ||
        !validNonNegativePrice(selling_price) ||
        !validDate(sale_date)
    ) {
        return res.status(400).json({
            message: "Please enter valid sales details"
        });
    }

    let connection;

    try {
        connection = await getTransactionConnection();

        const [oldRows] = await connection.query(
            "SELECT * FROM sales WHERE sale_id = ? FOR UPDATE",
            [req.params.id]
        );

        if (oldRows.length === 0) {
            await connection.rollback();
            return res.status(404).json({
                message: "Sale not found"
            });
        }

        const oldSale = oldRows[0];
        const oldProductId = Number(oldSale.product_id);
        const newProductId = Number(product_id);
        const oldQuantity = Number(oldSale.quantity);
        const newQuantity = Number(quantity);

        const productIds = [...new Set([
            oldProductId,
            newProductId
        ])].sort((a, b) => a - b);

        const [lockedProducts] = await connection.query(
            "SELECT product_id, quantity FROM products WHERE product_id IN (?) ORDER BY product_id FOR UPDATE",
            [productIds]
        );

        const productMap = new Map(
            lockedProducts.map(p => [
                Number(p.product_id),
                Number(p.quantity)
            ])
        );

        if (!productMap.has(newProductId) || !productMap.has(oldProductId)) {
            await connection.rollback();
            return res.status(404).json({
                message: "Product not found"
            });
        }

        if (oldProductId === newProductId) {
            const availableStock =
                productMap.get(oldProductId) + oldQuantity;

            if (availableStock < newQuantity) {
                await connection.rollback();
                return res.status(400).json({
                    message: "Insufficient stock for the updated sale"
                });
            }

            await connection.query(
                "UPDATE products SET quantity = ? WHERE product_id = ?",
                [availableStock - newQuantity, oldProductId]
            );

        } else {
            const newProductStock = productMap.get(newProductId);

            if (newProductStock < newQuantity) {
                await connection.rollback();
                return res.status(400).json({
                    message: "Insufficient stock for the selected product"
                });
            }

            await connection.query(
                "UPDATE products SET quantity = quantity + ? WHERE product_id = ?",
                [oldQuantity, oldProductId]
            );

            await connection.query(
                "UPDATE products SET quantity = quantity - ? WHERE product_id = ?",
                [newQuantity, newProductId]
            );
        }

        await connection.query(`
            UPDATE sales
            SET product_id = ?,
                customer_name = ?,
                quantity = ?,
                selling_price = ?,
                sale_date = ?
            WHERE sale_id = ?
        `, [
            newProductId,
            customer_name.trim(),
            newQuantity,
            Number(selling_price),
            sale_date,
            req.params.id
        ]);

        await connection.commit();

        res.json({
            message: "Sale updated and stock adjusted successfully!"
        });

    } catch (error) {
        if (connection) await connection.rollback();
        res.status(500).json({ message: error.message });

    } finally {
        if (connection) connection.release();
    }
});


// DELETE SALE

app.delete("/api/sales/:id", async (req, res) => {
    let connection;

    try {
        connection = await getTransactionConnection();

        const [rows] = await connection.query(
            "SELECT * FROM sales WHERE sale_id = ? FOR UPDATE",
            [req.params.id]
        );

        if (rows.length === 0) {
            await connection.rollback();
            return res.status(404).json({
                message: "Sale not found"
            });
        }

        const sale = rows[0];

        await connection.query(
            "UPDATE products SET quantity = quantity + ? WHERE product_id = ?",
            [sale.quantity, sale.product_id]
        );

        await connection.query(
            "DELETE FROM sales WHERE sale_id = ?",
            [req.params.id]
        );

        await connection.commit();

        res.json({
            message: "Sale deleted and stock restored successfully!"
        });

    } catch (error) {
        if (connection) await connection.rollback();
        res.status(500).json({ message: error.message });

    } finally {
        if (connection) connection.release();
    }
});

// ===============================
// START SERVER
// ===============================

async function startServer() {
    await connectDatabase();

    app.listen(PORT, () => {
        console.log(`J's Inventory Server Started!`);
        console.log(`Open: http://localhost:${PORT}`);
    });
}

startServer();
