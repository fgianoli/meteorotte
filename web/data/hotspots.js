// Punti critici lungo le rotte. Coordinate APPROSSIMATIVE: da verificare con le associazioni sul posto.
// tipo: fiume | montagna | bosco | pianura | urbano
// flood: cella GloFAS sull'asta principale (tools/snap_glofas.py, da verificare); false = fiume non rappresentato in GloFAS
// meteoalarm: feed nazionale e nomi delle aree MeteoAlarm (i nomi compaiono nel feed solo quando c'è un'allerta: da verificare)
// hubeau: stazioni idrometriche francesi in tempo reale (Hub'Eau / Vigicrues): Roya a Breil, Saorge, Tenda
// eaws: micro-regioni EAWS dei bollettini valanghe (IT-21 = AINEVA/Arpa Piemonte, FR = Météo-France); quota: altitudine del valico percorso
// omirl: idrometri ARPAL sul Roja italiano (Ventimiglia Ponte Aniante, Torri, Airole) con soglie ufficiali; arso: idrometri sloveni (Soča a Solkan, Kolpa) con soglie di piena
// vigilance: dipartimento francese della Vigilance Météo-France (06 Alpes-Maritimes, 05 Hautes-Alpes); fen = solo questi fenomeni (2 pioggia, 4 piene, 5 neve, 7 freddo, 8 valanghe)
// upstream: punti a monte nel bacino (per la pioggia che arriva dall'alto e per le piene improvvise)
window.LINKS = {
  IT: [["Protezione Civile", "https://www.protezionecivile.gov.it"], ["Allerta Liguria", "https://allertaliguria.regione.liguria.it"], ["Arpa Piemonte", "https://www.arpa.piemonte.it"], ["Protezione Civile FVG", "https://www.protezionecivile.fvg.it"], ["Bollettini valanghe AINEVA", "https://bollettini.aineva.it"]],
  FR: [["Vigilance Météo-France", "https://vigilance.meteofrance.fr"], ["Vigicrues", "https://www.vigicrues.gouv.fr"], ["Météo montagne / BRA", "https://meteofrance.com/meteo-montagne"]],
  SI: [["ARSO meteo", "https://meteo.arso.gov.si"]],
  HR: [["DHMZ meteo.hr", "https://meteo.hr"]],
  BA: [["FHMZ BiH", "https://www.fhmzbih.gov.ba"]],
  RS: [["RHMZ Srbije", "https://www.hidmet.gov.rs"]],
  GR: [["EMY", "https://www.emy.gr"]],
  BG: [["NIMH meteo.bg", "https://www.meteo.bg"]],
  ALL: [["MeteoAlarm (Europa)", "https://meteoalarm.org"]]
};
window.EMERGENCY = { IT: "112", FR: "112", SI: "112", HR: "112", BA: "112 / 124 (ambulanza) / 122 (polizia)", RS: "112 / 194 (ambulanza)", GR: "112", BG: "112" };

window.HOTSPOTS = [
  // --- Liguria / Alpi Marittime
  { id: "ventimiglia-roja", vigilance: { dep: "06", fen: [2, 4] }, omirl: ["XXMPA", "TORRI", "AIROL"], meteoalarm: { feed: "italy", aree: ["Liguria"] }, hubeau: ["Y662000301", "Y662000401", "Y660000201"], nome: "Ventimiglia – alveo del Roja", regione: "Liguria / Alpi Marittime", paese: "IT", tipo: "fiume", lat: 43.7905, lon: 7.6075, flood: false,
    upstream: [[43.937, 7.514], [44.060, 7.590]], note: "Accampamenti sotto i ponti e nel letto del fiume. Piene improvvise da piogge sulla Val Roja francese." },
  { id: "grimaldi", meteoalarm: { feed: "italy", aree: ["Liguria"] }, nome: "Grimaldi – sentiero del «Passo della morte»", regione: "Liguria / Alpi Marittime", paese: "IT", tipo: "montagna", lat: 43.788, lon: 7.539, note: "Sentiero ripido verso Mentone; pericoloso con pioggia e di notte." },
  { id: "breil-roya", vigilance: { dep: "06" }, meteoalarm: { feed: "france", aree: ["Alpes-Maritimes"] }, hubeau: ["Y662000301", "Y662000401", "Y660000201"], nome: "Breil-sur-Roya – Val Roja", regione: "Liguria / Alpi Marittime", paese: "FR", tipo: "fiume", lat: 43.937, lon: 7.514, flood: false, upstream: [[44.060, 7.590]], note: "Valle colpita dalla tempesta Alex (2020)." },
  // --- Alpi occidentali
  { id: "oulx", eaws: ["IT-21-TO-03"], quota: 1850, meteoalarm: { feed: "italy", aree: ["Piemonte"] }, nome: "Oulx", regione: "Alpi occidentali (Val di Susa – Briançonnais)", paese: "IT", tipo: "montagna", lat: 45.033, lon: 6.833, note: "Punto di partenza verso Monginevro e Colle della Scala." },
  { id: "claviere-monginevro", vigilance: { dep: "05", fen: [5, 7, 8] }, eaws: ["IT-21-TO-03", "FR-13"], quota: 1850, meteoalarm: { feed: "italy", aree: ["Piemonte"] }, nome: "Claviere – Monginevro", regione: "Alpi occidentali (Val di Susa – Briançonnais)", paese: "IT", tipo: "montagna", lat: 44.937, lon: 6.749, note: "Valico ~1850 m; attraversamenti notturni su piste e sentieri innevati." },
  { id: "colle-scala", dpc: "Piem-D", vigilance: { dep: "05", fen: [5, 7, 8] }, eaws: ["IT-21-TO-03", "FR-13"], quota: 1760, meteoalarm: { feed: "italy", aree: ["Piemonte"] }, nome: "Bardonecchia – Colle della Scala", regione: "Alpi occidentali (Val di Susa – Briançonnais)", paese: "IT", tipo: "montagna", lat: 45.050, lon: 6.640, note: "Colle ~1760 m, esposto a valanghe in inverno." },
  { id: "briancon", vigilance: { dep: "05" }, eaws: ["FR-13"], quota: 1850, meteoalarm: { feed: "france", aree: ["Hautes Alpes", "Hautes-Alpes"] }, nome: "Briançon", regione: "Alpi occidentali (Val di Susa – Briançonnais)", paese: "FR", tipo: "montagna", lat: 44.899, lon: 6.643, note: "Arrivo dopo il valico; rifugi solidali." },
  // --- Carso / Friuli Venezia Giulia
  { id: "basovizza", meteoalarm: { feed: "italy", aree: ["Friuli Venezia Giulia"] }, nome: "Carso – Basovizza / Draga", regione: "Carso / Friuli Venezia Giulia", paese: "IT", tipo: "bosco", lat: 45.630, lon: 13.860, note: "Arrivi a piedi dalla Slovenia attraverso il bosco; bora molto forte in inverno." },
  { id: "fernetti", meteoalarm: { feed: "italy", aree: ["Friuli Venezia Giulia"] }, nome: "Carso – Fernetti / Monrupino", regione: "Carso / Friuli Venezia Giulia", paese: "IT", tipo: "bosco", lat: 45.703, lon: 13.795, note: "Altopiano esposto alla bora." },
  { id: "trieste", meteoalarm: { feed: "italy", aree: ["Friuli Venezia Giulia"] }, nome: "Trieste – piazza Libertà", regione: "Carso / Friuli Venezia Giulia", paese: "IT", tipo: "urbano", lat: 45.657, lon: 13.773, note: "Persone che dormono all'aperto vicino alla stazione." },
  { id: "gorizia-isonzo", arso: ["8180"], meteoalarm: { feed: "italy", aree: ["Friuli Venezia Giulia"] }, nome: "Gorizia – Isonzo", regione: "Carso / Friuli Venezia Giulia", paese: "IT", tipo: "fiume", lat: 45.940, lon: 13.610, flood: [45.94, 13.51], upstream: [[46.185, 13.735], [46.335, 13.555]], note: "Isonzo soggetto a piene rapide." },
  // --- Slovenia / Croazia
  { id: "kolpa-vinica", arso: ["4828", "4820"], meteoalarm: { feed: "slovenia", aree: ["Kolpa", "Slovenia / South-East"] }, nome: "Kolpa/Kupa – Vinica", regione: "Slovenia / Croazia", paese: "SI", tipo: "fiume", lat: 45.455, lon: 15.250, flood: [45.555, 15.25], upstream: [[45.480, 14.840]], note: "Confine fluviale: annegamenti durante gli attraversamenti." },
  { id: "kolpa-metlika", arso: ["4860"], meteoalarm: { feed: "slovenia", aree: ["Kolpa", "Slovenia / South-East"] }, nome: "Kolpa/Kupa – Metlika", regione: "Slovenia / Croazia", paese: "SI", tipo: "fiume", lat: 45.645, lon: 15.315, flood: [45.645, 15.415], upstream: [[45.455, 15.250], [45.480, 14.840]], note: "Confine fluviale." },
  { id: "gorski-kotar", meteoalarm: { feed: "croatia", aree: ["Primorsko-goranska"] }, nome: "Gorski kotar", regione: "Slovenia / Croazia", paese: "HR", tipo: "bosco", lat: 45.420, lon: 14.620, note: "Foreste in quota, freddo e neve precoci." },
  { id: "korana", meteoalarm: { feed: "croatia", aree: ["Karlovačka"] }, nome: "Korana – Slunj / Rakovica", regione: "Slovenia / Croazia", paese: "HR", tipo: "fiume", lat: 45.115, lon: 15.590, flood: [45.215, 15.49], upstream: [[44.880, 15.620]], note: "Area di attraversamento dopo il confine bosniaco." },
  // --- Bosnia-Erzegovina
  { id: "bihac-una", meteoalarm: { feed: "bosnia-herzegovina", aree: ["Bihac"] }, nome: "Bihać – fiume Una", regione: "Bosnia-Erzegovina", paese: "BA", tipo: "fiume", lat: 44.816, lon: 15.870, flood: [44.916, 15.97], upstream: [[44.560, 16.090], [44.490, 16.140]], note: "Campi informali e accampamenti lungo il fiume." },
  { id: "velika-kladusa", meteoalarm: { feed: "bosnia-herzegovina", aree: ["Bihac"] }, nome: "Velika Kladuša", regione: "Bosnia-Erzegovina", paese: "BA", tipo: "bosco", lat: 45.184, lon: 15.806, note: "Partenze per «il game» verso la Croazia." },
  { id: "pljesevica", meteoalarm: { feed: "bosnia-herzegovina", aree: ["Bihac"] }, nome: "Monte Plješevica (confine)", regione: "Bosnia-Erzegovina", paese: "BA", tipo: "montagna", lat: 44.700, lon: 15.750, note: "Rilievo ~1600 m sul confine, campi minati residui in zona." },
  { id: "drina-zvornik", meteoalarm: { feed: "bosnia-herzegovina", aree: ["Tuzla"] }, nome: "Drina – Zvornik", regione: "Bosnia-Erzegovina", paese: "BA", tipo: "fiume", lat: 44.390, lon: 19.100, flood: [44.49, 19.05], upstream: [[43.780, 19.290]], note: "Confine fluviale con la Serbia, annegamenti frequenti." },
  // --- Serbia / Bulgaria / Grecia
  { id: "subotica", meteoalarm: { feed: "serbia", aree: ["Backa", "Bačka", "North Backa"] }, nome: "Subotica – Horgoš (confine HU)", regione: "Serbia / Bulgaria / Grecia", paese: "RS", tipo: "pianura", lat: 46.140, lon: 19.900, note: "Pianura esposta, freddo intenso e caldo estremo d'estate." },
  { id: "strandzha", meteoalarm: { feed: "bulgaria", aree: ["Burgas"] }, nome: "Strandzha – Malko Tarnovo", regione: "Serbia / Bulgaria / Grecia", paese: "BG", tipo: "bosco", lat: 42.000, lon: 27.520, note: "Foreste di confine con la Turchia; morti per ipotermia." },
  { id: "evros", meteoalarm: { feed: "greece", aree: ["Evros", "Thraki", "Thrace", "East Macedonia and Thrace"] }, nome: "Evros/Meriç – Orestiada", regione: "Serbia / Bulgaria / Grecia", paese: "GR", tipo: "fiume", lat: 41.500, lon: 26.560, flood: [41.55, 26.51], upstream: [[41.680, 26.560], [42.000, 25.900]], note: "Fiume di confine con la Turchia; annegamenti e caldo estremo." }
];
