// Shared utility functions — used across multiple components

export const haversine = (lat1, lng1, lat2, lng2) => {
  const R = 3959, dLat = (lat2 - lat1) * Math.PI / 180, dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
};

export const daysBetween = (a, b) => {
  if (!a || !b) return 0;
  return Math.max(1, Math.round(Math.abs(new Date(b + "T12:00:00") - new Date(a + "T12:00:00")) / 86400000));
};

export const COUNTRY_CODES = {
  "Afghanistan":"AF","Albania":"AL","Algeria":"DZ","Andorra":"AD","Angola":"AO","Argentina":"AR",
  "Armenia":"AM","Australia":"AU","Austria":"AT","Azerbaijan":"AZ","Bahamas":"BS","Bahrain":"BH",
  "Bangladesh":"BD","Barbados":"BB","Belarus":"BY","Belgium":"BE","Belize":"BZ","Benin":"BJ",
  "Bhutan":"BT","Bolivia":"BO","Bosnia and Herzegovina":"BA","Botswana":"BW","Brazil":"BR",
  "Brunei":"BN","Bulgaria":"BG","Cambodia":"KH","Cameroon":"CM","Canada":"CA","Chad":"TD",
  "Chile":"CL","China":"CN","Colombia":"CO","Congo":"CG","Costa Rica":"CR","Croatia":"HR",
  "Cuba":"CU","Cyprus":"CY","Czech Republic":"CZ","Czechia":"CZ","Denmark":"DK",
  "Dominican Republic":"DO","Ecuador":"EC","Egypt":"EG","El Salvador":"SV","Estonia":"EE",
  "Ethiopia":"ET","Fiji":"FJ","Finland":"FI","France":"FR","Georgia":"GE","Germany":"DE",
  "Ghana":"GH","Greece":"GR","Guatemala":"GT","Haiti":"HT","Honduras":"HN","Hungary":"HU",
  "Iceland":"IS","India":"IN","Indonesia":"ID","Iran":"IR","Iraq":"IQ","Ireland":"IE",
  "Israel":"IL","Italy":"IT","Jamaica":"JM","Japan":"JP","Jordan":"JO","Kazakhstan":"KZ",
  "Kenya":"KE","South Korea":"KR","Korea":"KR","Kuwait":"KW","Laos":"LA","Latvia":"LV",
  "Lebanon":"LB","Libya":"LY","Lithuania":"LT","Luxembourg":"LU","Madagascar":"MG",
  "Malaysia":"MY","Maldives":"MV","Mali":"ML","Malta":"MT","Mexico":"MX","Moldova":"MD",
  "Monaco":"MC","Mongolia":"MN","Montenegro":"ME","Morocco":"MA","Mozambique":"MZ",
  "Myanmar":"MM","Nepal":"NP","Netherlands":"NL","New Zealand":"NZ","Nicaragua":"NI",
  "Nigeria":"NG","North Macedonia":"MK","Norway":"NO","Oman":"OM","Pakistan":"PK","Panama":"PA",
  "Paraguay":"PY","Peru":"PE","Philippines":"PH","Poland":"PL","Portugal":"PT","Qatar":"QA",
  "Romania":"RO","Russia":"RU","Rwanda":"RW","Saudi Arabia":"SA","Senegal":"SN","Serbia":"RS",
  "Singapore":"SG","Slovakia":"SK","Slovenia":"SI","Somalia":"SO","South Africa":"ZA",
  "Spain":"ES","Sri Lanka":"LK","Sudan":"SD","Sweden":"SE","Switzerland":"CH","Syria":"SY",
  "Taiwan":"TW","Tanzania":"TZ","Thailand":"TH","Tunisia":"TN","Turkey":"TR","Turkiye":"TR",
  "Uganda":"UG","Ukraine":"UA","United Arab Emirates":"AE","UAE":"AE",
  "United Kingdom":"GB","UK":"GB","United States":"US","USA":"US","Uruguay":"UY",
  "Uzbekistan":"UZ","Venezuela":"VE","Vietnam":"VN","Yemen":"YE","Zambia":"ZM","Zimbabwe":"ZW",
  "Puerto Rico":"PR","Hawaii":"US","Scotland":"GB","England":"GB","Wales":"GB",
};

export function countryFlag(country) {
  const code = COUNTRY_CODES[country];
  if (!code) return "";
  return String.fromCodePoint(...[...code].map(c => 0x1F1E6 + c.charCodeAt(0) - 65));
}
