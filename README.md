# CR3@TIX AI LIVE — V3.2.2

Plateforme PWA de découverte et de lecture de conférences sur l’intelligence artificielle.

La règle du catalogue est stricte : **pas intégrable = pas affiché**. La lecture YouTube ou Vimeo se fait dans une iframe vidéo dédiée et cloisonnée ; les fichiers MP4, WebM et les flux HLS sont lus par le lecteur HTML interne. L’interface ne contient aucun lien de sortie vers une plateforme vidéo.

## Fonctionnement

- Grand lecteur central, changement de conférence sans recharger l’application.
- Sections En direct, À venir, Replays, Nouveautés et Favoris.
- Recherche locale et filtres par langue, date, thème et source.
- Favoris stockés uniquement sur l’appareil.
- PWA installable, responsive et utilisable avec le dernier catalogue en cache.
- Catalogue de secours composé de conférences vérifiées et intégrables.
- Publication principale sur GitHub Pages, compatible avec le sous-chemin du dépôt.
- Découverte YouTube automatique durant le workflow quand `YOUTUBE_API_KEY` est configurée.
- Validation systématique avec `privacyStatus=public`, `uploadStatus=processed` et `embeddable=true`.
- Reconstruction et republication automatiques toutes les six heures par GitHub Actions.

## Architecture

```text
GitHub Actions (toutes les 6 h)
  ├── collecte YouTube Data API si le secret est disponible
  ├── relais temporaire vers le catalogue existant pendant la migration
  ├── validation → dédoublonnage → catalogue JSON statique
  └── build Vite → artefact → GitHub Pages

Navigateur
  ├── application servie par GitHub Pages
  ├── catalogue JSON statique actualisé
  ├── favoris locaux
  └── lecteur interne YouTube / Vimeo / HTML5 / HLS
```

La clé API n’est jamais accessible au navigateur. GitHub Actions la lit uniquement depuis le secret `YOUTUBE_API_KEY` et ne l’intègre pas au build.

## Développement

Prérequis : Node.js 24.

```bash
npm install
npm run dev
```

Vérification complète :

```bash
npm run check
```

## Publication GitHub Pages

Le workflow `.github/workflows/pages.yml` publie automatiquement la branche `main` et relance la collecte toutes les six heures. Le build utilise le chemin `/creatix-ai-live/`, y compris pour le manifeste, les icônes, le service worker et les catalogues.

Adresse de production attendue :

```text
https://kevinlabens-del.github.io/creatix-ai-live/
```

Pour rendre la collecte indépendante de l’ancien hébergement, ajouter dans les secrets GitHub Actions :

```text
YOUTUBE_API_KEY=<clé YouTube Data API v3>
```

En attendant ce transfert, le workflow récupère le catalogue déjà validé par l’ancien service au moment du build, puis l’intègre sous forme de fichier statique à GitHub Pages. L’application exécutée par les visiteurs reste servie par GitHub Pages.

## Ancienne configuration Netlify

Définir la variable secrète suivante dans les variables d’environnement du projet :

```text
YOUTUBE_API_KEY=<clé YouTube Data API v3>
```

Ne jamais utiliser le préfixe `VITE_` pour cette clé et ne jamais la placer dans `.env` versionné.

La configuration historique utilise :

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
