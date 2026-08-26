export type HelplineType = 'general' | 'lgbtq_youth' | 'trans' | 'domestic_abuse';
export interface HelplineResource { name: string; phone?: string; sms?: string; smsBody?: string; url?: string; chatUrl?: string; hours: string; is24_7: boolean; type: HelplineType; }
export interface CountryCrisisProfile { countryCode: string; countryName: string; emergencyNumber?: string; resources: HelplineResource[]; }

export const globalFallback: CountryCrisisProfile = { countryCode: 'GLOBAL', countryName: 'International / Other', resources: [
  { name: 'Find A Helpline', url: 'https://findahelpline.com', hours: 'Search verified helplines by country', is24_7: true, type: 'general' },
  { name: 'Befrienders Worldwide', url: 'https://befrienders.org/map/', hours: 'Find a local emotional-support centre', is24_7: false, type: 'general' }
] };

export const crisisDirectory: Record<string, CountryCrisisProfile> = {
  GB: { countryCode: 'GB', countryName: 'United Kingdom', emergencyNumber: '999', resources: [
    { name: 'Samaritans', phone: '116 123', url: 'https://www.samaritans.org/how-we-can-help/contact-samaritan/', hours: '24 hours a day, every day', is24_7: true, type: 'general' },
    { name: 'Switchboard LGBT+', phone: '0800 0119 100', chatUrl: 'https://switchboard.lgbt/contact-us', url: 'https://switchboard.lgbt/contact-us', hours: 'See current phone and chat availability', is24_7: false, type: 'lgbtq_youth' },
    { name: 'Galop LGBT+ anti-abuse helpline', phone: '0800 999 5428', chatUrl: 'https://www.galop.org.uk/helpline', url: 'https://www.galop.org.uk/helpline', hours: 'Weekdays; hours vary and the line closes 1–2pm', is24_7: false, type: 'domestic_abuse' }
  ] },
  US: { countryCode: 'US', countryName: 'United States', emergencyNumber: '911', resources: [
    { name: '988 Suicide & Crisis Lifeline', phone: '988', sms: '988', chatUrl: 'https://988lifeline.org/chat/', url: 'https://988lifeline.org/get-help/', hours: '24 hours a day, every day', is24_7: true, type: 'general' },
    { name: 'The Trevor Project', phone: '1-866-488-7386', sms: '678678', smsBody: 'START', chatUrl: 'https://www.thetrevorproject.org/get-help/', url: 'https://www.thetrevorproject.org/get-help/', hours: '24 hours a day, every day', is24_7: true, type: 'lgbtq_youth' },
    { name: 'Trans Lifeline', phone: '1-877-565-8860', url: 'https://translifeline.org/hotline/', hours: 'Monday–Friday, 10am–6pm PT / 1–9pm ET', is24_7: false, type: 'trans' },
    { name: 'LGBT National Hotline', phone: '1-888-843-4564', url: 'https://lgbthotline.org/hotline/', hours: 'Check current hours', is24_7: false, type: 'general' }
  ] },
  CA: { countryCode: 'CA', countryName: 'Canada', emergencyNumber: '911', resources: [
    { name: '9-8-8 Suicide Crisis Helpline', phone: '988', sms: '988', url: 'https://988.ca/', hours: '24 hours a day, every day', is24_7: true, type: 'general' },
    { name: 'Trans Lifeline Canada', phone: '1-877-330-6366', url: 'https://translifeline.org/hotline/', hours: 'Monday–Friday, 10am–6pm PT / 1–9pm ET', is24_7: false, type: 'trans' },
    { name: 'LGBT YouthLine (Ontario, under 30)', sms: '647-694-4275', chatUrl: 'https://www.youthline.ca/helpline/peer-support-helpline/', url: 'https://www.youthline.ca/helpline/peer-support-helpline/', hours: 'Sunday–Friday, 4–9:30pm ET', is24_7: false, type: 'lgbtq_youth' }
  ] },
  AU: { countryCode: 'AU', countryName: 'Australia', emergencyNumber: '000', resources: [
    { name: 'Lifeline', phone: '13 11 14', sms: '0477 13 11 14', chatUrl: 'https://www.lifeline.org.au/crisis-chat/', url: 'https://www.lifeline.org.au/131114', hours: '24 hours a day, every day', is24_7: true, type: 'general' },
    { name: 'QLife', phone: '1800 184 527', chatUrl: 'https://qlife.org.au/', url: 'https://qlife.org.au/', hours: '3–9pm local time, every day', is24_7: false, type: 'general' },
    { name: 'Kids Helpline', phone: '1800 55 1800', chatUrl: 'https://www.kidshelpline.com.au/get-help/webchat-counselling', url: 'https://www.kidshelpline.com.au/', hours: '24 hours a day, every day', is24_7: true, type: 'lgbtq_youth' }
  ] },
  GLOBAL: globalFallback
};
export const supportedCountryCodes = ['GB', 'US', 'CA', 'AU', 'GLOBAL'] as const;
