import { useState, useEffect, useRef, useCallback, useMemo, useReducer } from "react";
import * as THREE from "three";
import { loadEntries, saveEntry, deleteEntry, loadConfig as loadCfg, saveConfig as saveCfg, uploadPhoto } from "./supabase.js";

/* =================================================================
   🌍 OUR WORLD — Seth & Rosie Posie
   "every moment, every adventure"
   v7 — hosted edition with Supabase
   ================================================================= */

const DEFAULT_CONFIG = {
  startDate: "2021-06-01",
  title: "Our World",
  subtitle: "every moment, every adventure",
  loveLetter: "",
  youName: "Seth",
  partnerName: "Rosie Posie",
};

const P = {
  cream: "#faf8f4", warm: "#fef9f4", parchment: "#f5f1ea",
  blush: "#fdf2f4", lavMist: "#f3f0ff",
  text: "#3d3552", textMid: "#6b5e7e", textMuted: "#958ba8", textFaint: "#c4bbd4",
  rose: "#d4a0b9", roseLight: "#f0d4e4", roseSoft: "#e8c0d4",
  sky: "#9bb5d6", skyLight: "#c8daf0", skySoft: "#b0c8e0",
  sage: "#a8bf94", gold: "#d4b078", goldWarm: "#e8c88a", lavender: "#b8a5cc",
  heart: "#e07a9a", heartSoft: "#f0a0b8",
  card: "rgba(253,251,247,0.96)", glass: "rgba(250,248,244,0.92)",
};

const TYPES = {
  "home-seth": { label: "Seth's Home", icon: "🏡", color: P.sky, who: "seth" },
  "home-rosie": { label: "Rosie's Home", icon: "🌹", color: P.rose, who: "rosie" },
  "seth-solo": { label: "Seth Traveling", icon: "🧭", color: P.skySoft, who: "seth" },
  "rosie-solo": { label: "Rosie Traveling", icon: "🌹", color: P.roseSoft, who: "rosie" },
  together: { label: "Together", icon: "💕", color: P.gold, who: "both" },
  special: { label: "Special Moment", icon: "✨", color: P.lavender, who: "both" },
};

// ---- UTILS ----
const ll2v = (lat, lng, r) => {
  const phi = (90 - lat) * Math.PI / 180, theta = (lng + 180) * Math.PI / 180;
  return new THREE.Vector3(-(r * Math.sin(phi) * Math.cos(theta)), r * Math.cos(phi), r * Math.sin(phi) * Math.sin(theta));
};
const lerp = (a, b, t) => a + (b - a) * t;
const haversine = (lat1, lng1, lat2, lng2) => {
  const R = 3959, dLat = (lat2 - lat1) * Math.PI / 180, dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
};
const daysBetween = (a, b) => Math.round((new Date(b) - new Date(a)) / 86400000);
const addDays = (ds, n) => { const d = new Date(ds); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); };
const fmtDate = d => { if (!d) return ""; const dt = new Date(d + "T12:00:00"); return dt.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }); };
const todayStr = () => new Date().toISOString().slice(0, 10);
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

const regionDots = (a, b, c, d, n) => { const r = []; for (let i = 0; i < n; i++) r.push([a + Math.random() * (b - a), c + Math.random() * (d - c)]); return r; };
const LAND = [
  ...regionDots(24, 50, -130, -68, 250), ...regionDots(50, 72, -142, -54, 80),
  ...regionDots(-56, 13, -83, -33, 170), ...regionDots(35, 62, -12, 44, 170),
  ...regionDots(60, 72, 4, 44, 45), ...regionDots(-37, 38, -22, 53, 200),
  ...regionDots(7, 57, 56, 143, 300), ...regionDots(54, 73, 56, 182, 90),
  ...regionDots(-43, -10, 111, 156, 100), ...regionDots(-3, 13, 93, 143, 70),
  ...regionDots(27, 47, 123, 147, 55), ...regionDots(60, 83, -75, -12, 40),
  ...regionDots(15, 30, -20, 60, 60), // Sahara/Middle East fill
  ...regionDots(-10, 5, 25, 42, 40), // Central Africa fill
];

// Simplified world coastlines and borders
const GEO_LINES = [
  {n:"north_america",t:"coast",p:[[71,-168],[70,-141],[60,-140],[59,-135],[55,-130],[49,-125],[45,-124],[40,-124],[35,-120],[33,-117],[30,-115],[28,-112],[25,-110],[23,-106],[20,-105],[16,-96],[15,-88],[18,-88],[21,-87],[21,-90],[29,-90],[30,-85],[25,-80],[27,-80],[30,-81],[32,-80],[35,-75],[37,-76],[39,-74],[41,-72],[42,-71],[43,-70],[44,-68],[46,-67],[47,-64],[44,-64],[46,-60],[48,-53],[52,-55],[55,-60],[60,-64],[59,-78],[63,-82],[60,-95],[64,-96],[68,-110],[70,-128],[71,-156],[71,-168]]},
  {n:"south_america",t:"coast",p:[[12,-72],[10,-76],[8,-77],[4,-77],[0,-80],[-2,-81],[-5,-81],[-6,-77],[-14,-76],[-16,-75],[-18,-71],[-23,-70],[-27,-71],[-33,-72],[-42,-74],[-46,-76],[-52,-75],[-55,-68],[-55,-64],[-52,-69],[-48,-66],[-42,-65],[-38,-57],[-35,-57],[-33,-53],[-28,-49],[-25,-48],[-23,-44],[-22,-41],[-13,-39],[-10,-37],[-6,-35],[-2,-44],[0,-50],[2,-52],[5,-52],[7,-60],[8,-62],[10,-62],[11,-72],[12,-72]]},
  {n:"europe",t:"coast",p:[[71,28],[70,32],[68,40],[66,34],[64,28],[60,25],[60,22],[56,14],[55,8],[54,6],[53,4],[51,3],[49,-1],[48,-5],[43,-9],[37,-9],[36,-6],[37,-2],[38,0],[41,2],[43,3],[43,6],[44,8],[40,14],[39,16],[37,22],[35,24],[36,28],[38,27],[41,29],[43,28],[45,14],[44,12],[46,7],[47,10],[48,16],[51,14],[54,14],[55,20],[56,18],[58,12],[59,5],[63,5],[68,16],[70,20],[71,28]]},
  {n:"africa",t:"coast",p:[[37,10],[35,0],[32,-5],[28,-13],[21,-17],[15,-17],[12,-17],[5,-4],[5,2],[6,10],[-1,9],[-6,12],[-12,14],[-17,12],[-23,14],[-28,16],[-33,18],[-35,20],[-34,26],[-30,31],[-26,33],[-15,41],[-11,44],[-2,41],[2,42],[5,44],[10,42],[12,45],[15,42],[20,37],[23,36],[25,34],[30,33],[32,32],[33,35],[37,10]]},
  {n:"asia",t:"coast",p:[[42,30],[41,40],[37,40],[30,48],[25,55],[20,59],[13,44],[12,45],[8,50],[0,104],[-2,106],[-7,106],[-8,110],[-8,115],[1,104],[2,103],[7,100],[10,99],[14,100],[20,106],[21,108],[22,114],[25,120],[30,122],[32,132],[35,130],[38,120],[40,118],[41,122],[45,133],[47,135],[50,140],[54,137],[55,141],[59,143],[62,150],[66,170],[68,180],[72,180],[72,130],[68,90],[58,70],[55,55],[50,54],[46,50],[42,44],[42,30]]},
  {n:"australia",t:"coast",p:[[-12,130],[-14,127],[-18,122],[-22,114],[-28,114],[-32,116],[-35,117],[-35,137],[-38,141],[-39,146],[-43,147],[-43,148],[-38,148],[-35,151],[-33,152],[-28,153],[-24,151],[-19,147],[-16,146],[-14,136],[-12,130]]},
  {n:"nz_north",t:"coast",p:[[-34,173],[-37,175],[-39,178],[-41,175],[-38,174],[-36,174],[-34,173]]},
  {n:"nz_south",t:"coast",p:[[-41,174],[-42,172],[-44,169],[-46,166],[-47,168],[-46,170],[-44,172],[-42,174],[-41,174]]},
  {n:"greenland",t:"coast",p:[[76,-18],[78,-20],[80,-22],[82,-30],[83,-40],[82,-50],[80,-62],[78,-70],[76,-72],[72,-56],[68,-50],[66,-44],[64,-42],[62,-44],[60,-44],[60,-48],[64,-52],[68,-54],[72,-56],[76,-68],[80,-65],[84,-45],[84,-30],[82,-20],[80,-15],[77,-18],[76,-18]]},
  {n:"madagascar",t:"coast",p:[[-12,49],[-16,44],[-22,43],[-25,47],[-22,48],[-17,50],[-12,49]]},
  {n:"japan",t:"coast",p:[[35,133],[36,136],[37,137],[38,140],[40,140],[41,141],[40,140],[38,139],[37,137],[35,137],[34,132],[33,131],[34,130],[35,133]]},
  {n:"uk",t:"coast",p:[[50,-5],[51,1],[53,0],[55,-2],[58,-3],[58,-5],[57,-6],[55,-5],[54,-3],[53,-4],[52,-4],[51,-3],[50,-5]]},
  {n:"iceland",t:"coast",p:[[64,-22],[65,-18],[66,-14],[66,-18],[65,-22],[64,-24],[64,-22]]},
  {n:"indonesia",t:"coast",p:[[6,95],[2,99],[-1,100],[-3,104],[-5,105],[-6,106],[-3,106],[0,104],[3,99],[6,95]]},
  {n:"borneo",t:"coast",p:[[7,117],[4,115],[1,110],[-1,109],[-3,111],[-2,117],[1,118],[4,118],[7,117]]},
  {n:"philippines",t:"coast",p:[[18,121],[15,121],[14,124],[11,125],[8,124],[7,126],[10,126],[13,124],[16,122],[18,121]]},
  {n:"cuba",t:"coast",p:[[22,-84],[23,-82],[22,-79],[20,-77],[21,-78],[22,-80],[22,-84]]},
  {n:"sri_lanka",t:"coast",p:[[10,80],[8,80],[7,80],[6,81],[7,82],[10,80]]},
  {n:"taiwan",t:"coast",p:[[25,121],[23,120],[22,121],[25,122],[25,121]]},
  {n:"us_canada",t:"border",p:[[49,-123],[49,-95],[47,-85],[46,-82],[43,-79],[44,-76],[45,-72],[47,-67]]},
  {n:"us_mexico",t:"border",p:[[32,-117],[32,-111],[31,-108],[30,-105],[29,-103],[26,-99],[26,-97]]},
  {n:"india",t:"border",p:[[35,74],[28,70],[24,69],[23,68],[21,69],[18,73],[8,77],[10,80]]},
  {n:"china_russia",t:"border",p:[[42,130],[45,133],[49,135],[53,134],[55,130],[58,120],[55,100],[50,87],[46,82],[44,80]]},
  {n:"europe_internal",t:"border",p:[[42,-2],[43,0],[46,6],[47,7],[47,13],[50,14],[52,14],[54,14],[55,10]]},
];

// 328 world cities
// 495 world cities
const CITIES = [
  ["New York City","USA",40.7128,-74.006],["Los Angeles","USA",34.0522,-118.2437],["Chicago","USA",41.8781,-87.6298],
  ["Houston","USA",29.7604,-95.3698],["Phoenix","USA",33.4484,-112.074],["Philadelphia","USA",39.9526,-75.1652],
  ["San Antonio","USA",29.4241,-98.4936],["San Diego","USA",32.7157,-117.1611],["Dallas","USA",32.7767,-96.797],
  ["San Jose","USA",37.3382,-121.8863],["Austin","USA",30.2672,-97.7431],["Jacksonville","USA",30.3322,-81.6557],
  ["Fort Worth","USA",32.7555,-97.3308],["Columbus","USA",39.9612,-82.9988],["Charlotte","USA",35.2271,-80.8431],
  ["San Francisco","USA",37.7749,-122.4194],["Indianapolis","USA",39.7684,-86.1581],["Seattle","USA",47.6062,-122.3321],
  ["Denver","USA",39.7392,-104.9903],["Washington DC","USA",38.9072,-77.0369],["Nashville","USA",36.1627,-86.7816],
  ["Oklahoma City","USA",35.4676,-97.5164],["El Paso","USA",31.7619,-106.485],["Boston","USA",42.3601,-71.0589],
  ["Portland","USA",45.5152,-122.6784],["Las Vegas","USA",36.1699,-115.1398],["Memphis","USA",35.1495,-90.049],
  ["Louisville","USA",38.2527,-85.7585],["Baltimore","USA",39.2904,-76.6122],["Milwaukee","USA",43.0389,-87.9065],
  ["Albuquerque","USA",35.0844,-106.6504],["Tucson","USA",32.2226,-110.9747],["Fresno","USA",36.7378,-119.7871],
  ["Sacramento","USA",38.5816,-121.4944],["Mesa","USA",33.4152,-111.8315],["Kansas City","USA",39.0997,-94.5786],
  ["Atlanta","USA",33.749,-84.388],["Omaha","USA",41.2565,-95.9345],["Colorado Springs","USA",38.8339,-104.8214],
  ["Raleigh","USA",35.7796,-78.6382],["Long Beach","USA",33.7701,-118.1937],["Virginia Beach","USA",36.8529,-75.978],
  ["Miami","USA",25.7617,-80.1918],["Oakland","USA",37.8044,-122.2712],["Minneapolis","USA",44.9778,-93.265],
  ["Tampa","USA",27.9506,-82.4572],["New Orleans","USA",29.9511,-90.0715],["Cleveland","USA",41.4993,-81.6944],
  ["Pittsburgh","USA",40.4406,-79.9959],["Cincinnati","USA",39.1031,-84.512],["St. Louis","USA",38.627,-90.1994],
  ["Orlando","USA",28.5383,-81.3792],["Detroit","USA",42.3314,-83.0458],["Richmond","USA",37.5407,-77.436],
  ["Savannah","USA",32.0809,-81.0912],["Charleston","USA",32.7765,-79.9311],["Salt Lake City","USA",40.7608,-111.891],
  ["Boise","USA",43.615,-116.2023],["Anchorage","USA",61.2181,-149.9003],["Honolulu","USA",21.3069,-157.8583],
  ["Maui","USA",20.7984,-156.3319],["Kauai","USA",22.0964,-159.5261],["Big Island Hawaii","USA",19.707,-155.085],
  ["Santa Fe","USA",35.687,-105.9378],["Aspen","USA",39.1911,-106.8175],["Key West","USA",24.5551,-81.78],
  ["Napa Valley","USA",38.2975,-122.2869],["Palm Springs","USA",33.8303,-116.5453],["Jackson Hole","USA",43.4799,-110.7624],
  ["Lake Tahoe","USA",39.0968,-120.0324],["Santa Barbara","USA",34.4208,-119.6982],["Sedona","USA",34.8697,-111.761],
  ["Park City","USA",40.6461,-111.498],["Fort Lauderdale","USA",26.1224,-80.1373],["Monterey","USA",36.6002,-121.8947],
  ["Scottsdale","USA",33.4942,-111.9261],["Burlington","USA",44.4759,-73.2121],["Asheville","USA",35.5951,-82.5515],
  ["Madison","USA",43.0731,-89.4012],["Ann Arbor","USA",42.2808,-83.743],["Boulder","USA",40.015,-105.2705],
  ["Providence","USA",41.824,-71.4128],["Spokane","USA",47.6588,-117.426],["San Juan","Puerto Rico",18.4655,-66.1057],
  ["Bend","USA",44.0582,-121.3153],["Reno","USA",39.5296,-119.8138],["Sarasota","USA",27.3364,-82.5307],
  ["St. Petersburg FL","USA",27.7676,-82.6403],["Knoxville","USA",35.9606,-83.9207],["Chattanooga","USA",35.0456,-85.3097],
  ["Birmingham","USA",33.5207,-86.8025],["Tulsa","USA",36.154,-95.9928],["Norfolk","USA",36.8508,-76.2859],
  ["Lexington","USA",38.0406,-84.5037],["Greenville","USA",34.8526,-82.394],["Columbia SC","USA",34.0007,-81.0348],
  ["Wilmington NC","USA",34.2257,-77.9447],["Santa Cruz","USA",36.9741,-122.0308],["Eugene","USA",44.0521,-123.0868],
  ["Tacoma","USA",47.2529,-122.4443],["Santa Monica","USA",34.0195,-118.4912],["Venice Beach","USA",33.985,-118.469],
  ["Malibu","USA",34.0259,-118.7798],["La Jolla","USA",32.8328,-117.2713],["Carmel","USA",36.5553,-121.9233],
  ["Nantucket","USA",41.2835,-70.0995],["Martha's Vineyard","USA",41.3805,-70.6455],["Cape Cod","USA",41.6688,-70.2962],
  ["Bar Harbor","USA",44.3876,-68.2039],["Hilton Head","USA",32.2163,-80.7526],["Outer Banks","USA",35.9582,-75.6241],
  ["Moab","USA",38.5733,-109.5498],["Yellowstone","USA",44.428,-110.5885],["Grand Canyon","USA",36.1069,-112.1129],
  ["Yosemite","USA",37.8651,-119.5383],["Glacier National Park","USA",48.7596,-113.787],["Zion","USA",37.2982,-113.0263],
  ["Joshua Tree","USA",33.8734,-115.901],["Toronto","Canada",43.6532,-79.3832],["Vancouver","Canada",49.2827,-123.1207],
  ["Montréal","Canada",45.5017,-73.5673],["Calgary","Canada",51.0447,-114.0719],["Ottawa","Canada",45.4215,-75.6972],
  ["Edmonton","Canada",53.5461,-113.4938],["Winnipeg","Canada",49.8951,-97.1384],["Québec City","Canada",46.8139,-71.208],
  ["Halifax","Canada",44.6488,-63.5752],["Victoria","Canada",48.4284,-123.3656],["Whistler","Canada",50.1163,-122.9574],
  ["Banff","Canada",51.1784,-115.5708],["Jasper","Canada",52.8737,-117.0814],["Kelowna","Canada",49.888,-119.4961],
  ["Tofino","Canada",49.1529,-125.9066],["St. John's","Canada",47.5615,-52.7126],["Niagara Falls","Canada",43.0896,-79.0849],
  ["Prince Edward Island","Canada",46.2382,-63.1311],["Mexico City","Mexico",19.4326,-99.1332],["Cancún","Mexico",21.1619,-86.8515],
  ["Guadalajara","Mexico",20.6597,-103.3496],["Monterrey","Mexico",25.6866,-100.3161],["Playa del Carmen","Mexico",20.6296,-87.0739],
  ["Tulum","Mexico",20.2115,-87.4653],["Puerto Vallarta","Mexico",20.6534,-105.2253],["Oaxaca","Mexico",17.0732,-96.7266],
  ["San Miguel de Allende","Mexico",20.9144,-100.7452],["Cabo San Lucas","Mexico",22.8905,-109.9167],["Mérida","Mexico",20.9674,-89.6243],
  ["Puebla","Mexico",19.0414,-98.2063],["Sayulita","Mexico",20.8691,-105.4421],["Guanajuato","Mexico",21.019,-101.2574],
  ["Guatemala City","Guatemala",14.6349,-90.5069],["Antigua Guatemala","Guatemala",14.5586,-90.7295],["San José","Costa Rica",9.9281,-84.0907],
  ["Monteverde","Costa Rica",10.3153,-84.8257],["Manuel Antonio","Costa Rica",9.3927,-84.1367],["Tamarindo","Costa Rica",10.2996,-85.8373],
  ["Panama City","Panama",8.9824,-79.5199],["Bocas del Toro","Panama",9.3405,-82.2418],["Belize City","Belize",17.5046,-88.1962],
  ["San Pedro Belize","Belize",17.9211,-87.9601],["Roatán","Honduras",16.3306,-86.534],["Havana","Cuba",23.1136,-82.3666],
  ["Kingston","Jamaica",18.0179,-76.8099],["Montego Bay","Jamaica",18.4762,-77.8939],["Nassau","Bahamas",25.0343,-77.3963],
  ["Santo Domingo","Dominican Republic",18.4861,-69.9312],["Punta Cana","Dominican Republic",18.582,-68.4055],["Aruba","Aruba",12.5093,-69.9688],
  ["Barbados","Barbados",13.1939,-59.5432],["St. Lucia","St. Lucia",13.9094,-60.9789],["Curaçao","Curaçao",12.1696,-68.99],
  ["Turks and Caicos","Turks and Caicos",21.694,-71.7979],["St. Kitts","St. Kitts",17.346,-62.7559],["Bermuda","Bermuda",32.3078,-64.7505],
  ["São Paulo","Brazil",-23.5505,-46.6333],["Rio de Janeiro","Brazil",-22.9068,-43.1729],["Buenos Aires","Argentina",-34.6037,-58.3816],
  ["Lima","Peru",-12.0464,-77.0428],["Bogotá","Colombia",4.711,-74.0721],["Santiago","Chile",-33.4489,-70.6693],
  ["Medellín","Colombia",6.2442,-75.5812],["Cartagena","Colombia",10.391,-75.5144],["Cusco","Peru",-13.532,-71.9675],
  ["Machu Picchu","Peru",-13.1631,-72.545],["Quito","Ecuador",-0.1807,-78.4678],["Montevideo","Uruguay",-34.9011,-56.1645],
  ["La Paz","Bolivia",-16.5,-68.15],["Galápagos Islands","Ecuador",-0.9538,-90.9656],["Patagonia","Argentina",-41.8101,-68.9063],
  ["Salvador","Brazil",-12.9714,-38.5124],["Florianópolis","Brazil",-27.5954,-48.548],["Bariloche","Argentina",-41.1335,-71.3103],
  ["Valparaíso","Chile",-33.0472,-71.6127],["Iguazu Falls","Argentina",-25.6953,-54.4367],["Uyuni","Bolivia",-20.4606,-66.8261],
  ["Torres del Paine","Chile",-51.2533,-72.3483],["Cali","Colombia",3.4516,-76.532],["Santa Marta","Colombia",11.2408,-74.199],
  ["Manaus","Brazil",-3.119,-60.0217],["Atacama","Chile",-23.6509,-68.1591],["London","UK",51.5074,-0.1278],
  ["Edinburgh","UK",55.9533,-3.1883],["Manchester","UK",53.4808,-2.2426],["Liverpool","UK",53.4084,-2.9916],
  ["Glasgow","UK",55.8642,-4.2518],["Belfast","UK",54.5973,-5.9301],["Dublin","Ireland",53.3498,-6.2603],
  ["Galway","Ireland",53.2707,-9.0568],["Cork","Ireland",51.8985,-8.4756],["Bath","UK",51.3811,-2.359],
  ["Oxford","UK",51.752,-1.2577],["Cambridge","UK",52.2053,0.1218],["Brighton","UK",50.8225,-0.1372],
  ["Bristol","UK",51.4545,-2.5879],["York","UK",53.9591,-1.0815],["Inverness","UK",57.4778,-4.2247],
  ["Isle of Skye","UK",57.2736,-6.2153],["Cotswolds","UK",51.8286,-1.6926],["Killarney","Ireland",52.0599,-9.5044],
  ["Dingle","Ireland",52.1409,-10.2686],["Paris","France",48.8566,2.3522],["Nice","France",43.7102,7.262],
  ["Lyon","France",45.764,4.8357],["Marseille","France",43.2965,5.3698],["Bordeaux","France",44.8378,-0.5792],
  ["Provence","France",43.9493,6.0679],["Strasbourg","France",48.5734,7.7521],["Toulouse","France",43.6047,1.4442],
  ["Cannes","France",43.5528,7.0174],["Mont Saint-Michel","France",48.636,-1.5115],["Chamonix","France",45.9237,6.8694],
  ["Annecy","France",45.8992,6.1294],["Avignon","France",43.9493,4.8055],["Colmar","France",48.0794,7.3586],
  ["Rome","Italy",41.9028,12.4964],["Milan","Italy",45.4642,9.19],["Florence","Italy",43.7696,11.2558],
  ["Venice","Italy",45.4408,12.3155],["Naples","Italy",40.8518,14.2681],["Bologna","Italy",44.4949,11.3426],
  ["Amalfi","Italy",40.634,14.6027],["Cinque Terre","Italy",44.1461,9.6439],["Lake Como","Italy",45.9983,9.2572],
  ["Tuscany","Italy",43.7711,11.2486],["Positano","Italy",40.6281,14.485],["Ravello","Italy",40.6492,14.6114],
  ["Capri","Italy",40.5532,14.2222],["Siena","Italy",43.3188,11.3308],["Verona","Italy",45.4384,10.9916],
  ["Turin","Italy",45.0703,7.6869],["Palermo","Italy",38.1157,13.3615],["Sardinia","Italy",40.1209,9.0129],
  ["Lake Garda","Italy",45.6494,10.6352],["Sorrento","Italy",40.6263,14.3758],["Barcelona","Spain",41.3874,2.1686],
  ["Madrid","Spain",40.4168,-3.7038],["Seville","Spain",37.3891,-5.9845],["Granada","Spain",37.1773,-3.5986],
  ["Valencia","Spain",39.4699,-0.3763],["Málaga","Spain",36.7213,-4.4214],["Ibiza","Spain",38.9067,1.4206],
  ["Mallorca","Spain",39.6953,3.0176],["San Sebastián","Spain",43.3183,-1.9812],["Bilbao","Spain",43.263,-2.935],
  ["Tenerife","Spain",28.2916,-16.6291],["Marbella","Spain",36.5099,-4.8866],["Salamanca","Spain",40.9701,-5.6635],
  ["Toledo","Spain",39.8628,-4.0273],["Lisbon","Portugal",38.7223,-9.1393],["Porto","Portugal",41.1579,-8.6291],
  ["Algarve","Portugal",37.0179,-7.9304],["Madeira","Portugal",32.6669,-16.9241],["Azores","Portugal",37.7833,-25.5],
  ["Sintra","Portugal",38.7981,-9.3882],["Berlin","Germany",52.52,13.405],["Munich","Germany",48.1351,11.582],
  ["Hamburg","Germany",53.5511,9.9937],["Frankfurt","Germany",50.1109,8.6821],["Cologne","Germany",50.9375,6.9603],
  ["Dresden","Germany",51.0504,13.7373],["Heidelberg","Germany",49.3988,8.6724],["Rothenburg","Germany",49.3769,10.1789],
  ["Baden-Baden","Germany",48.7651,8.2401],["Nuremberg","Germany",49.4521,11.0767],["Amsterdam","Netherlands",52.3676,4.9041],
  ["Brussels","Belgium",50.8503,4.3517],["Bruges","Belgium",51.2093,3.2247],["Ghent","Belgium",51.0543,3.7174],
  ["Zürich","Switzerland",47.3769,8.5417],["Geneva","Switzerland",46.2044,6.1432],["Interlaken","Switzerland",46.6863,7.8632],
  ["Lucerne","Switzerland",47.0502,8.3093],["Zermatt","Switzerland",46.0207,7.7491],["Luxembourg","Luxembourg",49.6117,6.13],
  ["Rotterdam","Netherlands",51.9225,4.4792],["The Hague","Netherlands",52.0705,4.3007],["Utrecht","Netherlands",52.0907,5.1214],
  ["Bern","Switzerland",46.948,7.4474],["Copenhagen","Denmark",55.6761,12.5683],["Stockholm","Sweden",59.3293,18.0686],
  ["Oslo","Norway",59.9139,10.7522],["Helsinki","Finland",60.1699,24.9384],["Bergen","Norway",60.3913,5.3221],
  ["Tromsø","Norway",69.6492,18.9553],["Lofoten","Norway",68.2094,14.1534],["Gothenburg","Sweden",57.7089,11.9746],
  ["Malmö","Sweden",55.604,13.004],["Rovaniemi","Finland",66.5039,25.7294],["Reykjavik","Iceland",64.1466,-21.9426],
  ["Blue Lagoon Iceland","Iceland",63.8804,-22.4495],["Prague","Czech Republic",50.0755,14.4378],["Budapest","Hungary",47.4979,19.0402],
  ["Warsaw","Poland",52.2297,21.0122],["Kraków","Poland",50.0647,19.945],["Vienna","Austria",48.2082,16.3738],
  ["Salzburg","Austria",47.8095,13.055],["Hallstatt","Austria",47.5622,13.6493],["Innsbruck","Austria",47.2692,11.4041],
  ["Athens","Greece",37.9838,23.7275],["Santorini","Greece",36.3932,25.4615],["Mykonos","Greece",37.4467,25.3289],
  ["Crete","Greece",35.2401,24.4709],["Corfu","Greece",39.6243,19.9217],["Rhodes","Greece",36.4349,28.2176],
  ["Istanbul","Turkey",41.0082,28.9784],["Cappadocia","Turkey",38.6431,34.8289],["Antalya","Turkey",36.8969,30.7133],
  ["Bodrum","Turkey",37.0344,27.4305],["Dubrovnik","Croatia",42.6507,18.0944],["Split","Croatia",43.5081,16.4402],
  ["Hvar","Croatia",43.1729,16.4411],["Plitvice Lakes","Croatia",44.8654,15.582],["Kotor","Montenegro",42.4247,18.7712],
  ["Belgrade","Serbia",44.7866,20.4489],["Bucharest","Romania",44.4268,26.1025],["Sofia","Bulgaria",42.6977,23.3219],
  ["Tallinn","Estonia",59.437,24.7536],["Riga","Latvia",56.9496,24.1052],["Vilnius","Lithuania",54.6872,25.2797],
  ["Ljubljana","Slovenia",46.0569,14.5058],["Lake Bled","Slovenia",46.3639,14.094],["Bratislava","Slovakia",48.1486,17.1077],
  ["Malta","Malta",35.8989,14.5146],["Cyprus","Cyprus",35.1264,33.4299],["Mostar","Bosnia",43.3438,17.8078],
  ["Tirana","Albania",41.3275,19.8187],["Monaco","Monaco",43.7384,7.4246],["Moscow","Russia",55.7558,37.6173],
  ["St. Petersburg","Russia",59.9343,30.3351],["Cape Town","South Africa",-33.9249,18.4241],["Johannesburg","South Africa",-26.2041,28.0473],
  ["Cairo","Egypt",30.0444,31.2357],["Marrakech","Morocco",31.6295,-7.9811],["Casablanca","Morocco",33.5731,-7.5898],
  ["Nairobi","Kenya",-1.2921,36.8219],["Lagos","Nigeria",6.5244,3.3792],["Accra","Ghana",5.6037,-0.187],
  ["Addis Ababa","Ethiopia",9.02,38.7469],["Zanzibar","Tanzania",-6.1659,39.199],["Dar es Salaam","Tanzania",-6.7924,39.2083],
  ["Victoria Falls","Zimbabwe",-17.9243,25.8572],["Serengeti","Tanzania",-2.3333,34.8333],["Luxor","Egypt",25.6872,32.6396],
  ["Fez","Morocco",34.0181,-5.0078],["Tunis","Tunisia",36.8065,10.1815],["Dakar","Senegal",14.7167,-17.4677],
  ["Windhoek","Namibia",-22.5609,17.0658],["Kruger Park","South Africa",-23.9884,31.5547],["Mauritius","Mauritius",-20.3484,57.5522],
  ["Seychelles","Seychelles",-4.6796,55.492],["Kigali","Rwanda",-1.9403,29.8739],["Essaouira","Morocco",31.5085,-9.7595],
  ["Chefchaouen","Morocco",35.1688,-5.2636],["Kilimanjaro","Tanzania",-3.0674,37.3556],["Masai Mara","Kenya",-1.4061,35.0],
  ["Stone Town","Tanzania",-6.1622,39.187],["Sossusvlei","Namibia",-24.7275,15.3394],["Garden Route","South Africa",-33.9614,22.4614],
  ["Stellenbosch","South Africa",-33.9321,18.8602],["Dubai","UAE",25.2048,55.2708],["Abu Dhabi","UAE",24.4539,54.3773],
  ["Doha","Qatar",25.2854,51.531],["Tel Aviv","Israel",32.0853,34.7818],["Jerusalem","Israel",31.7683,35.2137],
  ["Amman","Jordan",31.9454,35.9284],["Petra","Jordan",30.3285,35.4444],["Muscat","Oman",23.588,58.3829],
  ["Beirut","Lebanon",33.8938,35.5018],["Riyadh","Saudi Arabia",24.7136,46.6753],["Dead Sea","Jordan",31.5,35.5],
  ["Wadi Rum","Jordan",29.5321,35.4132],["Tokyo","Japan",35.6762,139.6503],["Osaka","Japan",34.6937,135.5023],
  ["Kyoto","Japan",35.0116,135.7681],["Seoul","South Korea",37.5665,126.978],["Beijing","China",39.9042,116.4074],
  ["Shanghai","China",31.2304,121.4737],["Hong Kong","China",22.3193,114.1694],["Taipei","Taiwan",25.033,121.5654],
  ["Busan","South Korea",35.1796,129.0756],["Hiroshima","Japan",34.3853,132.4553],["Nara","Japan",34.6851,135.8048],
  ["Okinawa","Japan",26.3344,127.8056],["Hakone","Japan",35.2326,139.107],["Sapporo","Japan",43.0618,141.3545],
  ["Fukuoka","Japan",33.5904,130.4017],["Guangzhou","China",23.1291,113.2644],["Shenzhen","China",22.5431,114.058],
  ["Chengdu","China",30.5728,104.0668],["Xi'an","China",34.3416,108.9398],["Guilin","China",25.2742,110.29],
  ["Macau","China",22.1987,113.5439],["Kaohsiung","Taiwan",22.6273,120.3014],["Jeju Island","South Korea",33.4996,126.5312],
  ["Takayama","Japan",36.146,137.2522],["Kamakura","Japan",35.3192,139.5467],["Nikko","Japan",36.7198,139.6982],
  ["Kanazawa","Japan",36.5613,136.6562],["Bangkok","Thailand",13.7563,100.5018],["Singapore","Singapore",1.3521,103.8198],
  ["Bali","Indonesia",-8.3405,115.092],["Hanoi","Vietnam",21.0278,105.8342],["Ho Chi Minh City","Vietnam",10.8231,106.6297],
  ["Kuala Lumpur","Malaysia",3.139,101.6869],["Jakarta","Indonesia",-6.2088,106.8456],["Manila","Philippines",14.5995,120.9842],
  ["Phnom Penh","Cambodia",11.5564,104.9282],["Siem Reap","Cambodia",13.3671,103.8448],["Chiang Mai","Thailand",18.7883,98.9853],
  ["Phuket","Thailand",7.8804,98.3923],["Koh Samui","Thailand",9.5121,100.0134],["Luang Prabang","Laos",19.8856,102.1347],
  ["Yangon","Myanmar",16.8661,96.1951],["Ubud","Indonesia",-8.5069,115.2625],["Yogyakarta","Indonesia",-7.7956,110.3695],
  ["Da Nang","Vietnam",16.0544,108.2022],["Hoi An","Vietnam",15.8801,108.338],["Penang","Malaysia",5.4164,100.3327],
  ["Langkawi","Malaysia",6.35,99.8],["Boracay","Philippines",11.9674,121.9248],["Palawan","Philippines",9.8349,118.7384],
  ["Koh Phi Phi","Thailand",7.7407,98.7784],["Koh Lanta","Thailand",7.6501,99.0299],["Pai","Thailand",19.3593,98.4421],
  ["Krabi","Thailand",8.0863,98.9063],["Vientiane","Laos",17.9757,102.6331],["Ha Long Bay","Vietnam",20.9101,107.1839],
  ["Nha Trang","Vietnam",12.2388,109.1967],["Lombok","Indonesia",-8.6505,116.3249],["Komodo","Indonesia",-8.5463,119.4884],
  ["El Nido","Philippines",11.1789,119.3929],["Delhi","India",28.7041,77.1025],["Mumbai","India",19.076,72.8777],
  ["Bangalore","India",12.9716,77.5946],["Jaipur","India",26.9124,75.7873],["Goa","India",15.2993,74.124],
  ["Agra","India",27.1767,78.0081],["Varanasi","India",25.3176,83.0064],["Kerala","India",10.8505,76.2711],
  ["Colombo","Sri Lanka",6.9271,79.8612],["Kathmandu","Nepal",27.7172,85.324],["Dhaka","Bangladesh",23.8103,90.4125],
  ["Maldives","Maldives",3.2028,73.2207],["Lhasa","Tibet",29.65,91.1],["Udaipur","India",24.5854,73.7125],
  ["Rishikesh","India",30.0869,78.2676],["Darjeeling","India",27.041,88.2663],["Ella","Sri Lanka",6.8667,81.0466],
  ["Kandy","Sri Lanka",7.2906,80.6337],["Pokhara","Nepal",28.2096,83.9856],["Sydney","Australia",-33.8688,151.2093],
  ["Melbourne","Australia",-37.8136,144.9631],["Brisbane","Australia",-27.4698,153.0251],["Perth","Australia",-31.9505,115.8605],
  ["Adelaide","Australia",-34.9285,138.6007],["Auckland","New Zealand",-36.8485,174.7633],["Queenstown","New Zealand",-45.0312,168.6626],
  ["Christchurch","New Zealand",-43.532,172.6306],["Wellington","New Zealand",-41.2865,174.7762],["Gold Coast","Australia",-28.0167,153.4],
  ["Cairns","Australia",-16.9186,145.7781],["Great Barrier Reef","Australia",-18.2871,147.6992],["Fiji","Fiji",-17.7134,178.065],
  ["Tahiti","French Polynesia",-17.6509,-149.426],["Bora Bora","French Polynesia",-16.5004,-151.7415],["Tasmania","Australia",-42.0409,146.8087],
  ["Darwin","Australia",-12.4634,130.8456],["Uluru","Australia",-25.3444,131.0369],["Byron Bay","Australia",-28.6474,153.612],
  ["Noosa","Australia",-26.3889,153.0914],["Rotorua","New Zealand",-38.1368,176.2497],["Milford Sound","New Zealand",-44.6141,167.8984],
  ["Hobbiton","New Zealand",-37.8721,175.6827],["Samoa","Samoa",-13.759,-172.1046],["Rarotonga","Cook Islands",-21.2367,-159.7777]
];



// ---- REDUCER (with Supabase persistence) ----
function reducer(st, a) {
  let next = st;
  switch (a.type) {
    case "LOAD": return { ...st, entries: a.entries };
    case "ADD":
      next = { ...st, entries: [...st.entries, a.entry] };
      saveEntry(a.entry);
      break;
    case "UPDATE":
      next = { ...st, entries: st.entries.map(e => e.id === a.id ? { ...e, ...a.data } : e) };
      { const updated = next.entries.find(e => e.id === a.id); if (updated) saveEntry(updated); }
      break;
    case "DELETE":
      next = { ...st, entries: st.entries.filter(e => e.id !== a.id) };
      deleteEntry(a.id);
      break;
    case "ADD_PHOTOS":
      next = { ...st, entries: st.entries.map(e => e.id === a.id ? { ...e, photos: [...(e.photos || []), ...a.urls] } : e) };
      { const updated = next.entries.find(e => e.id === a.id); if (updated) saveEntry(updated); }
      break;
    default: return st;
  }
  return next;
}

// ---- SEASONAL TINT ----
function seasonalHue(dateStr) {
  const m = new Date(dateStr + "T12:00:00").getMonth();
  if (m >= 4 && m <= 8) return { glow: "#f5d0c0", particle: "#e0a888" }; // warm summer
  if (m >= 9 || m <= 1) return { glow: "#d0d8f0", particle: "#a0b0d4" }; // cool winter
  return { glow: "#e0d8c8", particle: "#c8b8a0" }; // neutral spring/fall
}

// ---- FIRST BADGES ----
function getFirstBadges(entries) {
  const badges = {};
  const together = entries.filter(e => e.who === "both").sort((a, b) => (a.dateStart || "").localeCompare(b.dateStart || ""));
  if (together.length > 0) badges[together[0].id] = "First time together";
  const countries = {};
  together.forEach(e => {
    if (e.country && !countries[e.country]) { countries[e.country] = e.id; }
    (e.stops || []).forEach(s => { if (s.country && !countries[s.country]) countries[s.country] = e.id; });
  });
  const international = together.find(e => e.country && e.country !== "USA");
  if (international) badges[international.id] = badges[international.id] || "First trip abroad together";
  // First Christmas
  together.forEach(e => {
    const ds = e.dateStart;
    if (ds && ds.slice(5) >= "12-20" && ds.slice(5) <= "12-31" && !Object.values(badges).includes("First Christmas together")) {
      badges[e.id] = "First Christmas together";
    }
  });
  return badges;
}

// ================================================================
// MAIN
// ================================================================
export default function OurWorld() {
  const [data, dispatch] = useReducer(reducer, { entries: [] });
  const [config, setConfigState] = useState(DEFAULT_CONFIG);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const [entries, cfg] = await Promise.all([loadEntries(), loadCfg()]);
        dispatch({ type: "LOAD", entries: entries || [] });
        if (cfg) setConfigState({ ...DEFAULT_CONFIG, ...cfg });
      } catch (err) {
        console.error("Failed to load from Supabase:", err);
      }
      setLoading(false);
    })();
  }, []);

  const setConfig = useCallback(partial => {
    setConfigState(prev => {
      const next = { ...prev, ...partial };
      saveCfg(next);
      return next;
    });
  }, []);

  // THREE refs
  const mountRef = useRef(null);
  const rendRef = useRef(null);
  const scnRef = useRef(null);
  const camRef = useRef(null);
  const globeRef = useRef(null);
  const mkRef = useRef([]);
  const rtRef = useRef([]);
  const rayRef = useRef(new THREE.Raycaster());
  const mRef = useRef(new THREE.Vector2());
  const frameRef = useRef(0);
  const heartRef = useRef(null);
  const glowLayersRef = useRef([]);
  const geoLinesRef = useRef([]);
  const particlesRef = useRef(null);

  const dragR = useRef(false);
  const prevR = useRef({ x: 0, y: 0 });
  const rot = useRef({ x: 0.25, y: -1.8 });
  const tRot = useRef({ x: 0.25, y: -1.8 });
  const zmR = useRef(8);
  const tZm = useRef(3.6);
  const spinSpd = useRef(0.001);
  const tSpinSpd = useRef(0.001);
  const clickSR = useRef({ x: 0, y: 0, t: 0 });
  const tDistR = useRef(0);

  const [selected, setSelected] = useState(null);
  const selectedRef = useRef(null);
  useEffect(() => { selectedRef.current = selected; }, [selected]);
  const [curZoom, setCurZoom] = useState(8);
  const [ready, setReady] = useState(false);
  const [introComplete, setIntroComplete] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [editing, setEditing] = useState(null);
  const [photoIdx, setPhotoIdx] = useState(0);
  const [showLetter, setShowLetter] = useState(false);
  const [editLetter, setEditLetter] = useState(false);
  const [letterDraft, setLetterDraft] = useState("");
  const [showSettings, setShowSettings] = useState(false);
  const [sliderDate, setSliderDate] = useState(todayStr());
  const [isAnimating, setIsAnimating] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [showGallery, setShowGallery] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const playRef = useRef(null);
  const animRef = useRef(null);

  const RAD = 1; const MIN_Z = 1.6; const MAX_Z = 6;

  // ---- DERIVED ----
  const sorted = useMemo(() => [...data.entries].sort((a, b) => (a.dateStart || "").localeCompare(b.dateStart || "")), [data.entries]);
  const togetherList = useMemo(() => sorted.filter(e => e.who === "both"), [sorted]);
  const firstBadges = useMemo(() => getFirstBadges(data.entries), [data.entries]);
  const season = useMemo(() => seasonalHue(sliderDate), [sliderDate]);

  // Anniversary check
  const isAnniversary = useMemo(() => {
    if (!config.startDate) return false;
    const sd = config.startDate.slice(5);
    const today = sliderDate.slice(5);
    return sd === today && sliderDate !== config.startDate;
  }, [sliderDate, config.startDate]);

  // Positions on slider date
  const getPositions = useCallback(date => {
    let seth = null, rosie = null, tog = null;
    for (let i = sorted.length - 1; i >= 0; i--) {
      const e = sorted[i];
      if (e.dateStart > date) continue;
      if (e.dateEnd && e.dateEnd < date) continue;
      if ((e.who === "seth" || e.who === "both") && !seth) { seth = { lat: e.lat, lng: e.lng, entry: e }; if (e.who === "both") tog = e; }
      if ((e.who === "rosie" || e.who === "both") && !rosie) { rosie = { lat: e.lat, lng: e.lng, entry: e }; if (e.who === "both") tog = e; }
      if (seth && rosie) break;
    }
    return { seth, rosie, together: tog };
  }, [sorted]);

  const pos = useMemo(() => getPositions(sliderDate), [sliderDate, getPositions]);
  const areTogether = !!pos.together;
  const dist = useMemo(() => {
    if (areTogether) return 0;
    if (pos.seth && pos.rosie) return haversine(pos.seth.lat, pos.seth.lng, pos.rosie.lat, pos.rosie.lng);
    return null;
  }, [pos, areTogether]);

  // Next together entry (for countdown)
  const nextTogether = useMemo(() => {
    return togetherList.find(e => e.dateStart > todayStr());
  }, [togetherList]);

  // Stats
  const stats = useMemo(() => {
    let daysTog = 0, totalMiles = 0;
    const countries = new Set();
    togetherList.forEach((e, i) => {
      const end = e.dateEnd || e.dateStart;
      daysTog += Math.max(1, daysBetween(e.dateStart, end));
      if (e.country) countries.add(e.country);
      (e.stops || []).forEach(s => { if (s.country) countries.add(s.country); });
      if (i > 0) {
        const prev = togetherList[i - 1];
        totalMiles += haversine(prev.lat, prev.lng, e.lat, e.lng);
      }
    });
    return { daysTog, countries: countries.size, trips: togetherList.length, totalMiles, photos: data.entries.reduce((s, e) => s + (e.photos || []).length, 0) };
  }, [data.entries, togetherList]);

  // Together entry count
  const togetherIndex = useCallback(id => {
    const idx = togetherList.findIndex(e => e.id === id);
    return idx >= 0 ? idx + 1 : null;
  }, [togetherList]);

  // ---- TIMELINE NAV ----
  const stepDay = useCallback(dir => {
    if (isAnimating) return;
    const next = addDays(sliderDate, dir);
    if (next < config.startDate || next > todayStr()) return;
    setSliderDate(next);
    tSpinSpd.current = 0.018;
    setTimeout(() => { tSpinSpd.current = 0.001; }, 350);
  }, [sliderDate, config.startDate, isAnimating]);

  const jumpNext = useCallback(dir => {
    if (isAnimating) return;
    const cands = dir > 0 ? togetherList.filter(e => e.dateStart > sliderDate) : [...togetherList].reverse().filter(e => e.dateStart < sliderDate);
    if (cands.length === 0) return;
    const target = cands[0];
    setIsAnimating(true);
    const totalD = Math.abs(daysBetween(sliderDate, target.dateStart));
    const duration = Math.min(2500, Math.max(1200, totalD * 2));
    let elapsed = 0;
    const startD = sliderDate;

    const anim = () => {
      elapsed += 16;
      const t = Math.min(elapsed / duration, 1);
      const eased = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
      setSliderDate(addDays(startD, Math.round(eased * totalD * dir)));
      const spinCurve = t < 0.5 ? t * 2 : (1 - t) * 2;
      tSpinSpd.current = 0.001 + spinCurve * 0.12;
      if (t < 1) { animRef.current = requestAnimationFrame(anim); }
      else {
        setSliderDate(target.dateStart);
        tSpinSpd.current = 0.001;
        setIsAnimating(false);
        const p = ll2v(target.lat, target.lng, RAD);
        tRot.current = { x: Math.asin(p.y / RAD) * 0.3, y: Math.atan2(-p.x, p.z) };
        tZm.current = 2.5;
        setTimeout(() => { setSelected(target); setPhotoIdx(0); }, 500);
      }
    };
    animRef.current = requestAnimationFrame(anim);
  }, [sliderDate, togetherList, isAnimating]);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = e => {
      if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA" || e.target.tagName === "SELECT") return;
      if (e.key === "ArrowLeft") { e.preventDefault(); stepDay(-1); }
      if (e.key === "ArrowRight") { e.preventDefault(); stepDay(1); }
      if (e.key === "Escape") { setSelected(null); setEditing(null); setShowAdd(false); setShowLetter(false); setShowSettings(false); setShowGallery(false); if (isPlaying) stopPlay(); }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [stepDay, isPlaying]);

  // ---- PLAY OUR STORY ----
  const stopPlay = useCallback(() => {
    setIsPlaying(false);
    if (playRef.current) { clearTimeout(playRef.current); playRef.current = null; }
    tSpinSpd.current = 0.001;
  }, []);

  const playStory = useCallback(() => {
    if (togetherList.length === 0 || isPlaying) return;
    setIsPlaying(true);
    setSelected(null);
    setShowGallery(false);
    let idx = 0;

    const step = () => {
      if (idx >= togetherList.length) { stopPlay(); return; }
      const entry = togetherList[idx];
      setSliderDate(entry.dateStart);

      // Fly to
      const p = ll2v(entry.lat, entry.lng, RAD);
      tRot.current = { x: Math.asin(p.y / RAD) * 0.3, y: Math.atan2(-p.x, p.z) };
      tZm.current = 2.4;
      tSpinSpd.current = 0.05;

      playRef.current = setTimeout(() => {
        tSpinSpd.current = 0.001;
        setSelected(entry);
        setPhotoIdx(0);

        playRef.current = setTimeout(() => {
          setSelected(null);
          idx++;
          if (idx < togetherList.length) {
            tSpinSpd.current = 0.07;
            tZm.current = 3.6;
            playRef.current = setTimeout(step, 900);
          } else { stopPlay(); }
        }, 4500);
      }, 1400);
    };
    step();
  }, [togetherList, isPlaying, stopPlay]);

  // ---- GALLERY DATA ----
  const allPhotos = useMemo(() => {
    const out = [];
    sorted.forEach(e => (e.photos || []).forEach((url, i) => out.push({ url, id: e.id, city: e.city, date: e.dateStart })));
    return out;
  }, [sorted]);

  // ---- EXPORT / IMPORT ----
  const exportData = useCallback(() => {
    const blob = new Blob([JSON.stringify({ data, config }, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = "our-world-backup.json"; a.click();
    URL.revokeObjectURL(url);
  }, [data, config]);

  const importData = useCallback(() => {
    const input = document.createElement("input"); input.type = "file"; input.accept = ".json";
    input.onchange = ev => {
      const file = ev.target.files[0]; if (!file) return;
      const reader = new FileReader();
      reader.onload = re => {
        try {
          const parsed = JSON.parse(re.target.result);
          if (parsed.data?.entries) {
            dispatch({ type: "LOAD", entries: parsed.data.entries });
            // Save each entry to Supabase
            parsed.data.entries.forEach(e => saveEntry(e));
          }
          if (parsed.config) { setConfig(parsed.config); }
        } catch (err) { console.error("Import failed:", err); }
      };
      reader.readAsText(file);
    };
    input.click();
  }, [setConfig]);

  // Photo slideshow
  useEffect(() => {
    if (!selected) return;
    const e = data.entries.find(en => en.id === selected.id);
    if (!e || (e.photos || []).length < 2) return;
    const iv = setInterval(() => setPhotoIdx(i => (i + 1) % e.photos.length), 4000);
    return () => clearInterval(iv);
  }, [selected, data.entries]);

  // ---- THREE SETUP ----
  useEffect(() => {
    if (!mountRef.current || loading) return;
    const el = mountRef.current;
    const w = el.clientWidth, h = el.clientHeight;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(P.cream);
    scnRef.current = scene;

    const cam = new THREE.PerspectiveCamera(45, w / h, 0.1, 100);
    cam.position.z = 8; // start far for fly-in
    camRef.current = cam;

    const rend = new THREE.WebGLRenderer({ antialias: true });
    rend.setSize(w, h); rend.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    el.appendChild(rend.domElement);
    rendRef.current = rend;

    scene.add(new THREE.AmbientLight("#fff8f0", 0.7));
    const sun = new THREE.DirectionalLight("#fffaf0", 0.95);
    sun.position.set(4, 3, 5); scene.add(sun);
    const fill = new THREE.DirectionalLight("#f0e0f5", 0.3);
    fill.position.set(-4, -2, -4); scene.add(fill);
    const rim = new THREE.PointLight("#fce4ec", 0.4, 10);
    rim.position.set(0, 4, 2); scene.add(rim);

    const globe = new THREE.Group();
    scene.add(globe);
    globeRef.current = globe;

    // Main sphere — opaque, writes to depth buffer to occlude far-side markers
    globe.add(new THREE.Mesh(
      new THREE.SphereGeometry(RAD, 96, 96),
      new THREE.MeshPhongMaterial({ color: "#ece6dc", emissive: "#3d2050", emissiveIntensity: 0.05, shininess: 25, transparent: false })
    ));

    // Glow layers — enhanced, dreamy, airy
    const glows = [
      { r: 1.02, color: "#d8b0e0", op: 0.16 },
      { r: 1.05, color: "#f0b8d0", op: 0.12 },
      { r: 1.09, color: "#fce0ec", op: 0.08 },
      { r: 1.14, color: "#f8d8e8", op: 0.06 },
      { r: 1.22, color: "#f5e8f0", op: 0.035 },
      { r: 1.32, color: "#faf0f4", op: 0.02 },
    ].map(({ r, color, op }) => {
      const m = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: op, side: THREE.BackSide });
      const mesh = new THREE.Mesh(new THREE.SphereGeometry(RAD * r, 48, 48), m);
      globe.add(mesh);
      return mesh;
    });
    glowLayersRef.current = glows;

    // Graticule — very subtle, almost invisible
    const gM = new THREE.LineBasicMaterial({ color: "#e8e2da", transparent: true, opacity: 0.03 });
    for (let lat = -60; lat <= 60; lat += 30) {
      const pts = []; for (let lng = -180; lng <= 180; lng += 4) pts.push(ll2v(lat, lng, RAD * 1.001));
      globe.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), gM));
    }
    for (let lng = -180; lng < 180; lng += 30) {
      const pts = []; for (let lat = -90; lat <= 90; lat += 4) pts.push(ll2v(lat, lng, RAD * 1.001));
      globe.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), gM));
    }

    // Land dots — varied sizes for more organic feel
    LAND.forEach(([lat, lng]) => {
      const p = ll2v(lat, lng, RAD * 1.002);
      const sz = 0.002 + Math.random() * 0.0025;
      const op = 0.2 + Math.random() * 0.25;
      const d = new THREE.Mesh(new THREE.CircleGeometry(sz, 5), new THREE.MeshBasicMaterial({ color: "#c8bfb0", transparent: true, opacity: op, side: THREE.DoubleSide }));
      d.position.copy(p); d.lookAt(p.clone().multiplyScalar(2)); globe.add(d);
    });

    // Geography lines — coastlines and borders, fade in on zoom
    const geoGroup = [];
    GEO_LINES.forEach(geo => {
      const pts = geo.p.map(c => ll2v(c[0], c[1], RAD * 1.003));
      const geom = new THREE.BufferGeometry().setFromPoints(pts);
      const isBorder = geo.t === "border";
      const mat = new THREE.LineBasicMaterial({
        color: isBorder ? "#c0b8a8" : "#b8a898",
        transparent: true,
        opacity: 0, // starts invisible, fades in on zoom
      });
      const line = new THREE.Line(geom, mat);
      line.renderOrder = -1;
      globe.add(line);
      geoGroup.push({ line, mat, isBorder });
    });
    geoLinesRef.current = geoGroup;

    // Particles — multi-layered, varied colors and sizes
    const pN = 350;
    const pG = new THREE.BufferGeometry();
    const pP = new Float32Array(pN * 3);
    for (let i = 0; i < pN; i++) { pP[i * 3] = (Math.random() - 0.5) * 16; pP[i * 3 + 1] = (Math.random() - 0.5) * 16; pP[i * 3 + 2] = (Math.random() - 0.5) * 16; }
    pG.setAttribute("position", new THREE.BufferAttribute(pP, 3));
    const pMat = new THREE.PointsMaterial({ color: P.roseSoft, size: 0.008, transparent: true, opacity: 0.15 });
    const particles = new THREE.Points(pG, pMat);
    scene.add(particles);
    particlesRef.current = particles;

    // Second particle layer — warmer/gold dust
    const p2N = 180;
    const p2G = new THREE.BufferGeometry();
    const p2P = new Float32Array(p2N * 3);
    for (let i = 0; i < p2N; i++) { p2P[i * 3] = (Math.random() - 0.5) * 12; p2P[i * 3 + 1] = (Math.random() - 0.5) * 12; p2P[i * 3 + 2] = (Math.random() - 0.5) * 12; }
    p2G.setAttribute("position", new THREE.BufferAttribute(p2P, 3));
    const p2Mat = new THREE.PointsMaterial({ color: P.goldWarm, size: 0.005, transparent: true, opacity: 0.1 });
    const particles2 = new THREE.Points(p2G, p2Mat);
    scene.add(particles2);

    // Heart mesh
    const hs = new THREE.Shape();
    hs.moveTo(0, -0.025); hs.bezierCurveTo(0, -0.025, -0.005, 0, -0.025, 0);
    hs.bezierCurveTo(-0.055, 0, -0.055, -0.035, -0.055, -0.035);
    hs.bezierCurveTo(-0.055, -0.055, -0.035, -0.077, 0, -0.1);
    hs.bezierCurveTo(0.035, -0.077, 0.055, -0.055, 0.055, -0.035);
    hs.bezierCurveTo(0.055, -0.035, 0.055, 0, 0.025, 0);
    hs.bezierCurveTo(0.005, 0, 0, -0.025, 0, -0.025);
    const hMat = new THREE.MeshBasicMaterial({ color: P.heart, transparent: true, opacity: 0, side: THREE.DoubleSide, depthTest: true });
    const hMesh = new THREE.Mesh(new THREE.ShapeGeometry(hs), hMat);
    hMesh.renderOrder = 10; hMesh.visible = false;
    globe.add(hMesh);
    heartRef.current = hMesh;

    // Fly-in animation
    tZm.current = 3.6;

    const animate = () => {
      frameRef.current = requestAnimationFrame(animate);
      spinSpd.current = lerp(spinSpd.current, tSpinSpd.current, 0.04);
      if (!dragR.current && !selectedRef.current) tRot.current.y += spinSpd.current;
      rot.current.x = lerp(rot.current.x, tRot.current.x, 0.05);
      rot.current.y = lerp(rot.current.y, tRot.current.y, 0.05);
      globe.rotation.x = rot.current.x;
      globe.rotation.y = rot.current.y;
      zmR.current = lerp(zmR.current, tZm.current, 0.03);
      cam.position.z = zmR.current;
      setCurZoom(zmR.current);

      // Pulse markers
      mkRef.current.forEach((m, i) => {
        const t = Date.now() * 0.003 + i * 0.8;
        if (m.ring) { const s = 1 + Math.sin(t) * 0.22; m.ring.scale.set(s, s, s); m.ring.material.opacity = 0.18 + Math.sin(t) * 0.12; }
        if (m.glow) m.glow.material.opacity = 0.07 + Math.sin(t * 0.6) * 0.04;
      });

      if (hMesh.visible) {
        const ht = Date.now() * 0.004;
        hMesh.scale.set(1 + Math.sin(ht) * 0.15, 1 + Math.sin(ht) * 0.15, 1);
        hMesh.material.opacity = 0.5 + Math.sin(ht * 0.7) * 0.2;
        // Billboard: counter globe rotation so heart always faces camera
        const invGlobe = new THREE.Quaternion().setFromEuler(globe.rotation).invert();
        hMesh.quaternion.copy(invGlobe);
      }
      particles.rotation.y += 0.0001;
      particles2.rotation.y -= 0.00008;
      particles2.rotation.x += 0.00003;

      // Fade geography lines based on zoom (closer = more visible)
      const zoomFactor = clamp((3.2 - zmR.current) / 1.6, 0, 1); // fully visible below ~1.6, invisible above ~3.2
      geoGroup.forEach(g => {
        const maxOp = g.isBorder ? 0.12 : 0.25;
        g.mat.opacity = zoomFactor * maxOp;
      });

      rend.render(scene, cam);
    };
    animate();

    // Intro sequence
    setTimeout(() => setReady(true), 300);
    setTimeout(() => setIntroComplete(true), 2500);

    const onR = () => { const nw = el.clientWidth, nh = el.clientHeight; cam.aspect = nw / nh; cam.updateProjectionMatrix(); rend.setSize(nw, nh); };
    window.addEventListener("resize", onR);

    return () => {
      cancelAnimationFrame(frameRef.current);
      if (animRef.current) cancelAnimationFrame(animRef.current);
      if (playRef.current) clearTimeout(playRef.current);
      window.removeEventListener("resize", onR);
      if (el.contains(rend.domElement)) el.removeChild(rend.domElement);
      rend.dispose();
    };
  }, [loading]);

  // Seasonal tinting
  useEffect(() => {
    if (!glowLayersRef.current.length) return;
    const s = season;
    glowLayersRef.current.forEach((mesh, i) => {
      mesh.material.color.set(i < 2 ? s.glow : P.cream);
    });
    if (particlesRef.current) particlesRef.current.material.color.set(isAnniversary ? P.heart : s.particle);
    if (isAnniversary && particlesRef.current) particlesRef.current.material.opacity = 0.35;
    else if (particlesRef.current) particlesRef.current.material.opacity = 0.18;
  }, [season, isAnniversary]);

  // ---- REBUILD MARKERS ----
  // Group entries by location (within ~0.5 degrees)
  const locationGroups = useMemo(() => {
    const groups = [];
    data.entries.forEach(e => {
      const existing = groups.find(g => Math.abs(g.lat - e.lat) < 0.5 && Math.abs(g.lng - e.lng) < 0.5);
      if (existing) { existing.entries.push(e); }
      else { groups.push({ lat: e.lat, lng: e.lng, city: e.city, entries: [e] }); }
    });
    return groups;
  }, [data.entries]);

  const [locationList, setLocationList] = useState(null); // for multi-entry popup

  useEffect(() => {
    const g = globeRef.current; if (!g) return;
    mkRef.current.forEach(m => [m.dot, m.ring, m.glow].forEach(o => o && g.remove(o)));
    mkRef.current = [];
    rtRef.current.forEach(r => r.line && g.remove(r.line));
    rtRef.current = [];

    const positions = getPositions(sliderDate);

    // ---- ALL ENTRIES always visible as colored markers ----
    locationGroups.forEach(loc => {
      // Use the "most significant" entry type for the dot color
      const types = loc.entries.map(e => e.type);
      let color = P.textFaint;
      let icon = "together";
      if (types.includes("together") || types.includes("special")) { color = P.gold; icon = "together"; }
      else if (types.includes("home-seth")) { color = P.sky; icon = "home-seth"; }
      else if (types.includes("home-rosie")) { color = P.rose; icon = "home-rosie"; }
      else if (types.includes("seth-solo")) { color = P.skySoft; icon = "seth-solo"; }
      else if (types.includes("rosie-solo")) { color = P.roseSoft; icon = "rosie-solo"; }

      const isMulti = loc.entries.length > 1;
      const size = isMulti ? 0.02 : 0.014;
      const entryId = isMulti ? `group-${loc.city}` : loc.entries[0].id;

      mkRef.current.push(makeDot(g, loc.lat, loc.lng, color, size, entryId, false));
    });

    // ---- Seth position dot (from slider) ----
    if (positions.seth && !areTogether) {
      mkRef.current.push(makeDot(g, positions.seth.lat, positions.seth.lng, P.sky, 0.022, "seth-pos", false));
    }
    // ---- Rosie position dot (from slider) ----
    if (positions.rosie && !areTogether) {
      mkRef.current.push(makeDot(g, positions.rosie.lat, positions.rosie.lng, P.rose, 0.022, "rosie-pos", false));
    }

    // ---- Heart on together location ----
    if (areTogether && positions.together) {
      if (heartRef.current) {
        const hp = ll2v(positions.together.lat, positions.together.lng, RAD * 1.05);
        heartRef.current.position.copy(hp);
        heartRef.current.visible = true;
      }
    } else if (heartRef.current) { heartRef.current.visible = false; }

    // ---- Distance line when apart ----
    if (positions.seth && positions.rosie && !areTogether) {
      const from = ll2v(positions.seth.lat, positions.seth.lng, RAD * 1.005);
      const to = ll2v(positions.rosie.lat, positions.rosie.lng, RAD * 1.005);
      const mid = from.clone().add(to).multiplyScalar(0.5);
      mid.normalize().multiplyScalar(RAD + from.distanceTo(to) * 0.25);
      const curve = new THREE.QuadraticBezierCurve3(from, mid, to);
      const lG = new THREE.BufferGeometry().setFromPoints(curve.getPoints(50));
      const lM = new THREE.LineDashedMaterial({ color: P.rose, transparent: true, opacity: 0.18, dashSize: 0.012, gapSize: 0.008 });
      const line = new THREE.Line(lG, lM); line.computeLineDistances(); line.renderOrder = 3;
      g.add(line); rtRef.current.push({ line });
    }

    // ---- Trip route for selected entry ----
    if (selected && (selected.stops || []).length > 0) {
      const allPts = [{ lat: selected.lat, lng: selected.lng }, ...selected.stops];
      selected.stops.forEach(s => mkRef.current.push(makeDot(g, s.lat, s.lng, P.sage, 0.01, `${selected.id}-${s.sid}`)));
      for (let i = 0; i < allPts.length - 1; i++) {
        const from = ll2v(allPts[i].lat, allPts[i].lng, RAD * 1.005);
        const to = ll2v(allPts[i + 1].lat, allPts[i + 1].lng, RAD * 1.005);
        const mid = from.clone().add(to).multiplyScalar(0.5);
        mid.normalize().multiplyScalar(RAD + from.distanceTo(to) * 0.2);
        const lG = new THREE.BufferGeometry().setFromPoints(new THREE.QuadraticBezierCurve3(from, mid, to).getPoints(40));
        const lM = new THREE.LineDashedMaterial({ color: P.sage, transparent: true, opacity: 0.35, dashSize: 0.015, gapSize: 0.008 });
        const line = new THREE.Line(lG, lM); line.computeLineDistances(); line.renderOrder = 3;
        g.add(line); rtRef.current.push({ line });
      }
    }
  }, [sliderDate, data, getPositions, areTogether, locationGroups, selected]);

  function makeDot(group, lat, lng, color, size, id, faint = false) {
    const p = ll2v(lat, lng, RAD * 1.012);
    const dot = new THREE.Mesh(new THREE.CircleGeometry(size, 20), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: faint ? 0.28 : 0.92, side: THREE.DoubleSide, depthTest: true }));
    dot.position.copy(p); dot.lookAt(p.clone().multiplyScalar(2)); dot.userData = { entryId: id }; dot.renderOrder = 2; group.add(dot);
    const ring = new THREE.Mesh(new THREE.RingGeometry(size * 1.4, size * 2.2, 32), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: faint ? 0.06 : 0.2, side: THREE.DoubleSide, depthTest: true }));
    ring.position.copy(p); ring.lookAt(p.clone().multiplyScalar(2)); ring.renderOrder = 1; group.add(ring);
    const glow = new THREE.Mesh(new THREE.CircleGeometry(size * (faint ? 2 : 4.5), 20), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: faint ? 0.02 : 0.09, side: THREE.DoubleSide, depthTest: true }));
    glow.position.copy(p); glow.lookAt(p.clone().multiplyScalar(2)); glow.renderOrder = 0; group.add(glow);
    return { entryId: id, dot, ring, glow };
  }

  // ---- POINTER ----
  const onDown = useCallback(e => { dragR.current = true; prevR.current = { x: e.clientX, y: e.clientY }; clickSR.current = { x: e.clientX, y: e.clientY, t: Date.now() }; }, []);
  const onMove = useCallback(e => { if (!dragR.current) return; tRot.current.y += (e.clientX - prevR.current.x) * 0.005; tRot.current.x = clamp(tRot.current.x + (e.clientY - prevR.current.y) * 0.005, -1.2, 1.2); prevR.current = { x: e.clientX, y: e.clientY }; }, []);
  const onUp = useCallback(e => {
    dragR.current = false;
    if (Math.abs(e.clientX - clickSR.current.x) < 6 && Math.abs(e.clientY - clickSR.current.y) < 6 && Date.now() - clickSR.current.t < 350) {
      const rect = mountRef.current.getBoundingClientRect();
      mRef.current.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      mRef.current.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      rayRef.current.setFromCamera(mRef.current, camRef.current);
      const hits = rayRef.current.intersectObjects(mkRef.current.map(m => m.dot));
      if (hits.length > 0) {
        const id = hits[0].object.userData.entryId;
        // Check if this is a location group
        if (id.startsWith("group-")) {
          const groupCity = id.replace("group-", "");
          const group = locationGroups.find(g => g.city === groupCity);
          if (group) {
            setLocationList(group);
            setSelected(null);
            const p = ll2v(group.lat, group.lng, RAD);
            tRot.current = { x: Math.asin(p.y / RAD) * 0.3, y: Math.atan2(-p.x, p.z) };
            tZm.current = 2.3;
          }
        } else {
          const entry = data.entries.find(en => en.id === id);
          if (entry) {
            setSelected(entry); setPhotoIdx(0); setLocationList(null);
            setSliderDate(entry.dateStart);
            const p = ll2v(entry.lat, entry.lng, RAD);
            tRot.current = { x: Math.asin(p.y / RAD) * 0.3, y: Math.atan2(-p.x, p.z) };
            tZm.current = 2.5;
          }
        }
      } else { setSelected(null); setLocationList(null); }
    }
  }, [data.entries, locationGroups]);
  const onWheel = useCallback(e => { e.preventDefault(); tZm.current = clamp(tZm.current + e.deltaY * 0.001, MIN_Z, MAX_Z); }, []);
  const onTS = useCallback(e => { if (e.touches.length === 1) { dragR.current = true; prevR.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }; clickSR.current = { x: e.touches[0].clientX, y: e.touches[0].clientY, t: Date.now() }; } else if (e.touches.length === 2) { const dx = e.touches[0].clientX - e.touches[1].clientX, dy = e.touches[0].clientY - e.touches[1].clientY; tDistR.current = Math.sqrt(dx * dx + dy * dy); } }, []);
  const onTM = useCallback(e => { e.preventDefault(); if (e.touches.length === 1 && dragR.current) { tRot.current.y += (e.touches[0].clientX - prevR.current.x) * 0.005; tRot.current.x = clamp(tRot.current.x + (e.touches[0].clientY - prevR.current.y) * 0.005, -1.2, 1.2); prevR.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }; } else if (e.touches.length === 2) { const dx = e.touches[0].clientX - e.touches[1].clientX, dy = e.touches[0].clientY - e.touches[1].clientY; const d = Math.sqrt(dx * dx + dy * dy); tZm.current = clamp(tZm.current + (tDistR.current - d) * 0.008, MIN_Z, MAX_Z); tDistR.current = d; } }, []);

  const [uploading, setUploading] = useState(false);

  const handlePhotos = useCallback((id) => {
    const input = document.createElement("input"); input.type = "file"; input.accept = "image/*"; input.multiple = true;
    input.onchange = async (e) => {
      const files = Array.from(e.target.files);
      if (files.length === 0) return;
      setUploading(true);
      console.log("Starting upload of", files.length, "files for entry", id);
      const urls = [];
      for (const file of files) {
        console.log("Uploading:", file.name, file.size, "bytes");
        try {
          const url = await uploadPhoto(file, id);
          console.log("Upload result:", url);
          if (url) urls.push(url);
        } catch (err) {
          console.error("Upload error:", err);
        }
      }
      console.log("All uploads done. URLs:", urls);
      if (urls.length > 0) dispatch({ type: "ADD_PHOTOS", id, urls });
      setUploading(false);
    };
    input.click();
  }, []);

  const cur = selected ? data.entries.find(e => e.id === selected.id) : null;
  const totalDays = Math.max(1, daysBetween(config.startDate, todayStr()));
  const sliderVal = daysBetween(config.startDate, sliderDate);

  if (loading) return <div style={{ width: "100%", height: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: P.cream, fontFamily: "Georgia,serif", color: P.textMuted, fontSize: 14, letterSpacing: ".2em" }}>Loading your world...</div>;

  return (
    <div style={{ width: "100%", height: "100vh", position: "relative", overflow: "hidden", background: `linear-gradient(155deg,${P.cream} 0%,${P.blush} 40%,${P.lavMist} 100%)`, fontFamily: "'Palatino Linotype','Book Antiqua',Palatino,Georgia,serif", color: P.text, userSelect: "none" }}>

      <div ref={mountRef} style={{ width: "100%", height: "100%" }}
        onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onWheel={onWheel}
        onTouchStart={onTS} onTouchMove={onTM} onTouchEnd={() => dragR.current = false} />

      {/* TITLE */}
      <div style={{ position: "absolute", top: 22, left: 0, right: 0, textAlign: "center", zIndex: 10, pointerEvents: "none", opacity: ready ? 1 : 0, transform: ready ? "none" : "translateY(-12px)", transition: "all 1.8s cubic-bezier(.23,1,.32,1)" }}>
        <h1 style={{ fontSize: 28, fontWeight: 400, margin: 0, letterSpacing: ".2em", textTransform: "uppercase" }}>{config.title}</h1>
        <p style={{ fontSize: 11, color: P.textMuted, marginTop: 3, letterSpacing: ".35em", fontStyle: "italic" }}>{config.subtitle}</p>
        {isAnniversary && <div style={{ fontSize: 11, color: P.heart, marginTop: 6, letterSpacing: ".15em", animation: "heartPulse 2s ease infinite" }}>✨ Happy Anniversary ✨</div>}
      </div>

      {/* RIGHT PANEL — distance + stats */}
      <div style={{ position: "absolute", top: 22, right: 22, zIndex: 10, textAlign: "right", opacity: introComplete ? .8 : 0, transition: "opacity 1s ease", maxWidth: 180 }}>
        {dist !== null && (
          <div style={{ marginBottom: 4 }}>
            {areTogether ? <div style={{ fontSize: 16, color: P.heart, animation: "heartPulse 1.5s ease infinite" }}>💕 Together</div>
              : <div style={{ fontSize: 13, color: P.textMid }}><span style={{ color: P.rose }}>♥</span> {dist.toLocaleString()} mi apart</div>}
          </div>
        )}
        {nextTogether && !areTogether && (
          <div style={{ fontSize: 9, color: P.goldWarm, letterSpacing: ".08em", marginBottom: 4 }}>
            {daysBetween(todayStr(), nextTogether.dateStart)} days until together 💛
          </div>
        )}
        <div style={{ fontSize: 8, color: P.textFaint, letterSpacing: ".08em", lineHeight: 1.6 }}>
          {stats.daysTog} days together<br />{stats.trips} adventures · {stats.countries} countries<br />{stats.totalMiles.toLocaleString()} miles traveled
        </div>
      </div>

      {/* TOOLBAR */}
      <div style={{ position: "absolute", top: 22, left: 22, zIndex: 20, display: "flex", flexDirection: "column", gap: 7, opacity: introComplete ? 1 : 0, transition: "opacity .8s ease" }}>
        <TBtn a={editMode} onClick={() => { setEditMode(v => !v); if (editMode) { setEditing(null); setShowAdd(false); } }}>✏️</TBtn>
        {editMode && <TBtn onClick={() => setShowAdd(true)} accent>＋</TBtn>}
        {editMode && <TBtn onClick={() => setShowSettings(true)}>⚙️</TBtn>}
        {allPhotos.length > 0 && <TBtn a={showGallery} onClick={() => setShowGallery(v => !v)}>📷</TBtn>}
        {togetherList.length > 0 && !isPlaying && <TBtn onClick={playStory}>▶</TBtn>}
        {isPlaying && <TBtn onClick={stopPlay} a>⏹</TBtn>}
      </div>

      {/* LOVE LETTER TRIGGER */}
      {config.loveLetter && <button onClick={() => setShowLetter(true)} style={{ position: "absolute", bottom: 118, right: 22, zIndex: 12, background: "none", border: "none", cursor: "pointer", fontSize: 15, opacity: 0.2, transition: "opacity .5s", padding: 4 }} onMouseEnter={e => e.currentTarget.style.opacity = 0.55} onMouseLeave={e => e.currentTarget.style.opacity = 0.2}>❀</button>}
      {editMode && !config.loveLetter && <button onClick={() => { setEditLetter(true); setLetterDraft(""); }} style={{ position: "absolute", bottom: 118, right: 22, zIndex: 12, background: P.glass, border: `1px dashed ${P.rose}40`, borderRadius: 7, cursor: "pointer", fontSize: 9, color: P.textMuted, padding: "3px 9px", fontFamily: "inherit" }}>+ Letter</button>}

      {/* SLIDER */}
      <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 105, background: P.glass, backdropFilter: "blur(16px)", borderTop: `1px solid ${P.rose}10`, zIndex: 15, display: "flex", flexDirection: "column", justifyContent: "center", padding: "0 22px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, marginBottom: 6 }}>
          <button onClick={() => jumpNext(-1)} disabled={isAnimating} style={navSt} title="Previous together">💕◂</button>
          <button onClick={() => stepDay(-1)} disabled={isAnimating} style={navSt}>◂</button>
          <div style={{ minWidth: 150, textAlign: "center" }}>
            <div style={{ fontSize: 15, color: P.text, fontWeight: 400 }}>{fmtDate(sliderDate)}</div>
            <div style={{ fontSize: 9, color: areTogether ? P.heart : P.textFaint, letterSpacing: ".1em", marginTop: 1 }}>
              {areTogether ? `✨ ${pos.together?.city || "Together"} ✨` : pos.seth && pos.rosie ? `${pos.seth.entry?.city || "?"} ↔ ${pos.rosie.entry?.city || "?"}` : "Add entries to begin"}
            </div>
          </div>
          <button onClick={() => stepDay(1)} disabled={isAnimating} style={navSt}>▸</button>
          <button onClick={() => jumpNext(1)} disabled={isAnimating} style={navSt} title="Next together">▸💕</button>
        </div>
        <div style={{ position: "relative", width: "100%", height: 24, display: "flex", alignItems: "center" }}>
          <input type="range" min={0} max={totalDays} value={clamp(sliderVal, 0, totalDays)}
            onChange={e => { if (!isAnimating) setSliderDate(addDays(config.startDate, parseInt(e.target.value))); }}
            style={{ width: "100%", height: 3, appearance: "none", WebkitAppearance: "none", background: `linear-gradient(90deg,${P.sky},${P.rose})`, borderRadius: 2, outline: "none", cursor: "pointer", opacity: 0.5 }} />
          {togetherList.map(e => {
            const d = daysBetween(config.startDate, e.dateStart);
            const pct = totalDays > 0 ? (d / totalDays) * 100 : 0;
            if (pct < 0 || pct > 100) return null;
            return <div key={e.id} style={{ position: "absolute", left: `${pct}%`, top: 5, width: 5, height: 5, borderRadius: "50%", background: P.gold, transform: "translateX(-50%)", pointerEvents: "none", boxShadow: `0 0 5px ${P.gold}50` }} />;
          })}
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 7, color: P.textFaint, letterSpacing: ".1em", marginTop: 1 }}>
          <span>{fmtDate(config.startDate)}</span>
          <span>today</span>
        </div>
      </div>

      {/* LOCATION LIST — multiple chapters at same place */}
      {locationList && !selected && (
        <div style={{ position: "absolute", top: "42%", right: 18, transform: "translateY(-50%)", zIndex: 25, background: P.card, backdropFilter: "blur(24px)", borderRadius: 16, maxWidth: 300, minWidth: 220, boxShadow: "0 12px 44px rgba(61,53,82,.1)", border: `1px solid ${P.rose}10`, animation: "cardIn .5s ease", overflow: "hidden", display: "flex", flexDirection: "column" }}>
          <div style={{ padding: "14px 18px 10px" }}>
            <button onClick={() => setLocationList(null)} style={{ position: "absolute", top: 10, right: 10, background: "none", border: "none", fontSize: 16, color: P.textFaint, cursor: "pointer", zIndex: 5 }}>×</button>
            <h2 style={{ margin: 0, fontSize: 17, fontWeight: 400 }}>{locationList.city}</h2>
            <p style={{ fontSize: 9, color: P.textFaint, marginTop: 2, letterSpacing: ".1em" }}>{locationList.entries.length} chapters here</p>
          </div>
          <div style={{ padding: "0 14px 14px", maxHeight: 280, overflowY: "auto" }}>
            {locationList.entries.sort((a, b) => a.dateStart.localeCompare(b.dateStart)).map(e => {
              const t = TYPES[e.type] || TYPES.together;
              return (
                <button key={e.id} onClick={() => {
                  setSelected(e); setPhotoIdx(0); setLocationList(null);
                  setSliderDate(e.dateStart);
                }} style={{
                  display: "block", width: "100%", textAlign: "left", padding: "10px 12px",
                  background: "none", border: "none", borderBottom: `1px solid ${P.rose}08`,
                  cursor: "pointer", fontFamily: "inherit", transition: "background .15s", borderRadius: 6,
                }}
                  onMouseEnter={ev => ev.currentTarget.style.background = P.blush}
                  onMouseLeave={ev => ev.currentTarget.style.background = "none"}
                >
                  <div style={{ fontSize: 11, color: P.text, marginBottom: 2 }}>{t.icon} {e.city}</div>
                  <div style={{ fontSize: 9, color: P.textMuted }}>{fmtDate(e.dateStart)}{e.dateEnd ? ` → ${fmtDate(e.dateEnd)}` : ""}</div>
                  {e.notes && <div style={{ fontSize: 9, color: P.textFaint, marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{e.notes.slice(0, 60)}{e.notes.length > 60 ? "…" : ""}</div>}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* DETAIL CARD */}
      {cur && !editing && (
        <div style={{ position: "absolute", top: "42%", right: 18, transform: "translateY(-50%)", zIndex: 25, background: P.card, backdropFilter: "blur(24px)", borderRadius: 16, maxWidth: 330, minWidth: 260, maxHeight: "55vh", boxShadow: "0 12px 44px rgba(61,53,82,.1)", border: `1px solid ${P.rose}10`, animation: "cardIn .5s ease", overflow: "hidden", display: "flex", flexDirection: "column" }}>
          {(cur.photos || []).length > 0 && (
            <div style={{ position: "relative", width: "100%", height: 180, flexShrink: 0, overflow: "hidden" }}>
              <img src={cur.photos[photoIdx % cur.photos.length]} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", transition: "opacity .6s" }} />
              {cur.photos.length > 1 && (<><button onClick={() => setPhotoIdx(i => (i - 1 + cur.photos.length) % cur.photos.length)} style={imgN("left")}>‹</button><button onClick={() => setPhotoIdx(i => (i + 1) % cur.photos.length)} style={imgN("right")}>›</button>
                <div style={{ position: "absolute", bottom: 6, left: 0, right: 0, display: "flex", justifyContent: "center", gap: 3 }}>{cur.photos.map((_, i) => <div key={i} style={{ width: 4, height: 4, borderRadius: "50%", background: i === photoIdx % cur.photos.length ? "#fff" : "rgba(255,255,255,.3)" }} />)}</div></>)}
              {editMode && <button onClick={() => handlePhotos(cur.id)} style={{ position: "absolute", top: 6, left: 6, background: "rgba(255,255,255,.85)", border: "none", borderRadius: 5, padding: "2px 8px", fontSize: 9, cursor: "pointer", fontFamily: "inherit" }}>+ Photos</button>}
            </div>
          )}
          {(cur.photos || []).length === 0 && editMode && <button onClick={() => handlePhotos(cur.id)} style={{ width: "100%", height: 60, background: `linear-gradient(135deg,${P.parchment},${P.blush})`, border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 4, color: P.textMuted, fontSize: 10, fontFamily: "inherit", flexShrink: 0 }}>📷 Upload Photos</button>}

          <div style={{ padding: "14px 18px 18px", overflowY: "auto", flex: 1 }}>
            <button onClick={() => setSelected(null)} style={{ position: "absolute", top: (cur.photos || []).length > 0 ? 186 : 6, right: 10, background: "none", border: "none", fontSize: 16, color: P.textFaint, cursor: "pointer", zIndex: 5 }}>×</button>

            {firstBadges[cur.id] && <div style={{ fontSize: 8, color: P.gold, letterSpacing: ".12em", marginBottom: 4 }}>🏅 {firstBadges[cur.id]}</div>}
            {togetherIndex(cur.id) && <div style={{ fontSize: 8, color: P.textFaint, letterSpacing: ".1em", marginBottom: 4 }}>Trip #{togetherIndex(cur.id)}</div>}

            <div style={{ display: "inline-block", padding: "2px 7px", borderRadius: 14, fontSize: 7, letterSpacing: ".08em", color: (TYPES[cur.type] || TYPES.together).color, border: `1px solid ${(TYPES[cur.type] || TYPES.together).color}28`, marginBottom: 5 }}>
              {(TYPES[cur.type] || TYPES.together).icon} {(TYPES[cur.type] || TYPES.together).label}
            </div>

            <h2 style={{ margin: 0, fontSize: 19, fontWeight: 400, lineHeight: 1.2 }}>{cur.city}</h2>
            <p style={{ margin: "1px 0 0", fontSize: 10, color: P.textMuted }}>{cur.country}</p>
            <div style={{ margin: "9px 0", height: 1, background: `linear-gradient(90deg,transparent,${P.rose}18,transparent)` }} />
            <div style={{ fontSize: 11, color: P.textMid, marginBottom: 7 }}>📅 {fmtDate(cur.dateStart)}{cur.dateEnd ? ` → ${fmtDate(cur.dateEnd)}` : ""}</div>
            {cur.notes && <p style={{ fontSize: 12, lineHeight: 1.6, margin: "0 0 8px", opacity: .85 }}>{cur.notes}</p>}
            {renderList("Memories", cur.memories, "♥", P.rose)}
            {renderList("Museums & Culture", cur.museums, "🏛", P.sky)}
            {renderList("Restaurants & Food", cur.restaurants, "🍽", P.sage)}
            {renderList("Highlights", cur.highlights, "⭐", P.gold)}
            {(cur.stops || []).length > 0 && (<div style={{ marginTop: 10 }}><div style={{ fontSize: 7, color: P.textFaint, letterSpacing: ".16em", textTransform: "uppercase", marginBottom: 4 }}>Trip Route</div>{cur.stops.map(s => <div key={s.sid} style={{ padding: "5px 8px", background: `${P.sage}08`, borderRadius: 6, marginBottom: 4, borderLeft: `2px solid ${P.sage}35` }}><div style={{ fontSize: 11, fontWeight: 500 }}>{s.city}</div>{s.notes && <p style={{ fontSize: 10, color: P.textMid, margin: "2px 0 0" }}>{s.notes}</p>}</div>)}</div>)}
            {cur.musicUrl && <div style={{ marginTop: 8, padding: "6px 8px", background: `${P.lavender}0a`, borderRadius: 6 }}><div style={{ fontSize: 7, color: P.textFaint, letterSpacing: ".12em", textTransform: "uppercase", marginBottom: 3 }}>Our Song</div><audio controls src={cur.musicUrl} style={{ width: "100%", height: 26 }} /></div>}
            {editMode && <button onClick={() => setEditing({ ...cur })} style={{ marginTop: 10, width: "100%", padding: "7px 0", background: `linear-gradient(135deg,${P.parchment},${P.blush})`, border: `1px solid ${P.rose}15`, borderRadius: 7, cursor: "pointer", fontSize: 9, color: P.textMuted, fontFamily: "inherit" }}>✏️ Edit</button>}
          </div>
        </div>
      )}

      {/* ADD / EDIT / SETTINGS / LETTER overlays */}
      {showAdd && <AddForm types={TYPES} onAdd={entry => { dispatch({ type: "ADD", entry }); setShowAdd(false); const p = ll2v(entry.lat, entry.lng, RAD); tRot.current = { x: Math.asin(p.y / RAD) * 0.3, y: Math.atan2(-p.x, p.z) }; tZm.current = 2.6; setTimeout(() => { setSelected(entry); setPhotoIdx(0); }, 400); }} onClose={() => setShowAdd(false)} />}

      {editing && <EditForm entry={editing} types={TYPES} onChange={setEditing}
        onSave={() => { dispatch({ type: "UPDATE", id: editing.id, data: editing }); setSelected(editing); setEditing(null); }}
        onClose={() => setEditing(null)}
        onDelete={() => setConfirmDelete(editing.id)}
        onAddStop={stop => { const updated = { ...editing, stops: [...(editing.stops || []), stop] }; setEditing(updated); dispatch({ type: "UPDATE", id: editing.id, data: { stops: updated.stops } }); }} />}

      {confirmDelete && (
        <div style={{ position: "absolute", inset: 0, zIndex: 60, background: "rgba(253,251,247,.9)", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ background: P.card, borderRadius: 14, padding: 28, maxWidth: 320, textAlign: "center", boxShadow: "0 12px 40px rgba(61,53,82,.1)" }}>
            <p style={{ fontSize: 14, margin: "0 0 16px" }}>Delete this memory forever?</p>
            <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
              <button onClick={() => { dispatch({ type: "DELETE", id: confirmDelete }); setConfirmDelete(null); setEditing(null); setSelected(null); }} style={{ padding: "8px 20px", background: "#c9777a", color: "#fff", border: "none", borderRadius: 7, cursor: "pointer", fontSize: 12, fontFamily: "inherit" }}>Delete</button>
              <button onClick={() => setConfirmDelete(null)} style={{ padding: "8px 20px", background: "transparent", border: "1px solid #ddd", borderRadius: 7, cursor: "pointer", fontSize: 12, fontFamily: "inherit", color: P.textMuted }}>Keep</button>
            </div>
          </div>
        </div>
      )}

      {showLetter && (
        <div onClick={() => setShowLetter(false)} style={{ position: "absolute", inset: 0, zIndex: 50, background: "rgba(253,251,247,.93)", backdropFilter: "blur(30px)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", animation: "fadeIn .8s ease" }}>
          <div style={{ maxWidth: 460, padding: 36, textAlign: "center" }} onClick={e => e.stopPropagation()}>
            <div style={{ fontSize: 30, marginBottom: 14 }}>💌</div>
            <p style={{ fontSize: 14, lineHeight: 2, color: P.text, whiteSpace: "pre-wrap", fontStyle: "italic" }}>{config.loveLetter}</p>
            <p style={{ fontSize: 10, color: P.textFaint, marginTop: 20, letterSpacing: ".15em" }}>— {config.youName}</p>
            {editMode && <button onClick={() => { setEditLetter(true); setLetterDraft(config.loveLetter); setShowLetter(false); }} style={{ marginTop: 14, background: "none", border: `1px solid ${P.rose}28`, borderRadius: 5, padding: "4px 12px", fontSize: 9, color: P.textMuted, cursor: "pointer", fontFamily: "inherit" }}>Edit</button>}
          </div>
        </div>
      )}

      {editLetter && (
        <div style={{ position: "absolute", inset: 0, zIndex: 55, background: "rgba(253,251,247,.95)", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ width: 420, padding: 28, background: P.card, borderRadius: 16, boxShadow: "0 14px 48px rgba(61,53,82,.1)" }}>
            <h3 style={{ margin: "0 0 10px", fontSize: 16, fontWeight: 400 }}>💌 Your Love Letter</h3>
            <p style={{ fontSize: 9, color: P.textMuted, marginBottom: 12, fontStyle: "italic" }}>Hidden behind the tiny flower ❀ — she'll find it</p>
            <textarea value={letterDraft} onChange={e => setLetterDraft(e.target.value)} rows={8} placeholder={`Dear ${config.partnerName}...`} style={{ ...inpSt, resize: "vertical", lineHeight: 1.8 }} />
            <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
              <button onClick={() => { setConfig({ loveLetter: letterDraft }); setEditLetter(false); }} style={{ flex: 1, padding: "9px", background: P.rose, color: "#fff", border: "none", borderRadius: 7, cursor: "pointer", fontSize: 11, fontFamily: "inherit" }}>Save</button>
              <button onClick={() => setEditLetter(false)} style={{ padding: "9px 14px", background: "transparent", border: "1px solid #e5e0d8", borderRadius: 7, cursor: "pointer", fontSize: 11, fontFamily: "inherit", color: P.textMuted }}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* GALLERY PANEL — slides out from left, not a full overlay */}
      {showGallery && (
        <div style={{ position: "absolute", top: 72, left: 22, zIndex: 22, background: P.card, backdropFilter: "blur(24px)", borderRadius: 14, width: 280, maxHeight: "calc(100vh - 200px)", boxShadow: "0 10px 40px rgba(61,53,82,.12)", border: `1px solid ${P.rose}10`, animation: "cardIn .4s ease", overflow: "hidden", display: "flex", flexDirection: "column" }}>
          <div style={{ padding: "12px 14px 8px", display: "flex", justifyContent: "space-between", alignItems: "center", flexShrink: 0, borderBottom: `1px solid ${P.rose}08` }}>
            <div>
              <div style={{ fontSize: 12, fontWeight: 400 }}>📷 Gallery</div>
              <div style={{ fontSize: 8, color: P.textFaint, letterSpacing: ".1em", marginTop: 1 }}>{allPhotos.length} photos</div>
            </div>
            <button onClick={() => setShowGallery(false)} style={{ background: "none", border: "none", fontSize: 15, color: P.textFaint, cursor: "pointer" }}>×</button>
          </div>
          <div style={{ flex: 1, overflowY: "auto", padding: 8 }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 4 }}>
              {allPhotos.map((ph, i) => (
                <button key={i} onClick={() => {
                  const entry = data.entries.find(e => e.id === ph.id);
                  if (entry) {
                    setSelected(entry); setPhotoIdx(0); setShowGallery(false);
                    const p = ll2v(entry.lat, entry.lng, RAD);
                    tRot.current = { x: Math.asin(p.y / RAD) * 0.3, y: Math.atan2(-p.x, p.z) };
                    tZm.current = 2.5;
                    setSliderDate(entry.dateStart);
                  }
                }} style={{ padding: 0, border: "none", background: "none", cursor: "pointer", borderRadius: 4, overflow: "hidden", aspectRatio: "1", position: "relative" }}>
                  <img src={ph.url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: 4, transition: "transform .2s" }}
                    onMouseEnter={e => e.currentTarget.style.transform = "scale(1.05)"}
                    onMouseLeave={e => e.currentTarget.style.transform = "scale(1)"} />
                  <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, padding: "10px 3px 2px", background: "linear-gradient(transparent, rgba(0,0,0,.5))", fontSize: 6, color: "#fff", textAlign: "center", letterSpacing: ".05em" }}>{ph.city}</div>
                </button>
              ))}
            </div>
            {allPhotos.length === 0 && <div style={{ textAlign: "center", padding: 20, fontSize: 10, color: P.textFaint }}>No photos yet</div>}
          </div>
        </div>
      )}

      {/* UPLOAD INDICATOR */}
      {uploading && (
        <div style={{ position: "absolute", top: 70, left: 0, right: 0, textAlign: "center", zIndex: 50, pointerEvents: "none" }}>
          <div style={{ display: "inline-block", padding: "6px 18px", background: P.card, backdropFilter: "blur(12px)", borderRadius: 20, fontSize: 11, color: P.textMid, letterSpacing: ".1em", boxShadow: "0 4px 16px rgba(0,0,0,.08)" }}>
            📷 Uploading photos...
          </div>
        </div>
      )}

      {/* PLAY MODE INDICATOR */}
      {isPlaying && (
        <div style={{ position: "absolute", top: 70, left: 0, right: 0, textAlign: "center", zIndex: 12, pointerEvents: "none" }}>
          <div style={{ display: "inline-block", padding: "4px 16px", background: P.glass, backdropFilter: "blur(12px)", borderRadius: 20, fontSize: 10, color: P.heart, letterSpacing: ".15em", animation: "heartPulse 2s ease infinite" }}>
            ▶ Playing Our Story...
          </div>
        </div>
      )}

      {showSettings && (
        <div style={{ position: "absolute", inset: 0, zIndex: 45, background: "rgba(253,251,247,.93)", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ width: 360, padding: 26, background: P.card, borderRadius: 16, boxShadow: "0 14px 48px rgba(61,53,82,.1)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 14 }}><h3 style={{ margin: 0, fontSize: 15, fontWeight: 400 }}>Settings</h3><button onClick={() => setShowSettings(false)} style={{ background: "none", border: "none", fontSize: 17, color: P.textFaint, cursor: "pointer" }}>×</button></div>
            <Fld l="Date You Met" v={config.startDate} t="date" set={v => setConfig({ startDate: v })} />
            <Fld l="Title" v={config.title} set={v => setConfig({ title: v })} />
            <Fld l="Subtitle" v={config.subtitle} set={v => setConfig({ subtitle: v })} />
            <Fld l="Your Name" v={config.youName} set={v => setConfig({ youName: v })} />
            <Fld l="Partner Name" v={config.partnerName} set={v => setConfig({ partnerName: v })} />

            <div style={{ margin: "10px 0", height: 1, background: `linear-gradient(90deg,transparent,${P.rose}15,transparent)` }} />
            <div style={{ fontSize: 7, color: P.textFaint, letterSpacing: ".13em", textTransform: "uppercase", marginBottom: 6 }}>Data</div>
            <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
              <button onClick={exportData} style={{ flex: 1, padding: "8px", background: P.parchment, border: `1px solid ${P.sage}30`, borderRadius: 6, cursor: "pointer", fontSize: 9, fontFamily: "inherit", color: P.textMid }}>📥 Export Backup</button>
              <button onClick={importData} style={{ flex: 1, padding: "8px", background: P.parchment, border: `1px solid ${P.sky}30`, borderRadius: 6, cursor: "pointer", fontSize: 9, fontFamily: "inherit", color: P.textMid }}>📤 Import Data</button>
            </div>
            <div style={{ fontSize: 7, color: P.textFaint, fontStyle: "italic", marginBottom: 8 }}>Export saves all entries, photos, and settings as a JSON file</div>

            <button onClick={() => setShowSettings(false)} style={{ width: "100%", padding: "9px", background: P.sage, color: "#fff", border: "none", borderRadius: 7, cursor: "pointer", fontSize: 11, fontFamily: "inherit", marginTop: 6 }}>Done</button>
          </div>
        </div>
      )}

      {data.entries.length === 0 && introComplete && !showAdd && (
        <div style={{ position: "absolute", top: "48%", left: "50%", transform: "translate(-50%,-50%)", zIndex: 12, textAlign: "center", pointerEvents: "none", opacity: 0.45 }}>
          <div style={{ fontSize: 36, marginBottom: 10 }}>🌍</div>
          <div style={{ fontSize: 13, color: P.textMid, letterSpacing: ".08em" }}>Your world is waiting</div>
          <div style={{ fontSize: 10, color: P.textFaint, marginTop: 5, letterSpacing: ".1em" }}>Click ✏️ then ＋ to begin your story</div>
        </div>
      )}

      <style>{`
        @keyframes cardIn{from{opacity:0;transform:translateY(-50%) translateX(18px)}to{opacity:1;transform:translateY(-50%) translateX(0)}}
        @keyframes fadeIn{from{opacity:0}to{opacity:1}}
        @keyframes heartPulse{0%,100%{transform:scale(1)}50%{transform:scale(1.06)}}
        *{box-sizing:border-box}
        ::-webkit-scrollbar{width:3px}::-webkit-scrollbar-track{background:transparent}::-webkit-scrollbar-thumb{background:${P.textFaint}22;border-radius:2px}
        input:focus,textarea:focus,select:focus{outline:none;border-color:${P.rose}!important}
        input[type=range]{-webkit-appearance:none;appearance:none}
        input[type=range]::-webkit-slider-thumb{-webkit-appearance:none;width:13px;height:13px;border-radius:50%;background:${P.rose};cursor:pointer;border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.12)}
        input[type=range]::-moz-range-thumb{width:13px;height:13px;border-radius:50%;background:${P.rose};cursor:pointer;border:2px solid #fff}
      `}</style>
    </div>
  );
}

// ---- SHARED UI ----
const inpSt = { width: "100%", padding: "7px 9px", border: "1px solid #e5e0d8", borderRadius: 5, fontSize: 12, fontFamily: "'Palatino Linotype',Palatino,Georgia,serif", color: P.text, background: "#fdfcfa", boxSizing: "border-box" };
const navSt = { background: "none", border: `1px solid ${P.textFaint}35`, borderRadius: 5, padding: "3px 9px", cursor: "pointer", fontSize: 10, color: P.textMid, fontFamily: "inherit", transition: "all .2s" };
function imgN(s) { return { position: "absolute", [s]: 5, top: "50%", transform: "translateY(-50%)", background: "rgba(255,255,255,.65)", border: "none", borderRadius: "50%", width: 24, height: 24, cursor: "pointer", fontSize: 12, display: "flex", alignItems: "center", justifyContent: "center" }; }
function renderList(t, items, icon, color) { if (!items?.length) return null; return <div style={{ marginTop: 7 }}><div style={{ fontSize: 7, color: P.textFaint, letterSpacing: ".14em", textTransform: "uppercase", marginBottom: 3 }}>{t}</div>{items.map((it, i) => <div key={i} style={{ display: "flex", gap: 4, marginBottom: 2 }}><span style={{ color, fontSize: 6, marginTop: 4 }}>{icon}</span><span style={{ fontSize: 11, opacity: .8, lineHeight: 1.5 }}>{it}</span></div>)}</div>; }
function TBtn({ a, onClick, children, accent }) { return <button onClick={onClick} style={{ width: 34, height: 34, borderRadius: 9, border: `1px solid ${a ? P.rose : accent ? P.sage : "#ddd8d0"}`, background: a ? P.card : "rgba(253,251,247,.7)", backdropFilter: "blur(10px)", cursor: "pointer", fontSize: accent ? 15 : 14, display: "flex", alignItems: "center", justifyContent: "center", transition: "all .3s", fontFamily: "inherit", color: P.text }}>{children}</button>; }
function Lbl({ children }) { return <label style={{ fontSize: 7, color: P.textFaint, letterSpacing: ".13em", textTransform: "uppercase", display: "block", marginBottom: 2 }}>{children}</label>; }
function Fld({ l, v, set, t = "text", ph = "" }) { return <div style={{ marginBottom: 9 }}><Lbl>{l}</Lbl><input type={t} value={v || ""} placeholder={ph} onChange={e => set(e.target.value)} style={inpSt} /></div>; }

// ---- ADD FORM ----
function AddForm({ types, onAdd, onClose }) {
  const [f, sf] = useState({ city: "", country: "", lat: "", lng: "", dateStart: "", dateEnd: "", type: "together", who: "both", zoomLevel: 1, notes: "", memories: "", museums: "", restaurants: "", highlights: "", musicUrl: "", stops: [] });
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [ns, setNs] = useState({ city: "", lat: "", lng: "", notes: "" });

  const ok = f.city && f.lat && f.lng && f.dateStart && f.dateEnd && f.notes;

  const onCityInput = v => {
    sf(p => ({ ...p, city: v }));
    if (v.length >= 2) {
      const q = v.toLowerCase();
      const matches = CITIES.filter(c => c[0].toLowerCase().includes(q)).slice(0, 6);
      setSuggestions(matches);
      setShowSuggestions(matches.length > 0);
    } else {
      setSuggestions([]);
      setShowSuggestions(false);
    }
  };

  const selectCity = (c) => {
    sf(p => ({ ...p, city: c[0], country: c[1], lat: c[2].toString(), lng: c[3].toString() }));
    setSuggestions([]);
    setShowSuggestions(false);
  };

  return (
    <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%,-50%)", zIndex: 40, background: P.card, backdropFilter: "blur(24px)", borderRadius: 18, padding: 24, width: 370, maxHeight: "88vh", overflowY: "auto", boxShadow: "0 18px 56px rgba(61,53,82,.14)", border: `1px solid ${P.sage}22`, fontFamily: "'Palatino Linotype',Palatino,Georgia,serif", color: P.text }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}><h3 style={{ margin: 0, fontSize: 16, fontWeight: 400 }}>Add a New Chapter</h3><button onClick={onClose} style={{ background: "none", border: "none", fontSize: 18, color: P.textFaint, cursor: "pointer" }}>×</button></div>
      <p style={{ fontSize: 9, color: P.textMuted, marginBottom: 12, fontStyle: "italic" }}>Another page in your story ✨</p>

      <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
        <div style={{ flex: 1 }}>
          <RLbl req>Type</RLbl>
          <select value={f.type} onChange={e => { const t = e.target.value; sf(p => ({ ...p, type: t, who: types[t]?.who || "both" })); }} style={inpSt}>
            {Object.entries(types).map(([k, v]) => <option key={k} value={k}>{v.icon} {v.label}</option>)}
          </select>
        </div>
        <div style={{ flex: 1 }}>
          <RLbl>Zoom (1-3)</RLbl>
          <select value={f.zoomLevel} onChange={e => sf(p => ({ ...p, zoomLevel: parseInt(e.target.value) || 1 }))} style={inpSt}>
            <option value={1}>1 — Always</option>
            <option value={2}>2 — Regional</option>
            <option value={3}>3 — Close-up</option>
          </select>
        </div>
      </div>

      {/* City with autocomplete */}
      <div style={{ marginBottom: 8, position: "relative" }}>
        <RLbl req>City</RLbl>
        <input
          value={f.city}
          onChange={e => onCityInput(e.target.value)}
          onFocus={() => { if (suggestions.length > 0) setShowSuggestions(true); }}
          placeholder="Start typing — e.g. Haw..."
          style={{ ...inpSt, borderColor: f.city ? "#e5e0d8" : undefined }}
        />
        {showSuggestions && suggestions.length > 0 && (
          <div style={{ position: "absolute", top: "100%", left: 0, right: 0, background: "#fff", border: "1px solid #e5e0d8", borderRadius: 6, maxHeight: 150, overflowY: "auto", zIndex: 10, boxShadow: "0 6px 16px rgba(0,0,0,.1)" }}>
            {suggestions.map((c, i) => (
              <button key={i} onClick={() => selectCity(c)} style={{
                display: "flex", alignItems: "center", gap: 6, width: "100%", textAlign: "left",
                padding: "8px 10px", border: "none", borderBottom: "1px solid #f5f2ed",
                background: "none", cursor: "pointer", fontFamily: "inherit", fontSize: 11, color: P.textMid,
                transition: "background .15s",
              }}
                onMouseEnter={e => e.currentTarget.style.background = P.blush}
                onMouseLeave={e => e.currentTarget.style.background = "none"}
              >
                <span style={{ fontSize: 13 }}>📍</span>
                <div>
                  <div style={{ fontWeight: 500, color: P.text }}>{c[0]}</div>
                  <div style={{ fontSize: 9, color: P.textFaint }}>{c[1]} · {c[2].toFixed(2)}, {c[3].toFixed(2)}</div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      <Fld l="Country" v={f.country} set={v => sf(p => ({ ...p, country: v }))} ph="Auto-filled from city selection" />
      <div style={{ display: "flex", gap: 8 }}>
        <div style={{ flex: 1 }}><FldR l="Latitude" v={f.lat} t="number" set={v => sf(p => ({ ...p, lat: v }))} ph="Auto-filled" req /></div>
        <div style={{ flex: 1 }}><FldR l="Longitude" v={f.lng} t="number" set={v => sf(p => ({ ...p, lng: v }))} ph="Auto-filled" req /></div>
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        <div style={{ flex: 1 }}><FldR l="Start Date" v={f.dateStart} t="date" set={v => sf(p => ({ ...p, dateStart: v }))} req /></div>
        <div style={{ flex: 1 }}><FldR l="End Date" v={f.dateEnd} t="date" set={v => sf(p => ({ ...p, dateEnd: v }))} req /></div>
      </div>

      <div style={{ margin: "10px 0", height: 1, background: `linear-gradient(90deg,transparent,${P.rose}15,transparent)` }} />

      <div style={{ marginBottom: 8 }}><RLbl req>Notes</RLbl><textarea value={f.notes} onChange={e => sf(p => ({ ...p, notes: e.target.value }))} rows={2} placeholder="What made this place special?" style={{ ...inpSt, resize: "vertical" }} /></div>
      <div style={{ marginBottom: 8 }}><Lbl>Memories (one per line)</Lbl><textarea value={f.memories} onChange={e => sf(p => ({ ...p, memories: e.target.value }))} rows={2} placeholder={"The sunset was perfect\nDancing until midnight"} style={{ ...inpSt, resize: "vertical" }} /></div>
      <div style={{ marginBottom: 8 }}><Lbl>Museums & Culture</Lbl><textarea value={f.museums} onChange={e => sf(p => ({ ...p, museums: e.target.value }))} rows={1} style={{ ...inpSt, resize: "vertical" }} /></div>
      <div style={{ marginBottom: 8 }}><Lbl>Restaurants & Food</Lbl><textarea value={f.restaurants} onChange={e => sf(p => ({ ...p, restaurants: e.target.value }))} rows={1} style={{ ...inpSt, resize: "vertical" }} /></div>
      <div style={{ marginBottom: 8 }}><Lbl>Highlights</Lbl><textarea value={f.highlights} onChange={e => sf(p => ({ ...p, highlights: e.target.value }))} rows={1} style={{ ...inpSt, resize: "vertical" }} /></div>
      <div style={{ marginBottom: 8 }}><Lbl>Music URL</Lbl><input value={f.musicUrl} onChange={e => sf(p => ({ ...p, musicUrl: e.target.value }))} placeholder="Paste audio URL (optional)" style={inpSt} /></div>

      <div style={{ margin: "6px 0", height: 1, background: `linear-gradient(90deg,transparent,${P.sage}18,transparent)` }} />
      <Lbl>Trip Stops</Lbl>
      {f.stops.map(s => <div key={s.sid} style={{ fontSize: 10, padding: "3px 7px", background: `${P.sage}08`, borderRadius: 5, marginBottom: 3, display: "flex", justifyContent: "space-between" }}><span>{s.city}</span><button onClick={() => sf(p => ({ ...p, stops: p.stops.filter(st => st.sid !== s.sid) }))} style={{ background: "none", border: "none", color: "#c9777a", cursor: "pointer", fontSize: 11 }}>×</button></div>)}
      <div style={{ display: "flex", gap: 4, marginTop: 4, marginBottom: 12 }}>
        <input placeholder="City" value={ns.city} onChange={e => setNs(p => ({ ...p, city: e.target.value }))} style={{ ...inpSt, flex: 1 }} />
        <input placeholder="Lat" value={ns.lat} onChange={e => setNs(p => ({ ...p, lat: e.target.value }))} style={{ ...inpSt, width: 48 }} />
        <input placeholder="Lng" value={ns.lng} onChange={e => setNs(p => ({ ...p, lng: e.target.value }))} style={{ ...inpSt, width: 48 }} />
        <button disabled={!ns.city || !ns.lat} onClick={() => { sf(p => ({ ...p, stops: [...p.stops, { sid: `s-${Date.now()}`, city: ns.city, lat: parseFloat(ns.lat) || 0, lng: parseFloat(ns.lng) || 0, notes: ns.notes }] })); setNs({ city: "", lat: "", lng: "", notes: "" }); }} style={{ padding: "0 7px", background: P.sage, color: "#fff", border: "none", borderRadius: 4, cursor: "pointer", fontSize: 10 }}>+</button>
      </div>

      <button disabled={!ok} onClick={() => { setShowSuggestions(false); onAdd({
        id: `e-${Date.now()}`, city: f.city, country: f.country, lat: parseFloat(f.lat), lng: parseFloat(f.lng),
        dateStart: f.dateStart, dateEnd: f.dateEnd || null, type: f.type, who: f.who, zoomLevel: f.zoomLevel,
        notes: f.notes, memories: f.memories.split("\n").filter(Boolean), museums: f.museums.split("\n").filter(Boolean),
        restaurants: f.restaurants.split("\n").filter(Boolean), highlights: f.highlights.split("\n").filter(Boolean),
        photos: [], stops: f.stops, musicUrl: f.musicUrl || null,
      }); }} style={{ width: "100%", padding: "10px 0", background: ok ? P.rose : "#e5e0d8", color: "#fff", border: "none", borderRadius: 9, cursor: ok ? "pointer" : "default", fontSize: 12, letterSpacing: ".1em", fontFamily: "inherit", transition: "all .3s" }}>
        {ok ? "Add to Our World 💕" : "Fill required fields to continue"}
      </button>
      {!ok && <p style={{ fontSize: 8, color: P.textFaint, textAlign: "center", marginTop: 5, letterSpacing: ".08em" }}>
        Need: city, coordinates, dates, and notes
      </p>}
    </div>
  );
}

// Required-field label with pink asterisk
function RLbl({ children, req }) {
  return <label style={{ fontSize: 7, color: P.textFaint, letterSpacing: ".13em", textTransform: "uppercase", display: "block", marginBottom: 2 }}>
    {children}{req && <span style={{ color: P.rose, marginLeft: 2 }}>✱</span>}
  </label>;
}

// Field with required asterisk
function FldR({ l, v, set, t = "text", ph = "", req }) {
  return <div style={{ marginBottom: 9 }}><RLbl req={req}>{l}</RLbl><input type={t} value={v || ""} placeholder={ph} onChange={e => set(e.target.value)} style={inpSt} /></div>;
}

// ---- EDIT FORM ----
function EditForm({ entry, types, onChange, onSave, onClose, onDelete, onAddStop }) {
  const [ns, setNs] = useState({ city: "", lat: "", lng: "", notes: "" });
  return (
    <div style={{ position: "absolute", top: "42%", right: 18, transform: "translateY(-50%)", zIndex: 30, background: P.card, backdropFilter: "blur(24px)", borderRadius: 16, padding: 20, maxWidth: 330, minWidth: 260, maxHeight: "65vh", overflowY: "auto", boxShadow: "0 12px 44px rgba(61,53,82,.12)", border: `1px solid ${P.gold}20`, fontFamily: "'Palatino Linotype',Palatino,Georgia,serif" }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}><h3 style={{ margin: 0, fontSize: 14, fontWeight: 400 }}>Edit</h3><button onClick={onClose} style={{ background: "none", border: "none", fontSize: 16, color: P.textFaint, cursor: "pointer" }}>×</button></div>
      <Fld l="City" v={entry.city} set={v => onChange(p => ({ ...p, city: v }))} />
      <Fld l="Country" v={entry.country} set={v => onChange(p => ({ ...p, country: v }))} />
      <div style={{ display: "flex", gap: 6 }}><div style={{ flex: 1 }}><Fld l="Lat" v={entry.lat} t="number" set={v => onChange(p => ({ ...p, lat: parseFloat(v) || 0 }))} /></div><div style={{ flex: 1 }}><Fld l="Lng" v={entry.lng} t="number" set={v => onChange(p => ({ ...p, lng: parseFloat(v) || 0 }))} /></div></div>
      <div style={{ display: "flex", gap: 6 }}><div style={{ flex: 1 }}><Fld l="Start" v={entry.dateStart} t="date" set={v => onChange(p => ({ ...p, dateStart: v }))} /></div><div style={{ flex: 1 }}><Fld l="End" v={entry.dateEnd || ""} t="date" set={v => onChange(p => ({ ...p, dateEnd: v || null }))} /></div></div>
      <div style={{ marginBottom: 8 }}><Lbl>Type</Lbl><select value={entry.type} onChange={e => { const t = e.target.value; onChange(p => ({ ...p, type: t, who: types[t]?.who || "both" })); }} style={inpSt}>{Object.entries(types).map(([k, v]) => <option key={k} value={k}>{v.icon} {v.label}</option>)}</select></div>
      <div style={{ marginBottom: 8 }}><Lbl>Notes</Lbl><textarea value={entry.notes || ""} onChange={e => onChange(p => ({ ...p, notes: e.target.value }))} rows={2} style={{ ...inpSt, resize: "vertical" }} /></div>
      <div style={{ marginBottom: 8 }}><Lbl>Memories</Lbl><textarea value={(entry.memories || []).join("\n")} onChange={e => onChange(p => ({ ...p, memories: e.target.value.split("\n").filter(Boolean) }))} rows={2} style={{ ...inpSt, resize: "vertical" }} /></div>
      <div style={{ marginBottom: 8 }}><Lbl>Museums</Lbl><textarea value={(entry.museums || []).join("\n")} onChange={e => onChange(p => ({ ...p, museums: e.target.value.split("\n").filter(Boolean) }))} rows={1} style={{ ...inpSt, resize: "vertical" }} /></div>
      <div style={{ marginBottom: 8 }}><Lbl>Restaurants</Lbl><textarea value={(entry.restaurants || []).join("\n")} onChange={e => onChange(p => ({ ...p, restaurants: e.target.value.split("\n").filter(Boolean) }))} rows={1} style={{ ...inpSt, resize: "vertical" }} /></div>
      <div style={{ marginBottom: 8 }}><Lbl>Highlights</Lbl><textarea value={(entry.highlights || []).join("\n")} onChange={e => onChange(p => ({ ...p, highlights: e.target.value.split("\n").filter(Boolean) }))} rows={1} style={{ ...inpSt, resize: "vertical" }} /></div>
      <div style={{ marginBottom: 8 }}><Lbl>Music URL</Lbl><input value={entry.musicUrl || ""} onChange={e => onChange(p => ({ ...p, musicUrl: e.target.value || null }))} placeholder="paste audio URL" style={inpSt} /></div>

      <div style={{ margin: "8px 0", height: 1, background: `linear-gradient(90deg,transparent,${P.sage}18,transparent)` }} />
      <Lbl>Trip Stops</Lbl>
      {(entry.stops || []).map(s => <div key={s.sid} style={{ fontSize: 10, padding: "3px 7px", background: `${P.sage}08`, borderRadius: 5, marginBottom: 3, display: "flex", justifyContent: "space-between" }}><span>{s.city}</span><button onClick={() => onChange(p => ({ ...p, stops: (p.stops || []).filter(st => st.sid !== s.sid) }))} style={{ background: "none", border: "none", color: "#c9777a", cursor: "pointer", fontSize: 11 }}>×</button></div>)}
      <div style={{ display: "flex", gap: 4, marginTop: 4, marginBottom: 10 }}>
        <input placeholder="City" value={ns.city} onChange={e => setNs(p => ({ ...p, city: e.target.value }))} style={{ ...inpSt, flex: 1 }} />
        <input placeholder="Lat" value={ns.lat} onChange={e => setNs(p => ({ ...p, lat: e.target.value }))} style={{ ...inpSt, width: 48 }} />
        <input placeholder="Lng" value={ns.lng} onChange={e => setNs(p => ({ ...p, lng: e.target.value }))} style={{ ...inpSt, width: 48 }} />
        <button disabled={!ns.city || !ns.lat} onClick={() => { onAddStop({ sid: `s-${Date.now()}`, city: ns.city, lat: parseFloat(ns.lat) || 0, lng: parseFloat(ns.lng) || 0, notes: ns.notes }); setNs({ city: "", lat: "", lng: "", notes: "" }); }} style={{ padding: "0 7px", background: P.sage, color: "#fff", border: "none", borderRadius: 4, cursor: "pointer", fontSize: 10 }}>+</button>
      </div>

      <div style={{ display: "flex", gap: 7 }}>
        <button onClick={onSave} style={{ flex: 1, padding: "8px 0", background: P.sage, color: "#fff", border: "none", borderRadius: 7, cursor: "pointer", fontSize: 10, fontFamily: "inherit" }}>Save</button>
        <button onClick={onClose} style={{ padding: "8px 12px", background: "transparent", border: "1px solid #e5e0d8", borderRadius: 7, cursor: "pointer", fontSize: 10, fontFamily: "inherit", color: P.textMuted }}>Cancel</button>
      </div>
      <button onClick={onDelete} style={{ marginTop: 7, width: "100%", padding: "6px 0", background: "transparent", color: "#c9777a", border: "1px solid #e5c5c6", borderRadius: 7, cursor: "pointer", fontSize: 9, fontFamily: "inherit" }}>Delete</button>
    </div>
  );
}
