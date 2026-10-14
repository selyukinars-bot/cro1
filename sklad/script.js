const LOW_LIMIT = 5;
const PRODUCTS_KEY = "warehouseProducts";
const HISTORY_KEY = "warehouseHistory";

const productForm = document.getElementById("productForm");
const searchInput = document.getElementById("searchInput");
const productTable = document.getElementById("productTable");
const historyTable = document.getElementById("historyTable");
const message = document.getElementById("message");

function showMessage(text, isError = false) {
    message.textContent = text;
    message.className = isError ? "error" : "success";
}

function readStoredValue(key) {
    try {
        return localStorage.getItem(key);
    } catch {
        showMessage(
            "Не удалось прочитать данные браузера. Проверьте настройки хранения сайта.",
            true
        );
        return null;
    }
}

function loadProducts() {
    const stored = readStoredValue(PRODUCTS_KEY);
    if (stored === null) return [];

    let parsed;
    try {
        parsed = JSON.parse(stored);
    } catch {
        showMessage("Сохранённые товары повреждены и не могут быть загружены.", true);
        return [];
    }

    if (!Array.isArray(parsed)) {
        showMessage("Сохранённые товары имеют неверный формат.", true);
        return [];
    }

    let skipped = 0;
    const loaded = parsed.reduce((result, product) => {
        if (
            !product ||
            typeof product !== "object" ||
            (typeof product.id !== "string" && typeof product.id !== "number") ||
            typeof product.name !== "string" ||
            typeof product.category !== "string" ||
            !Number.isSafeInteger(product.quantity) ||
            product.quantity < 0
        ) {
            skipped++;
            return result;
        }

        const minQuantity = product.minQuantity ?? LOW_LIMIT;
        if (!Number.isSafeInteger(minQuantity) || minQuantity < 0) {
            skipped++;
            return result;
        }

        result.push({
            id: String(product.id),
            name: product.name,
            category: product.category,
            quantity: product.quantity,
            minQuantity
        });
        return result;
    }, []);

    if (skipped > 0) {
        showMessage(`Пропущено товаров с некорректными данными: ${skipped}.`, true);
    }

    return loaded;
}

function loadHistory() {
    const stored = readStoredValue(HISTORY_KEY);
    if (stored === null) return [];

    let parsed;
    try {
        parsed = JSON.parse(stored);
    } catch {
        showMessage("Сохранённая история повреждена и не может быть загружена.", true);
        return [];
    }

    if (!Array.isArray(parsed)) {
        showMessage("Сохранённая история имеет неверный формат.", true);
        return [];
    }

    return parsed.reduce((result, entry) => {
        if (typeof entry === "string") {
            result.push({
                time: "",
                operation: entry,
                product: "",
                quantity: ""
            });
        } else if (
            entry &&
            typeof entry === "object" &&
            typeof entry.time === "string" &&
            typeof entry.operation === "string" &&
            typeof entry.product === "string"
        ) {
            result.push(entry);
        }
        return result;
    }, []);
}

let products = loadProducts();
let history = loadHistory();

function saveData() {
    try {
        localStorage.setItem(PRODUCTS_KEY, JSON.stringify(products));
        localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
        return true;
    } catch {
        showMessage(
            "Не удалось сохранить данные. Проверьте свободное место и настройки хранения браузера.",
            true
        );
        return false;
    }
}

function addHistory(operation, product, quantity) {
    history.unshift({
        time: new Date().toLocaleString("ru-RU"),
        operation,
        product,
        quantity
    });
    history = history.slice(0, 100);
}

function render() {
    const query = searchInput.value.trim().toLocaleLowerCase("ru");
    const filteredProducts = products.filter(product =>
        product.name.toLocaleLowerCase("ru").includes(query) ||
        product.category.toLocaleLowerCase("ru").includes(query)
    );

    document.getElementById("totalProducts").textContent =
        String(products.length);
    document.getElementById("totalQuantity").textContent =
        String(products.reduce((sum, product) => sum + product.quantity, 0));
    document.getElementById("lowStock").textContent =
        String(products.filter(product =>
            product.quantity <= product.minQuantity
        ).length);

    productTable.replaceChildren();
    document.getElementById("emptyMessage").hidden =
        filteredProducts.length > 0;

    filteredProducts.forEach(product => {
        const row = productTable.insertRow();
        [
            product.name,
            product.category,
            String(product.quantity),
            String(product.minQuantity)
        ].forEach(value => {
            row.insertCell().textContent = value;
        });

        const statusCell = row.insertCell();
        const isLow = product.quantity <= product.minQuantity;
        statusCell.textContent = isLow ? "Низкий остаток" : "В наличии";
        statusCell.className = isLow ? "status-low" : "status-ok";

        const actionsCell = row.insertCell();
        const deleteButton = document.createElement("button");
        deleteButton.type = "button";
        deleteButton.textContent = "Удалить";
        deleteButton.className = "delete-btn";
        deleteButton.addEventListener("click", () => {
            if (!confirm(`Удалить товар «${product.name}»?`)) return;

            products = products.filter(item => item.id !== product.id);
            addHistory("Удаление", product.name, product.quantity);
            const saved = saveData();
            render();
            if (saved) showMessage("Товар удалён");
        });
        actionsCell.appendChild(deleteButton);
    });

    historyTable.replaceChildren();
    document.getElementById("historyEmpty").hidden = history.length > 0;
    history.forEach(entry => {
        const row = historyTable.insertRow();
        [entry.time, entry.operation, entry.product, String(entry.quantity ?? "")]
            .forEach(value => {
                row.insertCell().textContent = value;
            });
    });
}

productForm.addEventListener("submit", event => {
    event.preventDefault();

    const name = document.getElementById("productName").value.trim();
    const category = document.getElementById("category").value;
    const quantity = Number(document.getElementById("quantity").value);
    const minQuantity = Number(document.getElementById("minQuantity").value);

    if (!name) {
        showMessage("Введите название товара.", true);
        return;
    }
    if (!Number.isSafeInteger(quantity) || quantity < 1 || quantity > 1000000) {
        showMessage("Количество должно быть целым числом от 1 до 1 000 000.", true);
        return;
    }
    if (
        !Number.isSafeInteger(minQuantity) ||
        minQuantity < 0 ||
        minQuantity > 1000000
    ) {
        showMessage(
            "Минимальный остаток должен быть целым числом от 0 до 1 000 000.",
            true
        );
        return;
    }
    if (products.some(product =>
        product.name.toLocaleLowerCase("ru") === name.toLocaleLowerCase("ru")
    )) {
        showMessage("Товар с таким названием уже существует.", true);
        return;
    }

    products.push({
        id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
        name,
        category,
        quantity,
        minQuantity
    });
    addHistory("Добавление", name, quantity);

    const saved = saveData();
    render();
    if (saved) {
        productForm.reset();
        showMessage("Товар добавлен и сохранён в этом браузере.");
    }
});

document.getElementById("clearHistory").addEventListener("click", () => {
    history = [];
    const saved = saveData();
    render();
    if (saved) showMessage("История очищена.");
});

searchInput.addEventListener("input", render);

render();
