const axios = require('axios');

// Vul hier JOUW eigen e-mailadres in (hier komt de testmail binnen):
const TEST_EMAIL = "info@yvsportfitclub.nl";   // <-- AANPASSEN

const MAKE_WEBHOOK_VERLENGING = process.env.MAKE_WEBHOOK_VERLENGING;

async function testWebhook() {
    console.log("--- TEST: 1 nep-lid naar Make sturen ---");
    if (!MAKE_WEBHOOK_VERLENGING) {
        console.error("FOUT: MAKE_WEBHOOK_VERLENGING is niet ingesteld in Railway.");
        return;
    }
    try {
        const res = await axios.post(MAKE_WEBHOOK_VERLENGING, {
            member_id: 999999,                 // nep-id: makkelijk terug te vinden en te verwijderen
            voornaam: "TESTLID",
            achternaam: "NIET-ECHT",
            email: TEST_EMAIL,
            telefoon: "0600000000",
            contract_naam: "Premium Complete TEST",
            einddatum: "2026-08-31",
            bezoeken_90_dagen: 5
        });
        console.log("Make antwoordde met status:", res.status, JSON.stringify(res.data));
        console.log("KLAAR. Check nu: (1) je mailbox, (2) de sheet-rij met member_id 999999.");
    } catch (e) {
        console.error("Fout bij versturen:", e.message);
        if (e.response) console.error("Make zei:", e.response.status, JSON.stringify(e.response.data));
    }
}
testWebhook();
