// Cloudflare colocation codes for African POPs (as of 2026)
export const AFRICAN_COLOS = new Set<string>([
  // West Africa
  'LOS', // Lagos, NG
  'ABV', // Abuja, NG
  'ACC', // Accra, GH
  'DKR', // Dakar, SN
  'ABJ', // Abidjan, CI
  'OUA', // Ouagadougou, BF
  // North Africa
  'CMN', // Casablanca, MA
  'RBA', // Rabat, MA
  'CAI', // Cairo, EG
  'TUN', // Tunis, TN
  'ALG', // Algiers, DZ
  // East Africa
  'JIB', // Djibouti, DJ
  'ADD', // Addis Ababa, ET
  'NBO', // Nairobi, KE
  'MBA', // Mombasa, KE
  'KGL', // Kigali, RW
  'EBB', // Entebbe, UG
  'DAR', // Dar es Salaam, TZ
  // Southern Africa
  'JNB', // Johannesburg, ZA
  'CPT', // Cape Town, ZA
  'DUR', // Durban, ZA
  'MPM', // Maputo, MZ
  'BUL', // Bulawayo, ZW
  'HRE', // Harare, ZW
  'LUN', // Lusaka, ZM
  'GBE', // Gaborone, BW
  'WDH', // Windhoek, NA
  // Central Africa
  'LAD', // Luanda, AO
  'FIH', // Kinshasa, CD
])

export function isAfricanColo(colo: string | undefined): boolean {
  return colo ? AFRICAN_COLOS.has(colo) : false
}
