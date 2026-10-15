// DormGlide housing-policy helpers.
//
// Mirrors the Denison Student Residence Agreement 2026-2027 so that listings
// for items students may not keep in the residence halls are stopped at the
// form, and the same rules are enforced by the database trigger in
// supabase/multi-campus/25_housing_policy.sql. KEEP THE TWO LISTS IN SYNC:
// `node -e "require('./js/utils/policy.js'); console.log(DormGlidePolicy.sqlPattern())"`
// prints the Postgres pattern to paste into the migration.
(function () {
    const SOURCE = 'Denison University Student Residence Agreement, 2026–2027';
    const SOURCE_URL = 'http://www.denison.edu/campus/housing';

    // Phrases that look like a prohibited item but are allowed. They are
    // removed from the text before matching (no regex lookbehind, so old
    // phones stay supported).
    const ALLOWED_PHRASES = [
        'flameless candle', 'led candle', 'electric candle', 'battery candle', 'candle warmer', 'candle holder',
        'mattress topper', 'mattress pad', 'mattress protector', 'mattress cover', 'mattress encasement',
        'ac adapter', 'ac charger', 'ac power', 'ac cable', 'ac cord', 'ac/dc', 'ac dc',
        'kitchen knife', 'pocket knife', 'butter knife', 'knife set', 'knife block',
        'power strip', 'surge protector',
        'glue gun', 'nerf gun', 'massage gun', 'nail gun', 'water gun', 'squirt gun', 'gunmetal', 'gun metal',
        'snake plant', 'rabbit vibrator', 'bunny ears', 'cat ears', 'dog walking', 'dog walk', 'dog sitting', 'pet sitting', 'cat sitting',
        'toaster strudel', 'microwave safe', 'microwave-safe', 'microwavable', 'grill brush', 'grilled cheese',
        'hair dresser', 'hairdresser', 'dresser mirror', 'loft bed kit', 'lofted bed kit', 'bed riser'
    ];

    // label: shown to the student. clause: which part of the agreement.
    // re: pattern fragment (JS flavour; \b is converted to \y for Postgres).
    const RULES = [
        { label: 'air conditioner', clause: 'items', re: '\\b(?:air[ -]?con(?:ditioner|ditioning)?s?|a/c|ac|ac units?|window units?|portable ac)\\b' },
        { label: 'microwave', clause: 'kitchen', re: '\\bmicrowaves?\\b' },
        { label: 'hot plate', clause: 'kitchen', re: '\\bhot[ -]?plates?\\b' },
        { label: 'toaster or toaster oven', clause: 'kitchen', re: '\\btoasters?(?: ovens?)?\\b' },
        { label: 'electric skillet, griddle or grill', clause: 'kitchen', re: '\\b(?:electric (?:skillets?|griddles?)|george foreman|panini press|grills?)\\b' },
        { label: 'rice cooker, pressure cooker or Instant Pot', clause: 'kitchen', re: '\\b(?:rice cookers?|pressure cookers?|instant ?pots?|multi-?cookers?)\\b' },
        { label: 'space heater', clause: 'items', re: '\\b(?:space |electric |portable |room )?heaters?\\b' },
        { label: 'dehumidifier or fog machine', clause: 'items', re: '\\b(?:dehumidifiers?|fog machines?|smoke machines?)\\b' },
        { label: 'candle', clause: 'items', re: '\\bcandles?\\b' },
        { label: 'incense, potpourri burner or lava lamp', clause: 'items', re: '\\b(?:incense|potpourri burners?|lava lamps?)\\b' },
        { label: 'extension cord', clause: 'items', re: '\\bextension cords?\\b' },
        { label: 'ceiling fan', clause: 'items', re: '\\bceiling fans?\\b' },
        { label: 'weapon or replica weapon', clause: 'items', re: '\\b(?:guns?|rifles?|pistols?|firearms?|shotguns?|airsoft|bb guns?|paintball (?:guns?|markers?)|swords?|machetes?|daggers?|tasers?|stun guns?|pepper spray|crossbows?|brass knuckles|nunchucks?|throwing stars?|hunting kni(?:fe|ves)|switchblades?|butterfly kni(?:fe|ves))\\b' },
        { label: 'fireworks or flammable fuel', clause: 'items', re: '\\b(?:fireworks?|firecrackers?|sparklers?|smoke bombs?|lighter fluid|charcoal|propane|gasoline|kerosene|butane)\\b' },
        { label: 'security camera or smart doorbell', clause: 'items', re: '\\b(?:security cameras?|surveillance cameras?|spy cameras?|hidden cameras?|nanny cams?|ring doorbells?|nest doorbells?|smart doorbells?|video doorbells?|doorbell cameras?)\\b' },
        { label: 'animal', clause: 'items', re: '\\b(?:hamsters?|guinea pigs?|gerbils?|ferrets?|kittens?|puppies|puppy|bunny|bunnies|rabbits?|geckos?|bearded dragons?|parakeets?|snakes?|lizards?)\\b' },
        { label: 'loft', clause: 'items', re: '\\b(?:lofts?|lofted|lofting)\\b' },
        { label: 'mattress, bed frame, dresser or sleeper sofa', clause: 'furniture', re: '\\b(?:mattress(?:es)?|bed ?frames?|dressers?|sleeper sofas?|hide-?a-?beds?|futons?|sofa ?beds?|pull-?out couch(?:es)?|daybeds?|bunk beds?)\\b' },
        { label: 'waterbed, hot tub or pool', clause: 'items', re: '\\b(?:waterbeds?|hot tubs?|kiddie pools?|inflatable pools?|swimming pools?)\\b' }
    ];

    const COMPILED = RULES.map((rule) => ({ ...rule, regex: new RegExp(rule.re, 'i') }));

    const normalize = (text) => {
        let t = ' ' + String(text || '').toLowerCase().replace(/\s+/g, ' ') + ' ';
        ALLOWED_PHRASES.forEach((phrase) => { t = t.split(phrase).join(' '); });
        return t;
    };

    // Returns { label, clause, match } for the first prohibited item found, or null.
    const findProhibited = (...parts) => {
        const text = normalize(parts.join(' '));
        for (const rule of COMPILED) {
            const m = rule.regex.exec(text);
            if (m) return { label: rule.label, clause: rule.clause, match: m[0].trim() };
        }
        return null;
    };

    // Short list for the "see the list" link and the modal.
    const PROHIBITED_SUMMARY = [
        'Air conditioner units (window or free-standing)',
        'Microwaves, hot plates, toasters and toaster ovens, electric skillets and grills, rice and pressure cookers (in rooms without a designated kitchen)',
        'Coffee makers without an automatic shut-off',
        'Space heaters, dehumidifiers, fog machines, ceiling fans',
        'Candles (unless electronic), incense and potpourri burners, lava lamps',
        'Extension cords that are not power strips; large-bulb string lights',
        'Weapons, replica weapons and Airsoft; knives with blades over 3 inches',
        'Fireworks, lighter fluid, charcoal, propane and other flammables',
        'Security cameras and smart doorbells',
        'Animals, except fish in a tank of 10 gallons or less or an approved ESA',
        'Lofts and loft kits',
        'Personal mattresses, bed frames, dressers, sleeper sofas and hide-a-beds',
        'Waterbeds, hot tubs and pools'
    ];

    // Verbatim excerpts, quoted so Residential Communities & Housing can
    // recognise their own wording.
    const ITEMS_EXCERPT = [
        '“Because of the fire and life-safety risks associated with these items in a community setting, possession or use of the following items is strictly prohibited in the residence halls: candles, unless electronic; incense and potpourri burners; lava lamps; fog machines and dehumidifiers; extension cords of the non-power strip variety; weapons, including all life-like and replica weapons; waterbeds, hot tubs, pools; ceiling fans or other added electrical fixtures; space heaters; knives, except kitchen knives or ordinary pocket knives having a blade of three or fewer inches; hazardous chemicals and flammable or combustible materials; fireworks; cameras or devices to capture activity; animals; air conditioner units: neither window-installed or free-standing units are permitted; lofts; kitchen appliances, as designated below.”',
        '“Students may not use appliances with an open heating coil, including microwave ovens, hot plates, electric skillets, electric grilling machines, toasters, toaster ovens, and rice or pressure cookers in residence hall rooms without a designated kitchen area.”',
        '“While residents are encouraged to make their space feel comfortable, they are not permitted to bring in personal mattresses and bed frames, dressers, sleeper sofas/hide-a-beds.”'
    ];
    const ITEMS_SECTIONS = 'Room Decoration and Prohibited Items · Kitchens and Cooking Appliances · Furnishings & Amenities';

    const SPACES_EXCERPT = [
        '“To avoid hazards in access areas, such as lobbies, doorways, hallways, stairwells, and other common areas of the residence halls, these must be kept free of obstruction. Items such as trash bags, bicycles, furniture, personal effects, or other items should not be left in places where they might block or hinder egress.”',
        '“Common area furnishings may not be moved into student rooms.”',
        '“Residence halls maintain quiet hours at the following times during the academic year: Sunday through Thursday, 11:00 pm to 9:00 am; Friday and Saturday, 1:00 am to 10:00 am. During examination periods, strict quiet hours will be maintained twenty-four hours a day.”',
        '“Students hosting guests are responsible for informing their guests of University expectations and are responsible for the behavior of their guests.”',
        '“Students who reside in areas with community kitchens may use appliances in the community kitchen … University personnel may grant or prohibit access to community spaces, including community kitchens, at any time.”'
    ];
    const SPACES_SECTIONS = 'Obstruction of Common Areas · Furnishings & Amenities · Noise and Quiet Hours · Visitors and Overnight Guests · Kitchens and Cooking Appliances';

    // Postgres (ARE) version of the combined pattern, for the migration.
    const sqlPattern = () => RULES.map((r) => '(?:' + r.re.replace(/\\b/g, '\\y') + ')').join('|');

    window.DormGlidePolicy = {
        SOURCE, SOURCE_URL, RULES, ALLOWED_PHRASES, PROHIBITED_SUMMARY,
        ITEMS_EXCERPT, ITEMS_SECTIONS, SPACES_EXCERPT, SPACES_SECTIONS,
        findProhibited, normalize, sqlPattern
    };
    if (typeof module !== 'undefined') module.exports = window.DormGlidePolicy;
})();
