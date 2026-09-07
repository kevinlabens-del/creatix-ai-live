# CR3@TIX AI LIVE — V3

Plateforme PWA de découverte et de lecture de conférences sur l’intelligence artificielle.

La règle du catalogue est stricte : **pas intégrable = pas affiché**. La lecture YouTube ou Vimeo se fait dans une iframe vidéo dédiée et cloisonnée ; les fichiers MP4, WebM et les flux HLS sont lus par le lecteur HTML interne. L’interface ne contient aucun lien de sortie vers une plateforme vidéo.

## Fonctionnement

- Grand lecteur central, changement de conférence sans recharger l’application.
- Sections En direct, À venir, Replays, Nouveautés et Favoris.
- Recherche locale et filtres par langue, date, thème et source.
- Favoris stockés uniquement sur l’appareil.
- PWA installable, responsive et utilisable avec le dernier catalogue en cache.
- Catalogue de secours composé de conférences vérifiées et intégrables.
- Découverte YouTube automatique côté serveur quand `YOUTUBE_API_KEY` est configurée.
- Validation systématique avec `privacyStatus=public`, `uploadStatus=processed` et `embeddable=true`.
- Actualisation planifiée toutes les six heures et cache persistant Netlify Blobs.

## Architecture

```text
Navigateur
  ├── interface Vite + favoris locaux
  ├── lecteur interne YouTube / Vimeo / HTML5 / HLS
  └── GET /api/conferences
          └── Netlify Function
                ├── catalogue Netlify Blobs
                ├── validation YouTube Data API
                └── catalogue vérifié de secours

Netlify Scheduled Function (toutes les 6 h)
  └── recherche multi-requêtes → score → validation → dédoublonnage → cache
```

La clé API n’est jamais accessible au navigateur. Elle est lue uniquement par les fonctions via `Netlify.env.get("YOUTUBE_API_KEY")`.

## Développement

Prérequis : Node.js 20 ou plus récent.

```bash
npm install
npm run dev
```

Vérification complète :

```bash
npm run check
```

## Configuration Netlify

Définir la variable secrète suivante dans les variables d’environnement du projet :

```text
YOUTUBE_API_KEY=<clé YouTube Data API v3>
```

Ne jamais utiliser le préfixe `VITE_` pour cette clé et ne jamais la placer dans `.env` versionné.

Le déploiement utilise :

- commande de build : `npm run build` ;
- dossier publié : `dist` ;
- fonctions : `netlify/functions` ;
- endpoint public interne : `/api/conferences` ;
- tâche planifiée : `15 */6 * * *` (UTC).

## Contrôle des quotas

Chaque cycle parcourt une tranche tournante de six requêtes thématiques, plus une recherche de direct et une recherche d’événement programmé. Les détails sont récupérés par lots de 50. Le résultat est conservé côté serveur et n’est pas recalculé à chaque visite.

## Sécurité de lecture

- Aucune URL de page YouTube n’est envoyée au frontend.
- Les IDs YouTube et Vimeo sont validés avant création du lecteur.
- Les URLs de médias directs doivent obligatoirement utiliser HTTPS.
- Les iframes sont limitées aux lecteurs vidéo autorisés par la CSP.
- Leur sandbox interdit les fenêtres surgissantes et la navigation de la page principale.
- Les titres et descriptions distants sont injectés uniquement comme texte.
- Le service worker ignore tous les domaines distants et tous les flux vidéo.
