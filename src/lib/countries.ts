/** Countries for nationality, residence and phone codes (Arabic names, ISO 3166 alpha-2, dialling code). Gulf and Arab countries first. */
export const COUNTRIES: { code: string; name: string; dial: string }[] = [
  { code: 'SA', name: 'السعودية', dial: '966' }, { code: 'AE', name: 'الإمارات', dial: '971' }, { code: 'KW', name: 'الكويت', dial: '965' },
  { code: 'QA', name: 'قطر', dial: '974' }, { code: 'BH', name: 'البحرين', dial: '973' }, { code: 'OM', name: 'عُمان', dial: '968' },
  { code: 'YE', name: 'اليمن', dial: '967' }, { code: 'JO', name: 'الأردن', dial: '962' }, { code: 'EG', name: 'مصر', dial: '20' },
  { code: 'SD', name: 'السودان', dial: '249' }, { code: 'IQ', name: 'العراق', dial: '964' }, { code: 'SY', name: 'سوريا', dial: '963' },
  { code: 'LB', name: 'لبنان', dial: '961' }, { code: 'PS', name: 'فلسطين', dial: '970' }, { code: 'LY', name: 'ليبيا', dial: '218' },
  { code: 'TN', name: 'تونس', dial: '216' }, { code: 'DZ', name: 'الجزائر', dial: '213' }, { code: 'MA', name: 'المغرب', dial: '212' },
  { code: 'MR', name: 'موريتانيا', dial: '222' }, { code: 'SO', name: 'الصومال', dial: '252' }, { code: 'DJ', name: 'جيبوتي', dial: '253' },
  { code: 'KM', name: 'جزر القمر', dial: '269' }, { code: 'TR', name: 'تركيا', dial: '90' }, { code: 'PK', name: 'باكستان', dial: '92' },
  { code: 'IN', name: 'الهند', dial: '91' }, { code: 'BD', name: 'بنغلاديش', dial: '880' }, { code: 'ID', name: 'إندونيسيا', dial: '62' },
  { code: 'MY', name: 'ماليزيا', dial: '60' }, { code: 'PH', name: 'الفلبين', dial: '63' }, { code: 'NG', name: 'نيجيريا', dial: '234' },
  { code: 'ET', name: 'إثيوبيا', dial: '251' }, { code: 'KE', name: 'كينيا', dial: '254' }, { code: 'TD', name: 'تشاد', dial: '235' },
  { code: 'NE', name: 'النيجر', dial: '227' }, { code: 'ML', name: 'مالي', dial: '223' }, { code: 'IR', name: 'إيران', dial: '98' },
  { code: 'AF', name: 'أفغانستان', dial: '93' }, { code: 'KZ', name: 'كازاخستان', dial: '7' }, { code: 'MN', name: 'منغوليا', dial: '976' },
  { code: 'CN', name: 'الصين', dial: '86' }, { code: 'GB', name: 'المملكة المتحدة', dial: '44' }, { code: 'US', name: 'الولايات المتحدة', dial: '1' },
  { code: 'FR', name: 'فرنسا', dial: '33' }, { code: 'DE', name: 'ألمانيا', dial: '49' }, { code: 'AU', name: 'أستراليا', dial: '61' },
  { code: 'CA', name: 'كندا', dial: '1' },
]

export const countryName = (code?: string) => COUNTRIES.find((c) => c.code === code)?.name ?? code ?? ''
export const dialOf = (code?: string) => COUNTRIES.find((c) => c.code === code)?.dial ?? '966'

/** dialling codes, one per code (Canada and the US share +1) */
export const DIAL_CODES = [...new Map(COUNTRIES.map((c) => [c.dial, c])).values()]

/** cities offered as a list; other countries type the city */
export const CITIES: Record<string, string[]> = {
  SA: ['الرياض', 'جدة', 'مكة المكرمة', 'المدينة المنورة', 'الدمام', 'الخبر', 'الظهران', 'الأحساء', 'القطيف', 'الجبيل', 'حفر الباطن', 'بريدة', 'عنيزة', 'الرس',
    'حائل', 'تبوك', 'الجوف', 'سكاكا', 'عرعر', 'القريات', 'طريف', 'رفحاء', 'أبها', 'خميس مشيط', 'بيشة', 'النماص', 'جازان', 'صبيا', 'نجران', 'شرورة', 'الباحة',
    'الطائف', 'ينبع', 'العلا', 'رابغ', 'الخرج', 'المجمعة', 'الزلفي', 'شقراء', 'الدوادمي', 'عفيف', 'وادي الدواسر', 'السليل', 'الأفلاج', 'القويعية', 'الغاط'],
  AE: ['أبوظبي', 'دبي', 'الشارقة', 'العين', 'عجمان', 'رأس الخيمة', 'الفجيرة', 'أم القيوين', 'الظفرة'],
  KW: ['مدينة الكويت', 'حولي', 'الفروانية', 'الأحمدي', 'الجهراء', 'مبارك الكبير'],
  QA: ['الدوحة', 'الريان', 'الوكرة', 'الخور', 'الشمال', 'أم صلال', 'الشحانية'],
  BH: ['المنامة', 'المحرق', 'الرفاع', 'مدينة عيسى', 'مدينة حمد'],
  OM: ['مسقط', 'صلالة', 'صحار', 'نزوى', 'صور', 'البريمي', 'عبري', 'إبراء'],
}
