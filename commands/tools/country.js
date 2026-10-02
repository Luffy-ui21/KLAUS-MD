import { getBotName } from '../../lib/botname.js';

// ─── phone prefix database ────────────────────────────────────────────────────
// Sorted longest-prefix first so we match the most specific code first.
const PHONE_DB = [
    // ── Africa ──────────────────────────────────────────────────────────────
    { prefix: '20',   country: 'Egypt',                    continent: 'Africa',  flag: '🇪🇬' },
    { prefix: '212',  country: 'Morocco',                  continent: 'Africa',  flag: '🇲🇦' },
    { prefix: '213',  country: 'Algeria',                  continent: 'Africa',  flag: '🇩🇿' },
    { prefix: '216',  country: 'Tunisia',                  continent: 'Africa',  flag: '🇹🇳' },
    { prefix: '218',  country: 'Libya',                    continent: 'Africa',  flag: '🇱🇾' },
    { prefix: '220',  country: 'Gambia',                   continent: 'Africa',  flag: '🇬🇲' },
    { prefix: '221',  country: 'Senegal',                  continent: 'Africa',  flag: '🇸🇳' },
    { prefix: '222',  country: 'Mauritania',               continent: 'Africa',  flag: '🇲🇷' },
    { prefix: '223',  country: 'Mali',                     continent: 'Africa',  flag: '🇲🇱' },
    { prefix: '224',  country: 'Guinea',                   continent: 'Africa',  flag: '🇬🇳' },
    { prefix: '225',  country: 'Ivory Coast',              continent: 'Africa',  flag: '🇨🇮' },
    { prefix: '226',  country: 'Burkina Faso',             continent: 'Africa',  flag: '🇧🇫' },
    { prefix: '227',  country: 'Niger',                    continent: 'Africa',  flag: '🇳🇪' },
    { prefix: '228',  country: 'Togo',                     continent: 'Africa',  flag: '🇹🇬' },
    { prefix: '229',  country: 'Benin',                    continent: 'Africa',  flag: '🇧🇯' },
    { prefix: '230',  country: 'Mauritius',                continent: 'Africa',  flag: '🇲🇺' },
    { prefix: '231',  country: 'Liberia',                  continent: 'Africa',  flag: '🇱🇷' },
    { prefix: '232',  country: 'Sierra Leone',             continent: 'Africa',  flag: '🇸🇱' },
    { prefix: '233',  country: 'Ghana',                    continent: 'Africa',  flag: '🇬🇭' },
    { prefix: '234',  country: 'Nigeria',                  continent: 'Africa',  flag: '🇳🇬' },
    { prefix: '235',  country: 'Chad',                     continent: 'Africa',  flag: '🇹🇩' },
    { prefix: '236',  country: 'Central African Republic', continent: 'Africa',  flag: '🇨🇫' },
    { prefix: '237',  country: 'Cameroon',                 continent: 'Africa',  flag: '🇨🇲' },
    { prefix: '238',  country: 'Cape Verde',               continent: 'Africa',  flag: '🇨🇻' },
    { prefix: '239',  country: 'São Tomé and Príncipe',   continent: 'Africa',  flag: '🇸🇹' },
    { prefix: '240',  country: 'Equatorial Guinea',        continent: 'Africa',  flag: '🇬🇶' },
    { prefix: '241',  country: 'Gabon',                    continent: 'Africa',  flag: '🇬🇦' },
    { prefix: '242',  country: 'Republic of the Congo',    continent: 'Africa',  flag: '🇨🇬' },
    { prefix: '243',  country: 'DR Congo',                 continent: 'Africa',  flag: '🇨🇩' },
    { prefix: '244',  country: 'Angola',                   continent: 'Africa',  flag: '🇦🇴' },
    { prefix: '245',  country: 'Guinea-Bissau',            continent: 'Africa',  flag: '🇬🇼' },
    { prefix: '246',  country: 'British Indian Ocean Territory', continent: 'Africa', flag: '🇮🇴' },
    { prefix: '247',  country: 'Ascension Island',         continent: 'Africa',  flag: '🇸🇭' },
    { prefix: '248',  country: 'Seychelles',               continent: 'Africa',  flag: '🇸🇨' },
    { prefix: '249',  country: 'Sudan',                    continent: 'Africa',  flag: '🇸🇩' },
    { prefix: '250',  country: 'Rwanda',                   continent: 'Africa',  flag: '🇷🇼' },
    { prefix: '251',  country: 'Ethiopia',                 continent: 'Africa',  flag: '🇪🇹' },
    { prefix: '252',  country: 'Somalia',                  continent: 'Africa',  flag: '🇸🇴' },
    { prefix: '253',  country: 'Djibouti',                 continent: 'Africa',  flag: '🇩🇯' },
    { prefix: '254',  country: 'Kenya',                    continent: 'Africa',  flag: '🇰🇪' },
    { prefix: '255',  country: 'Tanzania',                 continent: 'Africa',  flag: '🇹🇿' },
    { prefix: '256',  country: 'Uganda',                   continent: 'Africa',  flag: '🇺🇬' },
    { prefix: '257',  country: 'Burundi',                  continent: 'Africa',  flag: '🇧🇮' },
    { prefix: '258',  country: 'Mozambique',               continent: 'Africa',  flag: '🇲🇿' },
    { prefix: '260',  country: 'Zambia',                   continent: 'Africa',  flag: '🇿🇲' },
    { prefix: '261',  country: 'Madagascar',               continent: 'Africa',  flag: '🇲🇬' },
    { prefix: '262',  country: 'Réunion / Mayotte',        continent: 'Africa',  flag: '🇷🇪' },
    { prefix: '263',  country: 'Zimbabwe',                 continent: 'Africa',  flag: '🇿🇼' },
    { prefix: '264',  country: 'Namibia',                  continent: 'Africa',  flag: '🇳🇦' },
    { prefix: '265',  country: 'Malawi',                   continent: 'Africa',  flag: '🇲🇼' },
    { prefix: '266',  country: 'Lesotho',                  continent: 'Africa',  flag: '🇱🇸' },
    { prefix: '267',  country: 'Botswana',                 continent: 'Africa',  flag: '🇧🇼' },
    { prefix: '268',  country: 'Eswatini',                 continent: 'Africa',  flag: '🇸🇿' },
    { prefix: '269',  country: 'Comoros',                  continent: 'Africa',  flag: '🇰🇲' },
    { prefix: '27',   country: 'South Africa',             continent: 'Africa',  flag: '🇿🇦' },
    { prefix: '290',  country: 'Saint Helena',             continent: 'Africa',  flag: '🇸🇭' },
    { prefix: '291',  country: 'Eritrea',                  continent: 'Africa',  flag: '🇪🇷' },
    { prefix: '297',  country: 'Aruba',                    continent: 'North America', flag: '🇦🇼' },
    { prefix: '298',  country: 'Faroe Islands',            continent: 'Europe',  flag: '🇫🇴' },
    { prefix: '299',  country: 'Greenland',                continent: 'North America', flag: '🇬🇱' },

    // ── Europe ───────────────────────────────────────────────────────────────
    { prefix: '30',   country: 'Greece',                   continent: 'Europe',  flag: '🇬🇷' },
    { prefix: '31',   country: 'Netherlands',              continent: 'Europe',  flag: '🇳🇱' },
    { prefix: '32',   country: 'Belgium',                  continent: 'Europe',  flag: '🇧🇪' },
    { prefix: '33',   country: 'France',                   continent: 'Europe',  flag: '🇫🇷' },
    { prefix: '34',   country: 'Spain',                    continent: 'Europe',  flag: '🇪🇸' },
    { prefix: '350',  country: 'Gibraltar',                continent: 'Europe',  flag: '🇬🇮' },
    { prefix: '351',  country: 'Portugal',                 continent: 'Europe',  flag: '🇵🇹' },
    { prefix: '352',  country: 'Luxembourg',               continent: 'Europe',  flag: '🇱🇺' },
    { prefix: '353',  country: 'Ireland',                  continent: 'Europe',  flag: '🇮🇪' },
    { prefix: '354',  country: 'Iceland',                  continent: 'Europe',  flag: '🇮🇸' },
    { prefix: '355',  country: 'Albania',                  continent: 'Europe',  flag: '🇦🇱' },
    { prefix: '356',  country: 'Malta',                    continent: 'Europe',  flag: '🇲🇹' },
    { prefix: '357',  country: 'Cyprus',                   continent: 'Europe',  flag: '🇨🇾' },
    { prefix: '358',  country: 'Finland',                  continent: 'Europe',  flag: '🇫🇮' },
    { prefix: '359',  country: 'Bulgaria',                 continent: 'Europe',  flag: '🇧🇬' },
    { prefix: '36',   country: 'Hungary',                  continent: 'Europe',  flag: '🇭🇺' },
    { prefix: '370',  country: 'Lithuania',                continent: 'Europe',  flag: '🇱🇹' },
    { prefix: '371',  country: 'Latvia',                   continent: 'Europe',  flag: '🇱🇻' },
    { prefix: '372',  country: 'Estonia',                  continent: 'Europe',  flag: '🇪🇪' },
    { prefix: '373',  country: 'Moldova',                  continent: 'Europe',  flag: '🇲🇩' },
    { prefix: '374',  country: 'Armenia',                  continent: 'Asia',    flag: '🇦🇲' },
    { prefix: '375',  country: 'Belarus',                  continent: 'Europe',  flag: '🇧🇾' },
    { prefix: '376',  country: 'Andorra',                  continent: 'Europe',  flag: '🇦🇩' },
    { prefix: '377',  country: 'Monaco',                   continent: 'Europe',  flag: '🇲🇨' },
    { prefix: '378',  country: 'San Marino',               continent: 'Europe',  flag: '🇸🇲' },
    { prefix: '380',  country: 'Ukraine',                  continent: 'Europe',  flag: '🇺🇦' },
    { prefix: '381',  country: 'Serbia',                   continent: 'Europe',  flag: '🇷🇸' },
    { prefix: '382',  country: 'Montenegro',               continent: 'Europe',  flag: '🇲🇪' },
    { prefix: '383',  country: 'Kosovo',                   continent: 'Europe',  flag: '🇽🇰' },
    { prefix: '385',  country: 'Croatia',                  continent: 'Europe',  flag: '🇭🇷' },
    { prefix: '386',  country: 'Slovenia',                 continent: 'Europe',  flag: '🇸🇮' },
    { prefix: '387',  country: 'Bosnia and Herzegovina',   continent: 'Europe',  flag: '🇧🇦' },
    { prefix: '389',  country: 'North Macedonia',          continent: 'Europe',  flag: '🇲🇰' },
    { prefix: '39',   country: 'Italy',                    continent: 'Europe',  flag: '🇮🇹' },
    { prefix: '40',   country: 'Romania',                  continent: 'Europe',  flag: '🇷🇴' },
    { prefix: '41',   country: 'Switzerland',              continent: 'Europe',  flag: '🇨🇭' },
    { prefix: '420',  country: 'Czech Republic',           continent: 'Europe',  flag: '🇨🇿' },
    { prefix: '421',  country: 'Slovakia',                 continent: 'Europe',  flag: '🇸🇰' },
    { prefix: '423',  country: 'Liechtenstein',            continent: 'Europe',  flag: '🇱🇮' },
    { prefix: '43',   country: 'Austria',                  continent: 'Europe',  flag: '🇦🇹' },
    { prefix: '44',   country: 'United Kingdom',           continent: 'Europe',  flag: '🇬🇧' },
    { prefix: '45',   country: 'Denmark',                  continent: 'Europe',  flag: '🇩🇰' },
    { prefix: '46',   country: 'Sweden',                   continent: 'Europe',  flag: '🇸🇪' },
    { prefix: '47',   country: 'Norway',                   continent: 'Europe',  flag: '🇳🇴' },
    { prefix: '48',   country: 'Poland',                   continent: 'Europe',  flag: '🇵🇱' },
    { prefix: '49',   country: 'Germany',                  continent: 'Europe',  flag: '🇩🇪' },

    // ── Americas ─────────────────────────────────────────────────────────────
    { prefix: '1',    country: 'USA / Canada',             continent: 'North America', flag: '🇺🇸' },
    { prefix: '52',   country: 'Mexico',                   continent: 'North America', flag: '🇲🇽' },
    { prefix: '53',   country: 'Cuba',                     continent: 'North America', flag: '🇨🇺' },
    { prefix: '54',   country: 'Argentina',                continent: 'South America', flag: '🇦🇷' },
    { prefix: '55',   country: 'Brazil',                   continent: 'South America', flag: '🇧🇷' },
    { prefix: '56',   country: 'Chile',                    continent: 'South America', flag: '🇨🇱' },
    { prefix: '57',   country: 'Colombia',                 continent: 'South America', flag: '🇨🇴' },
    { prefix: '58',   country: 'Venezuela',                continent: 'South America', flag: '🇻🇪' },
    { prefix: '501',  country: 'Belize',                   continent: 'North America', flag: '🇧🇿' },
    { prefix: '502',  country: 'Guatemala',                continent: 'North America', flag: '🇬🇹' },
    { prefix: '503',  country: 'El Salvador',              continent: 'North America', flag: '🇸🇻' },
    { prefix: '504',  country: 'Honduras',                 continent: 'North America', flag: '🇭🇳' },
    { prefix: '505',  country: 'Nicaragua',                continent: 'North America', flag: '🇳🇮' },
    { prefix: '506',  country: 'Costa Rica',               continent: 'North America', flag: '🇨🇷' },
    { prefix: '507',  country: 'Panama',                   continent: 'North America', flag: '🇵🇦' },
    { prefix: '508',  country: 'Saint Pierre and Miquelon',continent: 'North America', flag: '🇵🇲' },
    { prefix: '509',  country: 'Haiti',                    continent: 'North America', flag: '🇭🇹' },
    { prefix: '51',   country: 'Peru',                     continent: 'South America', flag: '🇵🇪' },
    { prefix: '591',  country: 'Bolivia',                  continent: 'South America', flag: '🇧🇴' },
    { prefix: '592',  country: 'Guyana',                   continent: 'South America', flag: '🇬🇾' },
    { prefix: '593',  country: 'Ecuador',                  continent: 'South America', flag: '🇪🇨' },
    { prefix: '594',  country: 'French Guiana',            continent: 'South America', flag: '🇬🇫' },
    { prefix: '595',  country: 'Paraguay',                 continent: 'South America', flag: '🇵🇾' },
    { prefix: '596',  country: 'Martinique',               continent: 'North America', flag: '🇲🇶' },
    { prefix: '597',  country: 'Suriname',                 continent: 'South America', flag: '🇸🇷' },
    { prefix: '598',  country: 'Uruguay',                  continent: 'South America', flag: '🇺🇾' },
    { prefix: '599',  country: 'Netherlands Antilles',     continent: 'North America', flag: '🇨🇼' },

    // ── Asia ─────────────────────────────────────────────────────────────────
    { prefix: '60',   country: 'Malaysia',                 continent: 'Asia',    flag: '🇲🇾' },
    { prefix: '61',   country: 'Australia',                continent: 'Oceania', flag: '🇦🇺' },
    { prefix: '62',   country: 'Indonesia',                continent: 'Asia',    flag: '🇮🇩' },
    { prefix: '63',   country: 'Philippines',              continent: 'Asia',    flag: '🇵🇭' },
    { prefix: '64',   country: 'New Zealand',              continent: 'Oceania', flag: '🇳🇿' },
    { prefix: '65',   country: 'Singapore',                continent: 'Asia',    flag: '🇸🇬' },
    { prefix: '66',   country: 'Thailand',                 continent: 'Asia',    flag: '🇹🇭' },
    { prefix: '670',  country: 'Timor-Leste',              continent: 'Asia',    flag: '🇹🇱' },
    { prefix: '672',  country: 'Norfolk Island',           continent: 'Oceania', flag: '🇳🇫' },
    { prefix: '673',  country: 'Brunei',                   continent: 'Asia',    flag: '🇧🇳' },
    { prefix: '674',  country: 'Nauru',                    continent: 'Oceania', flag: '🇳🇷' },
    { prefix: '675',  country: 'Papua New Guinea',         continent: 'Oceania', flag: '🇵🇬' },
    { prefix: '676',  country: 'Tonga',                    continent: 'Oceania', flag: '🇹🇴' },
    { prefix: '677',  country: 'Solomon Islands',          continent: 'Oceania', flag: '🇸🇧' },
    { prefix: '678',  country: 'Vanuatu',                  continent: 'Oceania', flag: '🇻🇺' },
    { prefix: '679',  country: 'Fiji',                     continent: 'Oceania', flag: '🇫🇯' },
    { prefix: '680',  country: 'Palau',                    continent: 'Oceania', flag: '🇵🇼' },
    { prefix: '681',  country: 'Wallis and Futuna',        continent: 'Oceania', flag: '🇼🇫' },
    { prefix: '682',  country: 'Cook Islands',             continent: 'Oceania', flag: '🇨🇰' },
    { prefix: '683',  country: 'Niue',                     continent: 'Oceania', flag: '🇳🇺' },
    { prefix: '685',  country: 'Samoa',                    continent: 'Oceania', flag: '🇼🇸' },
    { prefix: '686',  country: 'Kiribati',                 continent: 'Oceania', flag: '🇰🇮' },
    { prefix: '687',  country: 'New Caledonia',            continent: 'Oceania', flag: '🇳🇨' },
    { prefix: '688',  country: 'Tuvalu',                   continent: 'Oceania', flag: '🇹🇻' },
    { prefix: '689',  country: 'French Polynesia',         continent: 'Oceania', flag: '🇵🇫' },
    { prefix: '690',  country: 'Tokelau',                  continent: 'Oceania', flag: '🇹🇰' },
    { prefix: '691',  country: 'Micronesia',               continent: 'Oceania', flag: '🇫🇲' },
    { prefix: '692',  country: 'Marshall Islands',         continent: 'Oceania', flag: '🇲🇭' },
    { prefix: '7',    country: 'Russia / Kazakhstan',      continent: 'Europe / Asia', flag: '🇷🇺' },
    { prefix: '81',   country: 'Japan',                    continent: 'Asia',    flag: '🇯🇵' },
    { prefix: '82',   country: 'South Korea',              continent: 'Asia',    flag: '🇰🇷' },
    { prefix: '84',   country: 'Vietnam',                  continent: 'Asia',    flag: '🇻🇳' },
    { prefix: '850',  country: 'North Korea',              continent: 'Asia',    flag: '🇰🇵' },
    { prefix: '852',  country: 'Hong Kong',                continent: 'Asia',    flag: '🇭🇰' },
    { prefix: '853',  country: 'Macau',                    continent: 'Asia',    flag: '🇲🇴' },
    { prefix: '855',  country: 'Cambodia',                 continent: 'Asia',    flag: '🇰🇭' },
    { prefix: '856',  country: 'Laos',                     continent: 'Asia',    flag: '🇱🇦' },
    { prefix: '86',   country: 'China',                    continent: 'Asia',    flag: '🇨🇳' },
    { prefix: '880',  country: 'Bangladesh',               continent: 'Asia',    flag: '🇧🇩' },
    { prefix: '886',  country: 'Taiwan',                   continent: 'Asia',    flag: '🇹🇼' },
    { prefix: '90',   country: 'Turkey',                   continent: 'Asia',    flag: '🇹🇷' },
    { prefix: '91',   country: 'India',                    continent: 'Asia',    flag: '🇮🇳' },
    { prefix: '92',   country: 'Pakistan',                 continent: 'Asia',    flag: '🇵🇰' },
    { prefix: '93',   country: 'Afghanistan',              continent: 'Asia',    flag: '🇦🇫' },
    { prefix: '94',   country: 'Sri Lanka',                continent: 'Asia',    flag: '🇱🇰' },
    { prefix: '95',   country: 'Myanmar',                  continent: 'Asia',    flag: '🇲🇲' },
    { prefix: '960',  country: 'Maldives',                 continent: 'Asia',    flag: '🇲🇻' },
    { prefix: '961',  country: 'Lebanon',                  continent: 'Asia',    flag: '🇱🇧' },
    { prefix: '962',  country: 'Jordan',                   continent: 'Asia',    flag: '🇯🇴' },
    { prefix: '963',  country: 'Syria',                    continent: 'Asia',    flag: '🇸🇾' },
    { prefix: '964',  country: 'Iraq',                     continent: 'Asia',    flag: '🇮🇶' },
    { prefix: '965',  country: 'Kuwait',                   continent: 'Asia',    flag: '🇰🇼' },
    { prefix: '966',  country: 'Saudi Arabia',             continent: 'Asia',    flag: '🇸🇦' },
    { prefix: '967',  country: 'Yemen',                    continent: 'Asia',    flag: '🇾🇪' },
    { prefix: '968',  country: 'Oman',                     continent: 'Asia',    flag: '🇴🇲' },
    { prefix: '970',  country: 'Palestine',                continent: 'Asia',    flag: '🇵🇸' },
    { prefix: '971',  country: 'United Arab Emirates',     continent: 'Asia',    flag: '🇦🇪' },
    { prefix: '972',  country: 'Israel',                   continent: 'Asia',    flag: '🇮🇱' },
    { prefix: '973',  country: 'Bahrain',                  continent: 'Asia',    flag: '🇧🇭' },
    { prefix: '974',  country: 'Qatar',                    continent: 'Asia',    flag: '🇶🇦' },
    { prefix: '975',  country: 'Bhutan',                   continent: 'Asia',    flag: '🇧🇹' },
    { prefix: '976',  country: 'Mongolia',                 continent: 'Asia',    flag: '🇲🇳' },
    { prefix: '977',  country: 'Nepal',                    continent: 'Asia',    flag: '🇳🇵' },
    { prefix: '98',   country: 'Iran',                     continent: 'Asia',    flag: '🇮🇷' },
    { prefix: '992',  country: 'Tajikistan',               continent: 'Asia',    flag: '🇹🇯' },
    { prefix: '993',  country: 'Turkmenistan',             continent: 'Asia',    flag: '🇹🇲' },
    { prefix: '994',  country: 'Azerbaijan',               continent: 'Asia',    flag: '🇦🇿' },
    { prefix: '995',  country: 'Georgia',                  continent: 'Asia',    flag: '🇬🇪' },
    { prefix: '996',  country: 'Kyrgyzstan',               continent: 'Asia',    flag: '🇰🇬' },
    { prefix: '998',  country: 'Uzbekistan',               continent: 'Asia',    flag: '🇺🇿' },
];

// Sort longest prefix first for greedy matching
PHONE_DB.sort((a, b) => b.prefix.length - a.prefix.length);

// ─── lookup ───────────────────────────────────────────────────────────────────

function lookupByNumber(number) {
    const digits = number.replace(/\D/g, '').replace(/^0+/, '');
    for (const entry of PHONE_DB) {
        if (digits.startsWith(entry.prefix)) return entry;
    }
    return null;
}

// ─── number extractor ─────────────────────────────────────────────────────────

function extractNumberFromJid(jid) {
    return (jid || '').split('@')[0].split(':')[0].replace(/\D/g, '');
}

// Resolve a raw JID (may be @lid, @s.whatsapp.net, or bare number) to a phone
// number string using group participant list when available — same strategy as kick.js
function phoneFromParticipant(p, fallbackJid) {
    if (!p) {
        const num = extractNumberFromJid(fallbackJid || '');
        return /^\d{7,15}$/.test(num) ? num : null;
    }
    // p.id is the preferred field — use it if it is not @lid
    const id = p.id || fallbackJid || '';
    if (!id.includes('@lid')) {
        const num = extractNumberFromJid(id);
        return /^\d{7,15}$/.test(num) ? num : null;
    }
    // p.phoneNumber is set by Baileys when it can map the LID
    if (p.phoneNumber) {
        const num = String(p.phoneNumber).replace(/\D/g, '');
        if (/^\d{7,15}$/.test(num)) return num;
    }
    // globalThis LID → phone cache populated by the bot's JID manager
    const lidKey = id.split(':')[0].split('@')[0];
    const cached = globalThis.lidPhoneCache?.get(lidKey);
    if (cached) return cached;
    return null;
}

async function findParticipant(sock, chatId, jid) {
    try {
        if (!chatId.endsWith('@g.us')) return null;
        const meta = await sock.groupMetadata(chatId);
        const jidKey = jid.split(':')[0].split('@')[0];
        // Match by numeric/lid key against both p.id and p.lid fields
        return meta.participants.find(p => {
            const pIdKey  = (p.id  || '').split(':')[0].split('@')[0];
            const pLidKey = (p.lid || '').split(':')[0].split('@')[0];
            return pIdKey === jidKey || pLidKey === jidKey;
        }) || null;
    } catch {
        return null;
    }
}

async function resolveToPhone(sock, chatId, jid) {
    if (!jid) return null;
    // If already a plain phone JID, extract directly
    if (!jid.includes('@lid')) {
        const num = extractNumberFromJid(jid);
        if (/^\d{7,15}$/.test(num)) return num;
    }
    // For @lid (or any JID): look up in group participant list first
    const participant = await findParticipant(sock, chatId, jid);
    const num = phoneFromParticipant(participant, jid);
    return num;
}

async function resolveTarget(sock, msg, args) {
    const chatId = msg.key.remoteJid;
    const contextInfo =
        msg.message?.extendedTextMessage?.contextInfo ||
        msg.message?.imageMessage?.contextInfo ||
        msg.message?.videoMessage?.contextInfo ||
        msg.message?.documentMessage?.contextInfo ||
        msg.message?.stickerMessage?.contextInfo ||
        msg.message?.buttonsResponseMessage?.contextInfo ||
        msg.message?.templateButtonReplyMessage?.contextInfo || {};

    // 1. Number supplied as arg
    if (args.length) {
        const raw = args.join('').replace(/[\s\+\-\(\)]/g, '').replace(/^0+/, '');
        if (/^\d{7,15}$/.test(raw)) return { number: raw, source: 'arg' };
    }

    // 2. Mentioned user
    const mentioned = contextInfo.mentionedJid?.[0];
    if (mentioned) {
        const number = await resolveToPhone(sock, chatId, mentioned);
        if (number) return { number, source: 'mention' };
        return { unresolvable: true };
    }

    // 3. Quoted message sender
    if (contextInfo.quotedMessage && contextInfo.participant) {
        const number = await resolveToPhone(sock, chatId, contextInfo.participant);
        if (number) return { number, source: 'reply' };
        return { unresolvable: true };
    }

    return null;
}

// ─── command ──────────────────────────────────────────────────────────────────

export default {
    name: 'country',
    alias: ['whichcountry', 'numcountry', 'phonecountry'],
    description: 'Find the country and continent from a phone number, mention, or reply',
    category: 'tools',

    async execute(sock, msg, args, PREFIX) {
        const chatId = msg.key.remoteJid;

        await sock.sendMessage(chatId, { react: { text: '⏳', key: msg.key } });

        const target = await resolveTarget(sock, msg, args);

        if (!target) {
            await sock.sendMessage(chatId, { react: { text: '❌', key: msg.key } });
            return sock.sendMessage(chatId, {
                text: `╭⊷『 🌍 COUNTRY LOOKUP 』\n│\n` +
                      `├⊷ *Usage:*\n` +
                      `├⊷ ${PREFIX}country 254713046497\n` +
                      `├⊷ ${PREFIX}country @mention\n` +
                      `├⊷ Reply to a message + ${PREFIX}country\n` +
                      `└⊷ *Tip:* Number must include country code\n\n` +
                      `╰⊷ *${getBotName()} Tools*`
            }, { quoted: msg });
        }

        if (target.unresolvable) {
            await sock.sendMessage(chatId, { react: { text: '❌', key: msg.key } });
            return sock.sendMessage(chatId, {
                text: `╭⊷『 🌍 COUNTRY LOOKUP 』\n│\n` +
                      `├⊷ *Result:* ❌ Could not resolve this user's number\n` +
                      `├⊷ *Why:* This user's account uses a privacy ID\n` +
                      `├⊷ *Fix:* Try passing their number directly\n` +
                      `└⊷ *Example:* ${PREFIX}country 923001234567\n\n` +
                      `╰⊷ *${getBotName()} Tools*`
            }, { quoted: msg });
        }

        const { number, source } = target;
        const info = lookupByNumber(number);

        if (!info) {
            await sock.sendMessage(chatId, { react: { text: '❌', key: msg.key } });
            return sock.sendMessage(chatId, {
                text: `╭⊷『 🌍 COUNTRY LOOKUP 』\n│\n` +
                      `├⊷ *Number:* +${number}\n` +
                      `├⊷ *Result:* ❓ Unknown country\n` +
                      `└⊷ *Source:* ${source}\n\n` +
                      `╰⊷ *${getBotName()} Tools*`
            }, { quoted: msg });
        }

        const sourceLabel = source === 'arg'    ? 'Direct number'
                          : source === 'mention' ? 'Mentioned user'
                          : 'Replied user';

        await sock.sendMessage(chatId, { react: { text: '✅', key: msg.key } });
        await sock.sendMessage(chatId, {
            text: `╭⊷『 ${info.flag} COUNTRY LOOKUP 』\n│\n` +
                  `├⊷ *Number:* +${number}\n` +
                  `├⊷ *Country:* ${info.flag} ${info.country}\n` +
                  `├⊷ *Continent:* 🌐 ${info.continent}\n` +
                  `├⊷ *Dial Code:* +${info.prefix}\n` +
                  `└⊷ *Source:* ${sourceLabel}\n\n` +
                  `╰⊷ *${getBotName()} Tools*`
        }, { quoted: msg });
    }
};
