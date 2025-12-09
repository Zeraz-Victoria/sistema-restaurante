const fetch = require('node-fetch');

async function testConfig() {
    console.log("Testing /api/public/config for slug 'choco'...");
    try {
        const res = await fetch('http://localhost:3000/api/public/config?slug=choco');
        console.log("Status:", res.status);
        if (res.ok) {
            const data = await res.json();
            console.log("Data:", data);
        } else {
            console.log("Error:", await res.text());
        }
    } catch (e) {
        console.error("Fetch failed:", e);
    }
}

testConfig();
