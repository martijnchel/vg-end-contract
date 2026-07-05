const axios = require('axios');
const CLUB_ID = process.env.CLUB_ID;
const API_KEY = process.env.API_KEY;
const CLUB_SECRET = process.env.CLUB_SECRET;

async function test() {
    const varianten = ['memberships', 'active_memberships', 'membership', 'contracts', 'subscriptions'];
    for (const w of varianten) {
        try {
            const res = await axios.get(`https://api.virtuagym.com/api/v1/club/${CLUB_ID}/member`, {
                params: { api_key: API_KEY, club_secret: CLUB_SECRET, with: w, from_id: 0, limit: 20 }
            });
            const leden = res.data.result || [];
            // zoek het eerste lid dat een gevulde memberships-lijst heeft
            const gevuld = leden.find(m => Array.isArray(m.memberships) && m.memberships.length > 0);
            if (gevuld) {
                console.log(`>>> RAAK met with="${w}" <<<`);
                console.log("Inhoud van een lidmaatschap:");
                console.log(JSON.stringify(gevuld.memberships[0], null, 2));
                return;
            } else {
                console.log(`with="${w}": memberships nog steeds leeg`);
            }
        } catch (e) {
            console.log(`with="${w}": fout - ${e.message}`);
        }
    }
    console.log("Geen enkele variant vulde de lijst. Dan zit de lidmaatschap-info mogelijk op een apart endpoint.");
}
test();
