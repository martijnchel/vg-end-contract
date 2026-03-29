const axios = require('axios');

const CLUB_ID = process.env.CLUB_ID;
const API_KEY = process.env.API_KEY;
const CLUB_SECRET = process.env.CLUB_SECRET;
const MAKE_WEBHOOK_VERLENGING = process.env.MAKE_WEBHOOK_VERLENGING; 

const MAX_PER_DAG = 1; 
const RECENT_WINDOW_MS = 90 * 24 * 60 * 60 * 1000;

async function runTest() {
    console.log(`--- [TEST RUN] TRIGGER MAKE WEBHOOK (Inclusief Achternaam) ---`);
    const timestamp90DaysAgo = Date.now() - RECENT_WINDOW_MS;

    try {
        const res = await axios.get(`https://api.virtuagym.com/api/v1/club/${CLUB_ID}/member`, {
            params: { api_key: API_KEY, club_secret: CLUB_SECRET, with: 'active_memberships', limit: 50 }
        });

        const members = res.data.result || [];
        for (const member of members) {
            const vRes = await axios.get(`https://api.virtuagym.com/api/v1/club/${CLUB_ID}/visits`, {
                params: { api_key: API_KEY, club_secret: CLUB_SECRET, member_id: member.member_id, sync_from: timestamp90DaysAgo }
            });

            if (vRes.data.result && vRes.data.result.length > 0) {
                await axios.post(MAKE_WEBHOOK_VERLENGING, {
                    member_id: member.member_id,
                    voornaam: member.firstname,
                    achternaam: member.lastname, // Nieuw veld
                    telefoon: member.mobile || member.phone,
                    contract_naam: "TEST-CONTRACT COMPLETE",
                    einddatum: "2026-06-01",
                    bezoeken_90_dagen: vRes.data.result.length
                });
                console.log(`--- TEST DATA VERZONDEN NAAR MAKE (Check de Webhook!) ---`);
                return; 
            }
        }
    } catch (e) { console.error("Fout tijdens test:", e.message); }
}
runTest();
