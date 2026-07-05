const axios = require('axios');
// OMGEVINGSVARIABELEN
const CLUB_ID = process.env.CLUB_ID;
const API_KEY = process.env.API_KEY;
const CLUB_SECRET = process.env.CLUB_SECRET;
const MAKE_WEBHOOK_VERLENGING = process.env.MAKE_WEBHOOK_VERLENGING;

// VEILIGHEID: op false = alleen testen, stuurt NIETS naar Make.
// Pas als de aantallen kloppen zetten we dit op true.
const ECHT_VERSTUREN = false;

// CONFIGURATIE
const MAX_PER_DAG = 30;
const WINDOW_START = 65;
const WINDOW_END = 50;
const MIN_VISITS_RECENT = 1;
const RECENT_WINDOW_MS = 90 * 24 * 60 * 60 * 1000;
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function runRetentionBot() {
    console.log(`--- [START] TEST SCAN ---`);
    const today = new Date();
    const dateStart = new Date();
    dateStart.setDate(today.getDate() + WINDOW_END);
    const dateEnd = new Date();
    dateEnd.setDate(today.getDate() + WINDOW_START);
    console.log(`Zoek einddatums tussen ${dateStart.toISOString().slice(0,10)} en ${dateEnd.toISOString().slice(0,10)}`);

    // FIX: Virtuagym verwacht seconden, niet milliseconden
    const timestamp90DaysAgo = Math.floor((Date.now() - RECENT_WINDOW_MS) / 1000);

    let fromId = 0;
    let hasMore = true;
    let sentCount = 0;
    let totaalLeden = 0;
    let matches = 0;
    let voorbeeldenGetoond = 0;

    try {
        while (hasMore && sentCount < MAX_PER_DAG) {
            const res = await axios.get(`https://api.virtuagym.com/api/v1/club/${CLUB_ID}/member`, {
                params: { api_key: API_KEY, club_secret: CLUB_SECRET, with: 'active_memberships', from_id: fromId, limit: 1000 }
            });
            const members = res.data.result || [];
            console.log(`Batch opgehaald: ${members.length} leden`);
            if (members.length === 0) break;
            totaalLeden += members.length;

            for (const member of members) {
                if (sentCount >= MAX_PER_DAG) break;
                fromId = Math.max(fromId, member.member_id);
                if (!member.active_memberships) continue;

                // DIAGNOSE: laat van de eerste 10 leden zien wat hun pakket + einddatum is
                if (voorbeeldenGetoond < 10) {
                    member.active_memberships.forEach(m => {
                        console.log(`   voorbeeld: pakket="${m.membership_name}" einddatum="${m.contract_end_date}"`);
                    });
                    voorbeeldenGetoond++;
                }

                const contract = member.active_memberships.find(m => {
                    const name = (m.membership_name || "").toLowerCase();
                    const isRightType = name.includes('complete') || name.includes('focus');
                    const endDate = new Date(m.contract_end_date);
                    const isWithinWindow = endDate >= dateStart && endDate <= dateEnd;
                    return isRightType && isWithinWindow;
                });

                if (contract) {
                    matches++;
                    console.log(`MATCH: ${member.firstname} ${member.lastname} | pakket="${contract.membership_name}" | einddatum=${contract.contract_end_date}`);
                    const vRes = await axios.get(`https://api.virtuagym.com/api/v1/club/${CLUB_ID}/visits`, {
                        params: { api_key: API_KEY, club_secret: CLUB_SECRET, member_id: member.member_id, sync_from: timestamp90DaysAgo }
                    });
                    const visits = vRes.data.result || [];
                    console.log(`   -> bezoeken laatste 90 dagen: ${visits.length}`);
                    if (visits.length >= MIN_VISITS_RECENT) {
                        if (ECHT_VERSTUREN) {
                            await axios.post(MAKE_WEBHOOK_VERLENGING, {
                                member_id: member.member_id, voornaam: member.firstname, achternaam: member.lastname,
                                email: member.email, telefoon: member.mobile || member.phone,
                                contract_naam: contract.membership_name, einddatum: contract.contract_end_date,
                                bezoeken_90_dagen: visits.length
                            });
                        }
                        sentCount++;
                        console.log(`   -> [${sentCount}] ${ECHT_VERSTUREN ? 'VERZONDEN' : 'ZOU VERSTUURD WORDEN'}: ${member.firstname} ${member.lastname}`);
                        await sleep(500);
                    }
                }
            }
            if (members.length < 1000) hasMore = false;
        }
        console.log(`--- KLAAR ---`);
        console.log(`Totaal leden gescand: ${totaalLeden}`);
        console.log(`Leden met juist pakket EN einddatum in window: ${matches}`);
        console.log(`Daarvan met genoeg bezoeken (klaar voor Make): ${sentCount}`);
    } catch (e) {
        console.error("Kritieke fout:", e.message);
    }
}
runRetentionBot();
