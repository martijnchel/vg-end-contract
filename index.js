const axios = require('axios');
const CLUB_ID = process.env.CLUB_ID;
const API_KEY = process.env.API_KEY;
const CLUB_SECRET = process.env.CLUB_SECRET;

async function onderzoek() {
    console.log("--- ONDERZOEK: hoe ziet de ledendata eruit? ---");
    try {
        const res = await axios.get(`https://api.virtuagym.com/api/v1/club/${CLUB_ID}/member`, {
            params: { api_key: API_KEY, club_secret: CLUB_SECRET, with: 'active_memberships', from_id: 0, limit: 5 }
        });

        console.log("Top-level velden van het API-antwoord:", Object.keys(res.data).join(", "));

        const leden = res.data.result || [];
        console.log("Aantal leden in dit testantwoord:", leden.length);
        if (leden.length === 0) {
            console.log("Er komen GEEN leden terug -> waarschijnlijk een sleutel/permissie-probleem.");
            return;
        }

        const eerste = leden[0];
        console.log("Velden die een lid heeft:", Object.keys(eerste).join(", "));
        console.log("Zit 'active_memberships' erin?", eerste.active_memberships !== undefined ? "JA" : "NEE");

        if (eerste.active_memberships) {
            console.log("Inhoud van active_memberships:");
            console.log(JSON.stringify(eerste.active_memberships, null, 2));
        }

        Object.keys(eerste).forEach(k => {
            const lk = k.toLowerCase();
            if (lk.includes('member') || lk.includes('contract') || lk.includes('subscription') || lk.includes('product')) {
                console.log(`Ander relevant veld "${k}":`, JSON.stringify(eerste[k]));
            }
        });
    } catch (e) {
        console.error("Fout:", e.message);
        if (e.response) console.error("API zei:", JSON.stringify(e.response.data));
    }
}
onderzoek();
