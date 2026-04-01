const axios = require('axios');

// OMGEVINGSVARIABELEN
const CLUB_ID = process.env.CLUB_ID;
const API_KEY = process.env.API_KEY;
const CLUB_SECRET = process.env.CLUB_SECRET;
const MAKE_WEBHOOK_VERLENGING = process.env.MAKE_WEBHOOK_VERLENGING; 

// CONFIGURATIE
const MAX_PER_DAG = 30; 
const WINDOW_START = 65; 
const WINDOW_END = 50;   
const MIN_VISITS_RECENT = 1; 
const RECENT_WINDOW_MS = 90 * 24 * 60 * 60 * 1000;

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function runRetentionBot() {
    console.log(`--- [START] BATCH SCAN (T-65 tot T-50) - MAX 30 ---`);

    const today = new Date();
    const dateStart = new Date();
    dateStart.setDate(today.getDate() + WINDOW_END);
    const dateEnd = new Date();
    dateEnd.setDate(today.getDate() + WINDOW_START);
    const timestamp90DaysAgo = Date.now() - RECENT_WINDOW_MS;

    let fromId = 0;
    let hasMore = true;
    let sentCount = 0;

    try {
        while (hasMore && sentCount < MAX_PER_DAG) {
            const res = await axios.get(`https://api.virtuagym.com/api/v1/club/${CLUB_ID}/member`, {
                params: { 
                    api_key: API_KEY, 
                    club_secret: CLUB_SECRET, 
                    with: 'active_memberships',
                    from_id: fromId,
                    limit: 1000 
                }
            });

            const members = res.data.result || [];
            if (members.length === 0) break;

            for (const member of members) {
                if (sentCount >= MAX_PER_DAG) break;
                fromId = Math.max(fromId, member.member_id);
                
                if (!member.active_memberships) continue;

                const contract = member.active_memberships.find(m => {
                    const name = (m.membership_name || "").toLowerCase();
                    const isRightType = name.includes('complete') || name.includes('focus');
                    const endDate = new Date(m.contract_end_date);
                    const isWithinWindow = endDate >= dateStart && endDate <= dateEnd;
                    return isRightType && isWithinWindow;
                });

                if (contract) {
                    const vRes = await axios.get(`https://api.virtuagym.com/api/v1/club/${CLUB_ID}/visits`, {
                        params: { 
                            api_key: API_KEY, 
                            club_secret: CLUB_SECRET, 
                            member_id: member.member_id, 
                            sync_from: timestamp90DaysAgo 
                        }
                    });

                    const visits = vRes.data.result || [];
                    if (visits.length >= MIN_VISITS_RECENT) {
                        // HIER WORDEN DE GEGEVENS NAAR MAKE GESTUURD
                        await axios.post(MAKE_WEBHOOK_VERLENGING, {
                            member_id: member.member_id,
                            voornaam: member.firstname,
                            achternaam: member.lastname,
                            email: member.email, // <--- TOEGEVOEGD
                            telefoon: member.mobile || member.phone,
                            contract_naam: contract.membership_name,
                            einddatum: contract.contract_end_date,
                            bezoeken_90_dagen: visits.length
                        });
                        
                        sentCount++;
                        console.log(`[${sentCount}/30] Verzonden: ${member.firstname} ${member.lastname} (${member.email})`);
                        await sleep(3000); 
                    }
                }
            }
            if (members.length < 1000) hasMore = false;
        }
        console.log(`--- SCAN KLAAR: ${sentCount} leden naar Make gestuurd ---`);
    } catch (e) {
        console.error("Kritieke fout:", e.message);
    }
}

runRetentionBot();
