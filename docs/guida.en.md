# MeteoRotte – User guide

## 1. What it is

MeteoRotte flags weather-related dangers (floods, cold, snow and avalanches, wind, heat) in the places crossed by people on the move between Ventimiglia, the Alps, the Karst and the Balkan route. It is designed for aid workers and volunteers, who pass the warnings on.

**It is not a civil protection service.** Alerts are computed automatically and do not replace official warnings. Green does not mean safe.

## 2. Colours

- **Green**: no threshold exceeded in the next 72 hours.
- **Yellow**: be aware.
- **Orange**: danger, people should be warned.
- **Red**: severe danger.

Thresholds are more cautious than those used for the general public, because they are meant for people outdoors with no shelter.

## 3. The map

Circles are the critical points: the colour is the alert level, the icon is the main hazard. From the box at the top right (on a phone: the layers icon) you can turn on:

- **Official warnings by area**: Italian regions and French départements with a warning in force.
- **River gauges**: river level, with the border coloured by status.
- **Avalanche danger**: bulletin areas, European scale 1 to 5.
- **Weather stations**: measured temperature; tap for wind and snow depth.
- **Rain radar**, **wind**, **marked trails** (summer trails: not visible under snow), **free bivouacs and shelters**, **help points**.

Tap an area, a gauge or a station for details.

## 4. A point's card

Tap a point on the map or in the list to see:

- the **72-hour strip**: the expected level hour by hour, from now to three days ahead;
- **hours of darkness**, the value **measured** by the nearest weather station, and **river gauge** levels with thresholds;
- the list of **hazards**, when they start and the source;
- the **message** ready to forward and links to official warnings.

## 5. Messages and languages

Choose the language at the top (*Message language*). **Copy message** copies it for WhatsApp or Telegram; **Copy in all languages** copies them all. **Poster** opens a full-screen version to project or print, with the app's QR code.

Translations are drafts. Those flagged as unchecked (Wolof, Mandinka, Pulaar) must not be forwarded before a native speaker has checked them.

## 6. Proximity warnings

The button **Warn me if I am in a dangerous place** uses the phone's GPS: when you are near a critical point the warning appears and the phone vibrates. In a riverbed the warning always appears, even with no alert.

Your position stays on the phone: it is never sent or stored. It only works while the app is open.

## 7. Receiving alerts

- **Notifications** (bell button): an alert on the phone from orange upwards, for the selected area and language. On iPhone, add the app to the Home screen first.
- **Telegram bot**, for aid workers only: `/start code`, then `/zone`, `/iscrivi 1 3` or `/iscrivi tutte`, `/lingue it ar fa`, `/livello 2`. Other commands: `/stato`, `/punti`, `/punto name`, `/stop`. The same alert is not repeated for 12 hours. The bot replies in Italian.

## 8. Where the data come from

- Weather forecasts: Open-Meteo (ECMWF, DWD, Météo-France models), updated hourly.
- Rivers: gauges from ARPAL (Roja), Hub'Eau (French Roya), ARSO (Isonzo/Soča, Kolpa), checked every 5 minutes; GloFAS flood forecasts (Copernicus).
- Official warnings: MeteoAlarm and Météo-France Vigilance, every 5 minutes.
- Avalanches: AINEVA and Météo-France bulletins (in season).
- Weather stations: Météo-France, ARSO, DHMZ, ARPAL.
- Trails and bivouacs: OpenStreetMap.

The time of the last update is shown at the top. If a source does not respond, its name appears there.

## 9. Privacy

No accounts, no personal data, no access logs. Turning on notifications stores only the browser's technical address, the area and the language.

## 10. Limits to keep in mind

- There can be false alarms and unreported dangers: dam releases, local thunderstorms, avalanches.
- Coordinates, thresholds and translations need checking with people working on the ground.
- Avalanche bulletins exist only in season; out of season there is only an indicator derived from forecast snow.
- In danger call **112**.
