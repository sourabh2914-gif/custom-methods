import type { WalnutContext } from './walnut';

/** @walnut_method
 * name: Generate Random Location Name
 * description: Generate a random location name from around the world and store in $[location]
 * actionType: custom_generate_random_location
 * context: shared
 * needsLocator: false
 * category: Data Processing
 */
export async function generateRandomLocation(ctx: WalnutContext) {
  // ctx.args[0] = "location" (from $[location]) — runtime variable name to store into

  const outputVar = ctx.args[0];

  const locations = [
    // Asia
    'Tokyo', 'Osaka', 'Kyoto', 'Seoul', 'Busan', 'Beijing', 'Shanghai', 'Guangzhou',
    'Shenzhen', 'Hong Kong', 'Taipei', 'Singapore', 'Bangkok', 'Chiang Mai', 'Jakarta',
    'Bali', 'Kuala Lumpur', 'Manila', 'Ho Chi Minh City', 'Hanoi', 'Phnom Penh',
    'Yangon', 'Colombo', 'Kathmandu', 'Dhaka', 'Karachi', 'Lahore', 'Islamabad',
    'Mumbai', 'Delhi', 'Bengaluru', 'Chennai', 'Kolkata', 'Hyderabad', 'Ahmedabad',
    'Pune', 'Jaipur', 'Lucknow', 'Surat', 'Kochi', 'Goa', 'Agra', 'Varanasi',
    'Amritsar', 'Chandigarh', 'Bhopal', 'Indore', 'Nagpur', 'Visakhapatnam',
    'Kabul', 'Tbilisi', 'Baku', 'Yerevan', 'Tashkent', 'Almaty', 'Bishkek',
    'Dushanbe', 'Ashgabat', 'Ulaanbaatar', 'Pyongyang', 'Vientiane',

    // Middle East
    'Dubai', 'Abu Dhabi', 'Doha', 'Riyadh', 'Jeddah', 'Mecca', 'Medina',
    'Kuwait City', 'Manama', 'Muscat', 'Amman', 'Beirut', 'Damascus', 'Baghdad',
    'Tehran', 'Mashhad', 'Isfahan', 'Ankara', 'Istanbul', 'Izmir', 'Jerusalem',
    'Tel Aviv', 'Haifa', 'Nicosia',

    // Europe
    'London', 'Manchester', 'Birmingham', 'Edinburgh', 'Glasgow', 'Dublin',
    'Paris', 'Lyon', 'Marseille', 'Nice', 'Bordeaux', 'Toulouse', 'Strasbourg',
    'Berlin', 'Munich', 'Hamburg', 'Frankfurt', 'Cologne', 'Stuttgart', 'Dresden',
    'Madrid', 'Barcelona', 'Valencia', 'Seville', 'Bilbao', 'Malaga', 'Zaragoza',
    'Rome', 'Milan', 'Naples', 'Turin', 'Florence', 'Venice', 'Bologna', 'Palermo',
    'Amsterdam', 'Rotterdam', 'The Hague', 'Brussels', 'Antwerp', 'Ghent',
    'Vienna', 'Graz', 'Salzburg', 'Zurich', 'Geneva', 'Bern', 'Basel',
    'Stockholm', 'Gothenburg', 'Malmo', 'Oslo', 'Bergen', 'Copenhagen', 'Aarhus',
    'Helsinki', 'Tampere', 'Turku', 'Reykjavik', 'Warsaw', 'Krakow', 'Gdansk',
    'Prague', 'Brno', 'Budapest', 'Bratislava', 'Bucharest', 'Cluj-Napoca',
    'Sofia', 'Plovdiv', 'Athens', 'Thessaloniki', 'Lisbon', 'Porto', 'Braga',
    'Valletta', 'Nicosia', 'Ljubljana', 'Zagreb', 'Sarajevo', 'Belgrade',
    'Skopje', 'Tirana', 'Podgorica', 'Pristina', 'Tallinn', 'Riga', 'Vilnius',
    'Minsk', 'Kyiv', 'Lviv', 'Odessa', 'Kharkiv', 'Moscow', 'Saint Petersburg',
    'Novosibirsk', 'Yekaterinburg', 'Kazan', 'Chelyabinsk', 'Omsk',

    // Africa
    'Cairo', 'Alexandria', 'Giza', 'Casablanca', 'Marrakech', 'Fez', 'Tunis',
    'Algiers', 'Tripoli', 'Khartoum', 'Addis Ababa', 'Nairobi', 'Mombasa',
    'Kampala', 'Dar es Salaam', 'Zanzibar', 'Kigali', 'Bujumbura', 'Lusaka',
    'Harare', 'Bulawayo', 'Johannesburg', 'Cape Town', 'Durban', 'Pretoria',
    'Port Elizabeth', 'Bloemfontein', 'Maputo', 'Antananarivo', 'Windhoek',
    'Gaborone', 'Maseru', 'Mbabane', 'Luanda', 'Kinshasa', 'Brazzaville',
    'Libreville', 'Yaounde', 'Douala', 'Lagos', 'Abuja', 'Ibadan', 'Kano',
    'Accra', 'Kumasi', 'Abidjan', 'Yamoussoukro', 'Dakar', 'Bamako', 'Ouagadougou',
    'Niamey', 'Ndjamena', 'Bangui', 'Lome', 'Cotonou', 'Conakry', 'Freetown',
    'Monrovia', 'Bissau', 'Banjul', 'Nouakchott', 'Djibouti', 'Mogadishu',
    'Nairobi', 'Asmara', 'Juba', 'Khartoum',

    // North America
    'New York', 'Los Angeles', 'Chicago', 'Houston', 'Phoenix', 'Philadelphia',
    'San Antonio', 'San Diego', 'Dallas', 'San Jose', 'Austin', 'Jacksonville',
    'Fort Worth', 'Columbus', 'Charlotte', 'San Francisco', 'Indianapolis',
    'Seattle', 'Denver', 'Boston', 'Portland', 'Las Vegas', 'Memphis', 'Detroit',
    'Louisville', 'Nashville', 'Atlanta', 'Baltimore', 'Milwaukee', 'Albuquerque',
    'Tucson', 'Fresno', 'Sacramento', 'Mesa', 'Kansas City', 'Omaha', 'Raleigh',
    'Colorado Springs', 'Long Beach', 'Virginia Beach', 'Minneapolis', 'Tampa',
    'Miami', 'Orlando', 'New Orleans', 'Cleveland', 'Pittsburgh', 'Cincinnati',
    'Honolulu', 'Anchorage', 'Toronto', 'Montreal', 'Vancouver', 'Calgary',
    'Edmonton', 'Ottawa', 'Quebec City', 'Winnipeg', 'Halifax', 'Victoria',
    'Mexico City', 'Guadalajara', 'Monterrey', 'Puebla', 'Tijuana', 'Cancun',
    'Merida', 'Leon', 'Ciudad Juarez', 'San Luis Potosi', 'Havana', 'Kingston',
    'Port-au-Prince', 'Santo Domingo', 'San Juan', 'Guatemala City', 'Belize City',
    'San Salvador', 'Tegucigalpa', 'Managua', 'San Jose', 'Panama City',

    // South America
    'Sao Paulo', 'Rio de Janeiro', 'Brasilia', 'Salvador', 'Fortaleza', 'Belo Horizonte',
    'Manaus', 'Curitiba', 'Recife', 'Porto Alegre', 'Belem', 'Goiania', 'Florianopolis',
    'Buenos Aires', 'Cordoba', 'Rosario', 'Mendoza', 'Tucuman', 'La Plata',
    'Mar del Plata', 'Santiago', 'Valparaiso', 'Concepcion', 'Lima', 'Arequipa',
    'Trujillo', 'Cusco', 'Bogota', 'Medellin', 'Cali', 'Barranquilla', 'Cartagena',
    'Caracas', 'Maracaibo', 'Valencia', 'Quito', 'Guayaquil', 'Cuenca',
    'La Paz', 'Santa Cruz', 'Cochabamba', 'Asuncion', 'Montevideo', 'Salto',
    'Georgetown', 'Paramaribo', 'Cayenne',

    // Oceania
    'Sydney', 'Melbourne', 'Brisbane', 'Perth', 'Adelaide', 'Gold Coast',
    'Canberra', 'Hobart', 'Darwin', 'Newcastle', 'Wollongong', 'Cairns',
    'Auckland', 'Wellington', 'Christchurch', 'Hamilton', 'Tauranga', 'Dunedin',
    'Suva', 'Port Moresby', 'Honiara', 'Port Vila', 'Nuku alofa', 'Apia',
    'Pago Pago', 'Funafuti', 'Tarawa', 'Majuro', 'Palikir',

    // Caribbean
    'Nassau', 'Bridgetown', 'Castries', 'Kingstown', 'Basseterre', "St. John's",
    'Roseau', 'Fort-de-France', 'Pointe-a-Pitre', 'Willemstad', 'Oranjestad',
    'Philipsburg', 'Marigot', 'Road Town', 'Charlotte Amalie',
  ];

  const randomIndex = Math.floor(Math.random() * locations.length);
  const location = locations[randomIndex];

  ctx.log(`Generated random location: "${location}"`);
  ctx.setVariable(outputVar, location);
}
