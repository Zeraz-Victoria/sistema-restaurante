const axios = require('axios');
const API_URL = 'http://localhost:3000/api';

async function verifyMenu() {
    try {
        // 1. Get Config (to find a valid restaurant ID or just use 1)
        console.log('Fetching menu for restaurant 1...');
        const res = await axios.get(`${API_URL}/public/menu?restaurante_id=1`);

        const categories = res.data;
        console.log(`✅ Categories found: ${categories.length}`);

        let dishCount = 0;
        let modCount = 0;

        categories.forEach(cat => {
            console.log(`   Category: ${cat.nombre_categoria} (${cat.platos ? cat.platos.length : 0} dishes)`);
            if (cat.platos) {
                dishCount += cat.platos.length;
                cat.platos.forEach(p => {
                    if (p.modificadores) {
                        modCount += p.modificadores.length;
                    }
                });
            }
        });

        console.log(`✅ Total Dishes: ${dishCount}`);
        console.log(`✅ Total Modifiers: ${modCount}`);

        if (categories.length > 0 && dishCount > 0) {
            console.log('✅ Menu structure verification PASSED');
        } else {
            console.warn('⚠️ Menu might be empty (this is okay if DB is empty, but structure seems valid)');
        }

    } catch (e) {
        console.error('❌ Menu verification FAILED:', e.message);
        if (e.response) {
            console.error('Response:', e.response.data);
        }
    }
}

verifyMenu();
