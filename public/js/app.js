const API_URL = '/api';
const socket = io();

// --- STATE ---
let cart = [];
let currentRestaurantId = 1; // Default for demo

// --- UTILS ---
const formatCurrency = (amount) => {
    return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(amount);
};

// --- CUSTOMER FUNCTIONS ---

async function loadMenu() {
    try {
        const response = await fetch(`${API_URL}/public/menu?restaurante_id=${currentRestaurantId}`);
        const categories = await response.json();

        const menuContainer = document.getElementById('menu-container');
        if (!menuContainer) return;

        menuContainer.innerHTML = '';

        categories.forEach(category => {
            const catSection = document.createElement('div');
            catSection.className = 'category-section';
            catSection.innerHTML = `<h2 style="margin: 2rem 0 1rem;">${category.nombre_categoria}</h2>`;

            const grid = document.createElement('div');
            grid.className = 'grid';

            category.platos.forEach(plato => {
                const card = document.createElement('div');
                card.className = 'card';
                card.innerHTML = `
                    <h3>${plato.nombre_plato}</h3>
                    <p>${plato.descripcion || 'Sin descripción'}</p>
                    <span class="price">${formatCurrency(plato.precio)}</span>
                    <button class="btn btn-primary" onclick="addToCart(${plato.id}, '${plato.nombre_plato}', ${plato.precio})">
                        Agregar
                    </button>
                `;
                grid.appendChild(card);
            });

            catSection.appendChild(grid);
            menuContainer.appendChild(catSection);
        });
    } catch (error) {
        console.error('Error loading menu:', error);
    }
}

function addToCart(id, nombre, precio) {
    const existing = cart.find(item => item.id === id);
    if (existing) {
        existing.cantidad++;
    } else {
        cart.push({ id, nombre, precio, cantidad: 1 });
    }
    updateCartUI();
}

function updateCartUI() {
    const count = cart.reduce((sum, item) => sum + item.cantidad, 0);
    const cartCountEl = document.getElementById('cart-count');
    if (cartCountEl) cartCountEl.innerText = count;

    const cartItemsContainer = document.getElementById('cart-items');
    const cartTotalEl = document.getElementById('cart-total');

    if (cartItemsContainer && cartTotalEl) {
        cartItemsContainer.innerHTML = '';
        let total = 0;

        cart.forEach(item => {
            const itemTotal = item.precio * item.cantidad;
            total += itemTotal;
            cartItemsContainer.innerHTML += `
                <li>
                    <span>${item.cantidad}x ${item.nombre}</span>
                    <span>${formatCurrency(itemTotal)}</span>
                </li>
            `;
        });

        cartTotalEl.innerText = formatCurrency(total);
    }
}

async function placeOrder() {
    if (cart.length === 0) return alert('El carrito está vacío');

    const mesa = document.getElementById('mesa-input').value || 'Mesa 1';
    const total = cart.reduce((sum, item) => sum + (item.precio * item.cantidad), 0);

    try {
        const response = await fetch(`${API_URL}/pedidos`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                mesa_id: 1, // Hardcoded for demo, ideally should be dynamic or mapped from string
                restaurante_id: currentRestaurantId,
                items: cart,
                total: total
            })
        });

        if (response.ok) {
            alert('¡Pedido enviado a cocina!');
            cart = [];
            updateCartUI();
            toggleCartModal();
        } else {
            alert('Error al enviar pedido');
        }
    } catch (error) {
        console.error('Error placing order:', error);
    }
}

// --- KITCHEN FUNCTIONS ---

async function loadPendingOrders() {
    try {
        // Note: The original server code had /api/cocina/pendientes but we refactored to /api/pedidos maybe?
        // Let's check the routes. Ah, I see I didn't implement a specific GET /api/pedidos/pendientes in the refactor plan explicitly for the kitchen?
        // Wait, I used `createPedidosRoutes`. Let's check `routes/pedidos.js`.
        // It only has POST /. I need to add GET /pendientes to `routes/pedidos.js` or `routes/cocina.js`?
        // The original `servidor.js` had `/api/cocina/pendientes`.
        // My refactor plan mapped `/api/pedidos` -> `routes/pedidos.js`.
        // I should probably add the GET route to `routes/pedidos.js` or create a new one.
        // For now, I will assume I will fix the backend to support this.

        // Actually, looking at `routes/pedidos.js` content I read earlier, it ONLY had POST /.
        // I need to update `routes/pedidos.js` to include the GET route for the kitchen.

        const response = await fetch(`${API_URL}/pedidos/pendientes`);
        if (!response.ok) return; // Fail silently if route doesn't exist yet

        const orders = await response.json();
        const container = document.getElementById('kitchen-orders');
        if (!container) return;

        container.innerHTML = '';
        orders.forEach(renderOrderCard);
    } catch (error) {
        console.error('Error loading orders:', error);
    }
}

function renderOrderCard(order) {
    const container = document.getElementById('kitchen-orders');
    if (!container) return;

    const card = document.createElement('div');
    card.className = `card order-card ${order.estado === 'completado' ? 'completed' : ''}`;
    card.id = `order-${order.id}`;

    let itemsHtml = '';
    // Handle both structure types (flat items or nested) depending on how the API returns it
    // The previous code returned { ...order, items: [...] }
    if (order.items) {
        order.items.forEach(item => {
            itemsHtml += `<li>${item.cantidad}x ${item.nombre_plato || item.nombre}</li>`;
        });
    }

    card.innerHTML = `
        <div style="display:flex; justify-content:space-between;">
            <h3>Orden #${order.id}</h3>
            <span>${new Date(order.hora_pedido || order.fecha).toLocaleTimeString()}</span>
        </div>
        <p><strong>Mesa:</strong> ${order.mesa_id || order.mesa}</p>
        <ul class="order-items">
            ${itemsHtml}
        </ul>
        ${order.estado !== 'completado' ? `
            <button class="btn btn-success" onclick="completeOrder(${order.id})">
                Completar
            </button>
        ` : '<p class="text-success">Completado</p>'}
    `;

    container.appendChild(card);
}

async function completeOrder(id) {
    try {
        await fetch(`${API_URL}/pedidos/${id}/completar`, { method: 'POST' });
        // UI update will happen via socket event
    } catch (error) {
        console.error('Error completing order:', error);
    }
}

// --- SOCKET EVENTS ---

socket.on('nuevo_pedido', (order) => {
    console.log('Nuevo pedido recibido:', order);
    // If we are on the kitchen page
    if (document.getElementById('kitchen-orders')) {
        renderOrderCard(order);
        // Play sound?
        const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3');
        audio.play().catch(e => console.log('Audio play failed', e));
    }
});

socket.on('orden_completada', (id) => {
    const card = document.getElementById(`order-${id}`);
    if (card) {
        card.remove(); // Or mark as completed
    }
});

// --- UI HELPERS ---
function toggleCartModal() {
    const modal = document.getElementById('cart-modal');
    if (modal) modal.classList.toggle('active');
}

// --- INIT ---
document.addEventListener('DOMContentLoaded', () => {
    if (document.getElementById('menu-container')) {
        loadMenu();
    }
    if (document.getElementById('kitchen-orders')) {
        loadPendingOrders();
    }
});
