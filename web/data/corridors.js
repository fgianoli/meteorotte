// Corridoi lungo i quali si calcola la griglia meteo (freddo, pioggia, vento, neve, caldo) oltre i punti critici.
// Sono tracciati MOLTO approssimativi tra località note, usati solo per decidere dove calcolare le previsioni:
// non descrivono percorsi. Da rivedere con le associazioni. Formato: elenco di linee [lat, lon].
(typeof window !== "undefined" ? window : globalThis).CORRIDORS = [
  [[43.79, 7.61], [43.94, 7.51], [44.09, 7.59]],                                                                   // Ventimiglia – Val Roja
  [[45.14, 7.05], [45.03, 6.83], [44.94, 6.75], [44.90, 6.64]],                                                    // Val di Susa – Monginevro – Briançon
  [[45.03, 6.83], [45.08, 6.70], [45.05, 6.64], [44.90, 6.64]],                                                    // Bardonecchia – Colle della Scala
  [[41.50, 26.56], [41.77, 26.20], [42.14, 24.75], [42.70, 23.32], [43.02, 22.78], [43.32, 21.90], [44.80, 20.47], [46.10, 19.67]], // Evros – Bulgaria – Serbia
  [[42.00, 27.52], [42.48, 26.50], [42.14, 24.75]],                                                                // Strandzha
  [[44.80, 20.47], [44.39, 19.10], [44.54, 18.67], [44.73, 18.09], [44.77, 17.19], [44.82, 15.87], [45.18, 15.81], [45.49, 15.55], [45.65, 15.32], [45.80, 15.17], [46.05, 14.51], [45.78, 14.21], [45.65, 13.77]], // Serbia – Bosnia – Croazia – Slovenia – Trieste
  [[44.82, 15.87], [44.88, 15.62], [45.42, 14.62], [45.33, 14.44], [45.65, 13.77]],                                // Bihać – Gorski kotar – Trieste
  [[45.78, 14.21], [45.94, 13.61]]                                                                                 // Postojna – Gorizia
];
