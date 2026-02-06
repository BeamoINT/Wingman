/**
 * Countries data with flags, dial codes, and regions
 */

import type { Country, CountryRegion } from '../types/location';

/**
 * Complete list of countries with ISO codes, emoji flags, dial codes, and regions
 */
export const countries: Country[] = [
  // Africa
  { code: 'DZ', name: 'Algeria', flag: '\uD83C\uDDE9\uD83C\uDDFF', dialCode: '+213', region: 'Africa' },
  { code: 'AO', name: 'Angola', flag: '\uD83C\uDDE6\uD83C\uDDF4', dialCode: '+244', region: 'Africa' },
  { code: 'BJ', name: 'Benin', flag: '\uD83C\uDDE7\uD83C\uDDEF', dialCode: '+229', region: 'Africa' },
  { code: 'BW', name: 'Botswana', flag: '\uD83C\uDDE7\uD83C\uDDFC', dialCode: '+267', region: 'Africa' },
  { code: 'BF', name: 'Burkina Faso', flag: '\uD83C\uDDE7\uD83C\uDDEB', dialCode: '+226', region: 'Africa' },
  { code: 'BI', name: 'Burundi', flag: '\uD83C\uDDE7\uD83C\uDDEE', dialCode: '+257', region: 'Africa' },
  { code: 'CV', name: 'Cabo Verde', flag: '\uD83C\uDDE8\uD83C\uDDFB', dialCode: '+238', region: 'Africa' },
  { code: 'CM', name: 'Cameroon', flag: '\uD83C\uDDE8\uD83C\uDDF2', dialCode: '+237', region: 'Africa' },
  { code: 'CF', name: 'Central African Republic', flag: '\uD83C\uDDE8\uD83C\uDDEB', dialCode: '+236', region: 'Africa' },
  { code: 'TD', name: 'Chad', flag: '\uD83C\uDDF9\uD83C\uDDE9', dialCode: '+235', region: 'Africa' },
  { code: 'KM', name: 'Comoros', flag: '\uD83C\uDDF0\uD83C\uDDF2', dialCode: '+269', region: 'Africa' },
  { code: 'CG', name: 'Congo', flag: '\uD83C\uDDE8\uD83C\uDDEC', dialCode: '+242', region: 'Africa' },
  { code: 'CD', name: 'Congo (DRC)', flag: '\uD83C\uDDE8\uD83C\uDDE9', dialCode: '+243', region: 'Africa' },
  { code: 'CI', name: "Cote d'Ivoire", flag: '\uD83C\uDDE8\uD83C\uDDEE', dialCode: '+225', region: 'Africa' },
  { code: 'DJ', name: 'Djibouti', flag: '\uD83C\uDDE9\uD83C\uDDEF', dialCode: '+253', region: 'Africa' },
  { code: 'EG', name: 'Egypt', flag: '\uD83C\uDDEA\uD83C\uDDEC', dialCode: '+20', region: 'Africa' },
  { code: 'GQ', name: 'Equatorial Guinea', flag: '\uD83C\uDDEC\uD83C\uDDF6', dialCode: '+240', region: 'Africa' },
  { code: 'ER', name: 'Eritrea', flag: '\uD83C\uDDEA\uD83C\uDDF7', dialCode: '+291', region: 'Africa' },
  { code: 'SZ', name: 'Eswatini', flag: '\uD83C\uDDF8\uD83C\uDDFF', dialCode: '+268', region: 'Africa' },
  { code: 'ET', name: 'Ethiopia', flag: '\uD83C\uDDEA\uD83C\uDDF9', dialCode: '+251', region: 'Africa' },
  { code: 'GA', name: 'Gabon', flag: '\uD83C\uDDEC\uD83C\uDDE6', dialCode: '+241', region: 'Africa' },
  { code: 'GM', name: 'Gambia', flag: '\uD83C\uDDEC\uD83C\uDDF2', dialCode: '+220', region: 'Africa' },
  { code: 'GH', name: 'Ghana', flag: '\uD83C\uDDEC\uD83C\uDDED', dialCode: '+233', region: 'Africa' },
  { code: 'GN', name: 'Guinea', flag: '\uD83C\uDDEC\uD83C\uDDF3', dialCode: '+224', region: 'Africa' },
  { code: 'GW', name: 'Guinea-Bissau', flag: '\uD83C\uDDEC\uD83C\uDDFC', dialCode: '+245', region: 'Africa' },
  { code: 'KE', name: 'Kenya', flag: '\uD83C\uDDF0\uD83C\uDDEA', dialCode: '+254', region: 'Africa' },
  { code: 'LS', name: 'Lesotho', flag: '\uD83C\uDDF1\uD83C\uDDF8', dialCode: '+266', region: 'Africa' },
  { code: 'LR', name: 'Liberia', flag: '\uD83C\uDDF1\uD83C\uDDF7', dialCode: '+231', region: 'Africa' },
  { code: 'LY', name: 'Libya', flag: '\uD83C\uDDF1\uD83C\uDDFE', dialCode: '+218', region: 'Africa' },
  { code: 'MG', name: 'Madagascar', flag: '\uD83C\uDDF2\uD83C\uDDEC', dialCode: '+261', region: 'Africa' },
  { code: 'MW', name: 'Malawi', flag: '\uD83C\uDDF2\uD83C\uDDFC', dialCode: '+265', region: 'Africa' },
  { code: 'ML', name: 'Mali', flag: '\uD83C\uDDF2\uD83C\uDDF1', dialCode: '+223', region: 'Africa' },
  { code: 'MR', name: 'Mauritania', flag: '\uD83C\uDDF2\uD83C\uDDF7', dialCode: '+222', region: 'Africa' },
  { code: 'MU', name: 'Mauritius', flag: '\uD83C\uDDF2\uD83C\uDDFA', dialCode: '+230', region: 'Africa' },
  { code: 'MA', name: 'Morocco', flag: '\uD83C\uDDF2\uD83C\uDDE6', dialCode: '+212', region: 'Africa' },
  { code: 'MZ', name: 'Mozambique', flag: '\uD83C\uDDF2\uD83C\uDDFF', dialCode: '+258', region: 'Africa' },
  { code: 'NA', name: 'Namibia', flag: '\uD83C\uDDF3\uD83C\uDDE6', dialCode: '+264', region: 'Africa' },
  { code: 'NE', name: 'Niger', flag: '\uD83C\uDDF3\uD83C\uDDEA', dialCode: '+227', region: 'Africa' },
  { code: 'NG', name: 'Nigeria', flag: '\uD83C\uDDF3\uD83C\uDDEC', dialCode: '+234', region: 'Africa' },
  { code: 'RW', name: 'Rwanda', flag: '\uD83C\uDDF7\uD83C\uDDFC', dialCode: '+250', region: 'Africa' },
  { code: 'ST', name: 'Sao Tome and Principe', flag: '\uD83C\uDDF8\uD83C\uDDF9', dialCode: '+239', region: 'Africa' },
  { code: 'SN', name: 'Senegal', flag: '\uD83C\uDDF8\uD83C\uDDF3', dialCode: '+221', region: 'Africa' },
  { code: 'SC', name: 'Seychelles', flag: '\uD83C\uDDF8\uD83C\uDDE8', dialCode: '+248', region: 'Africa' },
  { code: 'SL', name: 'Sierra Leone', flag: '\uD83C\uDDF8\uD83C\uDDF1', dialCode: '+232', region: 'Africa' },
  { code: 'SO', name: 'Somalia', flag: '\uD83C\uDDF8\uD83C\uDDF4', dialCode: '+252', region: 'Africa' },
  { code: 'ZA', name: 'South Africa', flag: '\uD83C\uDDFF\uD83C\uDDE6', dialCode: '+27', region: 'Africa' },
  { code: 'SS', name: 'South Sudan', flag: '\uD83C\uDDF8\uD83C\uDDF8', dialCode: '+211', region: 'Africa' },
  { code: 'SD', name: 'Sudan', flag: '\uD83C\uDDF8\uD83C\uDDE9', dialCode: '+249', region: 'Africa' },
  { code: 'TZ', name: 'Tanzania', flag: '\uD83C\uDDF9\uD83C\uDDFF', dialCode: '+255', region: 'Africa' },
  { code: 'TG', name: 'Togo', flag: '\uD83C\uDDF9\uD83C\uDDEC', dialCode: '+228', region: 'Africa' },
  { code: 'TN', name: 'Tunisia', flag: '\uD83C\uDDF9\uD83C\uDDF3', dialCode: '+216', region: 'Africa' },
  { code: 'UG', name: 'Uganda', flag: '\uD83C\uDDFA\uD83C\uDDEC', dialCode: '+256', region: 'Africa' },
  { code: 'ZM', name: 'Zambia', flag: '\uD83C\uDDFF\uD83C\uDDF2', dialCode: '+260', region: 'Africa' },
  { code: 'ZW', name: 'Zimbabwe', flag: '\uD83C\uDDFF\uD83C\uDDFC', dialCode: '+263', region: 'Africa' },

  // Americas
  { code: 'AI', name: 'Anguilla', flag: '\uD83C\uDDE6\uD83C\uDDEE', dialCode: '+1264', region: 'Americas' },
  { code: 'AG', name: 'Antigua and Barbuda', flag: '\uD83C\uDDE6\uD83C\uDDEC', dialCode: '+1268', region: 'Americas' },
  { code: 'AR', name: 'Argentina', flag: '\uD83C\uDDE6\uD83C\uDDF7', dialCode: '+54', region: 'Americas' },
  { code: 'AW', name: 'Aruba', flag: '\uD83C\uDDE6\uD83C\uDDFC', dialCode: '+297', region: 'Americas' },
  { code: 'BS', name: 'Bahamas', flag: '\uD83C\uDDE7\uD83C\uDDF8', dialCode: '+1242', region: 'Americas' },
  { code: 'BB', name: 'Barbados', flag: '\uD83C\uDDE7\uD83C\uDDE7', dialCode: '+1246', region: 'Americas' },
  { code: 'BZ', name: 'Belize', flag: '\uD83C\uDDE7\uD83C\uDDFF', dialCode: '+501', region: 'Americas' },
  { code: 'BM', name: 'Bermuda', flag: '\uD83C\uDDE7\uD83C\uDDF2', dialCode: '+1441', region: 'Americas' },
  { code: 'BO', name: 'Bolivia', flag: '\uD83C\uDDE7\uD83C\uDDF4', dialCode: '+591', region: 'Americas' },
  { code: 'BR', name: 'Brazil', flag: '\uD83C\uDDE7\uD83C\uDDF7', dialCode: '+55', region: 'Americas' },
  { code: 'CA', name: 'Canada', flag: '\uD83C\uDDE8\uD83C\uDDE6', dialCode: '+1', region: 'Americas' },
  { code: 'KY', name: 'Cayman Islands', flag: '\uD83C\uDDF0\uD83C\uDDFE', dialCode: '+1345', region: 'Americas' },
  { code: 'CL', name: 'Chile', flag: '\uD83C\uDDE8\uD83C\uDDF1', dialCode: '+56', region: 'Americas' },
  { code: 'CO', name: 'Colombia', flag: '\uD83C\uDDE8\uD83C\uDDF4', dialCode: '+57', region: 'Americas' },
  { code: 'CR', name: 'Costa Rica', flag: '\uD83C\uDDE8\uD83C\uDDF7', dialCode: '+506', region: 'Americas' },
  { code: 'CU', name: 'Cuba', flag: '\uD83C\uDDE8\uD83C\uDDFA', dialCode: '+53', region: 'Americas' },
  { code: 'CW', name: 'Curacao', flag: '\uD83C\uDDE8\uD83C\uDDFC', dialCode: '+599', region: 'Americas' },
  { code: 'DM', name: 'Dominica', flag: '\uD83C\uDDE9\uD83C\uDDF2', dialCode: '+1767', region: 'Americas' },
  { code: 'DO', name: 'Dominican Republic', flag: '\uD83C\uDDE9\uD83C\uDDF4', dialCode: '+1', region: 'Americas' },
  { code: 'EC', name: 'Ecuador', flag: '\uD83C\uDDEA\uD83C\uDDE8', dialCode: '+593', region: 'Americas' },
  { code: 'SV', name: 'El Salvador', flag: '\uD83C\uDDF8\uD83C\uDDFB', dialCode: '+503', region: 'Americas' },
  { code: 'GF', name: 'French Guiana', flag: '\uD83C\uDDEC\uD83C\uDDEB', dialCode: '+594', region: 'Americas' },
  { code: 'GD', name: 'Grenada', flag: '\uD83C\uDDEC\uD83C\uDDE9', dialCode: '+1473', region: 'Americas' },
  { code: 'GP', name: 'Guadeloupe', flag: '\uD83C\uDDEC\uD83C\uDDF5', dialCode: '+590', region: 'Americas' },
  { code: 'GT', name: 'Guatemala', flag: '\uD83C\uDDEC\uD83C\uDDF9', dialCode: '+502', region: 'Americas' },
  { code: 'GY', name: 'Guyana', flag: '\uD83C\uDDEC\uD83C\uDDFE', dialCode: '+592', region: 'Americas' },
  { code: 'HT', name: 'Haiti', flag: '\uD83C\uDDED\uD83C\uDDF9', dialCode: '+509', region: 'Americas' },
  { code: 'HN', name: 'Honduras', flag: '\uD83C\uDDED\uD83C\uDDF3', dialCode: '+504', region: 'Americas' },
  { code: 'JM', name: 'Jamaica', flag: '\uD83C\uDDEF\uD83C\uDDF2', dialCode: '+1876', region: 'Americas' },
  { code: 'MQ', name: 'Martinique', flag: '\uD83C\uDDF2\uD83C\uDDF6', dialCode: '+596', region: 'Americas' },
  { code: 'MX', name: 'Mexico', flag: '\uD83C\uDDF2\uD83C\uDDFD', dialCode: '+52', region: 'Americas' },
  { code: 'MS', name: 'Montserrat', flag: '\uD83C\uDDF2\uD83C\uDDF8', dialCode: '+1664', region: 'Americas' },
  { code: 'NI', name: 'Nicaragua', flag: '\uD83C\uDDF3\uD83C\uDDEE', dialCode: '+505', region: 'Americas' },
  { code: 'PA', name: 'Panama', flag: '\uD83C\uDDF5\uD83C\uDDE6', dialCode: '+507', region: 'Americas' },
  { code: 'PY', name: 'Paraguay', flag: '\uD83C\uDDF5\uD83C\uDDFE', dialCode: '+595', region: 'Americas' },
  { code: 'PE', name: 'Peru', flag: '\uD83C\uDDF5\uD83C\uDDEA', dialCode: '+51', region: 'Americas' },
  { code: 'PR', name: 'Puerto Rico', flag: '\uD83C\uDDF5\uD83C\uDDF7', dialCode: '+1', region: 'Americas' },
  { code: 'KN', name: 'Saint Kitts and Nevis', flag: '\uD83C\uDDF0\uD83C\uDDF3', dialCode: '+1869', region: 'Americas' },
  { code: 'LC', name: 'Saint Lucia', flag: '\uD83C\uDDF1\uD83C\uDDE8', dialCode: '+1758', region: 'Americas' },
  { code: 'VC', name: 'Saint Vincent and the Grenadines', flag: '\uD83C\uDDFB\uD83C\uDDE8', dialCode: '+1784', region: 'Americas' },
  { code: 'SR', name: 'Suriname', flag: '\uD83C\uDDF8\uD83C\uDDF7', dialCode: '+597', region: 'Americas' },
  { code: 'TT', name: 'Trinidad and Tobago', flag: '\uD83C\uDDF9\uD83C\uDDF9', dialCode: '+1868', region: 'Americas' },
  { code: 'TC', name: 'Turks and Caicos Islands', flag: '\uD83C\uDDF9\uD83C\uDDE8', dialCode: '+1649', region: 'Americas' },
  { code: 'US', name: 'United States', flag: '\uD83C\uDDFA\uD83C\uDDF8', dialCode: '+1', region: 'Americas' },
  { code: 'UY', name: 'Uruguay', flag: '\uD83C\uDDFA\uD83C\uDDFE', dialCode: '+598', region: 'Americas' },
  { code: 'VE', name: 'Venezuela', flag: '\uD83C\uDDFB\uD83C\uDDEA', dialCode: '+58', region: 'Americas' },
  { code: 'VG', name: 'Virgin Islands (British)', flag: '\uD83C\uDDFB\uD83C\uDDEC', dialCode: '+1284', region: 'Americas' },
  { code: 'VI', name: 'Virgin Islands (U.S.)', flag: '\uD83C\uDDFB\uD83C\uDDEE', dialCode: '+1340', region: 'Americas' },

  // Asia
  { code: 'AF', name: 'Afghanistan', flag: '\uD83C\uDDE6\uD83C\uDDEB', dialCode: '+93', region: 'Asia' },
  { code: 'AM', name: 'Armenia', flag: '\uD83C\uDDE6\uD83C\uDDF2', dialCode: '+374', region: 'Asia' },
  { code: 'AZ', name: 'Azerbaijan', flag: '\uD83C\uDDE6\uD83C\uDDFF', dialCode: '+994', region: 'Asia' },
  { code: 'BH', name: 'Bahrain', flag: '\uD83C\uDDE7\uD83C\uDDED', dialCode: '+973', region: 'Asia' },
  { code: 'BD', name: 'Bangladesh', flag: '\uD83C\uDDE7\uD83C\uDDE9', dialCode: '+880', region: 'Asia' },
  { code: 'BT', name: 'Bhutan', flag: '\uD83C\uDDE7\uD83C\uDDF9', dialCode: '+975', region: 'Asia' },
  { code: 'BN', name: 'Brunei', flag: '\uD83C\uDDE7\uD83C\uDDF3', dialCode: '+673', region: 'Asia' },
  { code: 'KH', name: 'Cambodia', flag: '\uD83C\uDDF0\uD83C\uDDED', dialCode: '+855', region: 'Asia' },
  { code: 'CN', name: 'China', flag: '\uD83C\uDDE8\uD83C\uDDF3', dialCode: '+86', region: 'Asia' },
  { code: 'CY', name: 'Cyprus', flag: '\uD83C\uDDE8\uD83C\uDDFE', dialCode: '+357', region: 'Asia' },
  { code: 'GE', name: 'Georgia', flag: '\uD83C\uDDEC\uD83C\uDDEA', dialCode: '+995', region: 'Asia' },
  { code: 'HK', name: 'Hong Kong', flag: '\uD83C\uDDED\uD83C\uDDF0', dialCode: '+852', region: 'Asia' },
  { code: 'IN', name: 'India', flag: '\uD83C\uDDEE\uD83C\uDDF3', dialCode: '+91', region: 'Asia' },
  { code: 'ID', name: 'Indonesia', flag: '\uD83C\uDDEE\uD83C\uDDE9', dialCode: '+62', region: 'Asia' },
  { code: 'IR', name: 'Iran', flag: '\uD83C\uDDEE\uD83C\uDDF7', dialCode: '+98', region: 'Asia' },
  { code: 'IQ', name: 'Iraq', flag: '\uD83C\uDDEE\uD83C\uDDF6', dialCode: '+964', region: 'Asia' },
  { code: 'IL', name: 'Israel', flag: '\uD83C\uDDEE\uD83C\uDDF1', dialCode: '+972', region: 'Asia' },
  { code: 'JP', name: 'Japan', flag: '\uD83C\uDDEF\uD83C\uDDF5', dialCode: '+81', region: 'Asia' },
  { code: 'JO', name: 'Jordan', flag: '\uD83C\uDDEF\uD83C\uDDF4', dialCode: '+962', region: 'Asia' },
  { code: 'KZ', name: 'Kazakhstan', flag: '\uD83C\uDDF0\uD83C\uDDFF', dialCode: '+7', region: 'Asia' },
  { code: 'KW', name: 'Kuwait', flag: '\uD83C\uDDF0\uD83C\uDDFC', dialCode: '+965', region: 'Asia' },
  { code: 'KG', name: 'Kyrgyzstan', flag: '\uD83C\uDDF0\uD83C\uDDEC', dialCode: '+996', region: 'Asia' },
  { code: 'LA', name: 'Laos', flag: '\uD83C\uDDF1\uD83C\uDDE6', dialCode: '+856', region: 'Asia' },
  { code: 'LB', name: 'Lebanon', flag: '\uD83C\uDDF1\uD83C\uDDE7', dialCode: '+961', region: 'Asia' },
  { code: 'MO', name: 'Macau', flag: '\uD83C\uDDF2\uD83C\uDDF4', dialCode: '+853', region: 'Asia' },
  { code: 'MY', name: 'Malaysia', flag: '\uD83C\uDDF2\uD83C\uDDFE', dialCode: '+60', region: 'Asia' },
  { code: 'MV', name: 'Maldives', flag: '\uD83C\uDDF2\uD83C\uDDFB', dialCode: '+960', region: 'Asia' },
  { code: 'MN', name: 'Mongolia', flag: '\uD83C\uDDF2\uD83C\uDDF3', dialCode: '+976', region: 'Asia' },
  { code: 'MM', name: 'Myanmar', flag: '\uD83C\uDDF2\uD83C\uDDF2', dialCode: '+95', region: 'Asia' },
  { code: 'NP', name: 'Nepal', flag: '\uD83C\uDDF3\uD83C\uDDF5', dialCode: '+977', region: 'Asia' },
  { code: 'KP', name: 'North Korea', flag: '\uD83C\uDDF0\uD83C\uDDF5', dialCode: '+850', region: 'Asia' },
  { code: 'OM', name: 'Oman', flag: '\uD83C\uDDF4\uD83C\uDDF2', dialCode: '+968', region: 'Asia' },
  { code: 'PK', name: 'Pakistan', flag: '\uD83C\uDDF5\uD83C\uDDF0', dialCode: '+92', region: 'Asia' },
  { code: 'PS', name: 'Palestine', flag: '\uD83C\uDDF5\uD83C\uDDF8', dialCode: '+970', region: 'Asia' },
  { code: 'PH', name: 'Philippines', flag: '\uD83C\uDDF5\uD83C\uDDED', dialCode: '+63', region: 'Asia' },
  { code: 'QA', name: 'Qatar', flag: '\uD83C\uDDF6\uD83C\uDDE6', dialCode: '+974', region: 'Asia' },
  { code: 'SA', name: 'Saudi Arabia', flag: '\uD83C\uDDF8\uD83C\uDDE6', dialCode: '+966', region: 'Asia' },
  { code: 'SG', name: 'Singapore', flag: '\uD83C\uDDF8\uD83C\uDDEC', dialCode: '+65', region: 'Asia' },
  { code: 'KR', name: 'South Korea', flag: '\uD83C\uDDF0\uD83C\uDDF7', dialCode: '+82', region: 'Asia' },
  { code: 'LK', name: 'Sri Lanka', flag: '\uD83C\uDDF1\uD83C\uDDF0', dialCode: '+94', region: 'Asia' },
  { code: 'SY', name: 'Syria', flag: '\uD83C\uDDF8\uD83C\uDDFE', dialCode: '+963', region: 'Asia' },
  { code: 'TW', name: 'Taiwan', flag: '\uD83C\uDDF9\uD83C\uDDFC', dialCode: '+886', region: 'Asia' },
  { code: 'TJ', name: 'Tajikistan', flag: '\uD83C\uDDF9\uD83C\uDDEF', dialCode: '+992', region: 'Asia' },
  { code: 'TH', name: 'Thailand', flag: '\uD83C\uDDF9\uD83C\uDDED', dialCode: '+66', region: 'Asia' },
  { code: 'TL', name: 'Timor-Leste', flag: '\uD83C\uDDF9\uD83C\uDDF1', dialCode: '+670', region: 'Asia' },
  { code: 'TR', name: 'Turkey', flag: '\uD83C\uDDF9\uD83C\uDDF7', dialCode: '+90', region: 'Asia' },
  { code: 'TM', name: 'Turkmenistan', flag: '\uD83C\uDDF9\uD83C\uDDF2', dialCode: '+993', region: 'Asia' },
  { code: 'AE', name: 'United Arab Emirates', flag: '\uD83C\uDDE6\uD83C\uDDEA', dialCode: '+971', region: 'Asia' },
  { code: 'UZ', name: 'Uzbekistan', flag: '\uD83C\uDDFA\uD83C\uDDFF', dialCode: '+998', region: 'Asia' },
  { code: 'VN', name: 'Vietnam', flag: '\uD83C\uDDFB\uD83C\uDDF3', dialCode: '+84', region: 'Asia' },
  { code: 'YE', name: 'Yemen', flag: '\uD83C\uDDFE\uD83C\uDDEA', dialCode: '+967', region: 'Asia' },

  // Europe
  { code: 'AL', name: 'Albania', flag: '\uD83C\uDDE6\uD83C\uDDF1', dialCode: '+355', region: 'Europe' },
  { code: 'AD', name: 'Andorra', flag: '\uD83C\uDDE6\uD83C\uDDE9', dialCode: '+376', region: 'Europe' },
  { code: 'AT', name: 'Austria', flag: '\uD83C\uDDE6\uD83C\uDDF9', dialCode: '+43', region: 'Europe' },
  { code: 'BY', name: 'Belarus', flag: '\uD83C\uDDE7\uD83C\uDDFE', dialCode: '+375', region: 'Europe' },
  { code: 'BE', name: 'Belgium', flag: '\uD83C\uDDE7\uD83C\uDDEA', dialCode: '+32', region: 'Europe' },
  { code: 'BA', name: 'Bosnia and Herzegovina', flag: '\uD83C\uDDE7\uD83C\uDDE6', dialCode: '+387', region: 'Europe' },
  { code: 'BG', name: 'Bulgaria', flag: '\uD83C\uDDE7\uD83C\uDDEC', dialCode: '+359', region: 'Europe' },
  { code: 'HR', name: 'Croatia', flag: '\uD83C\uDDED\uD83C\uDDF7', dialCode: '+385', region: 'Europe' },
  { code: 'CZ', name: 'Czech Republic', flag: '\uD83C\uDDE8\uD83C\uDDFF', dialCode: '+420', region: 'Europe' },
  { code: 'DK', name: 'Denmark', flag: '\uD83C\uDDE9\uD83C\uDDF0', dialCode: '+45', region: 'Europe' },
  { code: 'EE', name: 'Estonia', flag: '\uD83C\uDDEA\uD83C\uDDEA', dialCode: '+372', region: 'Europe' },
  { code: 'FO', name: 'Faroe Islands', flag: '\uD83C\uDDEB\uD83C\uDDF4', dialCode: '+298', region: 'Europe' },
  { code: 'FI', name: 'Finland', flag: '\uD83C\uDDEB\uD83C\uDDEE', dialCode: '+358', region: 'Europe' },
  { code: 'FR', name: 'France', flag: '\uD83C\uDDEB\uD83C\uDDF7', dialCode: '+33', region: 'Europe' },
  { code: 'DE', name: 'Germany', flag: '\uD83C\uDDE9\uD83C\uDDEA', dialCode: '+49', region: 'Europe' },
  { code: 'GI', name: 'Gibraltar', flag: '\uD83C\uDDEC\uD83C\uDDEE', dialCode: '+350', region: 'Europe' },
  { code: 'GR', name: 'Greece', flag: '\uD83C\uDDEC\uD83C\uDDF7', dialCode: '+30', region: 'Europe' },
  { code: 'GL', name: 'Greenland', flag: '\uD83C\uDDEC\uD83C\uDDF1', dialCode: '+299', region: 'Europe' },
  { code: 'GG', name: 'Guernsey', flag: '\uD83C\uDDEC\uD83C\uDDEC', dialCode: '+44', region: 'Europe' },
  { code: 'HU', name: 'Hungary', flag: '\uD83C\uDDED\uD83C\uDDFA', dialCode: '+36', region: 'Europe' },
  { code: 'IS', name: 'Iceland', flag: '\uD83C\uDDEE\uD83C\uDDF8', dialCode: '+354', region: 'Europe' },
  { code: 'IE', name: 'Ireland', flag: '\uD83C\uDDEE\uD83C\uDDEA', dialCode: '+353', region: 'Europe' },
  { code: 'IM', name: 'Isle of Man', flag: '\uD83C\uDDEE\uD83C\uDDF2', dialCode: '+44', region: 'Europe' },
  { code: 'IT', name: 'Italy', flag: '\uD83C\uDDEE\uD83C\uDDF9', dialCode: '+39', region: 'Europe' },
  { code: 'JE', name: 'Jersey', flag: '\uD83C\uDDEF\uD83C\uDDEA', dialCode: '+44', region: 'Europe' },
  { code: 'XK', name: 'Kosovo', flag: '\uD83C\uDDFD\uD83C\uDDF0', dialCode: '+383', region: 'Europe' },
  { code: 'LV', name: 'Latvia', flag: '\uD83C\uDDF1\uD83C\uDDFB', dialCode: '+371', region: 'Europe' },
  { code: 'LI', name: 'Liechtenstein', flag: '\uD83C\uDDF1\uD83C\uDDEE', dialCode: '+423', region: 'Europe' },
  { code: 'LT', name: 'Lithuania', flag: '\uD83C\uDDF1\uD83C\uDDF9', dialCode: '+370', region: 'Europe' },
  { code: 'LU', name: 'Luxembourg', flag: '\uD83C\uDDF1\uD83C\uDDFA', dialCode: '+352', region: 'Europe' },
  { code: 'MT', name: 'Malta', flag: '\uD83C\uDDF2\uD83C\uDDF9', dialCode: '+356', region: 'Europe' },
  { code: 'MD', name: 'Moldova', flag: '\uD83C\uDDF2\uD83C\uDDE9', dialCode: '+373', region: 'Europe' },
  { code: 'MC', name: 'Monaco', flag: '\uD83C\uDDF2\uD83C\uDDE8', dialCode: '+377', region: 'Europe' },
  { code: 'ME', name: 'Montenegro', flag: '\uD83C\uDDF2\uD83C\uDDEA', dialCode: '+382', region: 'Europe' },
  { code: 'NL', name: 'Netherlands', flag: '\uD83C\uDDF3\uD83C\uDDF1', dialCode: '+31', region: 'Europe' },
  { code: 'MK', name: 'North Macedonia', flag: '\uD83C\uDDF2\uD83C\uDDF0', dialCode: '+389', region: 'Europe' },
  { code: 'NO', name: 'Norway', flag: '\uD83C\uDDF3\uD83C\uDDF4', dialCode: '+47', region: 'Europe' },
  { code: 'PL', name: 'Poland', flag: '\uD83C\uDDF5\uD83C\uDDF1', dialCode: '+48', region: 'Europe' },
  { code: 'PT', name: 'Portugal', flag: '\uD83C\uDDF5\uD83C\uDDF9', dialCode: '+351', region: 'Europe' },
  { code: 'RO', name: 'Romania', flag: '\uD83C\uDDF7\uD83C\uDDF4', dialCode: '+40', region: 'Europe' },
  { code: 'RU', name: 'Russia', flag: '\uD83C\uDDF7\uD83C\uDDFA', dialCode: '+7', region: 'Europe' },
  { code: 'SM', name: 'San Marino', flag: '\uD83C\uDDF8\uD83C\uDDF2', dialCode: '+378', region: 'Europe' },
  { code: 'RS', name: 'Serbia', flag: '\uD83C\uDDF7\uD83C\uDDF8', dialCode: '+381', region: 'Europe' },
  { code: 'SK', name: 'Slovakia', flag: '\uD83C\uDDF8\uD83C\uDDF0', dialCode: '+421', region: 'Europe' },
  { code: 'SI', name: 'Slovenia', flag: '\uD83C\uDDF8\uD83C\uDDEE', dialCode: '+386', region: 'Europe' },
  { code: 'ES', name: 'Spain', flag: '\uD83C\uDDEA\uD83C\uDDF8', dialCode: '+34', region: 'Europe' },
  { code: 'SE', name: 'Sweden', flag: '\uD83C\uDDF8\uD83C\uDDEA', dialCode: '+46', region: 'Europe' },
  { code: 'CH', name: 'Switzerland', flag: '\uD83C\uDDE8\uD83C\uDDED', dialCode: '+41', region: 'Europe' },
  { code: 'UA', name: 'Ukraine', flag: '\uD83C\uDDFA\uD83C\uDDE6', dialCode: '+380', region: 'Europe' },
  { code: 'GB', name: 'United Kingdom', flag: '\uD83C\uDDEC\uD83C\uDDE7', dialCode: '+44', region: 'Europe' },
  { code: 'VA', name: 'Vatican City', flag: '\uD83C\uDDFB\uD83C\uDDE6', dialCode: '+39', region: 'Europe' },

  // Oceania
  { code: 'AS', name: 'American Samoa', flag: '\uD83C\uDDE6\uD83C\uDDF8', dialCode: '+1684', region: 'Oceania' },
  { code: 'AU', name: 'Australia', flag: '\uD83C\uDDE6\uD83C\uDDFA', dialCode: '+61', region: 'Oceania' },
  { code: 'CK', name: 'Cook Islands', flag: '\uD83C\uDDE8\uD83C\uDDF0', dialCode: '+682', region: 'Oceania' },
  { code: 'FJ', name: 'Fiji', flag: '\uD83C\uDDEB\uD83C\uDDEF', dialCode: '+679', region: 'Oceania' },
  { code: 'PF', name: 'French Polynesia', flag: '\uD83C\uDDF5\uD83C\uDDEB', dialCode: '+689', region: 'Oceania' },
  { code: 'GU', name: 'Guam', flag: '\uD83C\uDDEC\uD83C\uDDFA', dialCode: '+1671', region: 'Oceania' },
  { code: 'KI', name: 'Kiribati', flag: '\uD83C\uDDF0\uD83C\uDDEE', dialCode: '+686', region: 'Oceania' },
  { code: 'MH', name: 'Marshall Islands', flag: '\uD83C\uDDF2\uD83C\uDDED', dialCode: '+692', region: 'Oceania' },
  { code: 'FM', name: 'Micronesia', flag: '\uD83C\uDDEB\uD83C\uDDF2', dialCode: '+691', region: 'Oceania' },
  { code: 'NR', name: 'Nauru', flag: '\uD83C\uDDF3\uD83C\uDDF7', dialCode: '+674', region: 'Oceania' },
  { code: 'NC', name: 'New Caledonia', flag: '\uD83C\uDDF3\uD83C\uDDE8', dialCode: '+687', region: 'Oceania' },
  { code: 'NZ', name: 'New Zealand', flag: '\uD83C\uDDF3\uD83C\uDDFF', dialCode: '+64', region: 'Oceania' },
  { code: 'NU', name: 'Niue', flag: '\uD83C\uDDF3\uD83C\uDDFA', dialCode: '+683', region: 'Oceania' },
  { code: 'NF', name: 'Norfolk Island', flag: '\uD83C\uDDF3\uD83C\uDDEB', dialCode: '+672', region: 'Oceania' },
  { code: 'MP', name: 'Northern Mariana Islands', flag: '\uD83C\uDDF2\uD83C\uDDF5', dialCode: '+1670', region: 'Oceania' },
  { code: 'PW', name: 'Palau', flag: '\uD83C\uDDF5\uD83C\uDDFC', dialCode: '+680', region: 'Oceania' },
  { code: 'PG', name: 'Papua New Guinea', flag: '\uD83C\uDDF5\uD83C\uDDEC', dialCode: '+675', region: 'Oceania' },
  { code: 'WS', name: 'Samoa', flag: '\uD83C\uDDFC\uD83C\uDDF8', dialCode: '+685', region: 'Oceania' },
  { code: 'SB', name: 'Solomon Islands', flag: '\uD83C\uDDF8\uD83C\uDDE7', dialCode: '+677', region: 'Oceania' },
  { code: 'TK', name: 'Tokelau', flag: '\uD83C\uDDF9\uD83C\uDDF0', dialCode: '+690', region: 'Oceania' },
  { code: 'TO', name: 'Tonga', flag: '\uD83C\uDDF9\uD83C\uDDF4', dialCode: '+676', region: 'Oceania' },
  { code: 'TV', name: 'Tuvalu', flag: '\uD83C\uDDF9\uD83C\uDDFB', dialCode: '+688', region: 'Oceania' },
  { code: 'VU', name: 'Vanuatu', flag: '\uD83C\uDDFB\uD83C\uDDFA', dialCode: '+678', region: 'Oceania' },
  { code: 'WF', name: 'Wallis and Futuna', flag: '\uD83C\uDDFC\uD83C\uDDEB', dialCode: '+681', region: 'Oceania' },
];

/**
 * Get countries grouped by region
 */
export function getCountriesByRegion(): Record<CountryRegion, Country[]> {
  const grouped: Record<CountryRegion, Country[]> = {
    Africa: [],
    Americas: [],
    Asia: [],
    Europe: [],
    Oceania: [],
  };

  for (const country of countries) {
    grouped[country.region].push(country);
  }

  // Sort each region alphabetically by name
  for (const region of Object.keys(grouped) as CountryRegion[]) {
    grouped[region].sort((a, b) => a.name.localeCompare(b.name));
  }

  return grouped;
}

/**
 * Search countries by name or code
 */
export function searchCountries(query: string): Country[] {
  const normalizedQuery = query.toLowerCase().trim();

  if (!normalizedQuery) {
    return countries;
  }

  return countries.filter(
    (country) =>
      country.name.toLowerCase().includes(normalizedQuery) ||
      country.code.toLowerCase().includes(normalizedQuery)
  );
}

/**
 * Get a country by its ISO code
 */
export function getCountryByCode(code: string): Country | undefined {
  return countries.find(
    (country) => country.code.toUpperCase() === code.toUpperCase()
  );
}

/**
 * Get flag emoji for a country code
 */
export function getCountryFlag(code: string): string {
  const country = getCountryByCode(code);
  return country?.flag || '';
}

/**
 * Get all region names in display order
 */
export const regionOrder: CountryRegion[] = [
  'Americas',
  'Europe',
  'Asia',
  'Africa',
  'Oceania',
];
