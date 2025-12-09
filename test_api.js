const axios = require('axios');

const API_URL = 'http://localhost:3000/api';
let token = '';
let restauranteId = 1; // Assuming seed data exists or we create it
let platoId = 0;
let pedidoId = 0;

async function runTests() {
    console.log('🚀 Starting API Tests...');

    try {
        // 1. Register Owner
        console.log('\n1. Testing Registration...');
        const email = `test${Date.now()}@example.com`;
        try {
            const regRes = await axios.post(`${API_URL}/auth/register`, {
                nombre_restaurante: `Restaurante Test ${Date.now()}`,
                email_dueño: email,
                password_dueño: 'password123'
            }, {
                headers: { 'x-admin-secret': 'SuperSecreto123' }
            });
            console.log('✅ Registration successful:', regRes.data.message);
            restauranteId = regRes.data.restauranteId;
        } catch (e) {
            console.error('❌ Registration failed:', e.response?.data || e.message);
        }

        // 2. Login
        console.log('\n2. Testing Login...');
        try {
            const loginRes = await axios.post(`${API_URL}/auth/login`, {
                email: email,
                password: 'password123'
            });
            console.log('✅ Login successful');
            token = loginRes.data.token;
        } catch (e) {
            console.error('❌ Login failed:', e.response?.data || e.message);
            return; // Stop if login fails
        }

        // 3. Create Category
        console.log('\n3. Testing Create Category...');
        let catId = 0;
        try {
            const catRes = await axios.post(`${API_URL}/menu/categorias`, {
                nombre_categoria: 'Entradas'
            }, { headers: { Authorization: `Bearer ${token}` } });
            console.log('✅ Category created:', catRes.data.nombre);
            catId = catRes.data.categoriaId;
        } catch (e) {
            console.error('❌ Create Category failed:', e.response?.data || e.message);
        }

        // 4. Create Dish
        console.log('\n4. Testing Create Dish...');
        try {
            const dishRes = await axios.post(`${API_URL}/menu/platos`, {
                nombre_plato: 'Nachos',
                descripcion: 'Con queso',
                precio: 120.50,
                categoria_id: catId
            }, { headers: { Authorization: `Bearer ${token}` } });
            console.log('✅ Dish created');
            platoId = dishRes.data.platoId;
        } catch (e) {
            console.error('❌ Create Dish failed:', e.response?.data || e.message);
        }

        // 5. Place Order (Public)
        console.log('\n5. Testing Place Order...');
        try {
            const orderRes = await axios.post(`${API_URL}/pedidos`, {
                mesa_id: 5,
                restaurante_id: restauranteId,
                items: [{ id: platoId, cantidad: 2, precio: 120.50 }],
                total: 241.00
            });
            console.log('✅ Order placed:', orderRes.data.message);
            pedidoId = orderRes.data.pedidoId;
        } catch (e) {
            console.error('❌ Place Order failed:', e.response?.data || e.message);
        }

        // 6. Check Kitchen Pending Orders
        console.log('\n6. Testing Kitchen Pending Orders...');
        try {
            const pendingRes = await axios.get(`${API_URL}/pedidos/pendientes?restaurante_id=${restauranteId}`);
            const found = pendingRes.data.find(o => o.id === pedidoId);
            if (found) {
                console.log('✅ Order found in kitchen pending list');
            } else {
                console.error('❌ Order NOT found in kitchen pending list');
            }
        } catch (e) {
            console.error('❌ Check Pending failed:', e.response?.data || e.message);
        }

        // 7. Complete Order
        console.log('\n7. Testing Complete Order...');
        try {
            await axios.post(`${API_URL}/pedidos/${pedidoId}/completar`);
            console.log('✅ Order marked as completed');
        } catch (e) {
            console.error('❌ Complete Order failed:', e.response?.data || e.message);
        }

        console.log('\n✨ All tests completed!');

    } catch (error) {
        console.error('Unexpected error:', error);
    }
}

runTests();
