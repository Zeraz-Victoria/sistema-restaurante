const axios = require('axios');

async function checkSecurity() {
    console.log('🔒 Verificando seguridad del Endpoint /api/tenants...\n');

    const protectedUrl = 'http://localhost:3000/api/tenants';
    const secret = 'SuperSecreto123'; // La clave correcta

    // 1. Prueba SIN clave (Debería FALLAR con 403)
    try {
        process.stdout.write('1. Acceso SIN clave secreta: ');
        await axios.get(protectedUrl);
        console.log('❌ FALLÓ (El servidor permitió el acceso)');
    } catch (e) {
        if (e.response && e.response.status === 403) {
            console.log('✅ BLOQUEADO CORRECTAMENTE (403 Forbidden)');
        } else {
            console.log(`❌ Error inesperado: ${e.message}`);
        }
    }

    // 2. Prueba CON clave INCORRECTA (Debería FALLAR con 403)
    try {
        process.stdout.write('2. Acceso con clave INCORRECTA: ');
        await axios.get(protectedUrl, { headers: { 'x-admin-secret': 'ClaveFalsa' } });
        console.log('❌ FALLÓ (El servidor permitió el acceso)');
    } catch (e) {
        if (e.response && e.response.status === 403) {
            console.log('✅ BLOQUEADO CORRECTAMENTE (403 Forbidden)');
        } else {
            console.log(`❌ Error inesperado: ${e.message}`);
        }
    }

    // 3. Prueba CON clave CORRECTA (Debería PASAR con 200)
    try {
        process.stdout.write('3. Acceso con clave CORRECTA: ');
        const res = await axios.get(protectedUrl, { headers: { 'x-admin-secret': secret } });
        console.log(`✅ ACCESO PERMITIDO (${res.data.length} tenants encontrados)`);
    } catch (e) {
        console.log(`❌ FALLÓ (El servidor denegó el acceso válido): ${e.message}`);
    }

    console.log('\n🏁 Verificación terminada.');
}

checkSecurity();
