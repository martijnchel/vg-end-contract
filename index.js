const axios = require('axios');
// OMGEVINGSVARIABELEN
const CLUB_ID = process.env.CLUB_ID;
const API_KEY = process.env.API_KEY;
const CLUB_SECRET = process.env.CLUB_SECRET;
const MAKE_WEBHOOK_VERLENGING = process.env.MAKE_WEBHOOK_VERLENGING;

// LIVE: op true = stuurt ECHT mails. Zet op false om alleen te testen.
const ECHT_VERSTUREN = true;

// CONFIGURATIE
const MAX_PER_DAG = 50;
const WINDOW_START = 65;
const WINDOW_END = 50;
const MIN_VISITS_RECENT = 1;
const RECENT_WINDOW_MS = 90 * 24 * 60 * 60 * 1000;
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function runRetentionBot() {
    console.log(`--- [START] BATCH SCAN (T+50 tot T+65) - MAX ${MAX_PER_DAG} ---`);
    console.log(`Modus: ${ECHT_VERSTUREN ? 'ECHT VERSTUREN' : 'TEST (stuurt niets)'}`);
    const today = new Date();
    const dateStart = new Date();
    dateStart.setDate(today.getDate() + WINDOW_END);
    const dateEnd = new Date();
    dateEnd.setDate(today.getDate() + WINDOW_START);
    console.log(`Window: einddatum tussen ${dateStart.toISOString().slice(0,10)} en ${dateEnd.toISOString().slice(0,10)}`);

    // Virtuagym verwacht seconden, niet milliseconden
    const timestamp90DaysAgo = Math.floor((Date.now() - RECENT_WINDOW_MS) / 1000);

    let fromId = 0;
    let hasMore = true;
    let sentCount = 0;
    let totaalLeden = 0;

    try {
        while (hasMore && sentCount < MAX_PER_DAG) {
            const res = await axios.get(`https://api.virtuagym.com/api/v1/club/${CLUB_ID}/member`, {
                params: { api_key: API_KEY, club_secret: CLUB_SECRET, with: 'memberships', from_id: fromId, limit: 500 }
            });
            const members = res.data.result || [];
            if (members.length === 0) break;
            totaalLeden += members.length;

            for (const member of members) {
                if (sentCount >= MAX_PER_DAG) break;
                fromId = Math.max(fromId, member.member_id);

                const memberships = member.memberships || [];
                if (memberships.length === 0) continue;

                const contract = memberships.find(m => {
                    // alleen lopende lidmaatschappen; geannuleerd/gestopt overslaan
                    if (m.active !== 1 || m.cancelled === 1 || m.stopped === 1) return false;
                    const name = (m.membership_name || "").toLowerCase();
                    const isRightType = name.includes('complete') || name.includes('focus');
                    const endDate = new Date(m.contract_end_date);
                    const isWithinWindow = endDate >= dateStart && endDate <= dateEnd;
                    return isRightType && isWithinWindow;
                });

                if (contract) {
                    const vRes = await axios.get(`https://api.virtuagym.com/api/v1/club/${CLUB_ID}/visits`, {
                        params: { api_key: API_KEY, club_secret: CLUB_SECRET, member_id: member.member_id, sync_from: timestamp90DaysAgo }
                    });
                    const visits = vRes.data.result || [];
                    if (visits.length >= MIN_VISITS_RECENT) {
                        if (ECHT_VERSTUREN) {
                            await axios.post(MAKE_WEBHOOK_VERLENGING, {
                                member_id: member.member_id,
                                voornaam: member.firstname,
                                achternaam: member.lastname,
                                email: member.email,
                                telefoon: member.mobile || member.phone,
                                contract_naam: contract.membership_name,
                                einddatum: contract.contract_end_date,
                                bezoeken_90_dagen: visits.length
                            });
                        }
                        sentCount++;
                        console.log(`[${sentCount}/${MAX_PER_DAG}] ${ECHT_VERSTUREN ? 'Verzonden' : 'ZOU STUREN'}: ${member.firstname} ${member.lastname} (${member.email}) | ${contract.membership_name} | eind ${contract.contract_end_date} | ${visits.length} bezoeken`);
                        await sleep(3000);
                    }
                }
            }
            if (members.length < 500) hasMore = false;
        }
        console.log(`--- SCAN KLAAR ---`);
        console.log(`Totaal leden gescand: ${totaalLeden}`);
        console.log(`${ECHT_VERSTUREN ? 'Verzonden naar Make' : 'Zou verstuurd worden'}: ${sentCount}`);
    } catch (e) {
        console.error("Kritieke fout:", e.message);
        if (e.response) console.error("API zei:", JSON.stringify(e.response.data));
    }
}
runRetentionBot();
