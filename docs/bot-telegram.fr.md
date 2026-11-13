# MeteoRotte – Le bot Telegram

Le bot envoie les alertes aux **équipes de terrain** (bénévoles, associations), qui décident de les relayer ou non. Il n'écrit jamais directement aux personnes en route. Les commandes et les réponses sont en italien.

## 1. Mettre le bot en service (une seule fois, par la personne qui gère le serveur)

1. Sur Telegram, ouvrez une discussion avec **@BotFather** et envoyez `/newbot`. Choisissez un nom et un identifiant se terminant par `bot`. BotFather répond avec un **jeton** (token).
2. Sur le serveur, modifiez `/opt/meteorotte/.env` :
   ```
   TELEGRAM_TOKEN=jeton-de-BotFather
   BOT_ACCESS_CODE=un-mot-de-votre-choix
   BOT_REPEAT_HOURS=12
   ```
   - `BOT_ACCESS_CODE` est le mot à donner uniquement aux équipes. S'il est vide, toute personne qui trouve le bot peut s'inscrire.
   - `BOT_REPEAT_HOURS` est le délai avant qu'une même alerte soit répétée.
3. Démarrez-le :
   ```bash
   cd /opt/meteorotte && sudo docker compose --profile bot up -d --build
   sudo docker compose logs bot | tail -3      # doit afficher "Bot avviato"
   ```

Le jeton est une clé : qui le possède contrôle le bot. En cas de fuite, régénérez-le avec BotFather (`/revoke`) et remplacez-le dans `.env`.

## 2. S'inscrire (chaque membre de l'équipe)

1. Cherchez le bot sur Telegram et ouvrez la discussion.
2. Envoyez `/start` suivi du code d'accès.
3. Envoyez `/zone` pour voir la liste numérotée des zones.
4. Choisissez les zones : `/iscrivi 1 3` ou `/iscrivi tutte` (toutes).
5. Choisissez les langues des messages : `/lingue fr ar fa`.
6. Choisissez le niveau minimal : `/livello 2` (1 jaune, 2 orange, 3 rouge). Par défaut : niveau 2, italien et anglais.

Le bot fonctionne aussi dans un **groupe** : ajoutez-le et utilisez les mêmes commandes.

## 3. Commandes

| Commande | Effet |
|---|---|
| `/start code` | active le bot pour cette discussion |
| `/zone` | liste des zones |
| `/iscrivi 1 3` · `/iscrivi tutte` | ajoute des zones |
| `/disiscrivi 2` · `/disiscrivi tutte` | retire des zones |
| `/lingue fr ar fa` | langues des messages (it en fr ar fa ps ur ti wo mnk ff) |
| `/livello 2` | niveau minimal |
| `/stato` | situation actuelle de vos zones |
| `/punti` | liste des points avec leur code |
| `/punto ventimiglia-roja` | message complet pour un point |
| `/stop` | supprime l'inscription |

## 4. Comment arrivent les alertes

- Le serveur recalcule les alertes toutes les 5 minutes ; le bot vérifie chaque minute.
- Quand un point de vos zones atteint votre niveau, vous recevez **un message pour ce point** : le texte prêt à transmettre dans chaque langue choisie, puis les **détails pour l'équipe** (la donnée qui a déclenché l'alerte et sa source).
- Le même danger au même niveau n'est pas répété pendant 12 heures. Si le niveau **monte**, l'alerte part aussitôt.
- Rien n'est envoyé à la fin d'une alerte : utilisez `/stato` pour vérifier.

Les traductions sont des brouillons ; le wolof, le mandinka et le pulaar ne sont pas vérifiés.

## 5. Gestion

- Le bot ne conserve que le numéro de la discussion, les zones, les langues et le niveau (`subs.json` dans le volume privé du serveur). Ni noms ni numéros de téléphone.
- Pour retirer quelqu'un : la personne envoie `/stop`, ou l'administrateur supprime son entrée de `subs.json` et redémarre le bot. Qui bloque le bot est retiré automatiquement.
- Changer `BOT_ACCESS_CODE` ne retire pas les personnes déjà inscrites.

## 6. En cas de problème

| Problème | Vérification |
|---|---|
| Le bot ne répond pas | `sudo docker compose ps` : le service `bot` doit tourner (il ne démarre qu'avec `--profile bot`) |
| Les journaux affichent « TELEGRAM_TOKEN mancante » | le jeton n'est pas dans `.env`, ou le bot n'a pas été redémarré |
| Il répond que le bot est réservé | il manque le code : `/start code` |
| Aucune alerte n'arrive | vérifiez `/stato` ; essayez `/livello 1` |
