/**
 * phoneTimezone.js
 * Derives IANA timezone, country name, and flag emoji from a WhatsApp
 * phone-number's country-dialling prefix. Longest-prefix match is used
 * so 254 correctly beats 25 or 2.
 */

const PHONE_DATA = {
  // prefix : [timezone, country, flag]
  // ── North America ──────────────────────────────────────────────────────
  '1':   ['America/New_York',                    'United States / Canada',       '🇺🇸'],
  // ── Russia / Central Asia ─────────────────────────────────────────────
  '7':   ['Europe/Moscow',                        'Russia / Kazakhstan',          '🇷🇺'],
  // ── Europe ────────────────────────────────────────────────────────────
  '30':  ['Europe/Athens',                        'Greece',                       '🇬🇷'],
  '31':  ['Europe/Amsterdam',                     'Netherlands',                  '🇳🇱'],
  '32':  ['Europe/Brussels',                      'Belgium',                      '🇧🇪'],
  '33':  ['Europe/Paris',                         'France',                       '🇫🇷'],
  '34':  ['Europe/Madrid',                        'Spain',                        '🇪🇸'],
  '36':  ['Europe/Budapest',                      'Hungary',                      '🇭🇺'],
  '39':  ['Europe/Rome',                          'Italy',                        '🇮🇹'],
  '40':  ['Europe/Bucharest',                     'Romania',                      '🇷🇴'],
  '41':  ['Europe/Zurich',                        'Switzerland',                  '🇨🇭'],
  '43':  ['Europe/Vienna',                        'Austria',                      '🇦🇹'],
  '44':  ['Europe/London',                        'United Kingdom',               '🇬🇧'],
  '45':  ['Europe/Copenhagen',                    'Denmark',                      '🇩🇰'],
  '46':  ['Europe/Stockholm',                     'Sweden',                       '🇸🇪'],
  '47':  ['Europe/Oslo',                          'Norway',                       '🇳🇴'],
  '48':  ['Europe/Warsaw',                        'Poland',                       '🇵🇱'],
  '49':  ['Europe/Berlin',                        'Germany',                      '🇩🇪'],
  '90':  ['Europe/Istanbul',                      'Turkey',                       '🇹🇷'],
  '297': ['America/Aruba',                        'Aruba',                        '🇦🇼'],
  '298': ['Atlantic/Faroe',                       'Faroe Islands',                '🇫🇴'],
  '299': ['America/Godthab',                      'Greenland',                    '🇬🇱'],
  '350': ['Europe/Gibraltar',                     'Gibraltar',                    '🇬🇮'],
  '351': ['Europe/Lisbon',                        'Portugal',                     '🇵🇹'],
  '352': ['Europe/Luxembourg',                    'Luxembourg',                   '🇱🇺'],
  '353': ['Europe/Dublin',                        'Ireland',                      '🇮🇪'],
  '354': ['Atlantic/Reykjavik',                   'Iceland',                      '🇮🇸'],
  '355': ['Europe/Tirane',                        'Albania',                      '🇦🇱'],
  '356': ['Europe/Malta',                         'Malta',                        '🇲🇹'],
  '357': ['Asia/Nicosia',                         'Cyprus',                       '🇨🇾'],
  '358': ['Europe/Helsinki',                      'Finland',                      '🇫🇮'],
  '359': ['Europe/Sofia',                         'Bulgaria',                     '🇧🇬'],
  '370': ['Europe/Vilnius',                       'Lithuania',                    '🇱🇹'],
  '371': ['Europe/Riga',                          'Latvia',                       '🇱🇻'],
  '372': ['Europe/Tallinn',                       'Estonia',                      '🇪🇪'],
  '373': ['Europe/Chisinau',                      'Moldova',                      '🇲🇩'],
  '374': ['Asia/Yerevan',                         'Armenia',                      '🇦🇲'],
  '375': ['Europe/Minsk',                         'Belarus',                      '🇧🇾'],
  '376': ['Europe/Andorra',                       'Andorra',                      '🇦🇩'],
  '377': ['Europe/Monaco',                        'Monaco',                       '🇲🇨'],
  '380': ['Europe/Kiev',                          'Ukraine',                      '🇺🇦'],
  '381': ['Europe/Belgrade',                      'Serbia',                       '🇷🇸'],
  '382': ['Europe/Podgorica',                     'Montenegro',                   '🇲🇪'],
  '385': ['Europe/Zagreb',                        'Croatia',                      '🇭🇷'],
  '386': ['Europe/Ljubljana',                     'Slovenia',                     '🇸🇮'],
  '387': ['Europe/Sarajevo',                      'Bosnia & Herzegovina',         '🇧🇦'],
  '389': ['Europe/Skopje',                        'North Macedonia',              '🇲🇰'],
  '420': ['Europe/Prague',                        'Czech Republic',               '🇨🇿'],
  '421': ['Europe/Bratislava',                    'Slovakia',                     '🇸🇰'],
  '423': ['Europe/Vaduz',                         'Liechtenstein',                '🇱🇮'],
  // ── Africa ────────────────────────────────────────────────────────────
  '20':  ['Africa/Cairo',                         'Egypt',                        '🇪🇬'],
  '27':  ['Africa/Johannesburg',                  'South Africa',                 '🇿🇦'],
  '212': ['Africa/Casablanca',                    'Morocco',                      '🇲🇦'],
  '213': ['Africa/Algiers',                       'Algeria',                      '🇩🇿'],
  '216': ['Africa/Tunis',                         'Tunisia',                      '🇹🇳'],
  '218': ['Africa/Tripoli',                       'Libya',                        '🇱🇾'],
  '220': ['Africa/Banjul',                        'Gambia',                       '🇬🇲'],
  '221': ['Africa/Dakar',                         'Senegal',                      '🇸🇳'],
  '222': ['Africa/Nouakchott',                    'Mauritania',                   '🇲🇷'],
  '223': ['Africa/Bamako',                        'Mali',                         '🇲🇱'],
  '224': ['Africa/Conakry',                       'Guinea',                       '🇬🇳'],
  '225': ['Africa/Abidjan',                       'Ivory Coast',                  '🇨🇮'],
  '226': ['Africa/Ouagadougou',                   'Burkina Faso',                 '🇧🇫'],
  '227': ['Africa/Niamey',                        'Niger',                        '🇳🇪'],
  '228': ['Africa/Lome',                          'Togo',                         '🇹🇬'],
  '229': ['Africa/Porto-Novo',                    'Benin',                        '🇧🇯'],
  '230': ['Indian/Mauritius',                     'Mauritius',                    '🇲🇺'],
  '231': ['Africa/Monrovia',                      'Liberia',                      '🇱🇷'],
  '232': ['Africa/Freetown',                      'Sierra Leone',                 '🇸🇱'],
  '233': ['Africa/Accra',                         'Ghana',                        '🇬🇭'],
  '234': ['Africa/Lagos',                         'Nigeria',                      '🇳🇬'],
  '235': ['Africa/Ndjamena',                      'Chad',                         '🇹🇩'],
  '236': ['Africa/Bangui',                        'Central African Republic',     '🇨🇫'],
  '237': ['Africa/Douala',                        'Cameroon',                     '🇨🇲'],
  '238': ['Atlantic/Cape_Verde',                  'Cape Verde',                   '🇨🇻'],
  '239': ['Africa/Sao_Tome',                      'São Tomé & Príncipe',          '🇸🇹'],
  '240': ['Africa/Malabo',                        'Equatorial Guinea',            '🇬🇶'],
  '241': ['Africa/Libreville',                    'Gabon',                        '🇬🇦'],
  '242': ['Africa/Brazzaville',                   'Republic of Congo',            '🇨🇬'],
  '243': ['Africa/Kinshasa',                      'DR Congo',                     '🇨🇩'],
  '244': ['Africa/Luanda',                        'Angola',                       '🇦🇴'],
  '245': ['Africa/Bissau',                        'Guinea-Bissau',                '🇬🇼'],
  '246': ['Indian/Chagos',                        'British Indian Ocean Terr.',   '🇮🇴'],
  '248': ['Indian/Mahe',                          'Seychelles',                   '🇸🇨'],
  '249': ['Africa/Khartoum',                      'Sudan',                        '🇸🇩'],
  '250': ['Africa/Kigali',                        'Rwanda',                       '🇷🇼'],
  '251': ['Africa/Addis_Ababa',                   'Ethiopia',                     '🇪🇹'],
  '252': ['Africa/Mogadishu',                     'Somalia',                      '🇸🇴'],
  '253': ['Africa/Djibouti',                      'Djibouti',                     '🇩🇯'],
  '254': ['Africa/Nairobi',                       'Kenya',                        '🇰🇪'],
  '255': ['Africa/Dar_es_Salaam',                 'Tanzania',                     '🇹🇿'],
  '256': ['Africa/Kampala',                       'Uganda',                       '🇺🇬'],
  '257': ['Africa/Bujumbura',                     'Burundi',                      '🇧🇮'],
  '258': ['Africa/Maputo',                        'Mozambique',                   '🇲🇿'],
  '260': ['Africa/Lusaka',                        'Zambia',                       '🇿🇲'],
  '261': ['Indian/Antananarivo',                  'Madagascar',                   '🇲🇬'],
  '262': ['Indian/Reunion',                       'Réunion',                      '🇷🇪'],
  '263': ['Africa/Harare',                        'Zimbabwe',                     '🇿🇼'],
  '264': ['Africa/Windhoek',                      'Namibia',                      '🇳🇦'],
  '265': ['Africa/Blantyre',                      'Malawi',                       '🇲🇼'],
  '266': ['Africa/Maseru',                        'Lesotho',                      '🇱🇸'],
  '267': ['Africa/Gaborone',                      'Botswana',                     '🇧🇼'],
  '268': ['Africa/Mbabane',                       'Eswatini',                     '🇸🇿'],
  '269': ['Indian/Comoro',                        'Comoros',                      '🇰🇲'],
  '290': ['Atlantic/St_Helena',                   'Saint Helena',                 '🇸🇭'],
  '291': ['Africa/Asmara',                        'Eritrea',                      '🇪🇷'],
  // ── South / Central America ───────────────────────────────────────────
  '51':  ['America/Lima',                         'Peru',                         '🇵🇪'],
  '52':  ['America/Mexico_City',                  'Mexico',                       '🇲🇽'],
  '53':  ['America/Havana',                       'Cuba',                         '🇨🇺'],
  '54':  ['America/Argentina/Buenos_Aires',        'Argentina',                    '🇦🇷'],
  '55':  ['America/Sao_Paulo',                    'Brazil',                       '🇧🇷'],
  '56':  ['America/Santiago',                     'Chile',                        '🇨🇱'],
  '57':  ['America/Bogota',                       'Colombia',                     '🇨🇴'],
  '58':  ['America/Caracas',                      'Venezuela',                    '🇻🇪'],
  '500': ['Atlantic/Stanley',                     'Falkland Islands',             '🇫🇰'],
  '501': ['America/Belize',                       'Belize',                       '🇧🇿'],
  '502': ['America/Guatemala',                    'Guatemala',                    '🇬🇹'],
  '503': ['America/El_Salvador',                  'El Salvador',                  '🇸🇻'],
  '504': ['America/Tegucigalpa',                  'Honduras',                     '🇭🇳'],
  '505': ['America/Managua',                      'Nicaragua',                    '🇳🇮'],
  '506': ['America/Costa_Rica',                   'Costa Rica',                   '🇨🇷'],
  '507': ['America/Panama',                       'Panama',                       '🇵🇦'],
  '508': ['America/Miquelon',                     'Saint Pierre & Miquelon',      '🇵🇲'],
  '509': ['America/Port-au-Prince',               'Haiti',                        '🇭🇹'],
  '590': ['America/Guadeloupe',                   'Guadeloupe',                   '🇬🇵'],
  '591': ['America/La_Paz',                       'Bolivia',                      '🇧🇴'],
  '592': ['America/Guyana',                       'Guyana',                       '🇬🇾'],
  '593': ['America/Guayaquil',                    'Ecuador',                      '🇪🇨'],
  '594': ['America/Cayenne',                      'French Guiana',                '🇬🇫'],
  '595': ['America/Asuncion',                     'Paraguay',                     '🇵🇾'],
  '596': ['America/Martinique',                   'Martinique',                   '🇲🇶'],
  '597': ['America/Paramaribo',                   'Suriname',                     '🇸🇷'],
  '598': ['America/Montevideo',                   'Uruguay',                      '🇺🇾'],
  '599': ['America/Curacao',                      'Curaçao',                      '🇨🇼'],
  // ── Asia & Pacific ────────────────────────────────────────────────────
  '60':  ['Asia/Kuala_Lumpur',                    'Malaysia',                     '🇲🇾'],
  '61':  ['Australia/Sydney',                     'Australia',                    '🇦🇺'],
  '62':  ['Asia/Jakarta',                         'Indonesia',                    '🇮🇩'],
  '63':  ['Asia/Manila',                          'Philippines',                  '🇵🇭'],
  '64':  ['Pacific/Auckland',                     'New Zealand',                  '🇳🇿'],
  '65':  ['Asia/Singapore',                       'Singapore',                    '🇸🇬'],
  '66':  ['Asia/Bangkok',                         'Thailand',                     '🇹🇭'],
  '670': ['Asia/Dili',                            'East Timor',                   '🇹🇱'],
  '673': ['Asia/Brunei',                          'Brunei',                       '🇧🇳'],
  '674': ['Pacific/Nauru',                        'Nauru',                        '🇳🇷'],
  '675': ['Pacific/Port_Moresby',                 'Papua New Guinea',             '🇵🇬'],
  '676': ['Pacific/Tongatapu',                    'Tonga',                        '🇹🇴'],
  '677': ['Pacific/Guadalcanal',                  'Solomon Islands',              '🇸🇧'],
  '678': ['Pacific/Efate',                        'Vanuatu',                      '🇻🇺'],
  '679': ['Pacific/Fiji',                         'Fiji',                         '🇫🇯'],
  '680': ['Pacific/Palau',                        'Palau',                        '🇵🇼'],
  '681': ['Pacific/Wallis',                       'Wallis & Futuna',              '🇼🇫'],
  '682': ['Pacific/Rarotonga',                    'Cook Islands',                 '🇨🇰'],
  '683': ['Pacific/Niue',                         'Niue',                         '🇳🇺'],
  '685': ['Pacific/Apia',                         'Samoa',                        '🇼🇸'],
  '686': ['Pacific/Tarawa',                       'Kiribati',                     '🇰🇮'],
  '687': ['Pacific/Noumea',                       'New Caledonia',                '🇳🇨'],
  '688': ['Pacific/Funafuti',                     'Tuvalu',                       '🇹🇻'],
  '689': ['Pacific/Gambier',                      'French Polynesia',             '🇵🇫'],
  '691': ['Pacific/Pohnpei',                      'Micronesia',                   '🇫🇲'],
  '692': ['Pacific/Majuro',                       'Marshall Islands',             '🇲🇭'],
  '81':  ['Asia/Tokyo',                           'Japan',                        '🇯🇵'],
  '82':  ['Asia/Seoul',                           'South Korea',                  '🇰🇷'],
  '84':  ['Asia/Ho_Chi_Minh',                     'Vietnam',                      '🇻🇳'],
  '86':  ['Asia/Shanghai',                        'China',                        '🇨🇳'],
  '850': ['Asia/Pyongyang',                       'North Korea',                  '🇰🇵'],
  '852': ['Asia/Hong_Kong',                       'Hong Kong',                    '🇭🇰'],
  '853': ['Asia/Macau',                           'Macau',                        '🇲🇴'],
  '855': ['Asia/Phnom_Penh',                      'Cambodia',                     '🇰🇭'],
  '856': ['Asia/Vientiane',                       'Laos',                         '🇱🇦'],
  '880': ['Asia/Dhaka',                           'Bangladesh',                   '🇧🇩'],
  '886': ['Asia/Taipei',                          'Taiwan',                       '🇹🇼'],
  '91':  ['Asia/Kolkata',                         'India',                        '🇮🇳'],
  '92':  ['Asia/Karachi',                         'Pakistan',                     '🇵🇰'],
  '93':  ['Asia/Kabul',                           'Afghanistan',                  '🇦🇫'],
  '94':  ['Asia/Colombo',                         'Sri Lanka',                    '🇱🇰'],
  '95':  ['Asia/Rangoon',                         'Myanmar',                      '🇲🇲'],
  '960': ['Indian/Maldives',                      'Maldives',                     '🇲🇻'],
  '961': ['Asia/Beirut',                          'Lebanon',                      '🇱🇧'],
  '962': ['Asia/Amman',                           'Jordan',                       '🇯🇴'],
  '963': ['Asia/Damascus',                        'Syria',                        '🇸🇾'],
  '964': ['Asia/Baghdad',                         'Iraq',                         '🇮🇶'],
  '965': ['Asia/Kuwait',                          'Kuwait',                       '🇰🇼'],
  '966': ['Asia/Riyadh',                          'Saudi Arabia',                 '🇸🇦'],
  '967': ['Asia/Aden',                            'Yemen',                        '🇾🇪'],
  '968': ['Asia/Muscat',                          'Oman',                         '🇴🇲'],
  '970': ['Asia/Gaza',                            'Palestine',                    '🇵🇸'],
  '971': ['Asia/Dubai',                           'United Arab Emirates',         '🇦🇪'],
  '972': ['Asia/Jerusalem',                       'Israel',                       '🇮🇱'],
  '973': ['Asia/Bahrain',                         'Bahrain',                      '🇧🇭'],
  '974': ['Asia/Qatar',                           'Qatar',                        '🇶🇦'],
  '975': ['Asia/Thimphu',                         'Bhutan',                       '🇧🇹'],
  '976': ['Asia/Ulaanbaatar',                     'Mongolia',                     '🇲🇳'],
  '977': ['Asia/Kathmandu',                       'Nepal',                        '🇳🇵'],
  '98':  ['Asia/Tehran',                          'Iran',                         '🇮🇷'],
  '992': ['Asia/Dushanbe',                        'Tajikistan',                   '🇹🇯'],
  '993': ['Asia/Ashgabat',                        'Turkmenistan',                 '🇹🇲'],
  '994': ['Asia/Baku',                            'Azerbaijan',                   '🇦🇿'],
  '995': ['Asia/Tbilisi',                         'Georgia',                      '🇬🇪'],
  '996': ['Asia/Bishkek',                         'Kyrgyzstan',                   '🇰🇬'],
  '998': ['Asia/Tashkent',                        'Uzbekistan',                   '🇺🇿'],
};

/**
 * Resolve a WhatsApp JID to its raw phone-number digits.
 * Handles three formats:
 *   1. "254713046497@s.whatsapp.net"  →  "254713046497"
 *   2. "254713046497"                 →  "254713046497"
 *   3. "71234567@lid"                 →  look up real phone via globalThis caches
 */
function resolveDigits(jid) {
  if (!jid) return '';

  const raw = String(jid);

  if (raw.includes('@lid')) {
    const lidNum = raw.split('@')[0].split(':')[0];

    try {
      const cache = globalThis.lidPhoneCache;
      if (cache) {
        const cached = cache.get(lidNum) || cache.get(raw.split('@')[0]);
        if (cached) return String(cached).replace(/\D/g, '');
      }
    } catch {}

    try {
      const resolve = globalThis.resolvePhoneFromLid;
      if (typeof resolve === 'function') {
        const resolved = resolve(raw);
        if (resolved) return String(resolved).replace(/\D/g, '');
      }
    } catch {}

    return '';
  }

  return raw.split('@')[0].replace(/\D/g, '');
}

/**
 * Returns { timezone, country, flag } for the given WhatsApp JID or phone number.
 * Falls back to { timezone:'UTC', country:'Unknown', flag:'🌍' } when not matched.
 */
function getPhoneInfo(jidOrPhone) {
  const digits = resolveDigits(jidOrPhone);
  if (!digits) return { timezone: 'UTC', country: 'Unknown', flag: '🌍' };

  for (let len = Math.min(digits.length, 4); len >= 1; len--) {
    const prefix = digits.slice(0, len);
    if (PHONE_DATA[prefix]) {
      const [timezone, country, flag] = PHONE_DATA[prefix];
      return { timezone, country, flag };
    }
  }
  return { timezone: 'UTC', country: 'Unknown', flag: '🌍' };
}

/**
 * Returns only the IANA timezone string (backwards-compatible helper).
 */
function getTimezoneFromPhone(jidOrPhone) {
  return getPhoneInfo(jidOrPhone).timezone;
}

export { getTimezoneFromPhone, getPhoneInfo };
