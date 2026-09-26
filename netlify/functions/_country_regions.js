'use strict';

/*
 * Website country (free text, English or Arabic) -> CRM region.
 *
 * The enquiry forms ask for a destination country as free text. The CRM needs
 * one of the regions in _crm_lib.js. This table is the bridge, and it is
 * deliberately conservative: a country is placed only when its region is not
 * in doubt. Anything else -- a typo, a city, "Germany / Hamburg", an ambiguous
 * name -- becomes 'Unassigned' for a person to set. A wrong region is worse
 * than an empty one, because nobody goes looking for it.
 *
 * THE RULE, so the edge cases are decisions rather than accidents:
 *
 *   - By continent. Europe is split by EU membership (the 27 members as of
 *     2026); Asia is split into 'Middle East' and 'Asia'.
 *   - 'Middle East' is UN M49 Western Asia, plus Iran. EU membership wins
 *     for Cyprus.
 *   - Transcontinental countries go where most of the population is:
 *     Egypt -> Africa, Turkey -> Middle East, Russia -> Europe (non-EU),
 *     Kazakhstan -> Asia.
 *   - Mexico, Central America and the Caribbean are North America, the
 *     continent -- not the narrower "Northern America" of the UN scheme.
 *
 * DELIBERATELY LEFT OUT, because the text alone does not say which place:
 *
 *   - "Georgia": the country (Middle East under this rule) or the US state.
 *   - "عمان" without its vowel marks: Oman (عُمان) or Amman (عَمّان), the
 *     capital of Jordan. "سلطنة عمان" -- the Sultanate of Oman -- is certain,
 *     and is included.
 *   - "Congo" alone: two countries. Both are Africa, so it is included.
 *   - "Korea" alone: both Koreas are Asia, so it is included.
 *   The test is whether the REGION is in doubt, not the country.
 *
 * Changing a country's region here changes only future website enquiries.
 * Buyers already in the CRM keep what they have.
 */

const TABLE = {
  'EU': [
    'austria', 'belgium', 'bulgaria', 'croatia', 'cyprus', 'czechia', 'czech republic',
    'denmark', 'estonia', 'finland', 'france', 'germany', 'deutschland', 'greece',
    'hungary', 'ireland', 'republic of ireland', 'italy', 'latvia', 'lithuania',
    'luxembourg', 'malta', 'netherlands', 'the netherlands', 'holland', 'poland',
    'portugal', 'romania', 'slovakia', 'slovenia', 'spain', 'sweden',
    'النمسا', 'بلجيكا', 'بلغاريا', 'كرواتيا', 'قبرص', 'التشيك', 'جمهورية التشيك',
    'الدنمارك', 'استونيا', 'فنلندا', 'فرنسا', 'المانيا', 'اليونان', 'المجر',
    'ايرلندا', 'ايطاليا', 'لاتفيا', 'ليتوانيا', 'لوكسمبورغ', 'مالطا', 'هولندا',
    'بولندا', 'البرتغال', 'رومانيا', 'سلوفاكيا', 'سلوفينيا', 'اسبانيا', 'السويد',
  ],
  'Europe (non-EU)': [
    'united kingdom', 'uk', 'u k', 'great britain', 'britain', 'england', 'scotland',
    'wales', 'northern ireland', 'norway', 'switzerland', 'iceland', 'liechtenstein',
    'ukraine', 'belarus', 'moldova', 'serbia', 'montenegro', 'north macedonia',
    'macedonia', 'albania', 'bosnia and herzegovina', 'bosnia', 'kosovo', 'andorra',
    'monaco', 'san marino', 'vatican', 'russia', 'russian federation',
    'المملكة المتحدة', 'بريطانيا', 'انجلترا', 'اسكتلندا', 'النرويج', 'سويسرا',
    'ايسلندا', 'اوكرانيا', 'بيلاروسيا', 'مولدوفا', 'صربيا', 'الجبل الاسود',
    'مقدونيا', 'البانيا', 'البوسنه والهرسك', 'البوسنه', 'كوسوفو', 'روسيا',
  ],
  'Middle East': [
    'saudi arabia', 'ksa', 'kingdom of saudi arabia', 'united arab emirates', 'uae',
    'u a e', 'emirates', 'dubai', 'abu dhabi', 'sharjah', 'qatar', 'kuwait', 'bahrain',
    'oman', 'sultanate of oman', 'yemen', 'iraq', 'iran', 'jordan', 'lebanon', 'syria',
    'palestine', 'state of palestine', 'israel', 'turkey', 'turkiye', 'armenia',
    'azerbaijan',
    'السعوديه', 'المملكه العربيه السعوديه', 'الامارات', 'الامارات العربيه المتحده',
    'دبي', 'ابوظبي', 'ابو ظبي', 'الشارقه', 'قطر', 'الكويت', 'البحرين', 'سلطنه عمان',
    'اليمن', 'العراق', 'ايران', 'الاردن', 'لبنان', 'سوريا', 'سوريه', 'فلسطين',
    'تركيا', 'ارمينيا', 'اذربيجان',
  ],
  'Africa': [
    'algeria', 'angola', 'benin', 'botswana', 'burkina faso', 'burundi', 'cabo verde',
    'cape verde', 'cameroon', 'central african republic', 'chad', 'comoros', 'congo',
    'republic of the congo', 'democratic republic of the congo', 'dr congo', 'drc',
    'djibouti', 'egypt', 'equatorial guinea', 'eritrea', 'eswatini', 'swaziland',
    'ethiopia', 'gabon', 'gambia', 'ghana', 'guinea', 'guinea bissau', 'ivory coast',
    'cote divoire', 'kenya', 'lesotho', 'liberia', 'libya', 'madagascar', 'malawi',
    'mali', 'mauritania', 'mauritius', 'morocco', 'mozambique', 'namibia', 'niger',
    'nigeria', 'rwanda', 'sao tome and principe', 'senegal', 'seychelles',
    'sierra leone', 'somalia', 'south africa', 'south sudan', 'sudan', 'tanzania',
    'togo', 'tunisia', 'uganda', 'zambia', 'zimbabwe',
    'مصر', 'ليبيا', 'تونس', 'الجزائر', 'المغرب', 'السودان', 'جنوب السودان',
    'موريتانيا', 'الصومال', 'جيبوتي', 'اثيوبيا', 'اريتريا', 'كينيا', 'تنزانيا',
    'اوغندا', 'نيجيريا', 'غانا', 'السنغال', 'الكاميرون', 'ساحل العاج',
    'جنوب افريقيا', 'انغولا', 'جزر القمر',
  ],
  'Asia': [
    'china', 'japan', 'south korea', 'korea', 'republic of korea', 'north korea',
    'mongolia', 'taiwan', 'hong kong', 'macau', 'india', 'pakistan', 'bangladesh',
    'sri lanka', 'nepal', 'bhutan', 'maldives', 'afghanistan', 'kazakhstan',
    'uzbekistan', 'turkmenistan', 'kyrgyzstan', 'tajikistan', 'indonesia', 'malaysia',
    'singapore', 'thailand', 'vietnam', 'viet nam', 'philippines', 'myanmar', 'cambodia',
    'laos', 'brunei', 'timor leste', 'east timor',
    'الصين', 'اليابان', 'كوريا', 'كوريا الجنوبيه', 'الهند', 'باكستان', 'بنغلاديش',
    'سريلانكا', 'افغانستان', 'كازاخستان', 'اوزبكستان', 'اندونيسيا', 'ماليزيا',
    'سنغافوره', 'تايلاند', 'فيتنام', 'الفلبين', 'هونغ كونغ',
  ],
  'North America': [
    'united states', 'united states of america', 'usa', 'u s a', 'us', 'u s', 'america',
    'canada', 'mexico', 'guatemala', 'belize', 'honduras', 'el salvador', 'nicaragua',
    'costa rica', 'panama', 'cuba', 'jamaica', 'haiti', 'dominican republic', 'bahamas',
    'barbados', 'trinidad and tobago', 'puerto rico', 'greenland', 'bermuda',
    'antigua and barbuda', 'dominica', 'grenada', 'saint lucia', 'st lucia',
    'saint kitts and nevis', 'saint vincent and the grenadines', 'aruba', 'curacao',
    'الولايات المتحده', 'الولايات المتحده الامريكيه', 'امريكا', 'كندا', 'المكسيك',
    'كوبا', 'بنما',
  ],
  'South America': [
    'argentina', 'bolivia', 'brazil', 'brasil', 'chile', 'colombia', 'ecuador',
    'guyana', 'paraguay', 'peru', 'suriname', 'uruguay', 'venezuela', 'french guiana',
    'البرازيل', 'الارجنتين', 'تشيلي', 'كولومبيا', 'بيرو', 'فنزويلا', 'الاكوادور',
    'اوروغواي', 'باراغواي', 'بوليفيا',
  ],
  'Oceania': [
    'australia', 'new zealand', 'fiji', 'papua new guinea', 'samoa', 'tonga',
    'vanuatu', 'solomon islands', 'kiribati', 'micronesia', 'marshall islands',
    'palau', 'nauru', 'tuvalu', 'new caledonia', 'french polynesia',
    'استراليا', 'نيوزيلندا', 'فيجي',
  ],
};

/*
 * One spelling for everything a person might type. English: accents off,
 * lower case, "&" as "and", punctuation dropped ("U.S.A." -> "u s a", which
 * is listed). Arabic: vowel marks and tatweel off, and the letters people
 * write interchangeably folded together -- alef forms to ا, ta marbuta to ه,
 * alef maqsura to ي -- so "السعودية" and "السعوديه" are the same key.
 */
function normaliseCountry(value) {
  return String(value == null ? '' : value)
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[ً-ٰٟـ]/g, '')
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/['’`]/g, '')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
    .replace(/^the /, '');
}

const LOOKUP = new Map();
for (const [region, names] of Object.entries(TABLE)) {
  for (const name of names) {
    const key = normaliseCountry(name);
    if (LOOKUP.has(key) && LOOKUP.get(key) !== region) {
      // Two regions claiming one spelling is a bug in this table, and would
      // make the answer depend on object key order. Refuse to load.
      throw new Error(`_country_regions: "${name}" is listed under both ${LOOKUP.get(key)} and ${region}`);
    }
    LOOKUP.set(key, region);
  }
}

function regionForCountry(value) {
  return LOOKUP.get(normaliseCountry(value)) || 'Unassigned';
}

module.exports = { TABLE, normaliseCountry, regionForCountry };
